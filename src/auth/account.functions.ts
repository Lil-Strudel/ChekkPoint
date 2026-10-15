import { createServerFn } from "@tanstack/solid-start";
import { z } from "zod";
import { loadAccountOverview } from "./account.server";
import { authMiddleware } from "./middleware";
import { updatePersonName } from "./people.server";

export const getAccountOverview = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(() => loadAccountOverview());

export const updateMyName = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(
		z.object({
			firstName: z.string().trim().min(1),
			lastName: z.string().trim(),
		}),
	)
	.handler(({ context, data }) =>
		updatePersonName(context.viewer.user.id, data),
	);
