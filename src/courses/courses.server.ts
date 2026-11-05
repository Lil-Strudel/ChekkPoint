import "@tanstack/solid-start/server-only";
import { and, asc, desc, eq, gt, lt, max } from "drizzle-orm";
import type { z } from "zod";
import { orgRolesCan } from "../auth/access";
import {
	ForbiddenError,
	getOrgRoles,
	requireOrgPermission,
} from "../auth/permissions.server";
import type { Viewer } from "../auth/session.server";
import { db } from "../db";
import { withConstraintMessages } from "../db/errors.server";
import {
	courseSplits,
	courses,
	eventGroups,
	events,
	organizations,
	timingPoints,
} from "../db/schema";
import type {
	copyCourseInput,
	courseIdInput,
	createCourseInput,
	createSplitInput,
	moveSplitInput,
	splitIdInput,
	updateCourseInput,
	updateSplitInput,
} from "./courses.shared";

const courseConstraints = {
	events_course_id_courses_id_fkey:
		"Events still run on this course. Move or delete them first.",
	course_splits_order_idx:
		"Another split was added at the same time. Reload and try again.",
};

export async function getCoursePage(viewer: Viewer, courseId: string) {
	const [course] = await db
		.select({
			id: courses.id,
			organizationId: courses.organizationId,
			name: courses.name,
			distanceMeters: courses.distanceMeters,
			elevationGainMeters: courses.elevationGainMeters,
			gpxRouteUrl: courses.gpxRouteUrl,
			copiedFromCourseId: courses.copiedFromCourseId,
			organizationSlug: organizations.slug,
		})
		.from(courses)
		.innerJoin(organizations, eq(organizations.id, courses.organizationId))
		.where(eq(courses.id, courseId));
	if (!course) return null;

	const myRoles = await getOrgRoles(viewer.user.id, course.organizationId);
	if (myRoles.length === 0) return null;

	const [splits, points, usedBy, copiedFrom] = await Promise.all([
		db
			.select({
				id: courseSplits.id,
				timingPointId: courseSplits.timingPointId,
				timingPointCode: timingPoints.code,
				name: courseSplits.name,
				sequenceOrder: courseSplits.sequenceOrder,
				distanceFromStartMeters: courseSplits.distanceFromStartMeters,
				subSplitBitmap: courseSplits.subSplitBitmap,
				cutoffDurationSeconds: courseSplits.cutoffDurationSeconds,
				tsdIdealDurationSeconds: courseSplits.tsdIdealDurationSeconds,
				isSecretCheckpoint: courseSplits.isSecretCheckpoint,
			})
			.from(courseSplits)
			.innerJoin(timingPoints, eq(timingPoints.id, courseSplits.timingPointId))
			.where(eq(courseSplits.courseId, courseId))
			.orderBy(asc(courseSplits.sequenceOrder)),
		db
			.select({
				id: timingPoints.id,
				name: timingPoints.name,
				code: timingPoints.code,
			})
			.from(timingPoints)
			.where(eq(timingPoints.organizationId, course.organizationId))
			.orderBy(asc(timingPoints.code)),
		db
			.select({
				id: events.id,
				name: events.name,
				eventGroupId: eventGroups.id,
				eventGroupName: eventGroups.name,
			})
			.from(events)
			.innerJoin(eventGroups, eq(eventGroups.id, events.eventGroupId))
			.where(eq(events.courseId, courseId))
			.orderBy(desc(events.scheduledStart)),
		course.copiedFromCourseId
			? db
					.select({ id: courses.id, name: courses.name })
					.from(courses)
					.where(eq(courses.id, course.copiedFromCourseId))
			: Promise.resolve([]),
	]);

	return {
		course,
		copiedFrom: copiedFrom[0] ?? null,
		can: {
			create: orgRolesCan(myRoles, "course", "create"),
			update: orgRolesCan(myRoles, "course", "update"),
			delete: orgRolesCan(myRoles, "course", "delete"),
		},
		splits,
		timingPoints: points,
		events: usedBy,
	};
}

async function requireCoursePermission(
	viewer: Viewer,
	courseId: string,
	action: "create" | "update" | "delete",
) {
	const [course] = await db
		.select({ organizationId: courses.organizationId })
		.from(courses)
		.where(eq(courses.id, courseId));
	if (!course) throw new ForbiddenError();
	await requireOrgPermission(viewer, course.organizationId, "course", action);
	return course.organizationId;
}

async function requireOwnTimingPoint(
	organizationId: string,
	timingPointId: string,
) {
	const [point] = await db
		.select({ id: timingPoints.id })
		.from(timingPoints)
		.where(
			and(
				eq(timingPoints.id, timingPointId),
				eq(timingPoints.organizationId, organizationId),
			),
		);
	if (!point) {
		throw new ForbiddenError("Timing point belongs to another organization");
	}
}

export async function createCourse(
	viewer: Viewer,
	data: z.infer<typeof createCourseInput>,
) {
	await requireOrgPermission(viewer, data.organizationId, "course", "create");
	const [course] = await db
		.insert(courses)
		.values(data)
		.returning({ id: courses.id });
	return course;
}

