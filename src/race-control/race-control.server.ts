import "@tanstack/solid-start/server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { z } from "zod";
import { orgRolesCan, parseOrgRoles, type OrgRole } from "../auth/access";
import { findOrCreatePerson } from "../auth/people.server";
import {
	ForbiddenError,
	getEventGroupAccess,
	requireOrgPermission,
	type EventGroupAccess,
} from "../auth/permissions.server";
import type { Viewer } from "../auth/session.server";
import { db } from "../db";
import { withConstraintMessages } from "../db/errors.server";
import {
	courseSplits,
	courses,
	entrantHistoricalProjections,
	entrants,
	eventGroupStaff,
	eventGroupStaffTimingPoints,
	eventGroups,
	events,
	organizationMembers,
	organizations,
	people,
	personExternalProfiles,
	personHistoricalSummaries,
	personRaceHistory,
	scoredSplitTimes,
	timingPoints,
	type RulesConfig,
} from "../db/schema";
import { zonedLocalToUtc } from "../lib/zoned-time";
import type {
	assignStaffTimingPointInput,
	backyardCloseYardInput,
	checkInEntrantInput,
	CombinedCustodyCounts,
	createSubEventInput,
	downhillGateReleaseInput,
	downhillRedFlagHoldInput,
	fixedTimeRecordPartialLapInput,
	partialRulesConfigInput,
	recalculateEntrantProjectionInput,
	removeStaffMemberInput,
	removeStaffTimingPointInput,
	resetEventGunInput,
	rosterStaffMemberInput,
	startEventGunInput,
	tsdGenerateIntervalStartsInput,
	tsdRevealSecretCheckpointsInput,
	updateEntrantWorkspaceInput,
	updateEventGroupRulesInput,
	updateStaffRolesInput,
	verifyExternalProfileInput,
	xcoCheckLappedPullInput,
	naturalCompareCompetitorNumbers,
	canManageRaceControl,
	canViewMedicalData,
} from "./race-control.shared";

export { canManageRaceControl, canViewMedicalData };

const emergencyContacts = alias(people, "emergency_contacts");

// ============================================================================
// PERMISSION HELPERS
// ============================================================================

export async function canVerifyExternalProfiles(viewer: Viewer): Promise<boolean> {
	if (viewer.user.role === "admin") return true;

	const memberships = await db
		.select({ role: organizationMembers.role })
		.from(organizationMembers)
		.where(eq(organizationMembers.userId, viewer.user.id));

	const isPrivilegedOrgUser = memberships.some((m) => {
		const parsed = parseOrgRoles(m.role);
		return parsed.some((r) => ["owner", "admin", "director", "steward"].includes(r));
	});
	if (isPrivilegedOrgUser) return true;

	if (viewer.person) {
		const staff = await db
			.select({ roles: eventGroupStaff.roles })
			.from(eventGroupStaff)
			.where(eq(eventGroupStaff.personId, viewer.person.id));
		const isPrivilegedStaff = staff.some((s) =>
			s.roles.some((r) =>
				["official", "checkpoint_captain", "race_director"].includes(r),
			),
		);
		if (isPrivilegedStaff) return true;
	}

	return false;
}

export async function getStaffPortalBridgeData(
	viewer: Viewer | null,
	eventGroupSlug: string,
) {
	if (!viewer) return { isStaff: false };
	const [group] = await db
		.select({
			id: eventGroups.id,
			slug: eventGroups.slug,
			organizationId: eventGroups.organizationId,
		})
		.from(eventGroups)
		.where(eq(eventGroups.slug, eventGroupSlug));
	if (!group) return { isStaff: false };

	const [org] = await db
		.select({ slug: organizations.slug })
		.from(organizations)
		.where(eq(organizations.id, group.organizationId));
	if (!org) return { isStaff: false };

	const access = await getEventGroupAccess(viewer, group.id);
	if (!access) return { isStaff: false };

	let stationCode: string | null = null;
	if (access.timingPointIds.length > 0) {
		const [tp] = await db
			.select({ code: timingPoints.code })
			.from(timingPoints)
			.where(eq(timingPoints.id, access.timingPointIds[0]));
		if (tp) stationCode = tp.code;
	}

	return {
		isStaff: true,
		orgSlug: org.slug,
		eventGroupSlug: group.slug,
		stationCode,
		orgRoles: access.orgRoles,
		staffRoles: access.staffRoles,
	};
}

async function resolveEventGroup(
	orgSlug: string,
	eventGroupSlug: string,
	viewer: Viewer,
) {
	const [org] = await db
		.select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
		.from(organizations)
		.where(eq(organizations.slug, orgSlug));
	if (!org) throw new ForbiddenError("Organization not found");

	const [group] = await db
		.select()
		.from(eventGroups)
		.where(
			and(
				eq(eventGroups.organizationId, org.id),
				eq(eventGroups.slug, eventGroupSlug),
			),
		);
	if (!group) throw new ForbiddenError("Event group not found");

	const access = await getEventGroupAccess(viewer, group.id);
	if (!access) throw new ForbiddenError("You do not have access to this event group");

	return { org, group, access };
}

// ============================================================================
// WEEKEND HUB QUERIES
// ============================================================================

