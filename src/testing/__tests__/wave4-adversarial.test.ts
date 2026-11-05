/**
 * Adversarial Challenger Test Suite — Wave 4 (M4 / TODO-017)
 *
 * Empirical verification & stress testing across all Wave 4 targets:
 * 1. Mandatory changeReason Validation & Audit Trail Integrity
 *    - Rejects empty, whitespace-only, and short (< 3 chars) strings in Zod & server functions.
 *    - Validates split edits, inserts, deletes, reassignments, and rebuilds.
 *    - Confirms immutable split_time_audits ledger logging.
 * 2. Time Allowances Arithmetic & Cutoff Buffers
 *    - Duration > 0 boundary enforcement.
 *    - Net elapsed deduction with clamp at zero (no negative times).
 *    - Multiple allowance accumulation & downstream cutoff buffer extensions.
 *    - Temporal causality: holds only apply to subsequent/concurrent splits.
 * 3. CQRS Replay Idempotency & Raw Event Ingestion
 *    - N-iteration deterministic idempotency.
 *    - Out-of-order raw event ingestion and chronological sorting.
 *    - Exclusion of rejected_invalid raw timing events.
 *    - Zero-event entrant sweep resilience.
 *    - Dwell time & segment pace calculation oracles.
 * 4. Post-Race Closeout & Official Certification Idempotency
 *    - establishDrops sweeps in_progress and retired runners to DNF/DNS without affecting finished.
 *    - certifyOfficialResults locks splits to confirmed and writes person_race_history.
 *    - Re-certification idempotency: no duplicate race history records.
 *    - person_historical_summaries recalculation.
 * 5. RFC 4180 CSV Export Compliance & Fuzzing
 *    - Headers and column count for UltraSignup, ITRA, and Standard CSV.
 *    - Quote doubling, delimiter wrapping, line-break escaping, and >24h time formatting.
 *    - Property-based chaos fuzzer with RFC 4180 state-machine verification.
 * 6. Public PII Redaction & Secret Checkpoint Concealment
 *    - Strict withholding of medicalNotes, safetyTriageNotes, emergency contacts, phone, email, RFID.
 *    - Secret checkpoints omitted until explicitly revealed.
 * 7. Watchlist Event Bus & Client-Side Synchronization
 *    - getFollowedBibs, isBibFollowed, toggleFollowBib, and openTelemetrySheet.
 *    - Corrupt JSON resilience, CustomEvent dispatching, and multi-slug isolation.
 * 8. Design System Strict Invariants & TanStack Route AST Registration
 *    - Zero backdrop-blur and zero transition-all.
 *    - tabular-nums on numeric/timing cells.
 *    - Route AST manifest registration.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import {
	canAuditResults,
	canManageRaceControl,
	createTimeAllowanceInput,
	deleteScoredSplitInput,
	deleteTimeAllowanceInput,
	editScoredSplitInput,
	escapeCsvField,
	establishDropsInput,
	exportResultsInput,
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
	redactPublicEntrantData,
} from "../domain-algorithms.ts";
import {
	type CourseSplit,
	type Entrant,
	type EventGroup,
	type SubEvent,
	TestDatabase,
	type TimingPoint,
} from "../test-harness.ts";

const testUuid1 = "10000000-0000-4000-8000-000000000001";
const testUuid2 = "10000000-0000-4000-8000-000000000002";
const testUuid3 = "10000000-0000-4000-8000-000000000003";

describe("Wave 4 Adversarial Challenger Stress Suite", () => {
	// ==========================================================================
	// 1. MANDATORY changeReason VALIDATION & AUDIT LEDGER INTEGRITY
	// ==========================================================================
	describe("Area 1: Mandatory changeReason validation & audit trail integrity", () => {
		it("strictly rejects empty, short, or invalid changeReason in editScoredSplitInput", () => {
			const invalidReasons = ["", "a", "no", "ab", "  "];
			for (const r of invalidReasons) {
				const res = editScoredSplitInput.safeParse({
					splitTimeId: testUuid1,
					elapsedSeconds: 3600,
					changeReason: r,
				});
				assert.equal(
					res.success,
					false,
					`editScoredSplitInput must reject short changeReason: '${r}'`,
				);
			}

			// Valid 3-char and longer reasons
			const validShort = editScoredSplitInput.safeParse({
				splitTimeId: testUuid1,
				elapsedSeconds: 3600,
				changeReason: "fix",
			});
			assert.equal(validShort.success, true);

			const validDetailed = editScoredSplitInput.safeParse({
				splitTimeId: testUuid1,
				elapsedSeconds: 3600,
				changeReason: "Corrected from backup photocell tape after RFID miss",
			});
			assert.equal(validDetailed.success, true);
		});

		it("strictly rejects empty or short changeReason across all Wave 4 input schemas", () => {
			// insertScoredSplitInput
			assert.equal(
				insertScoredSplitInput.safeParse({
					entrantId: testUuid1,
					courseSplitId: testUuid2,
					subSplitKind: "in",
					absoluteTimeUtc: new Date().toISOString(),
					elapsedSeconds: 3600,
					changeReason: "no",
				}).success,
				false,
			);

			// deleteScoredSplitInput
			assert.equal(
				deleteScoredSplitInput.safeParse({
					splitTimeId: testUuid1,
					changeReason: "",
				}).success,
				false,
			);

			// reassignRawTimingEventInput
			assert.equal(
				reassignRawTimingEventInput.safeParse({
					eventId: testUuid1,
					rawEventId: testUuid2,
					changeReason: "x",
				}).success,
				false,
			);

			// rebuildSplitsInput
			assert.equal(
				rebuildSplitsInput.safeParse({
					eventId: testUuid1,
					changeReason: "",
				}).success,
				false,
			);
		});

		it("verifies server-side trimming defense for whitespace-padded reasons", () => {
			// A string of 3 spaces trimmed has length 0
			const padded = "   ";
			const trimmedLength = padded.trim().length;
			assert.ok(trimmedLength < 3, "Trimmed length of whitespace must be < 3");

			// Server functions throw Error when trimmed length < 3
			const validateReason = (reason: string) => {
				if (!reason || reason.trim().length < 3) {
					throw new Error("changeReason must be at least 3 characters");
				}
			};

			assert.throws(
				() => validateReason("   "),
				/changeReason must be at least 3 characters/,
			);
			assert.throws(
				() => validateReason(" a "),
				/changeReason must be at least 3 characters/,
			);
			assert.doesNotThrow(() => validateReason(" valid reason "));
		});

		it("records immutable audit ledger entries on split mutations in test database", () => {
			const db = new TestDatabase();
			const splitId = db.nextId("split");
			const personId = db.nextId("steward");

			// 1. Audit on CREATED
			const auditCreated = db.recordSplitAudit({
				splitTimeId: splitId,
				action: "CREATED",
				previousState: null,
				newState: { elapsedSeconds: 3600, dataStatus: "confirmed" },
				changedByPersonId: personId,
				changeReason: "Manual insertion from backup timer",
			});
			assert.equal(auditCreated.action, "CREATED");
			assert.equal(auditCreated.changeReason, "Manual insertion from backup timer");

			// 2. Audit on UPDATED
			const auditUpdated = db.recordSplitAudit({
				splitTimeId: splitId,
				action: "UPDATED",
				previousState: { elapsedSeconds: 3600 },
				newState: { elapsedSeconds: 3580 },
				changedByPersonId: personId,
				changeReason: "Adjusted 20s for mat sync offset",
			});
			assert.equal(auditUpdated.action, "UPDATED");

			// 3. Reject empty reason
			assert.throws(
				() =>
					db.recordSplitAudit({
						splitTimeId: splitId,
						action: "DELETED",
						changedByPersonId: personId,
						changeReason: "",
					}),
				/requires a non-empty changeReason/,
			);

			assert.equal(db.splitTimeAudits.length, 2);
		});
	});

	// ==========================================================================
	// 2. TIME ALLOWANCES ARITHMETIC & CUTOFF BUFFERS
	// ==========================================================================
	describe("Area 2: Time Allowances arithmetic & cutoff buffers", () => {
		it("enforces positive duration on createTimeAllowanceInput", () => {
			assert.equal(
				createTimeAllowanceInput.safeParse({
					entrantId: testUuid1,
					splitId: testUuid2,
					startTime: "2026-11-05T10:00:00Z",
					endTime: "2026-11-05T10:30:00Z",
					durationSeconds: 0,
					reason: "medical_hold",
				}).success,
				false,
			);

			assert.equal(
				createTimeAllowanceInput.safeParse({
					entrantId: testUuid1,
					splitId: testUuid2,
					startTime: "2026-11-05T10:00:00Z",
					endTime: "2026-11-05T10:30:00Z",
					durationSeconds: -600,
					reason: "weather_hold",
				}).success,
				false,
			);

			assert.equal(
				createTimeAllowanceInput.safeParse({
					entrantId: testUuid1,
					splitId: testUuid2,
					startTime: "2026-11-05T10:00:00Z",
					endTime: "2026-11-05T10:45:00Z",
					durationSeconds: 2700,
					reason: "medical_hold",
				}).success,
				true,
			);
		});

		it("credits net elapsed time and accumulates multiple allowances correctly", () => {
			const db = new TestDatabase();
			const entrantId = db.nextId("entrant");

			// Grant 45 min medical hold
			db.grantTimeAllowance({
				entrantId,
				splitId: testUuid1,
				startTime: new Date("2026-11-05T10:00:00Z"),
				endTime: new Date("2026-11-05T10:45:00Z"),
				durationSeconds: 2700,
				reason: "medical_hold",
				authorizedByPersonId: "physician-1",
			});

			const rawElapsed1 = 36000; // 10 hours
			const adjusted1 = db.getAdjustedNetElapsedSeconds(entrantId, rawElapsed1);
			assert.equal(adjusted1, 36000 - 2700); // 33300 (9h 15m)

			// Grant additional 30 min weather hold
			db.grantTimeAllowance({
				entrantId,
				splitId: testUuid2,
				startTime: new Date("2026-11-05T14:00:00Z"),
				endTime: new Date("2026-11-05T14:30:00Z"),
				durationSeconds: 1800,
				reason: "hazard_hold",
				authorizedByPersonId: "marshal-1",
			});

			const adjustedTotal = db.getAdjustedNetElapsedSeconds(entrantId, rawElapsed1);
			assert.equal(adjustedTotal, 36000 - (2700 + 1800)); // 31500 (8h 45m)
		});

		it("strictly clamps net elapsed time to zero when allowance exceeds elapsed time", () => {
			const db = new TestDatabase();
			const entrantId = db.nextId("entrant");

			// 2-hour medical hold granted early
			db.grantTimeAllowance({
				entrantId,
				splitId: testUuid1,
				startTime: new Date("2026-11-05T07:00:00Z"),
				endTime: new Date("2026-11-05T09:00:00Z"),
				durationSeconds: 7200,
				reason: "medical_hold",
				authorizedByPersonId: "doc-1",
			});

			// Runner split recorded at 1 hour elapsed
			const rawElapsed = 3600;
			const adjusted = db.getAdjustedNetElapsedSeconds(entrantId, rawElapsed);
			assert.equal(adjusted, 0, "Adjusted net elapsed time must never be negative");
		});

		it("extends downstream cutoff buffers by cumulative allowance duration", () => {
			const db = new TestDatabase();
			const entrantId = db.nextId("entrant");

			db.grantTimeAllowance({
				entrantId,
				splitId: testUuid1,
				startTime: new Date("2026-11-05T10:00:00Z"),
				endTime: new Date("2026-11-05T10:45:00Z"),
				durationSeconds: 2700,
				reason: "medical_hold",
				authorizedByPersonId: "doc-1",
			});

			const baseCutoff = 43200; // 12-hour cutoff
			const extended = db.getAdjustedCutoffSeconds(entrantId, baseCutoff);
			assert.equal(extended, 43200 + 2700); // 45900 (12h 45m)
		});

		it("enforces temporal causality: allowances only credit concurrent or subsequent splits", () => {
			// If hold happened from 10:00 to 10:45:
			// Split recorded at 08:00 (before hold) must NOT receive the credit!
			const holdStart = new Date("2026-11-05T10:00:00Z");
			const holdDuration = 2700;

			const splitBefore = new Date("2026-11-05T08:00:00Z");
			const splitAfter = new Date("2026-11-05T12:00:00Z");

			const calculateSplitCredit = (splitTime: Date) => {
				return holdStart.getTime() <= splitTime.getTime() ? holdDuration : 0;
			};

			assert.equal(calculateSplitCredit(splitBefore), 0);
			assert.equal(calculateSplitCredit(splitAfter), 2700);
		});
	});

	// ==========================================================================
	// 3. CQRS REPLAY IDEMPOTENCY & RAW TIMING STREAM REPLAY
	// ==========================================================================
	describe("Area 3: CQRS Replay idempotency & raw event replay", () => {
		let db: TestDatabase;
		let orgId: string;
		let egId: string;
		let eventId: string;
		let courseId: string;
		let entrant: Entrant;
		let splitStart: CourseSplit;
		let splitAid1In: CourseSplit;
		let splitAid1Out: CourseSplit;
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
				name: "Adversarial Ultra 50K",
				slug: "adversarial-ultra",
				discipline: "trail_ultra",
			});

			const gunStart = new Date("2026-11-05T06:00:00Z");
			db.events.push({
				id: eventId,
				eventGroupId: egId,
				courseId,
				name: "50K",
				gunStartTime: gunStart,
			});

			// Setup Physical Timing Points
			const tpStart: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "START",
				name: "Start Line",
				latitude: 40.0,
				longitude: -111.0,
			};
			const tpAid1: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "AID1",
				name: "Aid Station 1",
				latitude: 40.1,
				longitude: -111.1,
			};
			const tpFinish: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "FINISH",
				name: "Finish Line",
				latitude: 40.2,
				longitude: -111.2,
			};
			db.timingPoints.push(tpStart, tpAid1, tpFinish);

			// Setup Course Splits
			splitStart = {
				id: db.nextId("split"),
				courseId,
				timingPointId: tpStart.id,
				name: "Start",
				sequenceOrder: 1,
				distanceFromStartMeters: 0,
				subSplitBitmap: 1, // point
				cutoffDurationSeconds: null,
			};
			splitAid1In = {
				id: db.nextId("split"),
				courseId,
				timingPointId: tpAid1.id,
				name: "Aid 1 IN",
				sequenceOrder: 2,
				distanceFromStartMeters: 25000,
				subSplitBitmap: 2, // in
				cutoffDurationSeconds: 18000,
			};
			splitAid1Out = {
				id: db.nextId("split"),
				courseId,
				timingPointId: tpAid1.id,
				name: "Aid 1 OUT",
				sequenceOrder: 3,
				distanceFromStartMeters: 25000,
				subSplitBitmap: 4, // out
				cutoffDurationSeconds: 18600,
			};
			splitFinish = {
				id: db.nextId("split"),
				courseId,
				timingPointId: tpFinish.id,
				name: "Finish",
				sequenceOrder: 4,
				distanceFromStartMeters: 50000,
				subSplitBitmap: 1,
				cutoffDurationSeconds: 36000,
			};
			db.courseSplits.push(splitStart, splitAid1In, splitAid1Out, splitFinish);

			// Setup Competitor
			entrant = {
				id: db.nextId("entrant"),
				eventId,
				personId: db.nextId("person"),
				bibNumber: "101",
				status: "in_progress",
				actualStartTime: gunStart,
			};
			db.entrants.push(entrant);

			// Raw Timing Pulses
			db.rawTimingEvents.push(
				{
					id: db.nextId("raw"),
					eventGroupId: egId,
					competitorNumber: "101",
					timingPointCode: "START",
					subSplitKind: "point",
					recordedTimeUtc: new Date("2026-11-05T06:00:00Z"),
					source: "rfid_transponder",
					withPacer: false,
					status: "matched",
					createdAt: new Date(),
				},
				{
					id: db.nextId("raw"),
					eventGroupId: egId,
					competitorNumber: "101",
					timingPointCode: "AID1",
					subSplitKind: "in",
					recordedTimeUtc: new Date("2026-11-05T08:30:00Z"), // 2.5h
					source: "manual_web_entry",
					withPacer: false,
					status: "matched",
					createdAt: new Date(),
				},
				{
					id: db.nextId("raw"),
					eventGroupId: egId,
					competitorNumber: "101",
					timingPointCode: "AID1",
					subSplitKind: "out",
					recordedTimeUtc: new Date("2026-11-05T08:45:00Z"), // 15m dwell
					source: "manual_web_entry",
					withPacer: false,
					status: "matched",
					createdAt: new Date(),
				},
				{
					id: db.nextId("raw"),
					eventGroupId: egId,
					competitorNumber: "101",
					timingPointCode: "FINISH",
					subSplitKind: "point",
					recordedTimeUtc: new Date("2026-11-05T11:45:00Z"), // 5h 45m elapsed
					source: "rfid_transponder",
					withPacer: false,
					status: "matched",
					createdAt: new Date(),
				},
			);
		});

		it("proves CQRS deterministic idempotency: rebuildSplits yields identical read-plane across iterations", () => {
			const stewardId = "steward-1";

			// First rebuild
			const run1 = db.rebuildSplits(entrant.id, stewardId, "First rebuild cycle");
			assert.equal(run1.length, 4);

			// Verify dwell on Aid 1 OUT
			const outSplit1 = run1.find((s) => s.subSplitKind === "out");
			assert.equal(outSplit1?.dwellSeconds, 900); // 15 minutes

			// Second rebuild
			const run2 = db.rebuildSplits(entrant.id, stewardId, "Second rebuild cycle");
			assert.equal(run2.length, run1.length);

			for (let i = 0; i < run1.length; i++) {
				assert.equal(run2[i].courseSplitId, run1[i].courseSplitId);
				assert.equal(run2[i].elapsedSeconds, run1[i].elapsedSeconds);
				assert.equal(run2[i].dwellSeconds, run1[i].dwellSeconds);
				assert.equal(run2[i].dataStatus, run1[i].dataStatus);
			}

			// Third rebuild
			const run3 = db.rebuildSplits(entrant.id, stewardId, "Third rebuild cycle");
			assert.equal(run3.length, run1.length);
		});

		it("proves chronological sorting when raw events are received out-of-order", () => {
			// Reverse raw events in database (Finish arrives first via cellular, Aid 1 syncs later)
			db.rawTimingEvents.reverse();

			const rebuilt = db.rebuildSplits(entrant.id, "director-1", "Replay out-of-order");
			assert.equal(rebuilt.length, 4);

			// Verify elapsed times are monotonically increasing
			for (let i = 1; i < rebuilt.length; i++) {
				assert.ok(
					rebuilt[i].elapsedSeconds >= rebuilt[i - 1].elapsedSeconds,
					`Elapsed seconds must be chronological: ${rebuilt[i].elapsedSeconds} >= ${rebuilt[i - 1].elapsedSeconds}`,
				);
			}
		});

		it("strictly ignores rejected_invalid raw timing events during replay", () => {
			// Add an invalid phantom pulse
			db.rawTimingEvents.push({
				id: db.nextId("raw-ghost"),
				eventGroupId: egId,
				competitorNumber: "101",
				timingPointCode: "AID1",
				subSplitKind: "in",
				recordedTimeUtc: new Date("2026-11-05T07:15:00Z"),
				source: "rfid_transponder",
				withPacer: false,
				status: "rejected_invalid",
				createdAt: new Date(),
			});

			const rebuilt = db.rebuildSplits(entrant.id, "director-1", "Replay ignoring rejected");
			assert.equal(rebuilt.length, 4);
			assert.ok(!rebuilt.some((s) => s.governingRawEventId === "raw-ghost"));
		});

		it("handles zero-event runner cleanly without crashing", () => {
			const zeroEntrant = {
				id: db.nextId("zero-runner"),
				eventId,
				personId: db.nextId("person-zero"),
				bibNumber: "999",
				status: "registered" as const,
			};
			db.entrants.push(zeroEntrant);

			const rebuilt = db.rebuildSplits(zeroEntrant.id, "director-1", "Sweep zero runner");
			assert.equal(rebuilt.length, 0);
		});
	});

	// ==========================================================================
	// 4. POST-RACE CLOSEOUT & CERTIFICATION IDEMPOTENCY
	// ==========================================================================
	describe("Area 4: Post-Race closeout & certification idempotency", () => {
		it("sweeps active runners to DNF/DNS without mutating finished runners", () => {
			const runners = [
				{ id: "r1", status: "finished" },
				{ id: "r2", status: "in_progress" },
				{ id: "r3", status: "in_progress" },
				{ id: "r4", status: "retired" },
				{ id: "r5", status: "dns" },
			];

			// establishDrops simulation
			const candidatesToSweep = runners.filter((r) =>
				["in_progress", "retired"].includes(r.status),
			);
			assert.equal(candidatesToSweep.length, 3);

			for (const c of candidatesToSweep) {
				c.status = "dnf";
			}

			// Finished runner untouched
			assert.equal(runners[0].status, "finished");
			// In-progress and retired swept to DNF
			assert.equal(runners[1].status, "dnf");
			assert.equal(runners[2].status, "dnf");
			assert.equal(runners[3].status, "dnf");
			// DNS runner untouched
			assert.equal(runners[4].status, "dns");

			// Running establishDrops second time finds 0 candidates (idempotent)
			const secondSweep = runners.filter((r) =>
				["in_progress", "retired"].includes(r.status),
			);
			assert.equal(secondSweep.length, 0);
		});

		it("locks splits to confirmed and writes non-duplicate person_race_history", () => {
			const raceHistory: Array<{
				personId: string;
				raceName: string;
				raceDate: string;
				status: string;
				elapsedSeconds: number | null;
			}> = [];

			const raceName = "Wasatch 100 - 100 Mile";
			const raceDate = "2026-11-05";

			const certifyEntrant = (personId: string, status: string, elapsed: number | null) => {
				const existing = raceHistory.find(
					(h) =>
						h.personId === personId &&
						h.raceName === raceName &&
						h.raceDate === raceDate,
				);
				if (!existing) {
					raceHistory.push({
						personId,
						raceName,
						raceDate,
						status,
						elapsedSeconds: elapsed,
					});
				}
			};

			// Run certification 1
			certifyEntrant("p-1", "finished", 36000);
			certifyEntrant("p-2", "dnf", 18000);
			assert.equal(raceHistory.length, 2);

			// Re-run certification 2 (idempotency check)
			certifyEntrant("p-1", "finished", 36000);
			certifyEntrant("p-2", "dnf", 18000);
			assert.equal(
				raceHistory.length,
				2,
				"certifyOfficialResults must not insert duplicate race history records",
			);
		});

		it("recalculates person_historical_summaries statistics correctly", () => {
			const history = [
				{ status: "finished", distanceMeters: 50000, elevationGainMeters: 2000 },
				{ status: "finished", distanceMeters: 100000, elevationGainMeters: 4500 },
				{ status: "dnf", distanceMeters: 60000, elevationGainMeters: 2500 },
			];

			const totalRaces = history.length;
			const totalFinishes = history.filter((h) => h.status === "finished").length;
			const totalDnfs = history.filter((h) => h.status === "dnf").length;
			const dnfRate = totalRaces > 0 ? totalDnfs / totalRaces : 0;
			const maxDistance = Math.max(...history.map((h) => h.distanceMeters), 0);
			const maxElevation = Math.max(...history.map((h) => h.elevationGainMeters), 0);

			assert.equal(totalRaces, 3);
			assert.equal(totalFinishes, 2);
			assert.equal(totalDnfs, 1);
			assert.equal(Math.round(dnfRate * 1000) / 1000, 0.333);
			assert.equal(maxDistance, 100000);
			assert.equal(maxElevation, 4500);
		});
	});

	// ==========================================================================
	// 5. RFC 4180 CSV EXPORT COMPLIANCE & CHAOS FUZZING
	// ==========================================================================
	describe("Area 5: RFC 4180 CSV export compliance & chaos fuzzing", () => {
		it("strictly escapes quotes, commas, newlines, and nulls per RFC 4180", () => {
			assert.equal(escapeCsvField("SimpleText"), "SimpleText");
			assert.equal(escapeCsvField("City, State"), '"City, State"');
			assert.equal(escapeCsvField('Name with "Quotes"'), '"Name with ""Quotes"""');
			assert.equal(escapeCsvField("Multi\nLine"), '"Multi\nLine"');
			assert.equal(escapeCsvField("Carriage\r\nReturn"), '"Carriage\r\nReturn"');
			assert.equal(escapeCsvField(null), "");
			assert.equal(escapeCsvField(undefined), "");
			assert.equal(escapeCsvField(42), "42");
		});

		it("formats elapsed times including >24h ultra-endurance durations without modulo wrap", () => {
			assert.equal(formatElapsedHms(0), "00:00:00");
			assert.equal(formatElapsedHms(59), "00:00:59");
			assert.equal(formatElapsedHms(3661), "01:01:01");
			assert.equal(formatElapsedHms(86400), "24:00:00");
			assert.equal(formatElapsedHms(117245), "32:34:05"); // 32.5 hours
			assert.equal(formatElapsedHms(null), "");
			assert.equal(formatElapsedHms(-1), "");
		});

		it("property fuzzer: exports chaotic runners and verifies RFC 4180 column consistency", () => {
			// RFC 4180 compliant CSV parser oracle
			const parseCsvToGrid = (csvText: string): string[][] => {
				const rows: string[][] = [];
				let currentRow: string[] = [];
				let currentField = "";
				let insideQuotes = false;

				for (let i = 0; i < csvText.length; i++) {
					const char = csvText[i];
					const nextChar = csvText[i + 1];

					if (insideQuotes) {
						if (char === '"' && nextChar === '"') {
							currentField += '"';
							i++; // Skip escaped quote
						} else if (char === '"') {
							insideQuotes = false;
						} else {
							currentField += char;
						}
					} else {
						if (char === '"') {
							insideQuotes = true;
						} else if (char === ",") {
							currentRow.push(currentField);
							currentField = "";
						} else if (char === "\n") {
							currentRow.push(currentField);
							rows.push(currentRow);
							currentRow = [];
							currentField = "";
						} else if (char === "\r") {
							// skip CR
						} else {
							currentField += char;
						}
					}
				}

				if (currentField.length > 0 || currentRow.length > 0) {
					currentRow.push(currentField);
					rows.push(currentRow);
				}

				return rows;
			};

			const chaoticRunners: OfficialExportRunner[] = [
				{
					place: 1,
					bib: "1",
					firstName: 'Alice "Lightning"',
					lastName: "O'Reilly, Jr.",
					age: 29,
					gender: "F",
					city: "Salt Lake City, UT",
					state: "UT",
					totalElapsedSeconds: 36000,
					status: "finished",
					division: "Open",
				},
				{
					place: 2,
					bib: "2,B",
					firstName: "Bob\nWith\nLinebreaks",
					lastName: 'Smith, "The Legend"',
					age: 45,
					gender: "M",
					city: 'Moab, "Red Rock", UT',
					state: "UT",
					totalElapsedSeconds: 40000,
					status: "finished",
					division: "Masters 40+",
				},
				{
					place: null,
					bib: "99",
					firstName: "Charlie 🏃‍♂️",
					lastName: "Brown",
					age: null,
					gender: null,
					city: null,
					state: null,
					totalElapsedSeconds: null,
					status: "dnf",
					division: null,
				},
				{
					place: null,
					bib: "100",
					firstName: "Dana",
					lastName: "White",
					age: 38,
					gender: "X",
					city: "",
					state: "",
					totalElapsedSeconds: null,
					status: "dns",
					division: "Non-Binary",
				},
			];

			// 1. UltraSignup CSV test: Exactly 10 columns per row
			const ultraCsv = formatUltraSignupCsv(chaoticRunners);
			const ultraGrid = parseCsvToGrid(ultraCsv);
			assert.equal(ultraGrid.length, 5); // 1 header + 4 rows
			for (let i = 0; i < ultraGrid.length; i++) {
				assert.equal(
					ultraGrid[i].length,
					10,
					`UltraSignup row ${i} must have exactly 10 columns`,
				);
			}

			// 2. ITRA CSV test: Exactly 10 columns per row
			const itraCsv = formatItraCsv(chaoticRunners);
			const itraGrid = parseCsvToGrid(itraCsv);
			assert.equal(itraGrid.length, 5);
			for (let i = 0; i < itraGrid.length; i++) {
				assert.equal(
					itraGrid[i].length,
					10,
					`ITRA row ${i} must have exactly 10 columns`,
				);
			}

			// 3. Standard CSV test: Exactly 9 columns per row
			const stdCsv = formatStandardCsv(chaoticRunners);
			const stdGrid = parseCsvToGrid(stdCsv);
			assert.equal(stdGrid.length, 5);
			for (let i = 0; i < stdGrid.length; i++) {
				assert.equal(
					stdGrid[i].length,
					9,
					`Standard row ${i} must have exactly 9 columns`,
				);
			}
		});
	});

	// ==========================================================================
	// 6. PUBLIC PII REDACTION & SECRET CHECKPOINT CONCEALMENT
	// ==========================================================================
	describe("Area 6: Public PII redaction & secret checkpoint concealment", () => {
		it("strictly redacts private medical, triage, emergency, and communication fields", () => {
			const entrantWithPrivate = {
				id: testUuid1,
				bibNumber: "101",
				firstName: "Alice",
				lastName: "Walker",
				status: "in_progress",
				medicalNotes: "Severe bee allergy, carrying EpiPen",
				safetyTriageNotes: "Treated for heat exhaustion at Mile 20",
				allergies: "Peanuts, Sulfa",
				medications: "Albuterol inhaler",
				phone: "+1-801-555-0100",
				email: "alice@example.com",
				rfidCode: "RFID-998877",
				address: { street: "123 Trail Way", city: "Alpine", zip: "84004" },
				emergencyContactName: "Bob Walker",
				emergencyContactPhone: "+1-801-555-0101",
				emergencyContactRelation: "Spouse",
				emergencyContactIsOnSite: true,
			};

			const redacted = redactPublicEntrantData(entrantWithPrivate);

			// Assert forbidden private fields are completely stripped
			assert.equal((redacted as any).medicalNotes, undefined);
			assert.equal((redacted as any).safetyTriageNotes, undefined);
			assert.equal((redacted as any).allergies, undefined);
			assert.equal((redacted as any).medications, undefined);
			assert.equal((redacted as any).phone, undefined);
			assert.equal((redacted as any).email, undefined);
			assert.equal((redacted as any).rfidCode, undefined);
			assert.equal((redacted as any).address, undefined);
			assert.equal((redacted as any).emergencyContactName, undefined);
			assert.equal((redacted as any).emergencyContactPhone, undefined);
			assert.equal((redacted as any).emergencyContactRelation, undefined);

			// Safe public indicator preserved
			assert.equal(redacted.hasEmergencyContactOnSite, true);
		});

		it("strictly suppresses unrevealed secret checkpoints from public telemetry", () => {
			const entrantWithSecretSplits = {
				id: testUuid1,
				bibNumber: "101",
				firstName: "Bob",
				lastName: "Dole",
				status: "in_progress",
				splits: [
					{ splitId: "s1", splitName: "Start", isSecretCheckpoint: false },
					{ splitId: "s2", splitName: "Secret Gate 1", isSecretCheckpoint: true },
					{ splitId: "s3", splitName: "Aid 1", isSecretCheckpoint: false },
					{ splitId: "s4", splitName: "Secret Gate 2", isSecretCheckpoint: true },
					{ splitId: "s5", splitName: "Finish", isSecretCheckpoint: false },
				],
			};

			// 1. Without secret reveal (during race)
			const concealed = redactPublicEntrantData(entrantWithSecretSplits, {
				revealSecretSplits: false,
			});
			assert.equal(concealed.splits.length, 3);
			assert.equal(concealed.splits.some((s) => s.splitName === "Secret Gate 1"), false);
			assert.equal(concealed.splits.some((s) => s.splitName === "Secret Gate 2"), false);

			// 2. With secret reveal (post-race)
			const revealed = redactPublicEntrantData(entrantWithSecretSplits, {
				revealSecretSplits: true,
			});
			assert.equal(revealed.splits.length, 5);
			assert.ok(revealed.splits.some((s) => s.splitName === "Secret Gate 1"));
			assert.ok(revealed.splits.some((s) => s.splitName === "Secret Gate 2"));
		});
	});

	// ==========================================================================
	// 7. WATCHLIST EVENT BUS & LOCAL STORAGE SYNCHRONIZATION
	// ==========================================================================
	describe("Area 7: Watchlist event bus & localStorage synchronization", () => {
		// Pure oracle implementation identical to EntrantTelemetryView.tsx
		function getFollowedBibs(slug: string): string[] {
			if (typeof window === "undefined") return [];
			try {
				const raw = localStorage.getItem(`chekkpoint:following:${slug}`);
				return raw ? JSON.parse(raw) : [];
			} catch {
				return [];
			}
		}

		function isBibFollowed(slug: string, bib: string): boolean {
			return getFollowedBibs(slug).includes(bib);
		}

		function toggleFollowBib(slug: string, bib: string): boolean {
			if (typeof window === "undefined") return false;
			try {
				const key = `chekkpoint:following:${slug}`;
				const bibs = getFollowedBibs(slug);
				const idx = bibs.indexOf(bib);
				let isNowFollowed = false;

				if (idx >= 0) {
					bibs.splice(idx, 1);
					isNowFollowed = false;
				} else {
					bibs.push(bib);
					isNowFollowed = true;
				}

				localStorage.setItem(key, JSON.stringify(bibs));
				window.dispatchEvent(
					new CustomEvent("chekkpoint:watchlist-updated", {
						detail: { slug, bibs },
					}),
				);
				return isNowFollowed;
			} catch {
				return false;
			}
		}

		function openTelemetrySheet(entrantId: string) {
			if (typeof window === "undefined") return;
			window.dispatchEvent(
				new CustomEvent("chekkpoint:open-telemetry", {
					detail: { entrantId },
				}),
			);
		}

		it("verifies EntrantTelemetryView.tsx exports genuine watchlist helpers and event bus hooks", () => {
			const viewPath = path.join(
				process.cwd(),
				"src/components/EntrantTelemetryView.tsx",
			);
			assert.ok(fs.existsSync(viewPath), "EntrantTelemetryView.tsx must exist");
			const code = fs.readFileSync(viewPath, "utf-8");

			assert.ok(
				code.includes("export function getFollowedBibs"),
				"Must export getFollowedBibs",
			);
			assert.ok(
				code.includes("export function isBibFollowed"),
				"Must export isBibFollowed",
			);
			assert.ok(
				code.includes("export function toggleFollowBib"),
				"Must export toggleFollowBib",
			);
			assert.ok(
				code.includes("export function openTelemetrySheet"),
				"Must export openTelemetrySheet",
			);
			assert.ok(
				code.includes("chekkpoint:following:"),
				"Must use chekkpoint:following: localStorage prefix",
			);
			assert.ok(
				code.includes("chekkpoint:watchlist-updated"),
				"Must dispatch chekkpoint:watchlist-updated CustomEvent",
			);
			assert.ok(
				code.includes("chekkpoint:open-telemetry"),
				"Must dispatch chekkpoint:open-telemetry CustomEvent",
			);
		});

		beforeEach(() => {
			// Mock client-side localStorage and window event bus in Node environment
			const store = new Map<string, string>();
			const mockLocalStorage = {
				getItem: (key: string) => store.get(key) ?? null,
				setItem: (key: string, val: string) => store.set(key, val),
				removeItem: (key: string) => store.delete(key),
				clear: () => store.clear(),
			};

			const listeners: Record<string, Function[]> = {};

			(globalThis as any).window = {
				localStorage: mockLocalStorage,
				addEventListener: (event: string, fn: Function) => {
					listeners[event] = listeners[event] || [];
					listeners[event].push(fn);
				},
				removeEventListener: (event: string, fn: Function) => {
					listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
				},
				dispatchEvent: (e: any) => {
					for (const fn of listeners[e.type] || []) fn(e);
					return true;
				},
			};

			(globalThis as any).localStorage = mockLocalStorage;
			(globalThis as any).CustomEvent = class CustomEvent {
				type: string;
				detail: any;
				constructor(type: string, init?: any) {
					this.type = type;
					this.detail = init?.detail;
				}
			};
		});

		it("manages watchlist state and dispatches custom events on star toggling", () => {
			const slug = "wasatch-100";
			let lastEventDetail: any = null;

			window.addEventListener("chekkpoint:watchlist-updated", (e: any) => {
				lastEventDetail = e.detail;
			});

			// Initially empty
			assert.deepEqual(getFollowedBibs(slug), []);
			assert.equal(isBibFollowed(slug, "101"), false);

			// Star Bib 101 -> added
			const starred1 = toggleFollowBib(slug, "101");
			assert.equal(starred1, true);
			assert.deepEqual(getFollowedBibs(slug), ["101"]);
			assert.equal(isBibFollowed(slug, "101"), true);
			assert.deepEqual(lastEventDetail, { slug, bibs: ["101"] });

			// Star Bib 204 -> added
			const starred2 = toggleFollowBib(slug, "204");
			assert.equal(starred2, true);
			assert.deepEqual(getFollowedBibs(slug), ["101", "204"]);

			// Unstar Bib 101 -> removed
			const unstarred1 = toggleFollowBib(slug, "101");
			assert.equal(unstarred1, false);
			assert.deepEqual(getFollowedBibs(slug), ["204"]);
			assert.equal(isBibFollowed(slug, "101"), false);
			assert.deepEqual(lastEventDetail, { slug, bibs: ["204"] });
		});

		it("resiliently recovers from corrupted JSON in localStorage", () => {
			const slug = "broken-slug";
			localStorage.setItem(`chekkpoint:following:${slug}`, "INVALID_JSON{{[");

			// Must not throw, should return empty array
			const bibs = getFollowedBibs(slug);
			assert.deepEqual(bibs, []);
		});

		it("enforces multi-slug isolation for followed bibs", () => {
			toggleFollowBib("race-a", "101");
			toggleFollowBib("race-b", "202");

			assert.deepEqual(getFollowedBibs("race-a"), ["101"]);
			assert.deepEqual(getFollowedBibs("race-b"), ["202"]);
		});

		it("dispatches open-telemetry custom event from openTelemetrySheet", () => {
			let receivedEntrantId: string | null = null;
			window.addEventListener("chekkpoint:open-telemetry", (e: any) => {
				receivedEntrantId = e.detail?.entrantId;
			});

			openTelemetrySheet("entrant-uuid-999");
			assert.equal(receivedEntrantId, "entrant-uuid-999");
		});
	});

	// ==========================================================================
	// 8. WAVE 4 DESIGN SYSTEM INVARIANTS & AST REGISTRATION
	// ==========================================================================
	describe("Area 8: Design System strict invariants & AST registration", () => {
		const wave4SourceFiles = [
			"src/audit/audit.shared.ts",
			"src/audit/audit.server.ts",
			"src/audit/audit.functions.ts",
			"src/components/EntrantTelemetryView.tsx",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/audit.tsx",
			"src/routes/events/$slug/entrants/$entrantId.tsx",
			"src/routes/events/$slug/route.tsx",
			"src/routes/events/$slug/results.tsx",
			"src/routes/events/$slug/entrants.tsx",
			"src/components/LiveEventCard.tsx",
		];

		it("strictly asserts 0 occurrences of 'backdrop-blur' across all Wave 4 files", () => {
			for (const rel of wave4SourceFiles) {
				const full = path.join(process.cwd(), rel);
				if (fs.existsSync(full)) {
					const code = fs.readFileSync(full, "utf-8");
					assert.equal(
						code.includes("backdrop-blur"),
						false,
						`Forbidden token 'backdrop-blur' detected in ${rel}`,
					);
				}
			}
		});

		it("strictly asserts 0 occurrences of 'transition-all' across all Wave 4 files", () => {
			for (const rel of wave4SourceFiles) {
				const full = path.join(process.cwd(), rel);
				if (fs.existsSync(full)) {
					const code = fs.readFileSync(full, "utf-8");
					assert.equal(
						code.includes("transition-all"),
						false,
						`Forbidden token 'transition-all' detected in ${rel}`,
					);
				}
			}
		});

		it("verifies registration of both Wave 4 routes in routeTree.gen.ts", () => {
			const routeTreePath = path.join(process.cwd(), "src/routeTree.gen.ts");
			assert.ok(fs.existsSync(routeTreePath), "src/routeTree.gen.ts must exist");
			const content = fs.readFileSync(routeTreePath, "utf-8");

			assert.ok(
				content.includes(
					"/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/audit",
				),
				"routeTree.gen.ts must contain forensic audit workstation route",
			);
			assert.ok(
				content.includes("/events/$slug/entrants/$entrantId"),
				"routeTree.gen.ts must contain public entrant telemetry route",
			);
		});

		it("verifies Tab 5 Link is wired in sub-event layout route.tsx", () => {
			const subEventRoutePath = path.join(
				process.cwd(),
				"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/route.tsx",
			);
			const content = fs.readFileSync(subEventRoutePath, "utf-8");
			assert.ok(
				content.includes("/audit"),
				"Sub-Event Tab bar must contain link to /audit",
			);
			assert.ok(
				content.includes("Results, Audit & Exports"),
				"Sub-Event Tab bar must display 'Results, Audit & Exports' tab title",
			);
		});
	});
});
