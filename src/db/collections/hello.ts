import { snakeCamelMapper } from "@electric-sql/client";
import {
	BrowserCollectionCoordinator,
	createBrowserWASQLitePersistence,
	openBrowserWASQLiteOPFSDatabase,
	persistedCollectionOptions,
} from "@tanstack/browser-db-sqlite-persistence";
import {
	type ElectricCollectionUtils,
	electricCollectionOptions,
} from "@tanstack/electric-db-collection";
import {
	NonRetriableError,
	startOfflineExecutor,
} from "@tanstack/offline-transactions";
import { createCollection } from "@tanstack/solid-db";
import { createHello, updateHello } from "../hello.functions";
import { type HelloRow, helloInput } from "../hello.shared";

function electricOptions() {
	return electricCollectionOptions<HelloRow>({
		id: "hello_world",
		getKey: (row) => row.id,
		shapeOptions: {
			url: new URL("/api/shapes/hello-world", window.location.origin).href,
			columnMapper: snakeCamelMapper(),
		},
	});
}

async function openPersistedCollection() {
	const database = await openBrowserWASQLiteOPFSDatabase({
		databaseName: "chekkpoint.sqlite",
	});
	const coordinator = new BrowserCollectionCoordinator({
		dbName: "chekkpoint",
	});
	const persistence = createBrowserWASQLitePersistence({
		database,
		coordinator,
	});
	const collection = createCollection(
		// TSchema can't be inferred from the Electric options.
		persistedCollectionOptions<
			HelloRow,
			string | number,
			never,
			ElectricCollectionUtils<HelloRow>
		>({
			...electricOptions(),
			persistence,
			schemaVersion: 1,
		}),
	);
	const close = async () => {
		coordinator.dispose();
		await database.close?.();
	};
	return { collection, close };
}

async function openCollection() {
	try {
		return { ...(await openPersistedCollection()), persisted: true };
	} catch (err) {
		console.warn("OPFS persistence unavailable, using memory only", err);
		const collection = createCollection(electricOptions());
		return { collection, close: async () => {}, persisted: false };
	}
}

async function init() {
	const { collection, close, persisted } = await openCollection();

	const executor = startOfflineExecutor({
		collections: { hello: collection },
		mutationFns: {
			saveHello: async ({ transaction }) => {
				for (const mutation of transaction.mutations) {
					const parsed = helloInput.safeParse(mutation.modified);
					if (!parsed.success)
						throw new NonRetriableError(parsed.error.message);
					const data = parsed.data;
					const { txid } =
						mutation.type === "insert"
							? await createHello({ data })
							: await updateHello({ data });
					if (txid !== null) await collection.utils.awaitTxId(txid);
				}
			},
		},
	});
	await executor.waitForInit();

	const addHello = executor.createOfflineAction({
		mutationFnName: "saveHello",
		onMutate: (message: string) => {
			const now = new Date().toISOString();
			collection.insert({
				id: crypto.randomUUID(),
				message: message.trim(),
				createdAt: now,
				updatedAt: now,
			});
		},
	});

	const editHello = executor.createOfflineAction({
		mutationFnName: "saveHello",
		onMutate: ({ id, message }: { id: string; message: string }) => {
			collection.update(id, (draft) => {
				draft.message = message.trim();
				draft.updatedAt = new Date().toISOString();
			});
		},
	});

	const dispose = async () => {
		executor.dispose();
		await close();
	};

	return { collection, executor, persisted, addHello, editHello, dispose };
}

export type HelloDb = Awaited<ReturnType<typeof init>>;

let helloDb: Promise<HelloDb> | undefined;

export function getHelloDb() {
	helloDb ??= init().catch((err) => {
		helloDb = undefined;
		throw err;
	});
	return helloDb;
}

// OPFS handles are exclusive; release them before HMR.
if (import.meta.hot) {
	import.meta.hot.dispose(async () => {
		await (await helloDb)?.dispose();
	});
}