export async function getWeekendHubOverviewData(
	viewer: Viewer,
	orgSlug: string,
	eventGroupSlug: string,
) {
	const { org, group, access } = await resolveEventGroup(
		orgSlug,
		eventGroupSlug,
		viewer,
	);

	// Load all sub-events with their course information
	const subEventRows = await db
		.select({
			id: events.id,
			name: events.name,
			lapsRequired: events.lapsRequired,
			scheduledStart: events.scheduledStart,
			actualStart: events.actualStart,
			courseId: events.courseId,
			courseName: courses.name,
			courseDistanceMeters: courses.distanceMeters,
			courseElevationGainMeters: courses.elevationGainMeters,
		})
		.from(events)
		.innerJoin(courses, eq(courses.id, events.courseId))
		.where(eq(events.eventGroupId, group.id))
		.orderBy(asc(events.scheduledStart));

	// Load all entrants custody counts across all sub-events
	const entrantRows = await db
		.select({
			id: entrants.id,
			eventId: entrants.eventId,
			status: entrants.status,
			emergencyContactIsOnSite: entrants.emergencyContactIsOnSite,
			emergencyContactPersonId: entrants.emergencyContactPersonId,
		})
		.from(entrants)
		.innerJoin(events, eq(events.id, entrants.eventId))
		.where(eq(events.eventGroupId, group.id));

	// Aggregate field custody
	const combinedCustody: CombinedCustodyCounts = {
		registered: 0,
		checkedIn: 0,
		inProgress: 0,
		finished: 0,
		dnf: 0,
		retired: 0,
		dns: 0,
		total: entrantRows.length,
	};

	const custodyByEvent = new Map<string, CombinedCustodyCounts>();
	for (const sub of subEventRows) {
		custodyByEvent.set(sub.id, {
			registered: 0,
			checkedIn: 0,
			inProgress: 0,
			finished: 0,
			dnf: 0,
			retired: 0,
			dns: 0,
			total: 0,
		});
	}

	let emergencyContactsCount = 0;
	let emergencyContactsOnSiteCount = 0;

	for (const row of entrantRows) {
		if (row.emergencyContactPersonId) emergencyContactsCount++;
		if (row.emergencyContactIsOnSite) emergencyContactsOnSiteCount++;

		switch (row.status) {
			case "registered":
				combinedCustody.registered++;
				break;
			case "checked_in":
				combinedCustody.checkedIn++;
				break;
			case "in_progress":
				combinedCustody.inProgress++;
				break;
			case "finished":
				combinedCustody.finished++;
				break;
			case "dnf":
				combinedCustody.dnf++;
				break;
			case "retired":
				combinedCustody.retired++;
				break;
			case "dns":
				combinedCustody.dns++;
				break;
		}

		const evCustody = custodyByEvent.get(row.eventId);
		if (evCustody) {
			evCustody.total++;
			if (row.status in evCustody) {
				(evCustody as Record<string, number>)[row.status]++;
			}
		}
	}

	// Staffing & timing points status
	const [timingPointsCountResult, staffCountResult, courseSplitsCountResult, orgCourses] =
		await Promise.all([
			db
				.select({ count: sql<number>`count(*)` })
				.from(timingPoints)
				.where(eq(timingPoints.organizationId, org.id)),
			db
				.select({ count: sql<number>`count(*)` })
				.from(eventGroupStaff)
				.where(eq(eventGroupStaff.eventGroupId, group.id)),
			db
				.select({ count: sql<number>`count(*)` })
				.from(courseSplits)
				.innerJoin(events, eq(events.courseId, courseSplits.courseId))
				.where(eq(events.eventGroupId, group.id)),
			db
				.select({ id: courses.id, name: courses.name, distanceMeters: courses.distanceMeters })
				.from(courses)
				.where(eq(courses.organizationId, org.id))
				.orderBy(asc(courses.name)),
		]);

	const totalTimingPoints = Number(timingPointsCountResult[0]?.count ?? 0);
	const totalStaff = Number(staffCountResult[0]?.count ?? 0);
	const totalSplits = Number(courseSplitsCountResult[0]?.count ?? 0);

	const subEventsWithCustody = subEventRows.map((ev) => ({
		...ev,
		custody: custodyByEvent.get(ev.id) ?? {
			registered: 0,
			checkedIn: 0,
			inProgress: 0,
			finished: 0,
			dnf: 0,
			retired: 0,
			dns: 0,
			total: 0,
		},
	}));

	return {
		organization: org,
		eventGroup: {
			id: group.id,
			name: group.name,
			slug: group.slug,
			discipline: group.discipline,
			rulesConfig: group.rulesConfig,
			timeZone: group.timeZone,
			location: group.location,
			startDate: group.startDate.toISOString(),
			endDate: group.endDate.toISOString(),
		},
		subEvents: subEventsWithCustody,
		organizationCourses: orgCourses,
		combinedCustody,
		readiness: {
			totalTimingPoints,
			totalStaff,
			totalSplits,
			emergencyContactsCount,
			emergencyContactsOnSiteCount,
			checkInRatePct:
				combinedCustody.total > 0
					? Math.round(
							((combinedCustody.checkedIn +
								combinedCustody.inProgress +
								combinedCustody.finished +
								combinedCustody.dnf) /
								combinedCustody.total) *
								100,
						)
					: 0,
		},
		access: {
			orgRoles: access.orgRoles,
			staffRoles: access.staffRoles,
			canManageStaff: orgRolesCan(access.orgRoles, "staff", "assign"),
			canViewMedicalData: canViewMedicalData(access),
		},
	};
}

export async function getDisciplineRulesAndStaffData(
	viewer: Viewer,
	orgSlug: string,
	eventGroupSlug: string,
) {
	const { org, group, access } = await resolveEventGroup(
		orgSlug,
		eventGroupSlug,
		viewer,
	);

	// Load staff with assigned timing points
	const staffRows = await db
		.select({
			staffId: eventGroupStaff.id,
			roles: eventGroupStaff.roles,
			createdAt: eventGroupStaff.createdAt,
			person: {
				id: people.id,
				firstName: people.firstName,
				lastName: people.lastName,
				email: people.email,
				phone: people.phone,
			},
		})
		.from(eventGroupStaff)
		.innerJoin(people, eq(people.id, eventGroupStaff.personId))
		.where(eq(eventGroupStaff.eventGroupId, group.id))
		.orderBy(asc(people.lastName), asc(people.firstName));

	// Load assigned timing points for all staff
	const staffTimingPointRows = await db
		.select({
			staffId: eventGroupStaffTimingPoints.staffId,
			timingPoint: {
				id: timingPoints.id,
				name: timingPoints.name,
				code: timingPoints.code,
				latitude: timingPoints.latitude,
				longitude: timingPoints.longitude,
				elevationMeters: timingPoints.elevationMeters,
			},
		})
		.from(eventGroupStaffTimingPoints)
		.innerJoin(
			timingPoints,
			eq(timingPoints.id, eventGroupStaffTimingPoints.timingPointId),
		)
		.innerJoin(
			eventGroupStaff,
			eq(eventGroupStaff.id, eventGroupStaffTimingPoints.staffId),
		)
		.where(eq(eventGroupStaff.eventGroupId, group.id));

	const pointsByStaffId = new Map<
		string,
		Array<{
			id: string;
			name: string;
			code: string;
			latitude: number | null;
			longitude: number | null;
			elevationMeters: number | null;
		}>
	>();
	for (const stp of staffTimingPointRows) {
		const list = pointsByStaffId.get(stp.staffId) ?? [];
		list.push(stp.timingPoint);
		pointsByStaffId.set(stp.staffId, list);
	}

	const staffWithPoints = staffRows.map((s) => ({
		...s,
		timingPoints: pointsByStaffId.get(s.staffId) ?? [],
	}));

	// Load all organization timing points
	const orgTimingPoints = await db
		.select()
		.from(timingPoints)
		.where(eq(timingPoints.organizationId, org.id))
		.orderBy(asc(timingPoints.name));

	return {
		organization: org,
		eventGroup: {
			id: group.id,
			name: group.name,
			slug: group.slug,
			discipline: group.discipline,
			rulesConfig: group.rulesConfig,
			timeZone: group.timeZone,
		},
		staff: staffWithPoints,
		organizationTimingPoints: orgTimingPoints,
		access: {
			orgRoles: access.orgRoles,
			staffRoles: access.staffRoles,
			canManageStaff: orgRolesCan(access.orgRoles, "staff", "assign"),
		},
	};
}

