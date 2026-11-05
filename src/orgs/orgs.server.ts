import "@tanstack/solid-start/server-only";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
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
	courseSplits,
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
import { mergeOrganizationMetadata } from "./format";
import { parseOrganizationMeta } from "../public/public.shared";
import {
	type assignStaffInput,
	type createEventGroupInput,
	type createTimingPointInput,
	type deleteEventGroupInput,
	type recordTimeInput,
	type removeStaffInput,
	slugify,
	type timingPointIdInput,
	type updateEventGroupInput,
	type updateOrganizationDetailsInput,
	type updateTimingPointInput,
} from "./orgs.shared";

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

function getDefaultRulesConfig(discipline: string) {
	switch (discipline) {
		case "backyard_ultra":
			return RulesConfigSchema.parse({
				timeFormat: "HH:MM:SS",
				displayPrecisionDecimals: 0,
				yardDistanceMiles: 4.166667,
				yardTimeLimitSeconds: 3600,
				allowSelfCheckIn: false,
				requirePacerRegistration: false,
			});
		case "tsd_regularity":
			return RulesConfigSchema.parse({
				timeFormat: "HH:MM:SS.sss",
				displayPrecisionDecimals: 3,
				earlyPenaltyFactor: 2.0,
				latePenaltyFactor: 1.0,
				gracePeriodSeconds: 0.0,
				allowSelfCheckIn: false,
				requirePacerRegistration: false,
			});
		case "downhill_mtb":
		case "xco_cycling":
			return RulesConfigSchema.parse({
				timeFormat: "MM:SS.sss",
				displayPrecisionDecimals: 2,
				allowSelfCheckIn: false,
				requirePacerRegistration: false,
			});
		case "trail_ultra":
			return RulesConfigSchema.parse({
				timeFormat: "HH:MM:SS",
				displayPrecisionDecimals: 0,
				allowSelfCheckIn: true,
				requirePacerRegistration: true,
			});
		case "road_marathon":
			return RulesConfigSchema.parse({
				timeFormat: "HH:MM:SS",
				displayPrecisionDecimals: 0,
				allowSelfCheckIn: true,
				requirePacerRegistration: false,
			});
		default:
			return RulesConfigSchema.parse({});
	}
}

