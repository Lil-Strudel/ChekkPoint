import "@tanstack/solid-start/server-only";
import { getRequestHeaders } from "@tanstack/solid-start/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
	entrants,
	eventGroupStaff,
	eventGroupStaffTimingPoints,
	eventGroups,
	events,
	organizations,
	people,
	personExternalProfiles,
	RulesConfigSchema,
	timingPoints,
} from "../db/schema";
import { auth } from "./auth.server";
import { ForbiddenError } from "./permissions.server";
import { type Viewer, loadAuthOptions } from "./session.server";

export async function loadAccountOverview(viewer: Viewer) {
	const headers = getRequestHeaders();
	const [passkeys, accounts, sessions] = await Promise.all([
		auth.api.listPasskeys({ headers }),
		auth.api.listUserAccounts({ headers }),
		auth.api.listSessions({ headers }),
	]);

	let personRecord = null;
	let externalProfiles: Array<{
		id: string;
		platform: string;
		externalIdentifier: string;
		profileUrl: string | null;
		verificationStatus: string;
	}> = [];
	let myRaces: Array<{
		id: string;
		competitorNumber: string;
		status: string;
		checkedInAt: Date | null;
		eventId: string;
		eventName: string;
		scheduledStart: Date | null;
		eventGroupId: string;
		eventGroupName: string;
		eventGroupSlug: string;
		organizationName: string;
		organizationSlug: string;
		allowSelfCheckIn: boolean;
	}> = [];
	let myVolunteerShifts: Array<{
		staffId: string;
		roles: string[];
		eventGroupId: string;
		eventGroupName: string;
		eventGroupSlug: string;
		startDate: Date;
		organizationName: string;
		organizationSlug: string;
		timingPoints: Array<{ id: string; name: string; code: string }>;
	}> = [];

	if (viewer.person?.id) {
		const [p] = await db
			.select({
				id: people.id,
				firstName: people.firstName,
				lastName: people.lastName,
				gender: people.gender,
				birthdate: people.birthdate,
				phone: people.phone,
				address: people.address,
				email: people.email,
			})
			.from(people)
			.where(eq(people.id, viewer.person.id));
		personRecord = p ?? null;

		externalProfiles = await db
			.select({
				id: personExternalProfiles.id,
				platform: personExternalProfiles.platform,
				externalIdentifier: personExternalProfiles.externalIdentifier,
				profileUrl: personExternalProfiles.profileUrl,
				verificationStatus: personExternalProfiles.verificationStatus,
			})
			.from(personExternalProfiles)
			.where(eq(personExternalProfiles.personId, viewer.person.id));

		const races = await db
			.select({
				id: entrants.id,
				competitorNumber: entrants.competitorNumber,
				status: entrants.status,
				checkedInAt: entrants.checkedInAt,
				eventId: events.id,
				eventName: events.name,
				scheduledStart: events.scheduledStart,
				eventGroupId: eventGroups.id,
				eventGroupName: eventGroups.name,
				eventGroupSlug: eventGroups.slug,
				organizationName: organizations.name,
				organizationSlug: organizations.slug,
				rulesConfig: eventGroups.rulesConfig,
			})
			.from(entrants)
			.innerJoin(events, eq(events.id, entrants.eventId))
			.innerJoin(eventGroups, eq(eventGroups.id, events.eventGroupId))
			.innerJoin(organizations, eq(organizations.id, eventGroups.organizationId))
			.where(eq(entrants.personId, viewer.person.id))
			.orderBy(desc(events.scheduledStart));

		myRaces = races.map((r) => {
			const rules = RulesConfigSchema.parse(r.rulesConfig ?? {});
			return {
				id: r.id,
				competitorNumber: r.competitorNumber,
				status: r.status,
				checkedInAt: r.checkedInAt,
				eventId: r.eventId,
				eventName: r.eventName,
				scheduledStart: r.scheduledStart,
				eventGroupId: r.eventGroupId,
				eventGroupName: r.eventGroupName,
				eventGroupSlug: r.eventGroupSlug,
				organizationName: r.organizationName,
				organizationSlug: r.organizationSlug,
				allowSelfCheckIn: rules.allowSelfCheckIn,
			};
		});

		const staffRows = await db
			.select({
				staffId: eventGroupStaff.id,
				roles: eventGroupStaff.roles,
				eventGroupId: eventGroups.id,
				eventGroupName: eventGroups.name,
				eventGroupSlug: eventGroups.slug,
				startDate: eventGroups.startDate,
				organizationName: organizations.name,
				organizationSlug: organizations.slug,
			})
			.from(eventGroupStaff)
			.innerJoin(eventGroups, eq(eventGroups.id, eventGroupStaff.eventGroupId))
			.innerJoin(organizations, eq(organizations.id, eventGroups.organizationId))
			.where(eq(eventGroupStaff.personId, viewer.person.id))
			.orderBy(desc(eventGroups.startDate));

		const staffIds = staffRows.map((s) => s.staffId);
		const pointsByStaff: Record<
			string,
			Array<{ id: string; name: string; code: string }>
		> = {};

		if (staffIds.length > 0) {
			const assignedPoints = await db
				.select({
					staffId: eventGroupStaffTimingPoints.staffId,
					timingPointId: timingPoints.id,
					name: timingPoints.name,
					code: timingPoints.code,
				})
				.from(eventGroupStaffTimingPoints)
				.innerJoin(
					timingPoints,
					eq(timingPoints.id, eventGroupStaffTimingPoints.timingPointId),
				)
				.where(inArray(eventGroupStaffTimingPoints.staffId, staffIds));

			for (const pt of assignedPoints) {
				if (!pointsByStaff[pt.staffId]) pointsByStaff[pt.staffId] = [];
				pointsByStaff[pt.staffId].push({
					id: pt.timingPointId,
					name: pt.name,
					code: pt.code,
				});
			}
		}

		myVolunteerShifts = staffRows.map((s) => ({
			staffId: s.staffId,
			roles: s.roles,
			eventGroupId: s.eventGroupId,
			eventGroupName: s.eventGroupName,
			eventGroupSlug: s.eventGroupSlug,
			startDate: s.startDate,
			organizationName: s.organizationName,
			organizationSlug: s.organizationSlug,
			timingPoints: pointsByStaff[s.staffId] ?? [],
		}));
	}

	return {
		providers: loadAuthOptions(),
		person: personRecord,
		externalProfiles,
		myRaces,
		myVolunteerShifts,
		passkeys: passkeys.map((p) => ({
			id: p.id,
			name: p.name ?? null,
			createdAt: p.createdAt,
		})),
		accounts: accounts.map((a) => ({ id: a.id, providerId: a.providerId })),
		sessions: sessions.map((s) => ({
			token: s.token,
			userAgent: s.userAgent ?? null,
			createdAt: s.createdAt,
		})),
	};
}

export async function athleteSelfCheckIn(viewer: Viewer, entrantId: string) {
	if (!viewer.person?.id) throw new ForbiddenError();

	const [entrant] = await db
		.select({
			id: entrants.id,
			personId: entrants.personId,
			status: entrants.status,
			rulesConfig: eventGroups.rulesConfig,
		})
		.from(entrants)
		.innerJoin(events, eq(events.id, entrants.eventId))
		.innerJoin(eventGroups, eq(eventGroups.id, events.eventGroupId))
		.where(eq(entrants.id, entrantId));

	if (!entrant || entrant.personId !== viewer.person.id) {
		throw new ForbiddenError();
	}

	const rules = RulesConfigSchema.parse(entrant.rulesConfig ?? {});
	if (!rules.allowSelfCheckIn) {
		throw new Error("Athlete self check-in is not enabled for this race.");
	}
	if (entrant.status !== "registered") {
		throw new Error(
			`Cannot self check-in: current entrant status is '${entrant.status}'.`,
		);
	}

	await db
		.update(entrants)
		.set({
			status: "checked_in",
			checkedInAt: new Date(),
		})
		.where(eq(entrants.id, entrantId));
}