// ============================================================================
// RULES & STAFF MUTATIONS
// ============================================================================

export async function updateEventGroupRules(
	viewer: Viewer,
	input: z.infer<typeof updateEventGroupRulesInput>,
) {
	const access = await getEventGroupAccess(viewer, input.eventGroupId);
	if (!access || !orgRolesCan(access.orgRoles, "eventGroup", "update")) {
		throw new ForbiddenError("Insufficient permissions to update discipline rules");
	}

	await db
		.update(eventGroups)
		.set({ rulesConfig: input.rulesConfig })
		.where(eq(eventGroups.id, input.eventGroupId));

	return { success: true };
}

export async function updatePartialRulesConfig(
	viewer: Viewer,
	input: z.infer<typeof partialRulesConfigInput>,
) {
	const access = await getEventGroupAccess(viewer, input.eventGroupId);
	if (!access || !orgRolesCan(access.orgRoles, "eventGroup", "update")) {
		throw new ForbiddenError("Insufficient permissions to update rules");
	}

	const [group] = await db
		.select({ rulesConfig: eventGroups.rulesConfig })
		.from(eventGroups)
		.where(eq(eventGroups.id, input.eventGroupId));
	if (!group) throw new ForbiddenError("Event group not found");

	const updatedConfig: RulesConfig = {
		...group.rulesConfig,
		...(input.timeFormat !== undefined && { timeFormat: input.timeFormat }),
		...(input.displayPrecisionDecimals !== undefined && {
			displayPrecisionDecimals: input.displayPrecisionDecimals,
		}),
		...(input.allowSelfCheckIn !== undefined && {
			allowSelfCheckIn: input.allowSelfCheckIn,
		}),
		...(input.requirePacerRegistration !== undefined && {
			requirePacerRegistration: input.requirePacerRegistration,
		}),
		...(input.earlyPenaltyFactor !== undefined && {
			earlyPenaltyFactor: input.earlyPenaltyFactor,
		}),
		...(input.latePenaltyFactor !== undefined && {
			latePenaltyFactor: input.latePenaltyFactor,
		}),
		...(input.gracePeriodSeconds !== undefined && {
			gracePeriodSeconds: input.gracePeriodSeconds,
		}),
		...(input.yardDistanceMiles !== undefined && {
			yardDistanceMiles: input.yardDistanceMiles,
		}),
		...(input.yardTimeLimitSeconds !== undefined && {
			yardTimeLimitSeconds: input.yardTimeLimitSeconds,
		}),
	};

	await db
		.update(eventGroups)
		.set({ rulesConfig: updatedConfig })
		.where(eq(eventGroups.id, input.eventGroupId));

	return { success: true, rulesConfig: updatedConfig };
}

export async function assignStaffTimingPoint(
	viewer: Viewer,
	input: z.infer<typeof assignStaffTimingPointInput>,
) {
	const access = await getEventGroupAccess(viewer, input.eventGroupId);
	if (!access || !orgRolesCan(access.orgRoles, "staff", "assign")) {
		throw new ForbiddenError("Insufficient permissions to assign staff to stations");
	}

	await db
		.insert(eventGroupStaffTimingPoints)
		.values({
			staffId: input.staffId,
			timingPointId: input.timingPointId,
		})
		.onConflictDoNothing();

	return { success: true };
}

export async function removeStaffTimingPoint(
	viewer: Viewer,
	input: z.infer<typeof removeStaffTimingPointInput>,
) {
	const access = await getEventGroupAccess(viewer, input.eventGroupId);
	if (!access || !orgRolesCan(access.orgRoles, "staff", "assign")) {
		throw new ForbiddenError("Insufficient permissions to remove staff station assignment");
	}

	await db
		.delete(eventGroupStaffTimingPoints)
		.where(
			and(
				eq(eventGroupStaffTimingPoints.staffId, input.staffId),
				eq(eventGroupStaffTimingPoints.timingPointId, input.timingPointId),
			),
		);

	return { success: true };
}

export async function updateStaffRoles(
	viewer: Viewer,
	input: z.infer<typeof updateStaffRolesInput>,
) {
	const access = await getEventGroupAccess(viewer, input.eventGroupId);
	if (!access || !orgRolesCan(access.orgRoles, "staff", "assign")) {
		throw new ForbiddenError("Insufficient permissions to update staff roles");
	}

	await db
		.update(eventGroupStaff)
		.set({ roles: input.roles })
		.where(eq(eventGroupStaff.id, input.staffId));

	return { success: true };
}

