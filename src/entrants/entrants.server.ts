import "@tanstack/solid-start/server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { z } from "zod";
import { orgRolesCan } from "../auth/access";
import { findOrCreatePerson } from "../auth/people.server";
import {
	ForbiddenError,
	getEventGroupAccess,
	requireOrgPermission,
} from "../auth/permissions.server";
import type { Viewer } from "../auth/session.server";
import { db, type Tx } from "../db";
import { withConstraintMessages } from "../db/errors.server";
import {
	courseSplits,
	entrants,
	eventGroups,
	events,
	people,
} from "../db/schema";
import { zonedLocalToUtc } from "../lib/zoned-time";
import type {
	createEntrantInput,
	emergencyContactInput,
	entrantIdInput,
	importEntrantsInput,
	updateEntrantInput,
} from "./entrants.shared";

const entrantConstraints = {
	entrants_event_competitor_idx: "That bib is already taken in this event.",
};

const emergencyContacts = alias(people, "emergency_contacts");

export async function getEntrantsPage(viewer: Viewer, eventGroupId: string) {
	const access = await getEventGroupAccess(viewer, eventGroupId);
	if (!access || access.orgRoles.length === 0) return null;

	const [rows, splits] = await Promise.all([
		db
			.select({
				id: entrants.id,
				eventId: entrants.eventId,
				eventName: events.name,
				competitorNumber: entrants.competitorNumber,
				rfidCode: entrants.rfidCode,
				status: entrants.status,
				division: entrants.division,
				participantData: entrants.participantData,
				scheduledStartTime: entrants.scheduledStartTime,
				actualStartTime: entrants.actualStartTime,
				droppedSplitId: entrants.droppedSplitId,
				dropReason: entrants.dropReason,
				dropLocationDescription: entrants.dropLocationDescription,
				comments: entrants.comments,
				emergencyContactRelationship: entrants.emergencyContactRelationship,
				emergencyContactIsOnSite: entrants.emergencyContactIsOnSite,
				person: {
					id: people.id,
					firstName: people.firstName,
					lastName: people.lastName,
					email: people.email,
					gender: people.gender,
					birthdate: people.birthdate,
					phone: people.phone,
					userId: people.userId,
				},
				emergencyContactFirstName: emergencyContacts.firstName,
				emergencyContactLastName: emergencyContacts.lastName,
				emergencyContactPhone: emergencyContacts.phone,
			})
			.from(entrants)
			.innerJoin(events, eq(events.id, entrants.eventId))
			.innerJoin(people, eq(people.id, entrants.personId))
			.leftJoin(
				emergencyContacts,
				eq(emergencyContacts.id, entrants.emergencyContactPersonId),
			)
			.where(eq(events.eventGroupId, eventGroupId))
			.orderBy(asc(events.scheduledStart), asc(entrants.competitorNumber)),
		db
			.select({
				eventId: events.id,
				id: courseSplits.id,
				name: courseSplits.name,
			})
			.from(courseSplits)
			.innerJoin(events, eq(events.courseId, courseSplits.courseId))
			.where(eq(events.eventGroupId, eventGroupId))
			.orderBy(asc(courseSplits.sequenceOrder)),
	]);

	return {
		can: {
			create: orgRolesCan(access.orgRoles, "entrant", "create"),
			update: orgRolesCan(access.orgRoles, "entrant", "update"),
			delete: orgRolesCan(access.orgRoles, "entrant", "delete"),
		},
		entrants: rows.map(
			({
				emergencyContactFirstName,
				emergencyContactLastName,
				emergencyContactPhone,
				emergencyContactRelationship,
				emergencyContactIsOnSite,
				...entrant
			}) => ({
				...entrant,
				emergencyContact:
					emergencyContactFirstName === null
						? null
						: {
								name: `${emergencyContactFirstName} ${emergencyContactLastName ?? ""}`.trim(),
								phone: emergencyContactPhone,
								relationship: emergencyContactRelationship,
								isOnSite: emergencyContactIsOnSite,
							},
			}),
		),
		splits,
	};
}

async function requireEventPermission(
	viewer: Viewer,
	eventId: string,
	action: "create" | "update" | "delete",
) {
	const [event] = await db
		.select({
			organizationId: eventGroups.organizationId,
			eventGroupId: eventGroups.id,
			timeZone: eventGroups.timeZone,
			courseId: events.courseId,
		})
		.from(events)
		.innerJoin(eventGroups, eq(eventGroups.id, events.eventGroupId))
		.where(eq(events.id, eventId));
	if (!event) throw new ForbiddenError();
	await requireOrgPermission(viewer, event.organizationId, "entrant", action);
	return event;
}

async function requireSplitOnCourse(courseId: string, splitId: string | null) {
	if (!splitId) return;
	const [split] = await db
		.select({ id: courseSplits.id })
		.from(courseSplits)
		.where(
			and(eq(courseSplits.id, splitId), eq(courseSplits.courseId, courseId)),
		);
	if (!split)
		throw new ForbiddenError("That split isn't on this event's course");
}

function splitName(name: string) {
	const [firstName, ...rest] = name.trim().split(/\s+/);
	return { firstName, lastName: rest.join(" ") };
}

async function createEmergencyContact(
	tx: Tx,
	contact: z.infer<typeof emergencyContactInput> | null,
) {
	if (!contact) return null;
	const [person] = await tx
		.insert(people)
		.values({ ...splitName(contact.name), phone: contact.phone })
		.returning({ id: people.id });
	return person.id;
}

