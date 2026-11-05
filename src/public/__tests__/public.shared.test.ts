import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	calculateEffortSplits,
	formatDistanceMiles,
	formatDuration,
	formatElevationFeet,
	formatPacePerMile,
	formatPersonDisplayName,
	getEventGroupTemporalState,
} from "../public.shared.ts";

describe("getEventGroupTemporalState", () => {
	const now = new Date("2026-11-05T12:00:00Z");

	it("returns 'live' when now is within startDate and endDate", () => {
		const start = new Date("2026-11-05T00:00:00Z");
		const end = new Date("2026-11-06T12:00:00Z");
		assert.equal(getEventGroupTemporalState(start, end, now), "live");
	});

	it("returns 'upcoming' when startDate is in the future", () => {
		const start = new Date("2026-11-10T06:00:00Z");
		const end = new Date("2026-11-11T18:00:00Z");
		assert.equal(getEventGroupTemporalState(start, end, now), "upcoming");
	});

	it("returns 'past' when endDate is in the past", () => {
		const start = new Date("2026-10-01T06:00:00Z");
		const end = new Date("2026-10-02T18:00:00Z");
		assert.equal(getEventGroupTemporalState(start, end, now), "past");
	});
});

describe("formatting utilities", () => {
	it("formats duration in HH:MM:SS and optional milliseconds", () => {
		assert.equal(formatDuration(3661), "01:01:01");
		assert.equal(formatDuration(51751), "14:22:31");
		assert.equal(formatDuration(195.42, { showMillis: true }), "00:03:15.420");
		assert.equal(formatDuration(null), "—");
	});

	it("formats distance in miles and elevation in feet", () => {
		assert.equal(formatDistanceMiles(160934.4, 1), "100.0 mi");
		assert.equal(formatElevationFeet(7345.68), "24,100 ft");
		assert.equal(formatPacePerMile(372.823), "10:00 /mi");
	});

	it("honors useInitialsOnly in formatPersonDisplayName", () => {
		assert.equal(
			formatPersonDisplayName({ firstName: "Elena", lastName: "Vance" }),
			"Elena Vance",
		);
		assert.equal(
			formatPersonDisplayName({
				firstName: "Elena",
				lastName: "Vance",
				useInitialsOnly: true,
			}),
			"E. V.",
		);
	});
});

describe("calculateEffortSplits ('Plan My Effort' Pace Calculator)", () => {
	const sampleSplits = [
		{
			id: "split-1",
			name: "Big Mountain Pass",
			sequenceOrder: 1,
			distanceFromStartMeters: 40_000,
			elevationMeters: 2260,
			subSplitBitmap: 3,
			cutoffDurationSeconds: 10 * 3600,
		},
		{
			id: "split-2",
			name: "Lambs Canyon",
			sequenceOrder: 2,
			distanceFromStartMeters: 80_000,
			elevationMeters: 1890,
			subSplitBitmap: 3,
			cutoffDurationSeconds: 18 * 3600,
		},
		{
			id: "split-3",
			name: "Brighton Lodge",
			sequenceOrder: 3,
			distanceFromStartMeters: 120_000,
			elevationMeters: 2670,
			subSplitBitmap: 3,
			cutoffDurationSeconds: 27 * 3600,
		},
		{
			id: "split-4",
			name: "Homestead Finish",
			sequenceOrder: 4,
			distanceFromStartMeters: 160_000,
			elevationMeters: 1710,
			subSplitBitmap: 1,
			cutoffDurationSeconds: 36 * 3600,
		},
	];

	it("computes constant pace for 'even' strategy and hits exact target finish time", () => {
		const res = calculateEffortSplits({
			totalDistanceMeters: 160_000,
			targetFinishSeconds: 24 * 3600, // 24:00:00
			startTimeHHMM: "05:00",
			strategy: "even",
			splits: sampleSplits,
		});

		assert.equal(res.length, 4);
		assert.equal(res[0].predictedElapsedSeconds, 6 * 3600);
		assert.equal(res[1].predictedElapsedSeconds, 12 * 3600);
		assert.equal(res[2].predictedElapsedSeconds, 18 * 3600);
		assert.equal(res[3].predictedElapsedSeconds, 24 * 3600);
		assert.equal(res[3].predictedElapsedFormatted, "24:00:00");
		assert.equal(res[0].cutoffStatus, "safe");
	});

	it("models second-half fade for 'conservative' and 'positive' strategies while hitting target finish", () => {
		const conservative = calculateEffortSplits({
			totalDistanceMeters: 160_000,
			targetFinishSeconds: 24 * 3600,
			startTimeHHMM: "05:00",
			strategy: "conservative",
			splits: sampleSplits,
		});

		const positive = calculateEffortSplits({
			totalDistanceMeters: 160_000,
			targetFinishSeconds: 24 * 3600,
			startTimeHHMM: "05:00",
			strategy: "positive",
			splits: sampleSplits,
		});

		// At halfway (split-2, 80km), positive arrives earlier than conservative, which arrives earlier than even (12h),
		// leaving more time for the harder second half while both finish at 24:00:00.
		assert.ok(
			positive[1].predictedElapsedSeconds <
				conservative[1].predictedElapsedSeconds,
		);
		assert.ok(conservative[1].predictedElapsedSeconds < 12 * 3600);
		assert.equal(conservative[3].predictedElapsedSeconds, 24 * 3600);
		assert.equal(positive[3].predictedElapsedSeconds, 24 * 3600);
		// Final segment pace in positive strategy is slower than first segment pace
		assert.ok(
			positive[3].segmentPaceSecondsPerKm > positive[0].segmentPaceSecondsPerKm,
		);
	});

	it("detects missed cutoffs when target finish exceeds cutoff limit", () => {
		const slow = calculateEffortSplits({
			totalDistanceMeters: 160_000,
			targetFinishSeconds: 38 * 3600,
			startTimeHHMM: "05:00",
			strategy: "even",
			splits: sampleSplits,
		});

		assert.equal(slow[3].cutoffStatus, "missed");
		assert.ok((slow[3].cutoffBufferSeconds ?? 0) < 0);
	});
});