export async function rosterStaffMember(
	viewer: Viewer,
	input: z.infer<typeof rosterStaffMemberInput>,
) {
	const access = await getEventGroupAccess(viewer, input.eventGroupId);
	if (!access || !orgRolesCan(access.orgRoles, "staff", "assign")) {
		throw new ForbiddenError("Insufficient permissions to roster staff");
	}

	let personId = input.personId;
	if (!personId && input.email) {
		const person = await findOrCreatePerson(db, {
			email: input.email,
			firstName: input.firstName ?? input.email.split("@")[0] ?? "Volunteer",
			lastName: input.lastName ?? "Staff",
		});
		personId = person.id;
	}

	if (!personId) throw new ForbiddenError("Person identity is required");

	const [existingStaff] = await db
		.select({ id: eventGroupStaff.id })
		.from(eventGroupStaff)
		.where(
			and(
				eq(eventGroupStaff.eventGroupId, input.eventGroupId),
				eq(eventGroupStaff.personId, personId),
			),
		);

	let staffId: string;
	if (existingStaff) {
		staffId = existingStaff.id;
		await db
			.update(eventGroupStaff)
			.set({ roles: input.roles })
			.where(eq(eventGroupStaff.id, staffId));
	} else {
		const [created] = await db
			.insert(eventGroupStaff)
			.values({
				eventGroupId: input.eventGroupId,
				personId,
				roles: input.roles,
			})
			.returning({ id: eventGroupStaff.id });
		staffId = created.id;
	}

	if (input.timingPointId) {
		await db
			.insert(eventGroupStaffTimingPoints)
			.values({
				staffId,
				timingPointId: input.timingPointId,
			})
			.onConflictDoNothing();
	}

	return { success: true, staffId };
}

export async function removeStaffMember(
	viewer: Viewer,
	input: z.infer<typeof removeStaffMemberInput>,
) {
	const access = await getEventGroupAccess(viewer, input.eventGroupId);
	if (!access || !orgRolesCan(access.orgRoles, "staff", "remove")) {
		throw new ForbiddenError("Insufficient permissions to remove staff");
	}

	await db
		.delete(eventGroupStaff)
		.where(eq(eventGroupStaff.id, input.staffId));

	return { success: true };
}

export async function createSubEvent(
	viewer: Viewer,
	input: z.infer<typeof createSubEventInput>,
) {
	const access = await getEventGroupAccess(viewer, input.eventGroupId);
	if (!access || !orgRolesCan(access.orgRoles, "eventGroup", "update")) {
		throw new ForbiddenError("Insufficient permissions to create sub-events");
	}

	const [group] = await db
		.select({ timeZone: eventGroups.timeZone })
		.from(eventGroups)
		.where(eq(eventGroups.id, input.eventGroupId));
	if (!group) throw new ForbiddenError("Event group not found");

	const scheduledStartUtc = zonedLocalToUtc(input.scheduledStart, group.timeZone);

	const [created] = await db
		.insert(events)
		.values({
			eventGroupId: input.eventGroupId,
			name: input.name,
			courseId: input.courseId,
			lapsRequired: input.lapsRequired,
			scheduledStart: scheduledStartUtc,
		})
		.returning({ id: events.id });

	return { success: true, eventId: created.id };
}

// ============================================================================
// SUB-EVENT WORKSPACE QUERIES & CONTROLS
// ============================================================================

export async function getSubEventOverviewData(
	viewer: Viewer,
	orgSlug: string,
	eventGroupSlug: string,
	eventId: string,
) {
	const { org, group, access } = await resolveEventGroup(
		orgSlug,
		eventGroupSlug,
		viewer,
	);

	const [event] = await db
		.select({
			id: events.id,
			name: events.name,
			lapsRequired: events.lapsRequired,
			scheduledStart: events.scheduledStart,
			actualStart: events.actualStart,
			courseId: events.courseId,
			courseName: courses.name,
			courseDistanceMeters: courses.distanceMeters,
			courseElevationGainMeters: courses.elevationGainMeters,
		})
		.from(events)
		.innerJoin(courses, eq(courses.id, events.courseId))
		.where(and(eq(events.id, eventId), eq(events.eventGroupId, group.id)));

	if (!event) throw new ForbiddenError("Sub-event not found");

	// Load entrants for this distance
	const entrantRows = await db
		.select({
			id: entrants.id,
			competitorNumber: entrants.competitorNumber,
			status: entrants.status,
			actualStartTime: entrants.actualStartTime,
			scheduledStartTime: entrants.scheduledStartTime,
			participantData: entrants.participantData,
			person: {
				id: people.id,
				firstName: people.firstName,
				lastName: people.lastName,
			},
		})
		.from(entrants)
		.innerJoin(people, eq(people.id, entrants.personId))
		.where(eq(entrants.eventId, event.id))
		.orderBy(asc(entrants.competitorNumber));

	const custody: CombinedCustodyCounts = {
		registered: 0,
		checkedIn: 0,
		inProgress: 0,
		finished: 0,
		dnf: 0,
		retired: 0,
		dns: 0,
		total: entrantRows.length,
	};

	for (const e of entrantRows) {
		if (e.status in custody) {
			(custody as Record<string, number>)[e.status]++;
		}
	}

	return {
		organization: org,
		eventGroup: {
			id: group.id,
			name: group.name,
			slug: group.slug,
			discipline: group.discipline,
			rulesConfig: group.rulesConfig,
			timeZone: group.timeZone,
		},
		event: {
			...event,
			scheduledStartIso: event.scheduledStart.toISOString(),
			actualStartIso: event.actualStart?.toISOString() ?? null,
		},
		custody,
		entrants: entrantRows,
		access: {
			orgRoles: access.orgRoles,
			staffRoles: access.staffRoles,
			canManageRaceControl: canManageRaceControl(access),
		},
	};
}

export async function recordGunStart(
	viewer: Viewer,
	input: z.infer<typeof startEventGunInput>,
) {
	const [event] = await db
		.select({ id: events.id, eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, input.eventId));
	if (!event) throw new ForbiddenError("Event not found");

	const access = await getEventGroupAccess(viewer, event.eventGroupId);
	if (!access || !canManageRaceControl(access)) {
		throw new ForbiddenError("Insufficient permissions to start race");
	}

	const gunTime = input.actualStart ? new Date(input.actualStart) : new Date();

	// In a transaction, record event start and transition all checked_in entrants to in_progress
	await db.transaction(async (tx) => {
		await tx
			.update(events)
			.set({ actualStart: gunTime })
			.where(eq(events.id, event.id));

		await tx
			.update(entrants)
			.set({
				status: "in_progress",
				actualStartTime: gunTime,
			})
			.where(
				and(
					eq(entrants.eventId, event.id),
					eq(entrants.status, "checked_in"),
				),
			);
	});

	return { success: true, actualStart: gunTime.toISOString() };
}

