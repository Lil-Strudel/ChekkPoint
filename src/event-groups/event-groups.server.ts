import "@tanstack/solid-start/server-only";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import {
	ForbiddenError,
	requireOrgPermission,
} from "../auth/permissions.server";
import type { Viewer } from "../auth/session.server";
import { db } from "../db";
import { courses, eventGroups, events } from "../db/schema";
import { zonedLocalToUtc } from "../lib/zoned-time";
import type {
	createEventInput,
	eventIdInput,
	updateEventGroupInput,
	updateEventInput,
	updateRulesConfigInput,
} from "./event-groups.shared";

async function requireEventGroupPermission(
	viewer: Viewer,
	eventGroupId: string,
	action: "update" | "delete",
) {
	const [group] = await db
		.select({
			organizationId: eventGroups.organizationId,
			timeZone: eventGroups.timeZone,
		})
		.from(eventGroups)
		.where(eq(eventGroups.id, eventGroupId));
	if (!group) throw new ForbiddenError();
	await requireOrgPermission(
		viewer,
		group.organizationId,
		"eventGroup",
		action,
	);
	return group;
}

export async function updateEventGroup(
	viewer: Viewer,
	{ eventGroupId, ...data }: z.infer<typeof updateEventGroupInput>,
) {
	await requireEventGroupPermission(viewer, eventGroupId, "update");
	await db
		.update(eventGroups)
		.set({
			...data,
			startDate: new Date(data.startDate),
			endDate: new Date(data.endDate),
		})
		.where(eq(eventGroups.id, eventGroupId));
}

export async function updateRulesConfig(
	viewer: Viewer,
	data: z.infer<typeof updateRulesConfigInput>,
) {
	await requireEventGroupPermission(viewer, data.eventGroupId, "update");
	await db
		.update(eventGroups)
		.set({ rulesConfig: data.rulesConfig })
		.where(eq(eventGroups.id, data.eventGroupId));
}

export async function deleteEventGroup(
	viewer: Viewer,
	data: { eventGroupId: string },
) {
	await requireEventGroupPermission(viewer, data.eventGroupId, "delete");
	await db.delete(eventGroups).where(eq(eventGroups.id, data.eventGroupId));
}

async function requireOwnCourse(organizationId: string, courseId: string) {
	const [course] = await db
		.select({ id: courses.id })
		.from(courses)
		.where(
			and(eq(courses.id, courseId), eq(courses.organizationId, organizationId)),
		);
	if (!course)
		throw new ForbiddenError("Course belongs to another organization");
}

function eventValues(
	data: z.infer<typeof createEventInput> | z.infer<typeof updateEventInput>,
	timeZone: string,
) {
	return {
		courseId: data.courseId,
		name: data.name,
		lapsRequired: data.lapsRequired,
		scheduledStart: zonedLocalToUtc(data.scheduledStart, timeZone),
		actualStart: data.actualStart
			? zonedLocalToUtc(data.actualStart, timeZone)
			: null,
	};
}

export async function createEvent(
	viewer: Viewer,
	data: z.infer<typeof createEventInput>,
) {
	const group = await requireEventGroupPermission(
		viewer,
		data.eventGroupId,
		"update",
	);
	await requireOwnCourse(group.organizationId, data.courseId);
	const [event] = await db
		.insert(events)
		.values({
			eventGroupId: data.eventGroupId,
			...eventValues(data, group.timeZone),
		})
		.returning({ id: events.id });
	return event;
}

async function requireEvent(viewer: Viewer, eventId: string) {
	const [event] = await db
		.select({ eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, eventId));
	if (!event) throw new ForbiddenError();
	return requireEventGroupPermission(viewer, event.eventGroupId, "update");
}

export async function updateEvent(
	viewer: Viewer,
	data: z.infer<typeof updateEventInput>,
) {
	const group = await requireEvent(viewer, data.eventId);
	await requireOwnCourse(group.organizationId, data.courseId);
	await db
		.update(events)
		.set(eventValues(data, group.timeZone))
		.where(eq(events.id, data.eventId));
}

export async function deleteEvent(
	viewer: Viewer,
	data: z.infer<typeof eventIdInput>,
) {
	await requireEvent(viewer, data.eventId);
	await db.delete(events).where(eq(events.id, data.eventId));
}
