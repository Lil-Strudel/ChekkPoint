import "@tanstack/solid-start/server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, type Tx } from "../db";
import { type NewPerson, people, users } from "../db/schema";

type VerifiedUser = { id: string; name: string; email: string };

function splitName(user: VerifiedUser) {
	const [firstName, ...rest] = user.name.trim().split(/\s+/).filter(Boolean);
	if (!firstName) return { firstName: user.email.split("@")[0], lastName: "" };
	return { firstName, lastName: rest.join(" ") };
}

/**
 * Links a verified user to their person record: the one unclaimed person with the
 * same email, or a new person when there is none or the match is ambiguous.
 */
export async function ensurePersonForUser(user: VerifiedUser) {
	return db.transaction(async (tx) => {
		const [existing] = await tx
			.select({ id: people.id })
			.from(people)
			.where(eq(people.userId, user.id));
		if (existing) return existing.id;

		const candidates = await tx
			.select({ id: people.id })
			.from(people)
			.where(
				and(
					isNull(people.userId),
					sql`lower(${people.email}) = lower(${user.email})`,
				),
			)
			.limit(2)
			.for("update");

		if (candidates.length === 1) {
			await tx
				.update(people)
				.set({ userId: user.id })
				.where(eq(people.id, candidates[0].id));
			return candidates[0].id;
		}

		const [created] = await tx
			.insert(people)
			.values({ ...splitName(user), email: user.email, userId: user.id })
			.returning({ id: people.id });
		return created.id;
	});
}

export async function updatePersonName(
	userId: string,
	name: { firstName: string; lastName: string },
) {
	await db.transaction(async (tx) => {
		await tx.update(people).set(name).where(eq(people.userId, userId));
		await tx
			.update(users)
			.set({ name: `${name.firstName} ${name.lastName}`.trim() })
			.where(eq(users.id, userId));
	});
}

/**
 * Reuses the person with this email, preferring one already claimed by a login
 * so access applies immediately. People without an email are always new.
 */
export async function findOrCreatePerson(tx: Tx, person: NewPerson) {
	if (person.email) {
		const [match] = await tx
			.select({ id: people.id })
			.from(people)
			.where(sql`lower(${people.email}) = lower(${person.email})`)
			.orderBy(sql`${people.userId} is null`)
			.limit(1);
		if (match) return match.id;
	}
	const [created] = await tx
		.insert(people)
		.values(person)
		.returning({ id: people.id });
	return created.id;
}
