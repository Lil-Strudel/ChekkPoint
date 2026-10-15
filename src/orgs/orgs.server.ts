import "@tanstack/solid-start/server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { orgRolesCan } from "../auth/access";
import {
	canManageStaff,
	canRecordAt,
	ForbiddenError,
	getEventGroupAccess,
	getOrgRoles,
	requireOrgPermission,
} from "../auth/permissions.server";
import type { Viewer } from "../auth/session.server";
import { db } from "../db";
import {
	eventGroupStaff,
	eventGroupStaffTimingPoints,
	eventGroups,
	organizationInvitations,
	organizationMembers,
	organizations,
	people,
	RulesConfigSchema,
	rawTimingEvents,
	timingPoints,
	users,
} from "../db/schema";
import type {
	assignStaffInput,
	createEventGroupInput,
	createTimingPointInput,
	recordTimeInput,
	removeStaffInput,
} from "./orgs.shared";
import { slugify } from "./orgs.shared";

export async function listMyOrganizations(viewer: Viewer) {
	const memberships = await db
		.select({
			id: organizations.id,
			name: organizations.name,
			slug: organizations.slug,
			role: organizationMembers.role,
		})
		.from(organizationMembers)
		.innerJoin(
			organizations,
			eq(organizations.id, organizationMembers.organizationId),
		)
		.where(eq(organizationMembers.userId, viewer.user.id))
		.orderBy(asc(organizations.name));

	const staffing = viewer.person
		? await db
				.select({
					eventGroupId: eventGroups.id,
					eventGroupName: eventGroups.name,
					organizationName: organizations.name,
					roles: eventGroupStaff.roles,
				})
				.from(eventGroupStaff)
				.innerJoin(
					eventGroups,
					eq(eventGroups.id, eventGroupStaff.eventGroupId),
				)
				.innerJoin(
					organizations,
					eq(organizations.id, eventGroups.organizationId),
				)
				.where(eq(eventGroupStaff.personId, viewer.person.id))
				.orderBy(desc(eventGroups.startDate))
		: [];

	return { memberships, staffing };
}

export async function getOrganizationOverview(viewer: Viewer, slug: string) {
	const [org] = await db
		.select({
			id: organizations.id,
			name: organizations.name,
			slug: organizations.slug,
		})
		.from(organizations)
		.where(eq(organizations.slug, slug));
	if (!org) return null;

	const myRoles = await getOrgRoles(viewer.user.id, org.id);
	if (myRoles.length === 0) return null;

	const can = {
		invite: orgRolesCan(myRoles, "invitation", "create"),
		updateMembers: orgRolesCan(myRoles, "member", "update"),
		createEventGroup: orgRolesCan(myRoles, "eventGroup", "create"),
		createTimingPoint: orgRolesCan(myRoles, "timingPoint", "create"),
	};

	const [members, invitations, groups, points] = await Promise.all([
		db
			.select({
				id: organizationMembers.id,
				userId: users.id,
				name: users.name,
				email: users.email,
				role: organizationMembers.role,
			})
			.from(organizationMembers)
			.innerJoin(users, eq(users.id, organizationMembers.userId))
			.where(eq(organizationMembers.organizationId, org.id))
			.orderBy(asc(users.name)),
		can.invite
			? db
					.select({
						id: organizationInvitations.id,
						email: organizationInvitations.email,
						role: organizationInvitations.role,
						expiresAt: organizationInvitations.expiresAt,
					})
					.from(organizationInvitations)
					.where(
						and(
							eq(organizationInvitations.organizationId, org.id),
							eq(organizationInvitations.status, "pending"),
						),
					)
			: Promise.resolve([]),
		db
			.select({
				id: eventGroups.id,
				name: eventGroups.name,
				discipline: eventGroups.discipline,
				startDate: eventGroups.startDate,
				endDate: eventGroups.endDate,
			})
			.from(eventGroups)
			.where(eq(eventGroups.organizationId, org.id))
			.orderBy(desc(eventGroups.startDate)),
		db
			.select({
				id: timingPoints.id,
				name: timingPoints.name,
				code: timingPoints.code,
			})
			.from(timingPoints)
			.where(eq(timingPoints.organizationId, org.id))
			.orderBy(asc(timingPoints.code)),
	]);

	return {
		organization: org,
		myRoles,
		can,
		members,
		invitations,
		eventGroups: groups,
		timingPoints: points,
	};
}

