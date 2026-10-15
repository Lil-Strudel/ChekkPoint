import "@tanstack/solid-start/server-only";
import { getRequestHeaders } from "@tanstack/solid-start/server";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { people } from "../db/schema";
import { env } from "../env";
import { auth } from "./auth.server";

export async function loadViewer() {
	const session = await auth.api.getSession({ headers: getRequestHeaders() });
	if (!session) return null;
	const { user } = session;
	const [person] = await db
		.select({
			id: people.id,
			firstName: people.firstName,
			lastName: people.lastName,
		})
		.from(people)
		.where(eq(people.userId, user.id));
	return {
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			image: user.image ?? null,
			role: user.role ?? null,
		},
		person: person ?? null,
	};
}

export type Viewer = NonNullable<Awaited<ReturnType<typeof loadViewer>>>;

export function loadAuthOptions() {
	return {
		google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
		strava: Boolean(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET),
	};
}
