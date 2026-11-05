import { notFound } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { authMiddleware } from "../auth/middleware";
import {
	assignStaff,
	createEventGroup,
	createTimingPoint,
	deleteEventGroup,
	deleteTimingPoint,
	getEventGroupPage,
	getOrganizationOverview,
	listMyOrganizations,
	recordTime,
	removeStaff,
	updateEventGroup,
	updateOrganizationDetails,
	updateTimingPoint,
} from "./orgs.server";
import {
	assignStaffInput,
	createEventGroupInput,
	createTimingPointInput,
	deleteEventGroupInput,
	eventGroupIdInput,
	recordTimeInput,
	removeStaffInput,
	slugInput,
	timingPointIdInput,
	updateEventGroupInput,
	updateOrganizationDetailsInput,
	updateTimingPointInput,
} from "./orgs.shared";

export const getMyOrganizations = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(({ context }) => listMyOrganizations(context.viewer));

export const getOrganization = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(slugInput)
	.handler(async ({ context, data }) => {
		const overview = await getOrganizationOverview(context.viewer, data.slug);
		if (!overview) throw notFound();
		return overview;
	});

export const addEventGroup = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(createEventGroupInput)
	.handler(({ context, data }) => createEventGroup(context.viewer, data));

export const editEventGroup = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateEventGroupInput)
	.handler(({ context, data }) => updateEventGroup(context.viewer, data));

export const removeEventGroup = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(deleteEventGroupInput)
	.handler(({ context, data }) => deleteEventGroup(context.viewer, data));

export const editOrganizationDetails = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateOrganizationDetailsInput)
	.handler(({ context, data }) =>
		updateOrganizationDetails(context.viewer, data),
	);

export const addTimingPoint = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(createTimingPointInput)
	.handler(({ context, data }) => createTimingPoint(context.viewer, data));

export const editTimingPoint = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateTimingPointInput)
	.handler(({ context, data }) => updateTimingPoint(context.viewer, data));

export const removeTimingPoint = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(timingPointIdInput)
	.handler(({ context, data }) => deleteTimingPoint(context.viewer, data));

export const getEventGroup = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(eventGroupIdInput)
	.handler(async ({ context, data }) => {
		const page = await getEventGroupPage(context.viewer, data.eventGroupId);
		if (!page) throw notFound();
		return page;
	});

export const saveStaff = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(assignStaffInput)
	.handler(({ context, data }) => assignStaff(context.viewer, data));

export const deleteStaff = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(removeStaffInput)
	.handler(({ context, data }) => removeStaff(context.viewer, data));

export const addTime = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(recordTimeInput)
	.handler(({ context, data }) => recordTime(context.viewer, data));