export async function createEventGroup(
	viewer: Viewer,
	data: z.infer<typeof createEventGroupInput>,
) {
	await requireOrgPermission(
		viewer,
		data.organizationId,
		"eventGroup",
		"create",
	);
	const [group] = await db
		.insert(eventGroups)
		.values({
			organizationId: data.organizationId,
			name: data.name,
			slug: slugify(data.name),
			discipline: data.discipline,
			rulesConfig: RulesConfigSchema.parse({}),
			startDate: new Date(data.startDate),
			endDate: new Date(data.endDate),
		})
		.returning({ id: eventGroups.id });
	return group;
}

export async function createTimingPoint(
	viewer: Viewer,
	data: z.infer<typeof createTimingPointInput>,
) {
	await requireOrgPermission(
		viewer,
		data.organizationId,
		"timingPoint",
		"create",
	);
	const [point] = await db
		.insert(timingPoints)
		.values(data)
		.onConflictDoNothing()
		.returning({ id: timingPoints.id });
	if (!point) throw new Error(`Timing point ${data.code} already exists`);
	return point;
}

export async function getEventGroupPage(viewer: Viewer, eventGroupId: string) {
	const access = await getEventGroupAccess(viewer, eventGroupId);
	if (!access) return null;

	const [group] = await db
		.select({
			id: eventGroups.id,
			name: eventGroups.name,
			discipline: eventGroups.discipline,
			startDate: eventGroups.startDate,
			endDate: eventGroups.endDate,
			organizationName: organizations.name,
			organizationSlug: organizations.slug,
		})
		.from(eventGroups)
		.innerJoin(organizations, eq(organizations.id, eventGroups.organizationId))
		.where(eq(eventGroups.id, eventGroupId));

	const points = await db
		.select({
			id: timingPoints.id,
			name: timingPoints.name,
			code: timingPoints.code,
		})
		.from(timingPoints)
		.where(eq(timingPoints.organizationId, access.organizationId))
		.orderBy(asc(timingPoints.code));

	const manageStaff = canManageStaff(access);
	const seesRoster = manageStaff || access.orgRoles.length > 0;

	const roster = seesRoster ? await loadRoster(eventGroupId) : [];

	const recorder = sql<string>`${people.firstName} || ' ' || ${people.lastName}`;
	const recent = await db
		.select({
			id: rawTimingEvents.id,
			competitorNumber: rawTimingEvents.competitorNumber,
			timingPointCode: rawTimingEvents.timingPointCode,
			subSplitKind: rawTimingEvents.subSplitKind,
			recordedTimeUtc: rawTimingEvents.recordedTimeUtc,
			recordedBy: recorder,
		})
		.from(rawTimingEvents)
		.leftJoin(people, eq(people.id, rawTimingEvents.recordedByPersonId))
		.where(eq(rawTimingEvents.eventGroupId, eventGroupId))
		.orderBy(desc(rawTimingEvents.recordedTimeUtc))
		.limit(20);

	return {
		eventGroup: group,
		access: {
			orgRoles: access.orgRoles,
			staffRoles: access.staffRoles,
			timingPointIds: access.timingPointIds,
		},
		can: {
			manageStaff,
			recordAt: points
				.filter((p) => canRecordAt(access, p.id))
				.map((p) => p.id),
		},
		timingPoints: points,
		roster,
		recentTimes: recent,
	};
}

async function loadRoster(eventGroupId: string) {
	const staff = await db
		.select({
			id: eventGroupStaff.id,
			roles: eventGroupStaff.roles,
			firstName: people.firstName,
			lastName: people.lastName,
			email: people.email,
			claimed: sql<boolean>`${people.userId} is not null`,
		})
		.from(eventGroupStaff)
		.innerJoin(people, eq(people.id, eventGroupStaff.personId))
		.where(eq(eventGroupStaff.eventGroupId, eventGroupId))
		.orderBy(asc(people.lastName), asc(people.firstName));
	if (staff.length === 0) return [];

	const assignments = await db
		.select({
			staffId: eventGroupStaffTimingPoints.staffId,
			code: timingPoints.code,
		})
		.from(eventGroupStaffTimingPoints)
		.innerJoin(
			timingPoints,
			eq(timingPoints.id, eventGroupStaffTimingPoints.timingPointId),
		)
		.where(
			inArray(
				eventGroupStaffTimingPoints.staffId,
				staff.map((s) => s.id),
			),
		);

	return staff.map((s) => ({
		...s,
		timingPointCodes: assignments
			.filter((a) => a.staffId === s.id)
			.map((a) => a.code),
	}));
}

