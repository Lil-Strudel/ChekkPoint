import "@tanstack/solid-start/server-only";
import { count } from "drizzle-orm";
import { db } from "./index";
import {
	courseSplits,
	courses,
	entrantHistoricalProjections,
	entrants,
	eventGroups,
	events,
	helloWorld,
	organizations,
	people,
	personExternalProfiles,
	personHistoricalSummaries,
	personRaceHistory,
	rawTimingEvents,
	scoredSplitTimes,
	splitTimeAudits,
	timeAllowances,
	timingPoints,
} from "./schema";
import { type CollectionKey, isCollectionKey } from "./schema-metadata";

export const tableMap = {
	organizations,
	eventGroups,
	courses,
	events,
	timingPoints,
	courseSplits,
	people,
	entrants,
	personExternalProfiles,
	personRaceHistory,
	personHistoricalSummaries,
	entrantHistoricalProjections,
	rawTimingEvents,
	scoredSplitTimes,
	timeAllowances,
	splitTimeAudits,
	helloWorld,
} as const;

export type SerializableValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| SerializableValue[]
	| { [key: string]: SerializableValue };

export type SerializableRow = Record<string, SerializableValue>;

export interface FetchCollectionResult {
	rows: SerializableRow[];
	totalCount?: number;
	error?: string;
	isOffline?: boolean;
}

export async function fetchCollectionRows(
	collectionKey: string,
	limit = 50,
): Promise<FetchCollectionResult> {
	if (!isCollectionKey(collectionKey)) {
		return {
			rows: [],
			totalCount: 0,
			error: `Unknown collection key: "${collectionKey}"`,
			isOffline: false,
		};
	}

	const table = tableMap[collectionKey as CollectionKey];

	try {
		const [rawRows, countResult] = await Promise.all([
			db.select().from(table).limit(limit),
			db.select({ value: count() }).from(table),
		]);

		const totalCount = Number(countResult[0]?.value ?? rawRows.length);
		const rows = JSON.parse(JSON.stringify(rawRows)) as SerializableRow[];

		return {
			rows,
			totalCount,
			isOffline: false,
		};
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		const isOffline =
			message.includes("ECONNREFUSED") ||
			message.includes("Connection terminated") ||
			message.includes("timeout") ||
			message.includes("does not exist") ||
			message.includes("connect") ||
			message.includes("5432");

		return {
			rows: [],
			totalCount: 0,
			error: message,
			isOffline,
		};
	}
}
