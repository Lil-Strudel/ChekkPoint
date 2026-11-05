import "@tanstack/solid-start/server-only";
import { and, asc, count, desc, eq, gt, lt, max } from "drizzle-orm";
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
import {
	SUB_SPLIT_IN,
	SUB_SPLIT_OUT,
	type copyCourseInput,
	type courseIdInput,
	type createCourseInput,
	type createSplitInput,
	type generateStartFinishSplitsInput,
	type moveSplitInput,
	type reorderCourseSplitInput,
	type splitIdInput,
	type updateCourseInput,
	type updateSplitInput,
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

	// Pre-check references in events
	const [eventsRef] = await db
		.select({ count: count() })
		.from(events)
		.where(eq(events.courseId, data.courseId));
	if (eventsRef && eventsRef.count > 0) {
		throw new Error(
			`Cannot delete course because it is used by ${eventsRef.count} event(s). Move or delete those events first.`,
		);
	}

	// Null out copiedFromCourseId references on child courses
	await db
		.update(courses)
		.set({ copiedFromCourseId: null })
		.where(eq(courses.copiedFromCourseId, data.courseId));

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

export async function generateStartFinishSplits(
	viewer: Viewer,
	data: z.infer<typeof generateStartFinishSplitsInput>,
) {
	const organizationId = await requireCoursePermission(
		viewer,
		data.courseId,
		"update",
	);

	const [course] = await db
		.select({
			id: courses.id,
			name: courses.name,
			distanceMeters: courses.distanceMeters,
			organizationId: courses.organizationId,
		})
		.from(courses)
		.where(eq(courses.id, data.courseId));
	if (!course) throw new Error("Course not found");

	const existingSplits = await db
		.select({ id: courseSplits.id })
		.from(courseSplits)
		.where(eq(courseSplits.courseId, data.courseId));
	if (existingSplits.length > 0) {
		throw new Error("Course already has splits configured");
	}

	return db.transaction(async (tx) => {
		// Find or create START timing point
		let [startPoint] = await tx
			.select({ id: timingPoints.id })
			.from(timingPoints)
			.where(
				and(
					eq(timingPoints.organizationId, organizationId),
					eq(timingPoints.code, "START"),
				),
			);
		if (!startPoint) {
			[startPoint] = await tx
				.insert(timingPoints)
				.values({
					organizationId,
					name: "Start",
					code: "START",
					latitude: null,
					longitude: null,
					elevationMeters: null,
				})
				.returning({ id: timingPoints.id });
		}

		// Find or create FINISH timing point
		let [finishPoint] = await tx
			.select({ id: timingPoints.id })
			.from(timingPoints)
			.where(
				and(
					eq(timingPoints.organizationId, organizationId),
					eq(timingPoints.code, "FINISH"),
				),
			);
		if (!finishPoint) {
			[finishPoint] = await tx
				.insert(timingPoints)
				.values({
					organizationId,
					name: "Finish",
					code: "FINISH",
					latitude: null,
					longitude: null,
					elevationMeters: null,
				})
				.returning({ id: timingPoints.id });
		}

		// Insert Start Split
		await tx.insert(courseSplits).values({
			courseId: course.id,
			timingPointId: startPoint.id,
			name: "Start",
			sequenceOrder: 1,
			distanceFromStartMeters: 0,
			subSplitBitmap: SUB_SPLIT_OUT, // 2 = OUT
			cutoffDurationSeconds: null,
			tsdIdealDurationSeconds: null,
			isSecretCheckpoint: false,
		});

		// Insert Finish Split
		await tx.insert(courseSplits).values({
			courseId: course.id,
			timingPointId: finishPoint.id,
			name: "Finish",
			sequenceOrder: 2,
			distanceFromStartMeters: course.distanceMeters,
			subSplitBitmap: SUB_SPLIT_IN, // 1 = IN
			cutoffDurationSeconds: null,
			tsdIdealDurationSeconds: null,
			isSecretCheckpoint: false,
		});
	});
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
	const split = await requireSplit(viewer, data.splitId);
	await db.transaction(async (tx) => {
		// Delete the split
		await tx.delete(courseSplits).where(eq(courseSplits.id, data.splitId));

		// Renumber remaining splits cleanly using negative offsets to avoid unique index collisions
		const remaining = await tx
			.select({ id: courseSplits.id })
			.from(courseSplits)
			.where(eq(courseSplits.courseId, split.courseId))
			.orderBy(asc(courseSplits.sequenceOrder));

		for (let i = 0; i < remaining.length; i++) {
			await tx
				.update(courseSplits)
				.set({ sequenceOrder: -1000 - i })
				.where(eq(courseSplits.id, remaining[i].id));
		}
		for (let i = 0; i < remaining.length; i++) {
			await tx
				.update(courseSplits)
				.set({ sequenceOrder: i + 1 })
				.where(eq(courseSplits.id, remaining[i].id));
		}
	});
}

export async function moveSplit(
	viewer: Viewer,
	data: z.infer<typeof moveSplitInput>,
) {
	const split = await requireSplit(viewer, data.splitId);
	const up = data.direction === "up";

	await db.transaction(async (tx) => {
		const splits = await tx
			.select({
				id: courseSplits.id,
				sequenceOrder: courseSplits.sequenceOrder,
			})
			.from(courseSplits)
			.where(eq(courseSplits.courseId, split.courseId))
			.orderBy(asc(courseSplits.sequenceOrder));

		const idx = splits.findIndex((s) => s.id === data.splitId);
		if (idx === -1) return;
		const targetIdx = up ? idx - 1 : idx + 1;
		if (targetIdx < 0 || targetIdx >= splits.length) return;

		// Swap items in memory
		const [moved] = splits.splice(idx, 1);
		splits.splice(targetIdx, 0, moved);

		// Step 1: Shift to negative temporary sequence orders to avoid index collisions
		for (let i = 0; i < splits.length; i++) {
			await tx
				.update(courseSplits)
				.set({ sequenceOrder: -1000 - i })
				.where(eq(courseSplits.id, splits[i].id));
		}

		// Step 2: Write final contiguous positive sequence orders 1..N
		for (let i = 0; i < splits.length; i++) {
			await tx
				.update(courseSplits)
				.set({ sequenceOrder: i + 1 })
				.where(eq(courseSplits.id, splits[i].id));
		}
	});
}

export async function reorderCourseSplit(
	viewer: Viewer,
	data: z.infer<typeof reorderCourseSplitInput>,
) {
	await requireCoursePermission(viewer, data.courseId, "update");

	await db.transaction(async (tx) => {
		const splits = await tx
			.select({
				id: courseSplits.id,
				sequenceOrder: courseSplits.sequenceOrder,
			})
			.from(courseSplits)
			.where(eq(courseSplits.courseId, data.courseId))
			.orderBy(asc(courseSplits.sequenceOrder));

		const idx = splits.findIndex((s) => s.id === data.splitId);
		if (idx === -1) return;
		const targetIdx = Math.max(
			0,
			Math.min(splits.length - 1, data.newSequenceOrder - 1),
		);
		if (idx === targetIdx) return;

		const [moved] = splits.splice(idx, 1);
		splits.splice(targetIdx, 0, moved);

		// Negative offset park
		for (let i = 0; i < splits.length; i++) {
			await tx
				.update(courseSplits)
				.set({ sequenceOrder: -1000 - i })
				.where(eq(courseSplits.id, splits[i].id));
		}

		// Final 1..N order
		for (let i = 0; i < splits.length; i++) {
			await tx
				.update(courseSplits)
				.set({ sequenceOrder: i + 1 })
				.where(eq(courseSplits.id, splits[i].id));
		}
	});
}
