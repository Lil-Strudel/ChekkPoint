import { eq, sql } from "drizzle-orm";
import { db } from ".";
import { helloWorld } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type HelloInput = { id: string; message: string };

// Must run in the same transaction as the write.
async function currentTxid(tx: Tx) {
	const result = await tx.execute<{ txid: string }>(
		sql`SELECT pg_current_xact_id()::xid::text AS txid`,
	);
	return Number(result.rows[0].txid);
}

export function insertHello(data: HelloInput) {
	return db.transaction(async (tx) => {
		// An outbox replay inserts nothing, so there's no txid to await.
		const inserted = await tx
			.insert(helloWorld)
			.values(data)
			.onConflictDoNothing()
			.returning({ id: helloWorld.id });
		return { txid: inserted.length > 0 ? await currentTxid(tx) : null };
	});
}

export function updateHelloMessage(data: HelloInput) {
	return db.transaction(async (tx) => {
		const updated = await tx
			.update(helloWorld)
			.set({ message: data.message })
			.where(eq(helloWorld.id, data.id))
			.returning({ id: helloWorld.id });
		return { txid: updated.length > 0 ? await currentTxid(tx) : null };
	});
}
