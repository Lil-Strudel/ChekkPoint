import { notFound } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { authMiddleware } from "../auth/middleware";
import {
	assignStaff,
	createEventGroup,
	createTimingPoint,
	getEventGroupPage,
	getOrganizationOverview,
	listMyOrganizations,
	recordTime,
	removeStaff,
} from "./orgs.server";
import {
	assignStaffInput,
	createEventGroupInput,
	createTimingPointInput,
	eventGroupIdInput,
	recordTimeInput,
	removeStaffInput,
	slugInput,
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

export const addTimingPoint = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(createTimingPointInput)
	.handler(({ context, data }) => createTimingPoint(context.viewer, data));

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
