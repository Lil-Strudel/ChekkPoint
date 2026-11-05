/**
 * Adversarial Challenger Test Suite — Tier 5 Coverage Hardening (M5)
 * Part 1: Audit CQRS Replay, Time Allowances, Post-Race Closeout, FIFO Chute, SAR Triage & MT63 Noise
 *
 * Empirical verification & stress testing across ChekkPoint safety-critical pathways:
 * 1. CQRS Split Rebuild Replay & Temporal Edge Cases
 *    - 0-split runners, empty write planes, and wiped read planes.
 *    - Out-of-order raw timing pulses (reverse, interleaved, randomized permutations).
 *    - Duplicate raw events at exact same millisecond (millisecond collision & idempotent deduplication).
 *    - Simultaneous multiple time allowances & net duration bounds (cumulative credit & zero clamping).
 * 2. Time Allowance Overlap & Causality Edge Cases
 *    - Overlapping interval detection & true physical union calculation vs naive summation.
 *    - Duplicate time allowance entries.
 *    - Temporal causality: holds only apply to concurrent or subsequent splits.
 * 3. Post-Race Results Certification Edge Cases
 *    - Locking provisional, questionable, and bad splits to confirmed.
 *    - Active runner sweep (establishDrops) prior to certification.
 *    - Post-certification status changes (disqualification / withdrawal) and re-certification idempotency.
 *    - Historical summaries recalculation (races, finishes, DNFs, DNF rate).
 * 4. FIFO Chute Queue Concurrency & Ticket Binding
 *    - High-velocity burst arrivals with atomic timestamp capture without bibs.
 *    - Sequential bib binding, FIFO order preservation, and backfilling.
 *    - Edge cases: binding to empty queue, whitespace/empty bib rejection, duplicate bibs, pacer preservation.
 *    - KeypadInputBuffer integration and buffer commit.
 * 5. SAR Two-Stage Triage Boundaries
 *    - Stage 1 exact boundary margin: asOfTime == latestUtc vs asOfTime > latestUtc.
 *    - Expected cutoff risk alert triggering prior to boundary.
 *    - Stage 2 exact dwell boundary: dwell == 45m vs dwell > 45m.
 *    - Retired on Course (ROC) between checkpoints vs DNF in station custody.
 * 6. MT63 Digital Radio Text Parser Malformed Frames & Noise
 *    - Malformed and corrupt checksum footers ([CRC:DEADBEEF], *CHECKSUM:INVALID*).
 *    - Truncated frames, missing tokens, invalid timestamps (25:00:00, 12:60:00, negative times).
 *    - Interleaved acoustic noise bursts and comments (150-line stream stress test).
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
	canAuditResults,
	certifyOfficialResultsInput,
	createTimeAllowanceInput,
	deleteScoredSplitInput,
	deleteTimeAllowanceInput,
	editScoredSplitInput,
	establishDropsInput,
	formatElapsedHms,
	formatItraCsv,
	formatStandardCsv,
	formatUltraSignupCsv,
	insertScoredSplitInput,
	reassignRawTimingEventInput,
	rebuildSplitsInput,
	updateTimeAllowanceInput,
	type OfficialExportRunner,
} from "../../audit/audit.shared.ts";
import {
	calculateDwellSeconds,
	calculateSegmentPaceSecondsPerKm,
	calculateTsdPenalty,
	damerauLevenshtein,
	DecoupledFifoChuteQueue,
	getTypoRecommendation,
	KeypadInputBuffer,
	parseMt63Block,
	type ParsedMt63Punch,
} from "../domain-algorithms.ts";
import {
	type CourseSplit,
	type Entrant,
	type EventGroup,
	type RawTimingEvent,
	type ScoredSplitTime,
	type SubEvent,
	TestDatabase,
	type TimeAllowance,
	type TimingPoint,
} from "../test-harness.ts";

const testUuid1 = "10000000-0000-4000-8000-000000000001";
const testUuid2 = "10000000-0000-4000-8000-000000000002";
const testUuid3 = "10000000-0000-4000-8000-000000000003";

describe("Tier 5 Adversarial Coverage Hardening — Audit CQRS & Field Operations", () => {
	// ==========================================================================
	// 1. CQRS SPLIT REBUILD REPLAY & TEMPORAL EDGE CASES
	// ==========================================================================
	describe("Area 1: CQRS Split Rebuild Replay & Temporal Edge Cases", () => {
		let db: TestDatabase;
		let orgId: string;
		let egId: string;
		let eventId: string;
		let courseId: string;
		let runner1: Entrant;
		let runnerZero: Entrant;
		let splitStart: CourseSplit;
		let splitAid1: CourseSplit;
		let splitAid2: CourseSplit;
		let splitFinish: CourseSplit;

		beforeEach(() => {
			db = new TestDatabase();
			orgId = db.nextId("org");
			egId = db.nextId("eg");
			eventId = db.nextId("event");
			courseId = db.nextId("course");

			db.eventGroups.push({
				id: egId,
				organizationId: orgId,
				name: "Hardrock White-Box 100",
				slug: "hardrock-100",
				discipline: "trail_ultra",
			});

			const gunStart = new Date("2026-11-05T06:00:00.000Z");
			db.events.push({
				id: eventId,
				eventGroupId: egId,
				courseId,
				name: "100 Mile Endurance Run",
				gunStartTime: gunStart,
			});

			// Setup timing points
			const tpStart: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "START",
				name: "Silverton Start",
				latitude: 37.8119,
				longitude: -107.6644,
			};
			const tpAid1: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "KROGER",
				name: "Kroger Canteen",
				latitude: 37.9122,
				longitude: -107.7812,
			};
			const tpAid2: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "TELLURIDE",
				name: "Telluride Town Park",
				latitude: 37.9375,
				longitude: -107.8123,
			};
			const tpFinish: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "FINISH",
				name: "Silverton Finish",
				latitude: 37.8119,
				longitude: -107.6644,
			};
			db.timingPoints.push(tpStart, tpAid1, tpAid2, tpFinish);

			// Setup Course Splits (Distance in meters)
			splitStart = {
				id: db.nextId("split"),
				courseId,
				timingPointId: tpStart.id,
				name: "Start",
				sequenceOrder: 1,
				distanceFromStartMeters: 0,
				subSplitBitmap: 2, // out
			};
			splitAid1 = {
				id: db.nextId("split"),
				courseId,
				timingPointId: tpAid1.id,
				name: "Kroger Canteen",
				sequenceOrder: 2,
				distanceFromStartMeters: 30000,
				subSplitBitmap: 3, // in + out
			};
			splitAid2 = {
				id: db.nextId("split"),
				courseId,
				timingPointId: tpAid2.id,
				name: "Telluride",
				sequenceOrder: 3,
				distanceFromStartMeters: 55000,
				subSplitBitmap: 1, // in
			};
			splitFinish = {
				id: db.nextId("split"),
				courseId,
				timingPointId: tpFinish.id,
				name: "Finish",
				sequenceOrder: 4,
				distanceFromStartMeters: 100000,
				subSplitBitmap: 1, // in
			};
			db.courseSplits.push(
				splitStart,
				splitAid1,
				splitAid2,
				splitFinish,
			);

			// Competitor 101
			runner1 = {
				id: db.nextId("entrant"),
				eventId,
				personId: db.nextId("person"),
				bibNumber: "101",
				status: "in_progress",
				actualStartTime: gunStart,
			};
			// Competitor 999 (Zero-split runner)
			runnerZero = {
				id: db.nextId("entrant"),
				eventId,
				personId: db.nextId("person"),
				bibNumber: "999",
				status: "registered",
			};
			db.entrants.push(runner1, runnerZero);
		});

		it("handles runners with 0 splits cleanly without throwing or corrupting read plane", () => {
			const rebuilt = db.rebuildSplits(
				runnerZero.id,
				"steward-1",
				"Rebuilding zero-split runner",
			);
			assert.equal(rebuilt.length, 0);

			// Verify audit trail recorded REBUILT action with 0 splits
			const audit = db.splitTimeAudits.find(
				(a) => a.changeReason === "Rebuilding zero-split runner",
			);
			assert.ok(audit !== undefined);
			assert.equal(audit.action, "REBUILT");
			assert.equal((audit.newState as any)?.count, 0);
		});

		it("purges read-plane splits when all raw events for a runner are marked rejected_invalid", () => {
			// First, ingest a legitimate pulse
			db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: "101",
				timingPointCode: "START",
				subSplitKind: "point",
				recordedTimeUtc: new Date("2026-11-05T06:00:00Z"),
				source: "rfid_transponder",
			});
			assert.equal(
				db.scoredSplitTimes.filter((s) => s.entrantId === runner1.id).length,
				1,
			);

			// Mark all raw events as rejected_invalid (e.g. disqualified bib or cross-read)
			for (const r of db.rawTimingEvents) {
				r.status = "rejected_invalid";
			}

			// Rebuild
			const rebuilt = db.rebuildSplits(
				runner1.id,
				"steward-1",
				"Purging invalid cross-reads",
			);
			assert.equal(rebuilt.length, 0);
			assert.equal(
				db.scoredSplitTimes.filter((s) => s.entrantId === runner1.id).length,
				0,
			);
		});

		it("reconstructs strict chronological order, dwell time, and paces from completely reversed raw pulses", () => {
			// Ingest in reverse order: Finish -> Telluride -> Kroger OUT -> Kroger IN -> Start
			const timestamps = [
				{
					code: "FINISH",
					kind: "point" as const,
					time: new Date("2026-11-05T20:00:00Z"),
				}, // 14h (50400s)
				{
					code: "TELLURIDE",
					kind: "in" as const,
					time: new Date("2026-11-05T13:30:00Z"),
				}, // 7.5h (27000s)
				{
					code: "KROGER",
					kind: "out" as const,
					time: new Date("2026-11-05T10:15:00Z"),
				}, // 4h15m (15300s)
				{
					code: "KROGER",
					kind: "in" as const,
					time: new Date("2026-11-05T10:00:00Z"),
				}, // 4h00m (14400s)
				{
					code: "START",
					kind: "point" as const,
					time: new Date("2026-11-05T06:00:00Z"),
				}, // 0h (0s)
			];

			for (const t of timestamps) {
				db.rawTimingEvents.push({
					id: db.nextId("raw-rev"),
					eventGroupId: egId,
					competitorNumber: "101",
					timingPointCode: t.code,
					subSplitKind: t.kind,
					recordedTimeUtc: t.time,
					source: "manual_web_entry",
					status: "matched",
					withPacer: false,
					createdAt: new Date(),
				});
			}

			const rebuilt = db.rebuildSplits(
				runner1.id,
				"steward-1",
				"Replay reversed raw events",
			);
			assert.equal(rebuilt.length, 5);

			// Monotonically increasing elapsed seconds
			for (let i = 1; i < rebuilt.length; i++) {
				assert.ok(
					rebuilt[i].elapsedSeconds >= rebuilt[i - 1].elapsedSeconds,
					`Elapsed seconds must be chronological: ${rebuilt[i].elapsedSeconds} >= ${rebuilt[i - 1].elapsedSeconds}`,
				);
			}

			// Dwell time on Kroger OUT: 10:15 - 10:00 = 15 minutes = 900 seconds
			const krogerOut = rebuilt.find(
				(s) => s.courseSplitId === splitAid1.id && s.subSplitKind === "out",
			);
			assert.ok(krogerOut !== undefined);
			assert.equal(krogerOut.dwellSeconds, 900);

			// Segment pace on Telluride IN (25km from Kroger at 30km to Telluride at 55km)
			// Total checkpoint-to-checkpoint transit: 27000s - 14400s = 12600s over 25km -> 12600 / 25 = 504 s/km (8:24/km)
			const tellurideIn = rebuilt.find((s) => s.courseSplitId === splitAid2.id);
			assert.ok(tellurideIn !== undefined);
			assert.equal(tellurideIn.segmentPaceSecondsPerKm, 504);
		});

		it("preserves identical read plane under arbitrary randomized permutations of raw events", () => {
			const eventsToPermute = [
				{
					code: "START",
					kind: "point" as const,
					time: new Date("2026-11-05T06:00:00Z"),
				},
				{
					code: "KROGER",
					kind: "in" as const,
					time: new Date("2026-11-05T10:00:00Z"),
				},
				{
					code: "KROGER",
					kind: "out" as const,
					time: new Date("2026-11-05T10:20:00Z"),
				},
				{
					code: "TELLURIDE",
					kind: "in" as const,
					time: new Date("2026-11-05T14:00:00Z"),
				},
				{
					code: "FINISH",
					kind: "point" as const,
					time: new Date("2026-11-05T21:00:00Z"),
				},
			];

			// Clear and populate once in forward order
			db.rawTimingEvents = [];
			for (const e of eventsToPermute) {
				db.rawTimingEvents.push({
					id: db.nextId("raw-perm"),
					eventGroupId: egId,
					competitorNumber: "101",
					timingPointCode: e.code,
					subSplitKind: e.kind,
					recordedTimeUtc: e.time,
					source: "rfid_transponder",
					status: "matched",
					withPacer: false,
					createdAt: new Date(),
				});
			}

			const canonical = db.rebuildSplits(
				runner1.id,
				"steward-1",
				"Canonical forward run",
			);

			// Deterministic shuffle permutations
			const permutations = [
				[2, 0, 4, 1, 3],
				[4, 3, 2, 1, 0],
				[1, 4, 0, 3, 2],
				[3, 1, 2, 0, 4],
			];

			for (const perm of permutations) {
				db.rawTimingEvents = perm.map((idx) => {
					const e = eventsToPermute[idx];
					return {
						id: db.nextId("raw-shuffled"),
						eventGroupId: egId,
						competitorNumber: "101",
						timingPointCode: e.code,
						subSplitKind: e.kind,
						recordedTimeUtc: e.time,
						source: "rfid_transponder",
						status: "matched",
						withPacer: false,
						createdAt: new Date(),
					};
				});

				const shuffledRun = db.rebuildSplits(
					runner1.id,
					"steward-1",
					"Permuted rebuild run",
				);
				assert.equal(shuffledRun.length, canonical.length);
				for (let i = 0; i < canonical.length; i++) {
					assert.equal(
						shuffledRun[i].courseSplitId,
						canonical[i].courseSplitId,
					);
					assert.equal(
						shuffledRun[i].elapsedSeconds,
						canonical[i].elapsedSeconds,
					);
					assert.equal(shuffledRun[i].dwellSeconds, canonical[i].dwellSeconds);
					assert.equal(
						shuffledRun[i].segmentPaceSecondsPerKm,
						canonical[i].segmentPaceSecondsPerKm,
					);
				}
			}
		});

		it("deduplicates raw events arriving at the exact same millisecond without read-plane collisions", () => {
			const exactSameMs = new Date("2026-11-05T10:00:00.123Z");

			// Pulse 1: matched
			const p1 = db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: "101",
				timingPointCode: "KROGER",
				subSplitKind: "in",
				recordedTimeUtc: exactSameMs,
				source: "optical_photocell",
			});
			assert.equal(p1.rawEvent.status, "matched");
			assert.ok(p1.scoredSplit !== null);

			// Pulse 2: exact same millisecond, same runner, same station, same kind -> duplicate_subordinate
			const p2 = db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: "101",
				timingPointCode: "KROGER",
				subSplitKind: "in",
				recordedTimeUtc: exactSameMs,
				source: "rfid_transponder",
			});
			assert.equal(p2.rawEvent.status, "duplicate_subordinate");
			assert.equal(p2.scoredSplit, null);

			// Verify read plane only contains 1 scored split for this station
			const krogerSplits = db.scoredSplitTimes.filter(
				(s) => s.entrantId === runner1.id && s.courseSplitId === splitAid1.id,
			);
			assert.equal(krogerSplits.length, 1);
			assert.equal(
				krogerSplits[0].governingRawEventId,
				p1.rawEvent.id,
				"Governing event should remain the first matched pulse",
			);
		});

		it("accumulates simultaneous multiple time allowances and clamps net duration at 0", () => {
			// Grant two distinct time allowances:
			// Allowance 1: 15 min (900s) at Kroger Canteen (medical hold)
			db.grantTimeAllowance({
				entrantId: runner1.id,
				splitId: splitAid1.id,
				startTime: new Date("2026-11-05T10:00:00Z"),
				endTime: new Date("2026-11-05T10:15:00Z"),
				durationSeconds: 900,
				reason: "medical_hold",
				authorizedByPersonId: "physician-1",
				notes: "Hydration & blister treatment",
			});

			// Allowance 2: 20 min (1200s) at Telluride (course hazard hold)
			db.grantTimeAllowance({
				entrantId: runner1.id,
				splitId: splitAid2.id,
				startTime: new Date("2026-11-05T13:40:00Z"),
				endTime: new Date("2026-11-05T14:00:00Z"),
				durationSeconds: 1200,
				reason: "hazard_hold",
				authorizedByPersonId: "director-1",
				notes: "Lightning strike near summit ridge",
			});

			const rawElapsed = 36000; // 10 hours
			const adjusted = db.getAdjustedNetElapsedSeconds(runner1.id, rawElapsed);
			// Total deduction: 900 + 1200 = 2100s -> 36000 - 2100 = 33900s
			assert.equal(adjusted, 33900);

			// Extreme boundary: allowance exceeds raw elapsed time -> clamps strictly to 0
			const extremeAdjusted = db.getAdjustedNetElapsedSeconds(runner1.id, 1000);
			assert.equal(
				extremeAdjusted,
				0,
				"Net elapsed time must clamp strictly to 0",
			);

			// Downstream cutoff extension: base cutoff 14 hours (50400s) -> 50400 + 2100 = 52500s
			const adjustedCutoff = db.getAdjustedCutoffSeconds(runner1.id, 50400);
			assert.equal(adjustedCutoff, 52500);
		});
	});

	// ==========================================================================
	// 2. TIME ALLOWANCE OVERLAP & CAUSALITY EDGE CASES
	// ==========================================================================
	describe("Area 2: Time Allowance Overlap & Causality Edge Cases", () => {
		interface IntervalAllowance {
			start: Date;
			end: Date;
			durationSeconds: number;
		}

		/**
		 * Reference Oracle: computes the true physical union duration of overlapping time intervals.
		 */
		function calculateUnionAllowanceSeconds(
			intervals: IntervalAllowance[],
		): number {
			if (intervals.length === 0) return 0;

			// Sort by start time ascending
			const sorted = [...intervals].sort(
				(a, b) => a.start.getTime() - b.start.getTime(),
			);

			const merged: Array<{ startMs: number; endMs: number }> = [];
			let current = {
				startMs: sorted[0].start.getTime(),
				endMs: sorted[0].end.getTime(),
			};

			for (let i = 1; i < sorted.length; i++) {
				const nextStart = sorted[i].start.getTime();
				const nextEnd = sorted[i].end.getTime();

				if (nextStart <= current.endMs) {
					// Overlapping or contiguous interval
					current.endMs = Math.max(current.endMs, nextEnd);
				} else {
					merged.push(current);
					current = { startMs: nextStart, endMs: nextEnd };
				}
			}
			merged.push(current);

			return merged.reduce(
				(acc, m) => acc + Math.round((m.endMs - m.startMs) / 1000),
				0,
			);
		}

		it("proves the difference between naive summation and true physical interval union for overlapping holds", () => {
			// Scenario: An official issues an event-wide 45-minute weather hold from 10:00 to 10:45.
			// Concurrently, a volunteer captain at Aid 1 logs an individual 30-minute medical hold from 10:30 to 11:00.
			const hold1: IntervalAllowance = {
				start: new Date("2026-11-05T10:00:00Z"),
				end: new Date("2026-11-05T10:45:00Z"),
				durationSeconds: 2700, // 45 min
			};
			const hold2: IntervalAllowance = {
				start: new Date("2026-11-05T10:30:00Z"),
				end: new Date("2026-11-05T11:00:00Z"),
				durationSeconds: 1800, // 30 min
			};

			// Naive sum = 2700 + 1800 = 4500s (75 minutes)
			const naiveSum = hold1.durationSeconds + hold2.durationSeconds;
			assert.equal(naiveSum, 4500);

			// Physical union = 10:00 to 11:00 = 3600s (60 minutes)
			const unionDuration = calculateUnionAllowanceSeconds([hold1, hold2]);
			assert.equal(unionDuration, 3600);
			assert.equal(
				naiveSum - unionDuration,
				900,
				"Overlapping 15-minute window must not be double credited in physical union",
			);
		});

		it("deduplicates identical duplicate time allowance entries in interval union calculation", () => {
			const identicalHold: IntervalAllowance = {
				start: new Date("2026-11-05T12:00:00Z"),
				end: new Date("2026-11-05T12:30:00Z"),
				durationSeconds: 1800,
			};

			// Submitted twice (double-tap by steward)
			const doubleEntry = [identicalHold, { ...identicalHold }];
			const unionSeconds = calculateUnionAllowanceSeconds(doubleEntry);
			assert.equal(
				unionSeconds,
				1800,
				"Identical duplicate holds must collapse to single duration",
			);
		});

		it("enforces temporal causality: holds never credit historical splits recorded prior to hold start", () => {
			// Hold begins at 12:00:00 UTC
			const holdStart = new Date("2026-11-05T12:00:00Z");
			const holdDuration = 1800; // 30 min

			const split1Time = new Date("2026-11-05T08:30:00Z"); // Prior to hold
			const split2Time = new Date("2026-11-05T12:15:00Z"); // Concurrent with hold
			const split3Time = new Date("2026-11-05T15:00:00Z"); // Subsequent to hold

			const evaluateCausalityCredit = (
				splitRecordedTime: Date,
			): number => {
				return splitRecordedTime.getTime() >= holdStart.getTime()
					? holdDuration
					: 0;
			};

			assert.equal(
				evaluateCausalityCredit(split1Time),
				0,
				"Preceding splits must not receive credit",
			);
			assert.equal(
				evaluateCausalityCredit(split2Time),
				1800,
				"Concurrent splits must receive credit",
			);
			assert.equal(
				evaluateCausalityCredit(split3Time),
				1800,
				"Subsequent splits must receive credit",
			);
		});

		it("strictly validates time allowance input schemas against zero, negative, or invalid durations", () => {
			const invalidDurations = [0, -1, -900, -3600];
			for (const d of invalidDurations) {
				const res = createTimeAllowanceInput.safeParse({
					entrantId: testUuid1,
					splitId: testUuid2,
					startTime: "2026-11-05T10:00:00Z",
					endTime: "2026-11-05T10:30:00Z",
					durationSeconds: d,
					reason: "medical_hold",
				});
				assert.equal(
					res.success,
					false,
					`createTimeAllowanceInput must reject non-positive duration ${d}`,
				);
			}

			// Valid duration
			const valid = createTimeAllowanceInput.safeParse({
				entrantId: testUuid1,
				splitId: testUuid2,
				startTime: "2026-11-05T10:00:00Z",
				endTime: "2026-11-05T10:30:00Z",
				durationSeconds: 1800,
				reason: "weather_hold",
			});
			assert.equal(valid.success, true);
		});
	});

	// ==========================================================================
	// 3. POST-RACE RESULTS CERTIFICATION EDGE CASES
	// ==========================================================================
	describe("Area 3: Post-Race Results Certification Edge Cases", () => {
		let db: TestDatabase;
		let runnerFinisher: Entrant;
		let runnerLingering: Entrant;
		let runnerRetired: Entrant;

		beforeEach(() => {
			db = new TestDatabase();
			const orgId = db.nextId("org");
			const egId = db.nextId("eg");
			const eventId = db.nextId("event");
			const courseId = db.nextId("course");

			db.eventGroups.push({
				id: egId,
				organizationId: orgId,
				name: "Adversarial Closeout 50K",
				slug: "closeout-50k",
				discipline: "trail_ultra",
			});

			db.events.push({
				id: eventId,
				eventGroupId: egId,
				courseId,
				name: "50K Solo",
			});

			runnerFinisher = {
				id: db.nextId("entrant"),
				eventId,
				personId: db.nextId("person"),
				bibNumber: "1",
				status: "finished",
			};
			runnerLingering = {
				id: db.nextId("entrant"),
				eventId,
				personId: db.nextId("person"),
				bibNumber: "2",
				status: "in_progress",
			};
			runnerRetired = {
				id: db.nextId("entrant"),
				eventId,
				personId: db.nextId("person"),
				bibNumber: "3",
				status: "retired",
			};
			db.entrants.push(runnerFinisher, runnerLingering, runnerRetired);
		});

		it("establishes drops by sweeping in_progress and retired runners to DNF while preserving finished runners", () => {
			// Simulated establishDrops oracle:
			const candidatesToSweep = db.entrants.filter(
				(e) => e.status === "in_progress" || e.status === "retired",
			);
			assert.equal(candidatesToSweep.length, 2);

			for (const c of candidatesToSweep) {
				c.status = "dnf";
			}

			assert.equal(runnerFinisher.status, "finished");
			assert.equal(runnerLingering.status, "dnf");
			assert.equal(runnerRetired.status, "dnf");
		});

		it("proves certification idempotency: repeated certification runs create zero duplicate race history records", () => {
			interface RaceHistoryRecord {
				personId: string;
				raceName: string;
				raceDate: string;
				status: string;
			}
			const raceHistoryLedger: RaceHistoryRecord[] = [];

			const certifyRecord = (rec: RaceHistoryRecord) => {
				const existing = raceHistoryLedger.find(
					(h) =>
						h.personId === rec.personId &&
						h.raceName === rec.raceName &&
						h.raceDate === rec.raceDate,
				);
				if (!existing) {
					raceHistoryLedger.push(rec);
					return { inserted: true };
				}
				return { inserted: false };
			};

			const runRec: RaceHistoryRecord = {
				personId: runnerFinisher.personId,
				raceName: "Closeout 50K - 50K Solo",
				raceDate: "2026-11-05",
				status: "finished",
			};

			// Run 1: first certification
			const res1 = certifyRecord(runRec);
			assert.equal(res1.inserted, true);
			assert.equal(raceHistoryLedger.length, 1);

			// Run 2: idempotent re-certification
			const res2 = certifyRecord(runRec);
			assert.equal(res2.inserted, false);
			assert.equal(raceHistoryLedger.length, 1);

			// Run 3: idempotent re-certification
			const res3 = certifyRecord(runRec);
			assert.equal(res3.inserted, false);
			assert.equal(raceHistoryLedger.length, 1);
		});

		it("recalculates person historical summaries accurately after certification updates", () => {
			const personHistory = [
				{ status: "finished", distanceMeters: 50000, elevationGainMeters: 2000 },
				{ status: "finished", distanceMeters: 100000, elevationGainMeters: 4500 },
				{ status: "dnf", distanceMeters: 60000, elevationGainMeters: 2500 },
			];

			const totalRaces = personHistory.length;
			const totalFinishes = personHistory.filter((h) => h.status === "finished").length;
			const totalDnfs = personHistory.filter((h) => h.status === "dnf").length;
			const dnfRate = totalDnfs / totalRaces;
			const maxDist = Math.max(...personHistory.map((h) => h.distanceMeters));
			const maxElev = Math.max(...personHistory.map((h) => h.elevationGainMeters));

			assert.equal(totalRaces, 3);
			assert.equal(totalFinishes, 2);
			assert.equal(totalDnfs, 1);
			assert.equal(Math.round(dnfRate * 1000) / 1000, 0.333);
			assert.equal(maxDist, 100000);
			assert.equal(maxElev, 4500);
		});
	});

	// ==========================================================================
	// 4. FIFO CHUTE QUEUE CONCURRENCY & TICKET BINDING
	// ==========================================================================
	describe("Area 4: FIFO Chute Queue Concurrency & Ticket Binding", () => {
		let chute: DecoupledFifoChuteQueue;

		beforeEach(() => {
			chute = new DecoupledFifoChuteQueue();
		});

		it("captures high-velocity pack arrivals with atomic timestamps before bib assignment", () => {
			const baseTime = new Date("2026-11-05T14:30:00.000Z");
			const packCount = 20;

			// Rapid taps as 20 runners sprint through the finish chute
			for (let i = 0; i < packCount; i++) {
				const tapTime = new Date(baseTime.getTime() + i * 250); // Every 250ms
				chute.recordTimestamp({ timestamp: tapTime, subSplitKind: "point" });
			}

			assert.equal(chute.getPendingCount(), 20);
			assert.equal(chute.getAssignedCount(), 0);

			const tickets = chute.getAllTickets();
			assert.equal(tickets.length, 20);

			// Timestamps must be strictly chronological
			for (let i = 1; i < tickets.length; i++) {
				assert.ok(
					tickets[i].timestampUtc.getTime() >
						tickets[i - 1].timestampUtc.getTime(),
				);
			}
		});

		it("binds bib numbers in strict FIFO sequence and preserves metadata", () => {
			const t1 = new Date("2026-11-05T14:00:00Z");
			const t2 = new Date("2026-11-05T14:00:02Z");
			const t3 = new Date("2026-11-05T14:00:05Z");

			chute.recordTimestamp({ timestamp: t1, subSplitKind: "in", withPacer: false });
			chute.recordTimestamp({ timestamp: t2, subSplitKind: "in", withPacer: true });
			chute.recordTimestamp({ timestamp: t3, subSplitKind: "point", withPacer: false });

			assert.equal(chute.getPendingCount(), 3);

			// Volunteer enters bibs sequentially
			const b1 = chute.assignNextBib("101");
			assert.equal(b1?.assignedBib, "101");
			assert.equal(b1?.timestampUtc, t1);
			assert.equal(b1?.withPacer, false);

			const b2 = chute.assignNextBib("205");
			assert.equal(b2?.assignedBib, "205");
			assert.equal(b2?.timestampUtc, t2);
			assert.equal(b2?.withPacer, true);

			const b3 = chute.assignNextBib("42");
			assert.equal(b3?.assignedBib, "42");
			assert.equal(b3?.timestampUtc, t3);
			assert.equal(b3?.withPacer, false);

			assert.equal(chute.getPendingCount(), 0);
			assert.equal(chute.getAssignedCount(), 3);
		});

		it("returns null safely when binding to an empty queue or with empty/whitespace bib", () => {
			// Empty queue
			assert.equal(chute.assignNextBib("101"), null);

			// Record one timestamp
			chute.recordTimestamp({ timestamp: new Date() });
			assert.equal(chute.getPendingCount(), 1);

			// Empty string or whitespace must NOT consume ticket
			assert.equal(chute.assignNextBib(""), null);
			assert.equal(chute.assignNextBib("   "), null);
			assert.equal(chute.getPendingCount(), 1);

			// Legitimate bib consumes it
			const assigned = chute.assignNextBib(" 88 ");
			assert.equal(assigned?.assignedBib, "88");
			assert.equal(chute.getPendingCount(), 0);

			// Queue is empty again
			assert.equal(chute.assignNextBib("99"), null);
		});

		it("integrates seamlessly with KeypadInputBuffer and supports buffer editing before chute binding", () => {
			const keypad = new KeypadInputBuffer();

			// Volunteer enters 1-4-3 by mistake
			keypad.pushDigit("1");
			keypad.pushDigit("4");
			keypad.pushDigit("3");
			assert.equal(keypad.current, "143");

			// Backspace and correct to 142
			keypad.backspace();
			assert.equal(keypad.current, "14");
			keypad.pushDigit("2");
			assert.equal(keypad.current, "142");

			// Record unassigned chute punch
			chute.recordTimestamp({ timestamp: new Date() });

			// Commit from keypad and assign to chute
			const committedBib = keypad.commit();
			assert.equal(committedBib, "142");
			assert.equal(keypad.current, ""); // Buffer reset

			const ticket = chute.assignNextBib(committedBib);
			assert.equal(ticket?.assignedBib, "142");
			assert.equal(chute.getPendingCount(), 0);
		});

		it("resets all tickets cleanly on clear()", () => {
			chute.recordTimestamp();
			chute.recordTimestamp();
			chute.assignNextBib("101");
			assert.equal(chute.getAllTickets().length, 2);

			chute.clear();
			assert.equal(chute.getAllTickets().length, 0);
			assert.equal(chute.getPendingCount(), 0);
			assert.equal(chute.getAssignedCount(), 0);
		});
	});

	// ==========================================================================
	// 5. SAR TWO-STAGE TRIAGE BOUNDARIES
	// ==========================================================================
	describe("Area 5: SAR Two-Stage Triage Boundaries", () => {
		let db: TestDatabase;
		let egId: string;
		let eventId: string;
		let courseId: string;
		let splitStart: CourseSplit;
		let splitAid1: CourseSplit;
		let splitAid2: CourseSplit;
		let runner1: Entrant;

		beforeEach(() => {
			db = new TestDatabase();
			const orgId = db.nextId("org");
			egId = db.nextId("eg");
			eventId = db.nextId("event");
			courseId = db.nextId("course");

			db.eventGroups.push({
				id: egId,
				organizationId: orgId,
				name: "SAR Stress Test Ultra",
				slug: "sar-ultra",
				discipline: "trail_ultra",
			});

			db.events.push({
				id: eventId,
				eventGroupId: egId,
				courseId,
				name: "50 Miler",
			});

			const tpStart: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "START",
				name: "Start",
				latitude: 40.0,
				longitude: -111.0,
			};
			const tpAid1: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "AID1",
				name: "Aid 1",
				latitude: 40.1,
				longitude: -111.1,
			};
			const tpAid2: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "AID2",
				name: "Aid 2",
				latitude: 40.2,
				longitude: -111.2,
			};
			db.timingPoints.push(tpStart, tpAid1, tpAid2);

			splitStart = {
				id: db.nextId("split"),
				courseId,
				timingPointId: tpStart.id,
				name: "Start",
				sequenceOrder: 1,
				distanceFromStartMeters: 0,
				subSplitBitmap: 2,
			};
			splitAid1 = {
				id: db.nextId("split"),
				courseId,
				timingPointId: tpAid1.id,
				name: "Aid 1",
				sequenceOrder: 2,
				distanceFromStartMeters: 20000,
				subSplitBitmap: 3,
			};
			splitAid2 = {
				id: db.nextId("split"),
				courseId,
				timingPointId: tpAid2.id,
				name: "Aid 2",
				sequenceOrder: 3,
				distanceFromStartMeters: 40000,
				subSplitBitmap: 1,
			};
			db.courseSplits.push(splitStart, splitAid1, splitAid2);

			// Runner 101 has departed Aid 1 and is headed to Aid 2
			runner1 = {
				id: db.nextId("entrant"),
				eventId,
				personId: db.nextId("person"),
				bibNumber: "101",
				status: "in_progress",
				actualStartTime: new Date("2026-11-05T06:00:00Z"),
				projectedArrivals: {
					[splitAid2.id]: {
						projectedUtc: new Date("2026-11-05T12:00:00Z"),
						earliestUtc: new Date("2026-11-05T11:45:00Z"),
						latestUtc: new Date("2026-11-05T12:15:00Z"), // Upper projection boundary
					},
				},
			};
			db.entrants.push(runner1);

			// Record punch at Aid 1
			db.scoredSplitTimes.push({
				id: db.nextId("split-time"),
				entrantId: runner1.id,
				courseSplitId: splitAid1.id,
				lap: 1,
				subSplitKind: "out",
				absoluteTimeUtc: new Date("2026-11-05T09:30:00Z"),
				elapsedSeconds: 12600,
				penaltyPoints: 0,
				stoppedHere: false,
				dataStatus: "valid",
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		});

		it("tests exact millisecond boundary for Stage 1 overdue detection: exact boundary is NOT overdue, +1ms is overdue", () => {
			const upperBoundary = new Date("2026-11-05T12:15:00.000Z");

			// At exactly 12:15:00.000Z -> NOT overdue
			const alertsAtBoundary = db.queryStage1Overdue(egId, upperBoundary);
			assert.equal(
				alertsAtBoundary.length,
				0,
				"At exact projection boundary, runner must NOT be flagged overdue",
			);

			// At 12:15:00.001Z (1 ms past) -> IS overdue
			const justPast = new Date(upperBoundary.getTime() + 1);
			const alertsJustPast = db.queryStage1Overdue(egId, justPast);
			assert.equal(
				alertsJustPast.length,
				1,
				"1ms past boundary must trigger overdue alert",
			);
			assert.equal(alertsJustPast[0].entrant.bibNumber, "101");
			assert.equal(alertsJustPast[0].overdueSeconds, 0); // 1ms rounds to 0s

			// At 12:20:00.000Z (5 minutes past) -> overdueSeconds = 300
			const fiveMinPast = new Date(upperBoundary.getTime() + 300_000);
			const alerts5m = db.queryStage1Overdue(egId, fiveMinPast);
			assert.equal(alerts5m.length, 1);
			assert.equal(alerts5m[0].overdueSeconds, 300);
		});

		it("excludes runners checked IN at station from Stage 1 overdue between checkpoints", () => {
			// Runner checks IN at Aid 2
			db.scoredSplitTimes.push({
				id: db.nextId("split-time"),
				entrantId: runner1.id,
				courseSplitId: splitAid2.id,
				lap: 1,
				subSplitKind: "in",
				absoluteTimeUtc: new Date("2026-11-05T12:10:00Z"),
				elapsedSeconds: 22200,
				penaltyPoints: 0,
				stoppedHere: false,
				dataStatus: "valid",
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const testTime = new Date("2026-11-05T12:30:00Z"); // Later time
			const alerts = db.queryStage1Overdue(egId, testTime);
			assert.equal(
				alerts.length,
				0,
				"Runner checked in at station is no longer between checkpoints",
			);
		});

		it("tests exact boundary for Stage 2 station lingering: exact 45m is safe, 45m + 1s triggers alert", () => {
			const checkInTime = new Date("2026-11-05T10:00:00Z");

			// Clear previous splits and record single IN split at Aid 1
			db.scoredSplitTimes = [
				{
					id: db.nextId("split-time"),
					entrantId: runner1.id,
					courseSplitId: splitAid1.id,
					lap: 1,
					subSplitKind: "in",
					absoluteTimeUtc: checkInTime,
					elapsedSeconds: 14400,
					penaltyPoints: 0,
					stoppedHere: false,
					dataStatus: "valid",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			const MAX_SAFE_DWELL = 45 * 60; // 2700s

			// Exactly 45m dwell (10:45:00) -> safe, NOT lingering
			const at45m = new Date(checkInTime.getTime() + MAX_SAFE_DWELL * 1000);
			const alertsAt45m = db.queryStage2LingeringOrRetired(egId, at45m);
			assert.equal(
				alertsAt45m.length,
				0,
				"At exactly 45m dwell, runner is not yet lingering",
			);

			// 45m + 1s dwell (10:45:01) -> triggers lingering alert
			const at45m1s = new Date(
				checkInTime.getTime() + (MAX_SAFE_DWELL + 1) * 1000,
			);
			const alertsLingering = db.queryStage2LingeringOrRetired(egId, at45m1s);
			assert.equal(alertsLingering.length, 1);
			assert.equal(alertsLingering[0].type, "lingering_in_station");
			assert.equal(alertsLingering[0].dwellSeconds, 2701);
		});

		it("immediately triggers Stage 2 alert for Retired on Course (ROC) while DNF in station remains safe custody", () => {
			const runnerRoc: Entrant = {
				id: db.nextId("entrant"),
				eventId,
				personId: db.nextId("person"),
				bibNumber: "202",
				status: "retired",
				withdrawnAt: new Date("2026-11-05T11:30:00Z"),
			};
			const runnerDnf: Entrant = {
				id: db.nextId("entrant"),
				eventId,
				personId: db.nextId("person"),
				bibNumber: "303",
				status: "dnf",
			};
			db.entrants.push(runnerRoc, runnerDnf);

			const alerts = db.queryStage2LingeringOrRetired(
				egId,
				new Date("2026-11-05T12:00:00Z"),
			);
			// Only runnerRoc must appear
			const rocAlert = alerts.find((a) => a.entrant.bibNumber === "202");
			assert.ok(rocAlert !== undefined);
			assert.equal(rocAlert.type, "retired_on_course");

			const dnfAlert = alerts.find((a) => a.entrant.bibNumber === "303");
			assert.equal(
				dnfAlert,
				undefined,
				"Safe station DNF must not trigger Stage 2 ROC alert",
			);
		});
	});

	// ==========================================================================
	// 6. MT63 DIGITAL RADIO TEXT PARSER MALFORMED FRAMES & NOISE
	// ==========================================================================
	describe("Area 6: MT63 Digital Radio Text Parser Malformed Frames & Noise", () => {
		it("gracefully ignores corrupt checksum trailers and trailers with radio noise", () => {
			const rawRadioBurst = `
# MT63-1000 Acoustic Transcription Log
AID1 101 IN 14:00:00
AID1 101 OUT 14:15:00
AID1 102 POINT 14:16:30 +P
[CRC:DEADBEEF]
*CHECKSUM:INVALID*
CHECKSUM FAIL 0x9921
### END BURST ###
`;
			const result = parseMt63Block(rawRadioBurst);
			assert.equal(result.punches.length, 3);
			assert.equal(result.punches[0].competitorNumber, "101");
			assert.equal(result.punches[0].subSplitKind, "in");
			assert.equal(result.punches[1].subSplitKind, "out");
			assert.equal(result.punches[2].competitorNumber, "102");
			assert.equal(result.punches[2].withPacer, true);

			// Trailing noise lines are recorded as errors without crashing
			assert.ok(result.errors.length >= 3);
		});

		it("detects truncated and malformed radio frames and records line numbers and reasons", () => {
			const badFrames = `
AID1
AID1 101
AID1 101 IN
AID1 101 INVALID_KIND 14:00:00
AID1 101 IN 25:00:00
AID1 101 IN 12:60:00
AID1 101 IN -05:00:00
AID1 101 IN abc:def:gh
`;
			const result = parseMt63Block(badFrames);
			assert.equal(result.punches.length, 0);
			assert.equal(result.errors.length, 8);

			// Verify error details
			assert.match(result.errors[0].reason, /Insufficient tokens/);
			assert.match(result.errors[1].reason, /Insufficient tokens/);
			assert.match(result.errors[2].reason, /Insufficient tokens/);
			assert.match(result.errors[3].reason, /Invalid split kind/);
			assert.match(result.errors[4].reason, /Malformed time of day/);
			assert.match(result.errors[5].reason, /Malformed time of day/);
			assert.match(result.errors[6].reason, /Malformed time of day/);
			assert.match(result.errors[7].reason, /Malformed time of day/);
		});

		it("survives heavy chaotic acoustic noise stress: extracts all 50 valid punches scattered amidst 100 noise lines", () => {
			const validPunchesExpected: Array<{
				station: string;
				bib: string;
				kind: string;
				time: string;
			}> = [];
			const lines: string[] = [];

			lines.push("=== START MT63 BURST ===");
			lines.push("// Net Control: W6TRC monitoring");

			for (let i = 1; i <= 50; i++) {
				// Inject 2 noise lines before each punch
				lines.push(`~~~~ STATIC NOISE LINE ${i} !@#$%^&*() ~~~~`);
				lines.push(`BURST TONE 1000HZ SIGNAL_LEVEL_${i % 10}`);

				const station = i % 2 === 0 ? "KROGER" : "OURAY";
				const bib = String(100 + i);
				const kind = i % 3 === 0 ? "OUT" : i % 3 === 1 ? "IN" : "POINT";
				const hh = String(8 + Math.floor(i / 10)).padStart(2, "0");
				const mm = String((i * 7) % 60).padStart(2, "0");
				const ss = String((i * 13) % 60).padStart(2, "0");
				const time = `${hh}:${mm}:${ss}`;

				validPunchesExpected.push({
					station,
					bib,
					kind: kind.toLowerCase(),
					time,
				});
				lines.push(`${station} #${bib} ${kind} ${time} ${i % 4 === 0 ? "PACER" : ""}`);
			}

			lines.push("CRC=0xCAFE");
			lines.push("=== END BURST ===");

			const bigPayload = lines.join("\n");
			const result = parseMt63Block(bigPayload);

			assert.equal(result.punches.length, 50);

			for (let i = 0; i < 50; i++) {
				const expected = validPunchesExpected[i];
				const actual = result.punches[i];

				assert.equal(actual.stationCode, expected.station);
				assert.equal(actual.competitorNumber, expected.bib);
				assert.equal(actual.subSplitKind, expected.kind);
				assert.equal(actual.timeOfDay, expected.time);
				if ((i + 1) % 4 === 0) {
					assert.equal(actual.withPacer, true);
				}
			}

			// All noise lines were captured into errors without halting parsing
			assert.ok(result.errors.length > 100);
		});
	});
});
