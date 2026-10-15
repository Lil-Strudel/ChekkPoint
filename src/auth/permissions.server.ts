import "@tanstack/solid-start/server-only";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
	eventGroupStaff,
	eventGroupStaffTimingPoints,
	eventGroups,
	organizationMembers,
	type StaffRole,
} from "../db/schema";
import {
	type OrgRole,
	orgRolesCan,
	parseOrgRoles,
	type statements,
} from "./access";
import type { Viewer } from "./session.server";

export class ForbiddenError extends Error {
	constructor(message = "You don't have permission to do that") {
		super(message);
	}
}

export async function getOrgRoles(userId: string, organizationId: string) {
	const [member] = await db
		.select({ role: organizationMembers.role })
		.from(organizationMembers)
		.where(
			and(
				eq(organizationMembers.userId, userId),
				eq(organizationMembers.organizationId, organizationId),
			),
		);
	return member ? parseOrgRoles(member.role) : [];
}

export async function requireOrgPermission<R extends keyof typeof statements>(
	viewer: Viewer,
	organizationId: string,
	resource: R,
	action: (typeof statements)[R][number],
) {
	const orgRoles = await getOrgRoles(viewer.user.id, organizationId);
	if (!orgRolesCan(orgRoles, resource, action)) throw new ForbiddenError();
	return orgRoles;
}

export type EventGroupAccess = {
	organizationId: string;
	orgRoles: OrgRole[];
	staffRoles: StaffRole[];
	timingPointIds: string[];
};

export async function getEventGroupAccess(
	viewer: Viewer,
	eventGroupId: string,
): Promise<EventGroupAccess | null> {
	const [group] = await db
		.select({ organizationId: eventGroups.organizationId })
		.from(eventGroups)
		.where(eq(eventGroups.id, eventGroupId));
	if (!group) return null;

	const orgRoles = await getOrgRoles(viewer.user.id, group.organizationId);

	let staffRoles: StaffRole[] = [];
	let timingPointIds: string[] = [];
	if (viewer.person) {
		const [staff] = await db
			.select({ id: eventGroupStaff.id, roles: eventGroupStaff.roles })
			.from(eventGroupStaff)
			.where(
				and(
					eq(eventGroupStaff.eventGroupId, eventGroupId),
					eq(eventGroupStaff.personId, viewer.person.id),
				),
			);
		if (staff) {
			staffRoles = staff.roles;
			const assignments = await db
				.select({ timingPointId: eventGroupStaffTimingPoints.timingPointId })
				.from(eventGroupStaffTimingPoints)
				.where(eq(eventGroupStaffTimingPoints.staffId, staff.id));
			timingPointIds = assignments.map((a) => a.timingPointId);
		}
	}

	if (orgRoles.length === 0 && staffRoles.length === 0) return null;
	return {
		organizationId: group.organizationId,
		orgRoles,
		staffRoles,
		timingPointIds,
	};
}

export function canManageStaff(access: EventGroupAccess) {
	return orgRolesCan(access.orgRoles, "staff", "assign");
}

export function canRecordAt(access: EventGroupAccess, timingPointId: string) {
	if (orgRolesCan(access.orgRoles, "timing", "record")) return true;
	if (access.staffRoles.includes("official")) return true;
	const stationed =
		access.staffRoles.includes("volunteer") ||
		access.staffRoles.includes("checkpoint_captain");
	return stationed && access.timingPointIds.includes(timingPointId);
}