export async function resetGunStart(
	viewer: Viewer,
	input: z.infer<typeof resetEventGunInput>,
) {
	const [event] = await db
		.select({ id: events.id, eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, input.eventId));
	if (!event) throw new ForbiddenError("Event not found");

	const access = await getEventGroupAccess(viewer, event.eventGroupId);
	if (!access || !canManageRaceControl(access)) {
		throw new ForbiddenError("Insufficient permissions to reset race start");
	}

	await db.transaction(async (tx) => {
		await tx
			.update(events)
			.set({ actualStart: null })
			.where(eq(events.id, event.id));

		await tx
			.update(entrants)
			.set({
				status: "checked_in",
				actualStartTime: null,
			})
			.where(
				and(
					eq(entrants.eventId, event.id),
					eq(entrants.status, "in_progress"),
				),
			);
	});

	return { success: true };
}

// ============================================================================
// DISCIPLINE OPERATIONAL CONTROLS
// ============================================================================

export async function closeBackyardYard(
	viewer: Viewer,
	input: z.infer<typeof backyardCloseYardInput>,
) {
	const [event] = await db
		.select({ id: events.id, eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, input.eventId));
	if (!event) throw new ForbiddenError("Event not found");

	const access = await getEventGroupAccess(viewer, event.eventGroupId);
	if (!access || !canManageRaceControl(access)) {
		throw new ForbiddenError("Insufficient permissions to execute yard close");
	}

	let completedIds = input.completedEntrantIds;

	// If not provided, query scoredSplitTimes for this event and completedYardNumber
	if (!completedIds) {
		const splits = await db
			.select({ entrantId: scoredSplitTimes.entrantId })
			.from(scoredSplitTimes)
			.innerJoin(entrants, eq(scoredSplitTimes.entrantId, entrants.id))
			.where(
				and(
					eq(entrants.eventId, event.id),
					eq(scoredSplitTimes.lap, input.completedYardNumber),
					eq(scoredSplitTimes.stoppedHere, false),
				),
			);
		completedIds = splits.map((s) => s.entrantId);
	}

	// Active runners in progress who have not completed the yard within time limit
	const inProgressEntrants = await db
		.select({ id: entrants.id })
		.from(entrants)
		.where(
			and(
				eq(entrants.eventId, event.id),
				eq(entrants.status, "in_progress"),
			),
		);

	const entrantsToSweep = inProgressEntrants
		.filter((e) => !completedIds!.includes(e.id))
		.map((e) => e.id);

	if (entrantsToSweep.length === 0) {
		return { success: true, sweptEntrantsCount: 0 };
	}

	const swept = await db
		.update(entrants)
		.set({
			status: "dnf",
			dropReason: "missed_cutoff",
			comments: `Over Time Limit (OTL) on Yard #${input.completedYardNumber}`,
		})
		.where(
			and(
				eq(entrants.eventId, event.id),
				inArray(entrants.id, entrantsToSweep),
			),
		)
		.returning({ id: entrants.id });

	return { success: true, sweptEntrantsCount: swept.length };
}

export async function generateTsdIntervalStarts(
	viewer: Viewer,
	input: z.infer<typeof tsdGenerateIntervalStartsInput>,
) {
	const [event] = await db
		.select({ id: events.id, eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, input.eventId));
	if (!event) throw new ForbiddenError("Event not found");

	const access = await getEventGroupAccess(viewer, event.eventGroupId);
	if (!access || !canManageRaceControl(access)) {
		throw new ForbiddenError("Insufficient permissions to generate intervals");
	}

	const baseTime = new Date(input.baseStartTimeUtc).getTime();
	const intervalMs = input.intervalSeconds * 1000;

	const entrantList = await db
		.select({ id: entrants.id, competitorNumber: entrants.competitorNumber })
		.from(entrants)
		.where(eq(entrants.eventId, event.id));

	// Natural sort so Car #2 departs before Car #10
	entrantList.sort((a, b) =>
		naturalCompareCompetitorNumbers(a.competitorNumber, b.competitorNumber),
	);

	await db.transaction(async (tx) => {
		for (let i = 0; i < entrantList.length; i++) {
			const entrantStart = new Date(baseTime + i * intervalMs);
			await tx
				.update(entrants)
				.set({
					scheduledStartTime: entrantStart,
					actualStartTime: entrantStart,
				})
				.where(eq(entrants.id, entrantList[i].id));
		}
	});

	return { success: true, totalIntervalsAssigned: entrantList.length };
}

export async function toggleTsdSecretCheckpoints(
	viewer: Viewer,
	input: z.infer<typeof tsdRevealSecretCheckpointsInput>,
) {
	const [event] = await db
		.select({ id: events.id, eventGroupId: events.eventGroupId, courseId: events.courseId })
		.from(events)
		.where(eq(events.id, input.eventId));
	if (!event) throw new ForbiddenError("Event not found");

	const access = await getEventGroupAccess(viewer, event.eventGroupId);
	if (!access || !canManageRaceControl(access)) {
		throw new ForbiddenError("Insufficient permissions to toggle secret checkpoints");
	}

	return { success: true, secretCheckpointsRevealed: input.reveal };
}

export async function recordDownhillGateRelease(
	viewer: Viewer,
	input: z.infer<typeof downhillGateReleaseInput>,
) {
	const [event] = await db
		.select({ id: events.id, eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, input.eventId));
	if (!event) throw new ForbiddenError("Event not found");

	const access = await getEventGroupAccess(viewer, event.eventGroupId);
	if (!access || !canManageRaceControl(access)) {
		throw new ForbiddenError("Insufficient permissions to release start gate");
	}

	const startTime = new Date(input.actualStartTime);

	await db
		.update(entrants)
		.set({
			status: "in_progress",
			actualStartTime: startTime,
		})
		.where(
			and(
				eq(entrants.id, input.entrantId),
				eq(entrants.eventId, event.id),
			),
		);

	return { success: true, actualStartTime: startTime.toISOString() };
}

