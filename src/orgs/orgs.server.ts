import "@tanstack/solid-start/server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { orgRolesCan } from "../auth/access";
import { findOrCreatePerson } from "../auth/people.server";
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
import { withConstraintMessages } from "../db/errors.server";
import {
	courses,
	eventGroupStaff,
	eventGroupStaffTimingPoints,
	eventGroups,
	events,
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
	timingPointIdInput,
	updateTimingPointInput,
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
		createCourse: orgRolesCan(myRoles, "course", "create"),
		updateCourse: orgRolesCan(myRoles, "course", "update"),
		deleteCourse: orgRolesCan(myRoles, "course", "delete"),
		createTimingPoint: orgRolesCan(myRoles, "timingPoint", "create"),
		updateTimingPoint: orgRolesCan(myRoles, "timingPoint", "update"),
		deleteTimingPoint: orgRolesCan(myRoles, "timingPoint", "delete"),
		updateOrganization: orgRolesCan(myRoles, "organization", "update"),
		deleteOrganization: orgRolesCan(myRoles, "organization", "delete"),
	};

	const [members, invitations, groups, points, orgCourses, orgEvents] =
		await Promise.all([
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
					location: eventGroups.location,
				})
				.from(eventGroups)
				.where(eq(eventGroups.organizationId, org.id))
				.orderBy(desc(eventGroups.startDate)),
			db
				.select({
					id: timingPoints.id,
					name: timingPoints.name,
					code: timingPoints.code,
					latitude: timingPoints.latitude,
					longitude: timingPoints.longitude,
					elevationMeters: timingPoints.elevationMeters,
				})
				.from(timingPoints)
				.where(eq(timingPoints.organizationId, org.id))
				.orderBy(asc(timingPoints.code)),
			db
				.select({
					id: courses.id,
					name: courses.name,
					distanceMeters: courses.distanceMeters,
					elevationGainMeters: courses.elevationGainMeters,
				})
				.from(courses)
				.where(eq(courses.organizationId, org.id))
				.orderBy(asc(courses.name)),
			db
				.select({
					id: events.id,
					name: events.name,
					eventGroupId: eventGroups.id,
					eventGroupName: eventGroups.name,
					timeZone: eventGroups.timeZone,
					courseName: courses.name,
					scheduledStart: events.scheduledStart,
					lapsRequired: events.lapsRequired,
				})
				.from(events)
				.innerJoin(eventGroups, eq(eventGroups.id, events.eventGroupId))
				.innerJoin(courses, eq(courses.id, events.courseId))
				.where(eq(eventGroups.organizationId, org.id))
				.orderBy(desc(events.scheduledStart)),
		]);

	return {
		organization: org,
		myRoles,
		can,
		members,
		invitations,
		eventGroups: groups,
		timingPoints: points,
		courses: orgCourses,
		events: orgEvents,
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
			timeZone: data.timeZone,
			location: data.location,
			rulesConfig: RulesConfigSchema.parse({}),
			startDate: new Date(data.startDate),
			endDate: new Date(data.endDate),
		})
		.returning({ id: eventGroups.id });
	return group;
}

const timingPointConstraints = {
	timing_points_org_code_idx: "Another timing point already uses that code.",
	course_splits_timing_point_id_timing_points_id_fkey:
		"A course still passes this timing point. Remove it from those courses first.",
};

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
	const [point] = await withConstraintMessages(timingPointConstraints, () =>
		db.insert(timingPoints).values(data).returning({ id: timingPoints.id }),
	);
	return point;
}

async function requireTimingPointPermission(
	viewer: Viewer,
	timingPointId: string,
	action: "update" | "delete",
) {
	const [point] = await db
		.select({ organizationId: timingPoints.organizationId })
		.from(timingPoints)
		.where(eq(timingPoints.id, timingPointId));
	if (!point) throw new ForbiddenError();
	await requireOrgPermission(
		viewer,
		point.organizationId,
		"timingPoint",
		action,
	);
}

export async function updateTimingPoint(
	viewer: Viewer,
	{ timingPointId, ...data }: z.infer<typeof updateTimingPointInput>,
) {
	await requireTimingPointPermission(viewer, timingPointId, "update");
	await withConstraintMessages(timingPointConstraints, () =>
		db.update(timingPoints).set(data).where(eq(timingPoints.id, timingPointId)),
	);
}

export async function deleteTimingPoint(
	viewer: Viewer,
	data: z.infer<typeof timingPointIdInput>,
) {
	await requireTimingPointPermission(viewer, data.timingPointId, "delete");
	await withConstraintMessages(timingPointConstraints, () =>
		db.delete(timingPoints).where(eq(timingPoints.id, data.timingPointId)),
	);
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
			timeZone: eventGroups.timeZone,
			location: eventGroups.location,
			rulesConfig: eventGroups.rulesConfig,
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
	const isMember = access.orgRoles.length > 0;

	const [roster, groupEvents, orgCourses] = await Promise.all([
		isMember ? loadRoster(eventGroupId) : [],
		db
			.select({
				id: events.id,
				name: events.name,
				courseId: events.courseId,
				courseName: courses.name,
				lapsRequired: events.lapsRequired,
				scheduledStart: events.scheduledStart,
				actualStart: events.actualStart,
			})
			.from(events)
			.innerJoin(courses, eq(courses.id, events.courseId))
			.where(eq(events.eventGroupId, eventGroupId))
			.orderBy(asc(events.scheduledStart)),
		isMember
			? db
					.select({ id: courses.id, name: courses.name })
					.from(courses)
					.where(eq(courses.organizationId, access.organizationId))
					.orderBy(asc(courses.name))
			: [],
	]);

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
			updateEventGroup: orgRolesCan(access.orgRoles, "eventGroup", "update"),
			deleteEventGroup: orgRolesCan(access.orgRoles, "eventGroup", "delete"),
			manageEntrants: orgRolesCan(access.orgRoles, "entrant", "update"),
			recordAt: points
				.filter((p) => canRecordAt(access, p.id))
				.map((p) => p.id),
		},
		timingPoints: points,
		events: groupEvents,
		courses: orgCourses,
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
		const personId = await findOrCreatePerson(tx, {
			firstName: data.firstName,
			lastName: data.lastName,
			email: data.email,
		});

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