async function requireStaffManager(viewer: Viewer, eventGroupId: string) {
	const access = await getEventGroupAccess(viewer, eventGroupId);
	if (!access || !canManageStaff(access)) throw new ForbiddenError();
	return access;
}

export async function assignStaff(
	viewer: Viewer,
	data: z.infer<typeof assignStaffInput>,
) {
	const access = await requireStaffManager(viewer, data.eventGroupId);

	if (data.timingPointIds.length > 0) {
		const owned = await db
			.select({ id: timingPoints.id })
			.from(timingPoints)
			.where(
				and(
					eq(timingPoints.organizationId, access.organizationId),
					inArray(timingPoints.id, data.timingPointIds),
				),
			);
		if (owned.length !== data.timingPointIds.length) {
			throw new ForbiddenError("Timing point belongs to another organization");
		}
	}

	return db.transaction(async (tx) => {
		// Prefer a person already claimed by a login so access applies immediately.
		const [match] = await tx
			.select({ id: people.id })
			.from(people)
			.where(sql`lower(${people.email}) = lower(${data.email})`)
			.orderBy(sql`${people.userId} is null`)
			.limit(1);

		const personId =
			match?.id ??
			(
				await tx
					.insert(people)
					.values({
						firstName: data.firstName,
						lastName: data.lastName,
						email: data.email,
					})
					.returning({ id: people.id })
			)[0].id;

		const [staff] = await tx
			.insert(eventGroupStaff)
			.values({ eventGroupId: data.eventGroupId, personId, roles: data.roles })
			.onConflictDoUpdate({
				target: [eventGroupStaff.eventGroupId, eventGroupStaff.personId],
				set: { roles: data.roles },
			})
			.returning({ id: eventGroupStaff.id });

		await tx
			.delete(eventGroupStaffTimingPoints)
			.where(eq(eventGroupStaffTimingPoints.staffId, staff.id));
		if (data.timingPointIds.length > 0) {
			await tx.insert(eventGroupStaffTimingPoints).values(
				data.timingPointIds.map((timingPointId) => ({
					staffId: staff.id,
					timingPointId,
				})),
			);
		}
		return staff;
	});
}

export async function removeStaff(
	viewer: Viewer,
	data: z.infer<typeof removeStaffInput>,
) {
	await requireStaffManager(viewer, data.eventGroupId);
	await db
		.delete(eventGroupStaff)
		.where(
			and(
				eq(eventGroupStaff.id, data.staffId),
				eq(eventGroupStaff.eventGroupId, data.eventGroupId),
			),
		);
}

export async function recordTime(
	viewer: Viewer,
	data: z.infer<typeof recordTimeInput>,
) {
	const access = await getEventGroupAccess(viewer, data.eventGroupId);
	if (!access || !viewer.person) throw new ForbiddenError();

	const [point] = await db
		.select({ code: timingPoints.code })
		.from(timingPoints)
		.where(
			and(
				eq(timingPoints.id, data.timingPointId),
				eq(timingPoints.organizationId, access.organizationId),
			),
		);
	if (!point || !canRecordAt(access, data.timingPointId)) {
		throw new ForbiddenError("You are not stationed at that timing point");
	}

	const [row] = await db
		.insert(rawTimingEvents)
		.values({
			eventGroupId: data.eventGroupId,
			competitorNumber: data.competitorNumber,
			timingPointCode: point.code,
			subSplitKind: data.subSplitKind,
			recordedTimeUtc: new Date(),
			source: "manual_web_entry",
			recordedByPersonId: viewer.person.id,
		})
		.returning({ id: rawTimingEvents.id });
	return row;
}
