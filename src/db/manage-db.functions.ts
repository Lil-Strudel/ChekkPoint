import { createServerFn } from "@tanstack/solid-start";
import { z } from "zod";
import { fetchCollectionRows } from "./manage-db.server";

export const getCollectionRows = createServerFn({ method: "GET" })
	.validator(
		z.object({
			collection: z.string(),
			limit: z.number().int().min(1).max(100).optional().default(50),
		}),
	)
	.handler(async ({ data }) => {
		return fetchCollectionRows(data.collection, data.limit);
	});
