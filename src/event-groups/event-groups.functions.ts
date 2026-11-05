import { createServerFn } from "@tanstack/solid-start";
import { authMiddleware } from "../auth/middleware";
import { eventGroupIdInput } from "../orgs/orgs.shared";
import {
	createEvent,
	deleteEvent,
	deleteEventGroup,
	updateEvent,
	updateEventGroup,
	updateRulesConfig,
} from "./event-groups.server";
import {
	createEventInput,
	eventIdInput,
	updateEventGroupInput,
	updateEventInput,
	updateRulesConfigInput,
} from "./event-groups.shared";

export const editEventGroup = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateEventGroupInput)
	.handler(({ context, data }) => updateEventGroup(context.viewer, data));

export const editRulesConfig = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateRulesConfigInput)
	.handler(({ context, data }) => updateRulesConfig(context.viewer, data));

export const removeEventGroup = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(eventGroupIdInput)
	.handler(({ context, data }) => deleteEventGroup(context.viewer, data));

export const addEvent = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(createEventInput)
	.handler(({ context, data }) => createEvent(context.viewer, data));

export const editEvent = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateEventInput)
	.handler(({ context, data }) => updateEvent(context.viewer, data));

export const removeEvent = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(eventIdInput)
	.handler(({ context, data }) => deleteEvent(context.viewer, data));
