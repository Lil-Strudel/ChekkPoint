import "@tanstack/solid-start/server-only";
import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.url(),
		REDIS_URL: z.url(),
		ELECTRIC_URL: z.url(),
		ELECTRIC_SECRET: z.string().optional(),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		SMTP_URL: z.url().optional(),
		EMAIL_FROM: z.string().default("ChekkPoint <no-reply@chekkpoint.local>"),
		GOOGLE_CLIENT_ID: z.string().optional(),
		GOOGLE_CLIENT_SECRET: z.string().optional(),
		STRAVA_CLIENT_ID: z.string().optional(),
		STRAVA_CLIENT_SECRET: z.string().optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
