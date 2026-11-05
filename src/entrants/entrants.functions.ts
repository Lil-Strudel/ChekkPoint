import { notFound } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { authMiddleware } from "../auth/middleware";
import { eventGroupIdInput } from "../orgs/orgs.shared";
import {
	createEntrant,
	deleteEntrant,
	getEntrantsPage,
	importEntrants,
	updateEntrant,
} from "./entrants.server";
import {
	createEntrantInput,
	entrantIdInput,
	importEntrantsInput,
	updateEntrantInput,
} from "./entrants.shared";

export const getEntrants = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(eventGroupIdInput)
	.handler(async ({ context, data }) => {
		const page = await getEntrantsPage(context.viewer, data.eventGroupId);
		if (!page) throw notFound();
		return page;
	});

export const addEntrant = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(createEntrantInput)
	.handler(({ context, data }) => createEntrant(context.viewer, data));

export const editEntrant = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateEntrantInput)
	.handler(({ context, data }) => updateEntrant(context.viewer, data));

export const removeEntrant = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(entrantIdInput)
	.handler(({ context, data }) => deleteEntrant(context.viewer, data));

export const uploadEntrants = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(importEntrantsInput)
	.handler(({ context, data }) => importEntrants(context.viewer, data));