export async function triggerDownhillRedFlag(
	viewer: Viewer,
	input: z.infer<typeof downhillRedFlagHoldInput>,
) {
	const [event] = await db
		.select({ id: events.id, eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, input.eventId));
	if (!event) throw new ForbiddenError("Event not found");

	const access = await getEventGroupAccess(viewer, event.eventGroupId);
	if (!access || !canManageRaceControl(access)) {
		throw new ForbiddenError("Insufficient permissions to trigger red flag hold");
	}

	return { success: true, redFlagActive: true, note: input.holdNote };
}

export async function checkXco80PercentPull(
	viewer: Viewer,
	input: z.infer<typeof xcoCheckLappedPullInput>,
) {
	const [event] = await db
		.select({ id: events.id, eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, input.eventId));
	if (!event) throw new ForbiddenError("Event not found");

	const cutoffThresholdSeconds = Math.round(input.leaderLapTimeSeconds * 0.8);

	return {
		success: true,
		leaderLap: input.leaderLap,
		thresholdSeconds: cutoffThresholdSeconds,
		pullNote: `Riders further back than ${cutoffThresholdSeconds}s behind leader on Lap ${input.leaderLap} are eligible for 80% pull`,
	};
}

export async function recordFixedTimePartialDistance(
	viewer: Viewer,
	input: z.infer<typeof fixedTimeRecordPartialLapInput>,
) {
	const [event] = await db
		.select({ id: events.id, eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, input.eventId));
	if (!event) throw new ForbiddenError("Event not found");

	const access = await getEventGroupAccess(viewer, event.eventGroupId);
	if (!access || !canManageRaceControl(access)) {
		throw new ForbiddenError("Insufficient permissions to record partial distance");
	}

	const [entrant] = await db
		.select({ id: entrants.id, comments: entrants.comments })
		.from(entrants)
		.where(
			and(
				eq(entrants.id, input.entrantId),
				eq(entrants.eventId, event.id),
			),
		);
	if (!entrant) throw new ForbiddenError("Entrant not found");

	const partialNote = `Partial final lap: ${input.partialDistanceMeters}m`;
	const comments = entrant.comments
		? `${entrant.comments} | ${partialNote}`
		: partialNote;

	await db
		.update(entrants)
		.set({
			comments,
		})
		.where(
			and(
				eq(entrants.id, input.entrantId),
				eq(entrants.eventId, event.id),
			),
		);

	return { success: true, partialDistanceMeters: input.partialDistanceMeters };
}

// ============================================================================
// SUB-EVENT COURSE & CUTOFFS QUERIES
// ============================================================================

export async function getSubEventCourseData(
	viewer: Viewer,
	orgSlug: string,
	eventGroupSlug: string,
	eventId: string,
) {
	const { org, group, access } = await resolveEventGroup(
		orgSlug,
		eventGroupSlug,
		viewer,
	);

	const [event] = await db
		.select({
			id: events.id,
			name: events.name,
			courseId: events.courseId,
		})
		.from(events)
		.where(and(eq(events.id, eventId), eq(events.eventGroupId, group.id)));

	if (!event) throw new ForbiddenError("Sub-event not found");

	const [course] = await db
		.select()
		.from(courses)
		.where(eq(courses.id, event.courseId));

	if (!course) throw new ForbiddenError("Course not found");

	const splits = await db
		.select({
			id: courseSplits.id,
			courseId: courseSplits.courseId,
			timingPointId: courseSplits.timingPointId,
			name: courseSplits.name,
			sequenceOrder: courseSplits.sequenceOrder,
			distanceFromStartMeters: courseSplits.distanceFromStartMeters,
			subSplitBitmap: courseSplits.subSplitBitmap,
			cutoffDurationSeconds: courseSplits.cutoffDurationSeconds,
			tsdIdealDurationSeconds: courseSplits.tsdIdealDurationSeconds,
			isSecretCheckpoint: courseSplits.isSecretCheckpoint,
			timingPointName: timingPoints.name,
			timingPointCode: timingPoints.code,
		})
		.from(courseSplits)
		.innerJoin(timingPoints, eq(timingPoints.id, courseSplits.timingPointId))
		.where(eq(courseSplits.courseId, course.id))
		.orderBy(asc(courseSplits.sequenceOrder));

	const orgTimingPoints = await db
		.select()
		.from(timingPoints)
		.where(eq(timingPoints.organizationId, org.id))
		.orderBy(asc(timingPoints.name));

	const orgCourses = await db
		.select({ id: courses.id, name: courses.name, distanceMeters: courses.distanceMeters })
		.from(courses)
		.where(eq(courses.organizationId, org.id))
		.orderBy(asc(courses.name));

	return {
		organization: org,
		eventGroup: {
			id: group.id,
			name: group.name,
			slug: group.slug,
			discipline: group.discipline,
		},
		event,
		course,
		splits,
		timingPoints: orgTimingPoints,
		allCourses: orgCourses,
		access: {
			orgRoles: access.orgRoles,
			staffRoles: access.staffRoles,
			canManageCourse: orgRolesCan(access.orgRoles, "course", "update"),
		},
	};
}

// ============================================================================
// SUB-EVENT ENTRANTS & CHECK-IN DESK QUERIES & MUTATIONS
// ============================================================================