function entrantValues(
	data: z.infer<typeof createEntrantInput>,
	timeZone: string,
) {
	const toUtc = (local: string | null) =>
		local ? zonedLocalToUtc(local, timeZone) : null;
	return {
		eventId: data.eventId,
		competitorNumber: data.competitorNumber,
		rfidCode: data.rfidCode,
		division: data.division,
		status: data.status,
		participantData: data.participantData,
		emergencyContactRelationship: data.emergencyContact?.relationship ?? null,
		emergencyContactIsOnSite: data.emergencyContact?.isOnSite ?? false,
		scheduledStartTime: toUtc(data.scheduledStartTime),
		actualStartTime: toUtc(data.actualStartTime),
		droppedSplitId: data.droppedSplitId,
		dropReason: data.dropReason,
		dropLocationDescription: data.dropLocationDescription,
		comments: data.comments,
	};
}

export async function createEntrant(
	viewer: Viewer,
	data: z.infer<typeof createEntrantInput>,
) {
	const event = await requireEventPermission(viewer, data.eventId, "create");
	await requireSplitOnCourse(event.courseId, data.droppedSplitId);
	return withConstraintMessages(entrantConstraints, () =>
		db.transaction(async (tx) => {
			const personId = await findOrCreatePerson(tx, data.person);
			const emergencyContactPersonId = await createEmergencyContact(
				tx,
				data.emergencyContact,
			);
			const [entrant] = await tx
				.insert(entrants)
				.values({
					...entrantValues(data, event.timeZone),
					personId,
					emergencyContactPersonId,
				})
				.returning({ id: entrants.id });
			return entrant;
		}),
	);
}

async function requireEntrant(
	viewer: Viewer,
	entrantId: string,
	action: "update" | "delete",
) {
	const [entrant] = await db
		.select({
			eventId: entrants.eventId,
			personId: entrants.personId,
			emergencyContactPersonId: entrants.emergencyContactPersonId,
		})
		.from(entrants)
		.where(eq(entrants.id, entrantId));
	if (!entrant) throw new ForbiddenError();
	const event = await requireEventPermission(viewer, entrant.eventId, action);
	return { ...entrant, event };
}

export async function updateEntrant(
	viewer: Viewer,
	{ entrantId, ...data }: z.infer<typeof updateEntrantInput>,
) {
	const entrant = await requireEntrant(viewer, entrantId, "update");
	const target =
		data.eventId === entrant.eventId
			? entrant.event
			: await requireEventPermission(viewer, data.eventId, "update");
	if (target.eventGroupId !== entrant.event.eventGroupId) {
		throw new ForbiddenError(
			"Entrants can only move between events in a group",
		);
	}
	await requireSplitOnCourse(target.courseId, data.droppedSplitId);

	await withConstraintMessages(entrantConstraints, () =>
		db.transaction(async (tx) => {
			// Someone who signed up owns their own name and contact details.
			await tx
				.update(people)
				.set(data.person)
				.where(and(eq(people.id, entrant.personId), isNull(people.userId)));

			let emergencyContactPersonId = entrant.emergencyContactPersonId;
			if (!data.emergencyContact) {
				emergencyContactPersonId = null;
			} else if (emergencyContactPersonId) {
				await tx
					.update(people)
					.set({
						...splitName(data.emergencyContact.name),
						phone: data.emergencyContact.phone,
					})
					.where(
						and(eq(people.id, emergencyContactPersonId), isNull(people.userId)),
					);
			} else {
				emergencyContactPersonId = await createEmergencyContact(
					tx,
					data.emergencyContact,
				);
			}

			await tx
				.update(entrants)
				.set({
					...entrantValues(data, target.timeZone),
					emergencyContactPersonId,
				})
				.where(eq(entrants.id, entrantId));
		}),
	);
}

export async function deleteEntrant(
	viewer: Viewer,
	data: z.infer<typeof entrantIdInput>,
) {
	await requireEntrant(viewer, data.entrantId, "delete");
	await db.delete(entrants).where(eq(entrants.id, data.entrantId));
}

export async function importEntrants(
	viewer: Viewer,
	data: z.infer<typeof importEntrantsInput>,
) {
	await requireEventPermission(viewer, data.eventId, "create");

	const bibs = data.rows.map((r) => r.competitorNumber);
	const repeated = bibs.filter((bib, i) => bibs.indexOf(bib) !== i);
	if (repeated.length > 0) {
		throw new Error(
			`Bibs appear more than once in the file: ${[...new Set(repeated)].join(", ")}`,
		);
	}
	const taken = await db
		.select({ bib: entrants.competitorNumber })
		.from(entrants)
		.where(
			and(
				eq(entrants.eventId, data.eventId),
				inArray(entrants.competitorNumber, bibs),
			),
		);
	if (taken.length > 0) {
		throw new Error(
			`Bibs already taken in this event: ${taken.map((t) => t.bib).join(", ")}`,
		);
	}

	return withConstraintMessages(entrantConstraints, () =>
		db.transaction(async (tx) => {
			for (const row of data.rows) {
				const personId = await findOrCreatePerson(tx, row.person);
				const emergencyContactPersonId = await createEmergencyContact(
					tx,
					row.emergencyContact,
				);
				await tx.insert(entrants).values({
					eventId: data.eventId,
					personId,
					competitorNumber: row.competitorNumber,
					rfidCode: row.rfidCode,
					division: row.division,
					participantData: { kind: "solo_competitor" },
					emergencyContactPersonId,
					emergencyContactRelationship:
						row.emergencyContact?.relationship ?? null,
				});
			}
			return { imported: data.rows.length };
		}),
	);
}
