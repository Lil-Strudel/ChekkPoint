import "@tanstack/solid-start/server-only";
import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.url(),
		REDIS_URL: z.url(),
		ELECTRIC_URL: z.url(),
		ELECTRIC_SECRET: z.string().optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