export async function getSubEventEntrantsData(
	viewer: Viewer,
	orgSlug: string,
	eventGroupSlug: string,
	eventId: string,
) {
	const { org, group, access } = await resolveEventGroup(
		orgSlug,
		eventGroupSlug,
		viewer,
	);

	const [event] = await db
		.select({
			id: events.id,
			name: events.name,
			scheduledStart: events.scheduledStart,
			actualStart: events.actualStart,
			courseId: events.courseId,
		})
		.from(events)
		.where(and(eq(events.id, eventId), eq(events.eventGroupId, group.id)));

	if (!event) throw new ForbiddenError("Sub-event not found");

	// Other sub-events in this group (for distance transfer)
	const siblingEvents = await db
		.select({ id: events.id, name: events.name })
		.from(events)
		.where(eq(events.eventGroupId, group.id))
		.orderBy(asc(events.name));

	// Load entrants for this sub-event
	const entrantRows = await db
		.select({
			id: entrants.id,
			eventId: entrants.eventId,
			personId: entrants.personId,
			competitorNumber: entrants.competitorNumber,
			rfidCode: entrants.rfidCode,
			status: entrants.status,
			division: entrants.division,
			participantData: entrants.participantData,
			scheduledStartTime: entrants.scheduledStartTime,
			actualStartTime: entrants.actualStartTime,
			emergencyContactPersonId: entrants.emergencyContactPersonId,
			emergencyContactRelationship: entrants.emergencyContactRelationship,
			emergencyContactIsOnSite: entrants.emergencyContactIsOnSite,
			person: {
				id: people.id,
				firstName: people.firstName,
				lastName: people.lastName,
				email: people.email,
				phone: people.phone,
				gender: people.gender,
				birthdate: people.birthdate,
			},
			emergencyContact: {
				id: emergencyContacts.id,
				firstName: emergencyContacts.firstName,
				lastName: emergencyContacts.lastName,
				phone: emergencyContacts.phone,
			},
			summary: {
				experienceTier: personHistoricalSummaries.experienceTier,
				totalRaces: personHistoricalSummaries.totalRaces,
				totalFinishes: personHistoricalSummaries.totalFinishes,
				totalDnfs: personHistoricalSummaries.totalDnfs,
				dnfRate: personHistoricalSummaries.dnfRate,
				ultrasignupRank: personHistoricalSummaries.ultrasignupRank,
				itraPerformanceIndex: personHistoricalSummaries.itraPerformanceIndex,
			},
			projection: {
				projectedFinishSeconds: entrantHistoricalProjections.projectedFinishSeconds,
				projectedPaceSecondsPerKm: entrantHistoricalProjections.projectedPaceSecondsPerKm,
				expectedCutoffRisk: entrantHistoricalProjections.expectedCutoffRisk,
				volunteersSarSafetyBadge: entrantHistoricalProjections.volunteersSarSafetyBadge,
			},
		})
		.from(entrants)
		.innerJoin(people, eq(people.id, entrants.personId))
		.leftJoin(
			emergencyContacts,
			eq(emergencyContacts.id, entrants.emergencyContactPersonId),
		)
		.leftJoin(
			personHistoricalSummaries,
			eq(personHistoricalSummaries.personId, entrants.personId),
		)
		.leftJoin(
			entrantHistoricalProjections,
			eq(entrantHistoricalProjections.entrantId, entrants.id),
		)
		.where(eq(entrants.eventId, event.id))
		.orderBy(asc(entrants.competitorNumber));

	// Load all external profiles for these people
	const personIds = Array.from(new Set(entrantRows.map((e) => e.personId)));
	const externalProfileRows =
		personIds.length > 0
			? await db
					.select()
					.from(personExternalProfiles)
					.where(inArray(personExternalProfiles.personId, personIds))
			: [];

	const profilesByPersonId = new Map<string, typeof externalProfileRows>();
	for (const p of externalProfileRows) {
		const list = profilesByPersonId.get(p.personId) ?? [];
		list.push(p);
		profilesByPersonId.set(p.personId, list);
	}

	const enrichedEntrants = entrantRows.map((e) => ({
		...e,
		externalProfiles: profilesByPersonId.get(e.personId) ?? [],
	}));

	return {
		organization: org,
		eventGroup: {
			id: group.id,
			name: group.name,
			slug: group.slug,
			discipline: group.discipline,
			timeZone: group.timeZone,
		},
		event: {
			id: event.id,
			name: event.name,
			scheduledStartIso: event.scheduledStart.toISOString(),
			actualStartIso: event.actualStart?.toISOString() ?? null,
		},
		siblingEvents,
		entrants: enrichedEntrants,
		access: {
			orgRoles: access.orgRoles,
			staffRoles: access.staffRoles,
			canManageEntrants: orgRolesCan(access.orgRoles, "entrant", "update"),
			canViewMedicalData: canViewMedicalData(access),
		},
	};
}

export async function checkInEntrant(
	viewer: Viewer,
	input: z.infer<typeof checkInEntrantInput>,
) {
	const [entrant] = await db
		.select({ id: entrants.id, eventId: entrants.eventId })
		.from(entrants)
		.where(eq(entrants.id, input.entrantId));
	if (!entrant) throw new ForbiddenError("Entrant not found");

	const [event] = await db
		.select({ eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, entrant.eventId));
	if (!event) throw new ForbiddenError("Event not found");

	const access = await getEventGroupAccess(viewer, event.eventGroupId);
	if (!access) throw new ForbiddenError("Access denied");

	const updateValues: Partial<typeof entrants.$inferInsert> = {
		status: input.status,
	};
	if (input.competitorNumber !== undefined) {
		updateValues.competitorNumber = input.competitorNumber;
	}
	if (input.rfidCode !== undefined) {
		updateValues.rfidCode = input.rfidCode;
	}
	if (input.emergencyContactIsOnSite !== undefined) {
		updateValues.emergencyContactIsOnSite = input.emergencyContactIsOnSite;
	}

	await db
		.update(entrants)
		.set(updateValues)
		.where(eq(entrants.id, input.entrantId));

	return { success: true, entrantId: input.entrantId, status: input.status };
}