export async function updateCourse(
	viewer: Viewer,
	{ courseId, ...data }: z.infer<typeof updateCourseInput>,
) {
	await requireCoursePermission(viewer, courseId, "update");
	await db.update(courses).set(data).where(eq(courses.id, courseId));
}

export async function deleteCourse(
	viewer: Viewer,
	data: z.infer<typeof courseIdInput>,
) {
	await requireCoursePermission(viewer, data.courseId, "delete");
	await withConstraintMessages(courseConstraints, () =>
		db.delete(courses).where(eq(courses.id, data.courseId)),
	);
}

export async function copyCourse(
	viewer: Viewer,
	data: z.infer<typeof copyCourseInput>,
) {
	await requireCoursePermission(viewer, data.courseId, "create");
	return db.transaction(async (tx) => {
		const [source] = await tx
			.select()
			.from(courses)
			.where(eq(courses.id, data.courseId));
		const [copy] = await tx
			.insert(courses)
			.values({
				organizationId: source.organizationId,
				name: data.name,
				distanceMeters: source.distanceMeters,
				elevationGainMeters: source.elevationGainMeters,
				gpxRouteUrl: source.gpxRouteUrl,
				copiedFromCourseId: source.id,
			})
			.returning({ id: courses.id });

		const splits = await tx
			.select()
			.from(courseSplits)
			.where(eq(courseSplits.courseId, source.id));
		if (splits.length > 0) {
			await tx.insert(courseSplits).values(
				splits.map(({ id: _, createdAt: __, ...split }) => ({
					...split,
					courseId: copy.id,
				})),
			);
		}
		return copy;
	});
}

export async function createSplit(
	viewer: Viewer,
	{ courseId, ...data }: z.infer<typeof createSplitInput>,
) {
	const organizationId = await requireCoursePermission(
		viewer,
		courseId,
		"update",
	);
	await requireOwnTimingPoint(organizationId, data.timingPointId);
	const [{ last }] = await db
		.select({ last: max(courseSplits.sequenceOrder) })
		.from(courseSplits)
		.where(eq(courseSplits.courseId, courseId));
	const [split] = await withConstraintMessages(courseConstraints, () =>
		db
			.insert(courseSplits)
			.values({ ...data, courseId, sequenceOrder: (last ?? 0) + 1 })
			.returning({ id: courseSplits.id }),
	);
	return split;
}

async function requireSplit(viewer: Viewer, splitId: string) {
	const [split] = await db
		.select({
			courseId: courseSplits.courseId,
			sequenceOrder: courseSplits.sequenceOrder,
		})
		.from(courseSplits)
		.where(eq(courseSplits.id, splitId));
	if (!split) throw new ForbiddenError();
	const organizationId = await requireCoursePermission(
		viewer,
		split.courseId,
		"update",
	);
	return { ...split, organizationId };
}

export async function updateSplit(
	viewer: Viewer,
	{ splitId, ...data }: z.infer<typeof updateSplitInput>,
) {
	const split = await requireSplit(viewer, splitId);
	await requireOwnTimingPoint(split.organizationId, data.timingPointId);
	await db.update(courseSplits).set(data).where(eq(courseSplits.id, splitId));
}

export async function deleteSplit(
	viewer: Viewer,
	data: z.infer<typeof splitIdInput>,
) {
	await requireSplit(viewer, data.splitId);
	await db.delete(courseSplits).where(eq(courseSplits.id, data.splitId));
}

export async function moveSplit(
	viewer: Viewer,
	data: z.infer<typeof moveSplitInput>,
) {
	const split = await requireSplit(viewer, data.splitId);
	const up = data.direction === "up";

	await db.transaction(async (tx) => {
		const [neighbour] = await tx
			.select({
				id: courseSplits.id,
				sequenceOrder: courseSplits.sequenceOrder,
			})
			.from(courseSplits)
			.where(
				and(
					eq(courseSplits.courseId, split.courseId),
					up
						? lt(courseSplits.sequenceOrder, split.sequenceOrder)
						: gt(courseSplits.sequenceOrder, split.sequenceOrder),
				),
			)
			.orderBy(
				up ? desc(courseSplits.sequenceOrder) : asc(courseSplits.sequenceOrder),
			)
			.limit(1);
		if (!neighbour) return;

		// The (course_id, sequence_order) index isn't deferrable, so park one
		// split on an unused order while the other takes its place.
		await tx
			.update(courseSplits)
			.set({ sequenceOrder: -1 })
			.where(eq(courseSplits.id, data.splitId));
		await tx
			.update(courseSplits)
			.set({ sequenceOrder: split.sequenceOrder })
			.where(eq(courseSplits.id, neighbour.id));
		await tx
			.update(courseSplits)
			.set({ sequenceOrder: neighbour.sequenceOrder })
			.where(eq(courseSplits.id, data.splitId));
	});
}
