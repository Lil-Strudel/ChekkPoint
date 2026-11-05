import { notFound } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { authMiddleware } from "../auth/middleware";
import {
	copyCourse,
	createCourse,
	createSplit,
	deleteCourse,
	deleteSplit,
	getCoursePage,
	moveSplit,
	updateCourse,
	updateSplit,
} from "./courses.server";
import {
	copyCourseInput,
	courseIdInput,
	createCourseInput,
	createSplitInput,
	moveSplitInput,
	splitIdInput,
	updateCourseInput,
	updateSplitInput,
} from "./courses.shared";

export const getCourse = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(courseIdInput)
	.handler(async ({ context, data }) => {
		const page = await getCoursePage(context.viewer, data.courseId);
		if (!page) throw notFound();
		return page;
	});

export const addCourse = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(createCourseInput)
	.handler(({ context, data }) => createCourse(context.viewer, data));

export const editCourse = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateCourseInput)
	.handler(({ context, data }) => updateCourse(context.viewer, data));

export const removeCourse = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(courseIdInput)
	.handler(({ context, data }) => deleteCourse(context.viewer, data));

export const duplicateCourse = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(copyCourseInput)
	.handler(({ context, data }) => copyCourse(context.viewer, data));

export const addSplit = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(createSplitInput)
	.handler(({ context, data }) => createSplit(context.viewer, data));

export const editSplit = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateSplitInput)
	.handler(({ context, data }) => updateSplit(context.viewer, data));

export const removeSplit = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(splitIdInput)
	.handler(({ context, data }) => deleteSplit(context.viewer, data));

export const reorderSplit = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(moveSplitInput)
	.handler(({ context, data }) => moveSplit(context.viewer, data));