export async function updateEntrantWorkspace(
	viewer: Viewer,
	input: z.infer<typeof updateEntrantWorkspaceInput>,
) {
	const [entrant] = await db
		.select({ id: entrants.id, eventId: entrants.eventId, personId: entrants.personId })
		.from(entrants)
		.where(eq(entrants.id, input.entrantId));
	if (!entrant) throw new ForbiddenError("Entrant not found");

	const [event] = await db
		.select({ eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, entrant.eventId));
	if (!event) throw new ForbiddenError("Event not found");

	const access = await getEventGroupAccess(viewer, event.eventGroupId);
	if (!access || !orgRolesCan(access.orgRoles, "entrant", "update")) {
		throw new ForbiddenError("Insufficient permissions to update entrant");
	}

	let emergencyContactPersonId = input.emergencyContactPersonId;
	if (!emergencyContactPersonId && (input.emergencyContactFirstName || input.emergencyContactPhone)) {
		const ecPerson = await findOrCreatePerson(db, {
			firstName: input.emergencyContactFirstName ?? "Emergency",
			lastName: input.emergencyContactLastName ?? "Contact",
			phone: input.emergencyContactPhone ?? undefined,
		});
		emergencyContactPersonId = ecPerson.id;
	}

	const updatePayload: Partial<typeof entrants.$inferInsert> = {
		competitorNumber: input.competitorNumber,
		rfidCode: input.rfidCode,
		division: input.division,
		participantData: input.participantData,
		emergencyContactPersonId,
		emergencyContactRelationship: input.emergencyContactRelationship,
		emergencyContactIsOnSite: input.emergencyContactIsOnSite ?? false,
	};

	if (input.targetEventId && input.targetEventId !== entrant.eventId) {
		const [targetEvent] = await db
			.select({ id: events.id, eventGroupId: events.eventGroupId })
			.from(events)
			.where(eq(events.id, input.targetEventId));
		if (!targetEvent || targetEvent.eventGroupId !== event.eventGroupId) {
			throw new ForbiddenError("Cannot transfer entrant across event groups");
		}
		updatePayload.eventId = input.targetEventId;
	}

	if (input.scheduledStartTime !== undefined) {
		updatePayload.scheduledStartTime = input.scheduledStartTime
			? new Date(input.scheduledStartTime)
			: null;
	}
	if (input.actualStartTime !== undefined) {
		updatePayload.actualStartTime = input.actualStartTime
			? new Date(input.actualStartTime)
			: null;
	}

	await withConstraintMessages(
		db.update(entrants).set(updatePayload).where(eq(entrants.id, input.entrantId)),
		{
			entrants_event_competitor_idx: "That bib number is already taken in the target sub-event.",
		},
	);

	return { success: true };
}

export async function verifyExternalProfile(
	viewer: Viewer,
	input: z.infer<typeof verifyExternalProfileInput>,
) {
	if (!(await canVerifyExternalProfiles(viewer))) {
		throw new ForbiddenError("Insufficient permissions to verify external profiles");
	}

	const [profile] = await db
		.select({ id: personExternalProfiles.id })
		.from(personExternalProfiles)
		.where(eq(personExternalProfiles.id, input.externalProfileId));
	if (!profile) throw new ForbiddenError("External profile not found");

	await db
		.update(personExternalProfiles)
		.set({
			verificationStatus: input.status,
			updatedAt: new Date(),
		})
		.where(eq(personExternalProfiles.id, input.externalProfileId));

	return { success: true, verificationStatus: input.status };
}

export async function recalculateEntrantProjection(
	viewer: Viewer,
	input: z.infer<typeof recalculateEntrantProjectionInput>,
) {
	const [entrant] = await db
		.select({
			id: entrants.id,
			personId: entrants.personId,
			eventId: entrants.eventId,
		})
		.from(entrants)
		.where(eq(entrants.id, input.entrantId));
	if (!entrant) throw new ForbiddenError("Entrant not found");

	const [event] = await db
		.select({ courseId: events.courseId, eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, entrant.eventId));
	if (!event) throw new ForbiddenError("Event not found");

	const access = await getEventGroupAccess(viewer, event.eventGroupId);
	if (!access || !canManageRaceControl(access)) {
		throw new ForbiddenError("Insufficient permissions to recalculate projection");
	}

	const [course] = await db
		.select({ distanceMeters: courses.distanceMeters })
		.from(courses)
		.where(eq(courses.id, event.courseId));
	const courseDistanceKm = (course?.distanceMeters ?? 50000) / 1000;

	// Load historical summary
	const [summary] = await db
		.select()
		.from(personHistoricalSummaries)
		.where(eq(personHistoricalSummaries.personId, entrant.personId));

	// Load max cutoff for course
	const splitsWithCutoff = await db
		.select({ cutoff: courseSplits.cutoffDurationSeconds })
		.from(courseSplits)
		.where(
			and(
				eq(courseSplits.courseId, event.courseId),
				sql`${courseSplits.cutoffDurationSeconds} IS NOT NULL`,
			),
		)
		.orderBy(desc(courseSplits.cutoffDurationSeconds));

	const maxCutoffSeconds = splitsWithCutoff[0]?.cutoff ?? null;

	// Determine baseline pace (seconds/km)
	let paceSecondsPerKm = summary?.avgPaceSecondsPerKm;
	if (!paceSecondsPerKm) {
		switch (summary?.experienceTier) {
			case "elite":
				paceSecondsPerKm = 270; // 4:30 / km
				break;
			case "veteran":
				paceSecondsPerKm = 330; // 5:30 / km
				break;
			case "intermediate":
				paceSecondsPerKm = 380; // 6:20 / km
				break;
			default:
				paceSecondsPerKm = 450; // 7:30 / km
				break;
		}
	}

	const projectedFinishSeconds = Math.round(courseDistanceKm * paceSecondsPerKm);
	const confidenceBandLowSeconds = Math.round(projectedFinishSeconds * 0.9);
	const confidenceBandHighSeconds = Math.round(projectedFinishSeconds * 1.15);

	const expectedCutoffRisk = Boolean(
		maxCutoffSeconds && projectedFinishSeconds > maxCutoffSeconds,
	);

	let volunteersSarSafetyBadge = "STABLE PACING";
	if (expectedCutoffRisk) {
		volunteersSarSafetyBadge = "HIGH CUTOFF RISK";
	} else if (summary && summary.dnfRate > 0.3) {
		volunteersSarSafetyBadge = "WATCH: DNF HISTORY";
	} else if (summary && summary.totalFinishes > 5) {
		volunteersSarSafetyBadge = "EXPERIENCED FINISHER";
	}

	// Upsert projection
	await db
		.insert(entrantHistoricalProjections)
		.values({
			entrantId: entrant.id,
			personId: entrant.personId,
			projectedFinishSeconds,
			projectedPaceSecondsPerKm: paceSecondsPerKm,
			confidenceBandLowSeconds,
			confidenceBandHighSeconds,
			expectedCutoffRisk,
			volunteersSarSafetyBadge,
			projectionMethod: "historical_pacing",
			computedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: [entrantHistoricalProjections.entrantId],
			set: {
				projectedFinishSeconds,
				projectedPaceSecondsPerKm: paceSecondsPerKm,
				confidenceBandLowSeconds,
				confidenceBandHighSeconds,
				expectedCutoffRisk,
				volunteersSarSafetyBadge,
				computedAt: new Date(),
			},
		});

	return {
		success: true,
		projectedFinishSeconds,
		expectedCutoffRisk,
		volunteersSarSafetyBadge,
	};
}
