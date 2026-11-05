import "@tanstack/solid-start/server-only";

type PgError = { code: string; constraint?: string };

function findPgError(err: unknown): PgError | undefined {
	// Drizzle wraps driver errors, so the Postgres fields sit on `cause`.
	for (let e = err; e instanceof Error; e = e.cause) {
		if ("code" in e && typeof e.code === "string") return e as PgError;
	}
	return undefined;
}

/**
 * Runs a write and replaces unique or foreign-key violations of the named
 * constraints with a message a director can act on.
 */
export async function withConstraintMessages<T>(
	messages: Record<string, string>,
	write: () => Promise<T>,
) {
	try {
		return await write();
	} catch (err) {
		const constraint = findPgError(err)?.constraint;
		if (constraint && constraint in messages) {
			throw new Error(messages[constraint]);
		}
		throw err;
	}
}