export async function getOrganizationOverview(viewer: Viewer, slug: string) {
	const [org] = await db
		.select({
			id: organizations.id,
			name: organizations.name,
			slug: organizations.slug,
			logo: organizations.logo,
			metadata: organizations.metadata,
		})
		.from(organizations)
		.where(eq(organizations.slug, slug));
	if (!org) return null;

	const myRoles = await getOrgRoles(viewer.user.id, org.id);

	let staffEventGroups: Array<{
		id: string;
		name: string;
		slug: string;
		roles: string[];
	}> = [];

	if (viewer.person?.id) {
		staffEventGroups = await db
			.select({
				id: eventGroups.id,
				name: eventGroups.name,
				slug: eventGroups.slug,
				roles: eventGroupStaff.roles,
			})
			.from(eventGroupStaff)
			.innerJoin(eventGroups, eq(eventGroups.id, eventGroupStaff.eventGroupId))
			.where(
				and(
					eq(eventGroups.organizationId, org.id),
					eq(eventGroupStaff.personId, viewer.person.id),
				),
			);
	}

	if (myRoles.length === 0 && staffEventGroups.length === 0) {
		return null;
	}

	const isStaffOnly = myRoles.length === 0;

	const can = {
		invite: !isStaffOnly && orgRolesCan(myRoles, "invitation", "create"),
		updateMembers: !isStaffOnly && orgRolesCan(myRoles, "member", "update"),
		createEventGroup: !isStaffOnly && orgRolesCan(myRoles, "eventGroup", "create"),
		createCourse: !isStaffOnly && orgRolesCan(myRoles, "course", "create"),
		updateCourse: !isStaffOnly && orgRolesCan(myRoles, "course", "update"),
		deleteCourse: !isStaffOnly && orgRolesCan(myRoles, "course", "delete"),
		createTimingPoint: !isStaffOnly && orgRolesCan(myRoles, "timingPoint", "create"),
		updateTimingPoint: !isStaffOnly && orgRolesCan(myRoles, "timingPoint", "update"),
		deleteTimingPoint: !isStaffOnly && orgRolesCan(myRoles, "timingPoint", "delete"),
		updateOrganization: !isStaffOnly && orgRolesCan(myRoles, "organization", "update"),
		deleteOrganization: !isStaffOnly && orgRolesCan(myRoles, "organization", "delete"),
	};

	const [members, invitations, groups, points, orgCourses, orgEvents] =
		await Promise.all([
			!isStaffOnly
				? db
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
						.orderBy(asc(users.name))
				: Promise.resolve([]),
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
					slug: eventGroups.slug,
					discipline: eventGroups.discipline,
					startDate: eventGroups.startDate,
					endDate: eventGroups.endDate,
					timeZone: eventGroups.timeZone,
					location: eventGroups.location,
					eventCount: sql<number>`(select count(*) from ${events} where ${events.eventGroupId} = ${eventGroups.id})`.mapWith(Number),
				})
				.from(eventGroups)
				.where(eq(eventGroups.organizationId, org.id))
				.orderBy(desc(eventGroups.startDate)),
			!isStaffOnly
				? db
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
						.orderBy(asc(timingPoints.code))
				: Promise.resolve([]),
			!isStaffOnly
				? db
						.select({
							id: courses.id,
							name: courses.name,
							distanceMeters: courses.distanceMeters,
							elevationGainMeters: courses.elevationGainMeters,
							gpxRouteUrl: courses.gpxRouteUrl,
							copiedFromCourseId: courses.copiedFromCourseId,
							splitCount: sql<number>`(select count(*) from ${courseSplits} where ${courseSplits.courseId} = ${courses.id})`.mapWith(Number),
						})
						.from(courses)
						.where(eq(courses.organizationId, org.id))
						.orderBy(asc(courses.name))
				: Promise.resolve([]),
			db
				.select({
					id: events.id,
					name: events.name,
					eventGroupId: eventGroups.id,
					eventGroupName: eventGroups.name,
					timeZone: eventGroups.timeZone,
					courseId: events.courseId,
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

	const parsedMeta = parseOrganizationMeta(org.metadata);

	return {
		organization: {
			...org,
			parsedMeta,
		},
		myRoles,
		isStaffOnly,
		staffEventGroups,
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

	const slug = data.slug ? slugify(data.slug) : slugify(data.name);

	// Validate slug uniqueness within organization
	const [existingSlug] = await db
		.select({ id: eventGroups.id })
		.from(eventGroups)
		.where(
			and(
				eq(eventGroups.organizationId, data.organizationId),
				eq(eventGroups.slug, slug),
			),
		);
	if (existingSlug) {
		throw new Error(
			"An event group with this address (slug) already exists in this organization.",
		);
	}

	const rulesConfig = getDefaultRulesConfig(data.discipline);

	const [group] = await db
		.insert(eventGroups)
		.values({
			organizationId: data.organizationId,
			name: data.name,
			slug,
			discipline: data.discipline,
			timeZone: data.timeZone,
			location: data.location,
			rulesConfig,
			startDate: new Date(data.startDate),
			endDate: new Date(data.endDate),
		})
		.returning({ id: eventGroups.id, slug: eventGroups.slug });
	return group;
}

export async function updateEventGroup(
	viewer: Viewer,
	data: z.infer<typeof updateEventGroupInput>,
) {
	const access = await getEventGroupAccess(viewer, data.eventGroupId);
	if (!access || !access.can.editEventGroup) {
		throw new ForbiddenError();
	}

	const [current] = await db
		.select({
			id: eventGroups.id,
			organizationId: eventGroups.organizationId,
			slug: eventGroups.slug,
		})
		.from(eventGroups)
		.where(eq(eventGroups.id, data.eventGroupId));
	if (!current) throw new Error("Event group not found");

	const slug = data.slug ? slugify(data.slug) : current.slug;

	if (slug !== current.slug) {
		const [existingSlug] = await db
			.select({ id: eventGroups.id })
			.from(eventGroups)
			.where(
				and(
					eq(eventGroups.organizationId, current.organizationId),
					eq(eventGroups.slug, slug),
				),
			);
		if (existingSlug) {
			throw new Error(
				"An event group with this address (slug) already exists in this organization.",
			);
		}
	}

	await db
		.update(eventGroups)
		.set({
			name: data.name,
			slug,
			discipline: data.discipline,
			startDate: new Date(data.startDate),
			endDate: new Date(data.endDate),
			timeZone: data.timeZone,
			location: data.location,
		})
		.where(eq(eventGroups.id, data.eventGroupId));
}

export async function deleteEventGroup(
	viewer: Viewer,
	data: z.infer<typeof deleteEventGroupInput>,
) {
	const access = await getEventGroupAccess(viewer, data.eventGroupId);
	if (!access || !access.can.editEventGroup) {
		throw new ForbiddenError();
	}

	// Pre-check sub-events
	const [subEvents] = await db
		.select({ count: count() })
		.from(events)
		.where(eq(events.eventGroupId, data.eventGroupId));
	if (subEvents && subEvents.count > 0) {
		throw new Error(
			`Cannot delete event group because it contains ${subEvents.count} sub-event(s). Delete them first.`,
		);
	}

	await db
		.delete(eventGroups)
		.where(eq(eventGroups.id, data.eventGroupId));
}

export async function updateOrganizationDetails(
	viewer: Viewer,
	data: z.infer<typeof updateOrganizationDetailsInput>,
) {
	await requireOrgPermission(
		viewer,
		data.organizationId,
		"organization",
		"update",
	);

	const [existing] = await db
		.select({
			id: organizations.id,
			slug: organizations.slug,
			metadata: organizations.metadata,
		})
		.from(organizations)
		.where(eq(organizations.id, data.organizationId));
	if (!existing) throw new Error("Organization not found");

	if (data.slug !== existing.slug) {
		const [conflict] = await db
			.select({ id: organizations.id })
			.from(organizations)
			.where(eq(organizations.slug, data.slug));
		if (conflict) {
			throw new Error(
				"An organization with that address (slug) already exists.",
			);
		}
	}

	const updatedMetadata = mergeOrganizationMetadata(existing.metadata, {
		description: data.description,
		location: data.location,
		timeZone: data.timeZone,
		website: data.website,
		establishedYear: data.establishedYear,
	});

	await db
		.update(organizations)
		.set({
			name: data.name,
			slug: data.slug,
			logo: data.logo ?? null,
			metadata: updatedMetadata,
		})
		.where(eq(organizations.id, data.organizationId));
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

	// First query the timing point by id to obtain code and organizationId
	const [point] = await db
		.select({
			id: timingPoints.id,
			code: timingPoints.code,
			organizationId: timingPoints.organizationId,
		})
		.from(timingPoints)
		.where(eq(timingPoints.id, data.timingPointId));

	if (!point) {
		throw new Error("Timing point not found");
	}

	// Pre-check reference counts in course_splits, event_group_staff_timing_points, and raw_timing_events
	const [splitsRef] = await db
		.select({ count: count() })
		.from(courseSplits)
		.where(eq(courseSplits.timingPointId, data.timingPointId));

	const [staffRef] = await db
		.select({ count: count() })
		.from(eventGroupStaffTimingPoints)
		.where(eq(eventGroupStaffTimingPoints.timingPointId, data.timingPointId));

	const [rawEventsRef] = await db
		.select({ count: count() })
		.from(rawTimingEvents)
		.innerJoin(eventGroups, eq(eventGroups.id, rawTimingEvents.eventGroupId))
		.where(
			and(
				eq(eventGroups.organizationId, point.organizationId),
				eq(rawTimingEvents.timingPointCode, point.code),
			),
		);

	const totalRefs =
		(splitsRef?.count ?? 0) +
		(staffRef?.count ?? 0) +
		(rawEventsRef?.count ?? 0);

	if (totalRefs > 0) {
		const parts: string[] = [];
		if (splitsRef?.count) parts.push(`${splitsRef.count} course split(s)`);
		if (staffRef?.count) parts.push(`${staffRef.count} staff assignment(s)`);
		if (rawEventsRef?.count)
			parts.push(`${rawEventsRef.count} raw timing record(s)`);
		throw new Error(
			`Cannot delete timing point because it is referenced by ${parts.join(", ")}. Remove or reassign them first.`,
		);
	}

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
