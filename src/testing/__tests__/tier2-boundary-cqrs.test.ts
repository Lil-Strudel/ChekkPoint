import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
	type CourseSplit,
	type Entrant,
	type EventGroup,
	type SubEvent,
	TestDatabase,
	type TimingPoint,
} from "../test-harness.ts";

describe("Tier 2: Boundary & Corner Cases / Server & CQRS Integration", () => {
	let db: TestDatabase;
	let orgId: string;
	let eventGroupId: string;
	let eventId: string;
	let courseId: string;
	let tpStart: TimingPoint;
	let tpAid1: TimingPoint;
	let tpFinish: TimingPoint;
	let splitStart: CourseSplit;
	let splitAid1In: CourseSplit;
	let splitFinish: CourseSplit;
	let testEntrant: Entrant;

	beforeEach(() => {
		db = new TestDatabase();
		orgId = db.nextId("org");
		eventGroupId = db.nextId("eg");
		courseId = db.nextId("course");
		eventId = db.nextId("event");

		// Setup event group
		const eventGroup: EventGroup = {
			id: eventGroupId,
			organizationId: orgId,
			name: "Wasatch 100",
			slug: "wasatch-100",
			discipline: "trail_ultra",
		};
		db.eventGroups.push(eventGroup);

		// Setup sub-event with gun start at 06:00:00 UTC
		const subEvent: SubEvent = {
			id: eventId,
			eventGroupId,
			courseId,
			name: "100 Mile Championship",
			gunStartTime: new Date("2026-11-05T06:00:00Z"),
		};
		db.events.push(subEvent);

		// Setup physical timing points
		tpStart = {
			id: db.nextId("tp"),
			organizationId: orgId,
			code: "START",
			name: "East Mountain Start",
			latitude: 40.7608,
			longitude: -111.891,
			elevationMeters: 1500,
		};
		tpAid1 = {
			id: db.nextId("tp"),
			organizationId: orgId,
			code: "AID1",
			name: "Big Mountain Pass",
			latitude: 40.8286,
			longitude: -111.654,
			elevationMeters: 2260,
		};
		tpFinish = {
			id: db.nextId("tp"),
			organizationId: orgId,
			code: "FINISH",
			name: "Homestead Finish",
			latitude: 40.5233,
			longitude: -111.478,
			elevationMeters: 1710,
		};
		db.timingPoints.push(tpStart, tpAid1, tpFinish);

		// Setup course splits
		splitStart = {
			id: db.nextId("cs"),
			courseId,
			timingPointId: tpStart.id,
			name: "Start",
			sequenceOrder: 1,
			distanceFromStartMeters: 0,
			subSplitBitmap: 2, // OUT only
		};
		splitAid1In = {
			id: db.nextId("cs"),
			courseId,
			timingPointId: tpAid1.id,
			name: "Big Mountain",
			sequenceOrder: 2,
			distanceFromStartMeters: 30_000, // 30 km
			subSplitBitmap: 3, // IN + OUT
			cutoffDurationSeconds: 6 * 3600, // 6 hour cutoff
		};
		splitFinish = {
			id: db.nextId("cs"),
			courseId,
			timingPointId: tpFinish.id,
			name: "Finish",
			sequenceOrder: 3,
			distanceFromStartMeters: 60_000, // 60 km
			subSplitBitmap: 1, // IN only
			cutoffDurationSeconds: 14 * 3600,
		};
		db.courseSplits.push(splitStart, splitAid1In, splitFinish);

		// Setup registered entrant (Bib 101)
		testEntrant = {
			id: db.nextId("entrant"),
			eventId,
			personId: db.nextId("person"),
			bibNumber: "101",
			status: "in_progress",
			actualStartTime: new Date("2026-11-05T06:00:00Z"),
			medicalNotes: "Severe penicillin allergy, asthmatic",
			safetyTriageNotes: "No known issues",
		};
		db.entrants.push(testEntrant);
	});

	// ==========================================================================
	// 1. EDGE CASE INPUTS & BOUNDARY HANDLING
	// ==========================================================================
	describe("Edge case inputs: negative durations, duplicates, zero distance", () => {
		it("flags punches recorded before race start with dataStatus = 'bad'", () => {
			// Punch recorded at 05:45:00 UTC (15 minutes BEFORE the 06:00:00 start)
			const preStartPunch = new Date("2026-11-05T05:45:00Z");

			const { scoredSplit } = db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "AID1",
				subSplitKind: "in",
				recordedTimeUtc: preStartPunch,
				source: "manual_web_entry",
			});

			assert.ok(scoredSplit !== null);
			assert.equal(scoredSplit.dataStatus, "bad");
			assert.ok(scoredSplit.elapsedSeconds < 0);
		});

		it("de-bounces raw punches within 30-second cluster window as duplicate_subordinate", () => {
			const punchTime1 = new Date("2026-11-05T09:30:00Z");
			const punchTime2 = new Date("2026-11-05T09:30:12Z"); // 12 seconds later (backup device or double tap)

			// First punch -> matched
			const first = db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "AID1",
				subSplitKind: "in",
				recordedTimeUtc: punchTime1,
				source: "rfid_transponder",
				sourceDeviceId: "mat-primary",
			});

			assert.equal(first.rawEvent.status, "matched");
			assert.ok(first.scoredSplit !== null);
			assert.equal(first.scoredSplit.elapsedSeconds, 3.5 * 3600); // 3h 30m

			// Second punch -> duplicate_subordinate
			const second = db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "AID1",
				subSplitKind: "in",
				recordedTimeUtc: punchTime2,
				source: "manual_web_entry",
				sourceDeviceId: "ipad-backup",
			});

			assert.equal(second.rawEvent.status, "duplicate_subordinate");
			assert.equal(second.scoredSplit, null); // Read plane was NOT overwritten

			// Read plane still holds the primary pulse
			const currentScored = db.scoredSplitTimes.find(
				(s) => s.entrantId === testEntrant.id && s.courseSplitId === splitAid1In.id,
			);
			assert.equal(currentScored?.governingRawEventId, first.rawEvent.id);
		});

		it("handles zero distance course splits without division by zero errors", () => {
			const zeroDistSplit: CourseSplit = {
				id: db.nextId("cs-zero"),
				courseId,
				timingPointId: tpStart.id,
				name: "Staging Loop",
				sequenceOrder: 1,
				distanceFromStartMeters: 0,
				subSplitBitmap: 1,
			};
			db.courseSplits.push(zeroDistSplit);

			const { scoredSplit } = db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "START",
				subSplitKind: "in",
				recordedTimeUtc: new Date("2026-11-05T06:05:00Z"),
				source: "manual_web_entry",
			});

			assert.ok(scoredSplit !== null);
			// Segment pace should be null rather than NaN or Infinity
			assert.equal(scoredSplit.segmentPaceSecondsPerKm, null);
		});
	});

	// ==========================================================================
	// 2. CQRS SPLIT DERIVATION & READ-PLANE MATERIALIZATION
	// ==========================================================================
	describe("CQRS split derivation from raw_timing_events into scored_split_times", () => {
		it("derives accurate elapsed time, dwell time, and segment pace from sequential punches", () => {
			// 1. Start punch (06:00:00)
			db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "START",
				subSplitKind: "out",
				recordedTimeUtc: new Date("2026-11-05T06:00:00Z"),
				source: "rfid_transponder",
			});

			// 2. Aid 1 IN punch (08:30:00, 2h 30m / 9000s)
			const aid1In = db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "AID1",
				subSplitKind: "in",
				recordedTimeUtc: new Date("2026-11-05T08:30:00Z"),
				source: "manual_web_entry",
			});

			assert.ok(aid1In.scoredSplit !== null);
			assert.equal(aid1In.scoredSplit.elapsedSeconds, 9000);
			// Segment 1 distance: 30 km. Pace = 9000s / 30km = 300s/km (5:00/km)
			assert.equal(aid1In.scoredSplit.segmentPaceSecondsPerKm, 300);
			assert.equal(aid1In.scoredSplit.dwellSeconds, null); // IN punch has no dwell

			// 3. Aid 1 OUT punch (08:44:30, 14m 30s dwell / 870s)
			const aid1Out = db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "AID1",
				subSplitKind: "out",
				recordedTimeUtc: new Date("2026-11-05T08:44:30Z"),
				source: "manual_web_entry",
			});

			assert.ok(aid1Out.scoredSplit !== null);
			assert.equal(aid1Out.scoredSplit.elapsedSeconds, 9870);
			assert.equal(aid1Out.scoredSplit.dwellSeconds, 870); // Exactly 14m 30s
		});
	});

	// ==========================================================================
	// 3. DETERMINISTIC CQRS REBUILD IDEMPOTENCY
	// ==========================================================================
	describe("Deterministic CQRS rebuild idempotency (rebuildSplits)", () => {
		it("rebuilds splits deterministically yielding identical state across multiple runs", () => {
			// Populate raw events: Start -> Aid1 IN -> Aid1 OUT -> Finish
			db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "START",
				subSplitKind: "out",
				recordedTimeUtc: new Date("2026-11-05T06:00:00Z"),
				source: "rfid_transponder",
			});
			db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "AID1",
				subSplitKind: "in",
				recordedTimeUtc: new Date("2026-11-05T08:30:00Z"),
				source: "manual_web_entry",
			});
			db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "AID1",
				subSplitKind: "out",
				recordedTimeUtc: new Date("2026-11-05T08:45:00Z"),
				source: "manual_web_entry",
			});
			db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "FINISH",
				subSplitKind: "in",
				recordedTimeUtc: new Date("2026-11-05T12:00:00Z"),
				source: "rfid_transponder",
			});

			const initialSplits = db.scoredSplitTimes
				.filter((s) => s.entrantId === testEntrant.id)
				.map((s) => ({
					splitId: s.courseSplitId,
					kind: s.subSplitKind,
					elapsed: s.elapsedSeconds,
					dwell: s.dwellSeconds,
				}));

			// Rebuild run 1
			const rebuild1 = db.rebuildSplits(
				testEntrant.id,
				"director-1",
				"Mat clock sync recalibration",
			);
			const rebuild1Mapped = rebuild1.map((s) => ({
				splitId: s.courseSplitId,
				kind: s.subSplitKind,
				elapsed: s.elapsedSeconds,
				dwell: s.dwellSeconds,
			}));

			assert.deepEqual(rebuild1Mapped, initialSplits);

			// Rebuild run 2 (idempotency check)
			const rebuild2 = db.rebuildSplits(
				testEntrant.id,
				"director-1",
				"Second verification pass",
			);
			const rebuild2Mapped = rebuild2.map((s) => ({
				splitId: s.courseSplitId,
				kind: s.subSplitKind,
				elapsed: s.elapsedSeconds,
				dwell: s.dwellSeconds,
			}));

			assert.deepEqual(rebuild2Mapped, initialSplits);
			assert.equal(db.splitTimeAudits.length, 2);
		});

		it("strictly rejects rebuild requests without a non-empty changeReason", () => {
			assert.throws(
				() => db.rebuildSplits(testEntrant.id, "director-1", ""),
				/changeReason is mandatory/,
			);
		});
	});

	// ==========================================================================
	// 4. TIME ALLOWANCES & CUTOFF EXTENSIONS
	// ==========================================================================
	describe("Time allowances deduction & cutoff extension", () => {
		it("deducts approved time allowance from net elapsed time and extends downstream cutoff", () => {
			// Entrant held at Aid 1 for 45 minutes (2700s) due to medical evaluation
			const holdStart = new Date("2026-11-05T08:30:00Z");
			const holdEnd = new Date("2026-11-05T09:15:00Z");

			db.grantTimeAllowance({
				entrantId: testEntrant.id,
				splitId: splitAid1In.id,
				startTime: holdStart,
				endTime: holdEnd,
				durationSeconds: 2700,
				reason: "medical_hold",
				authorizedByPersonId: "physician-1",
				notes: "Mandatory hydration and cognitive check",
			});

			const rawElapsed = 36000; // 10:00:00 raw elapsed
			const adjustedNet = db.getAdjustedNetElapsedSeconds(
				testEntrant.id,
				rawElapsed,
			);

			// 36,000s - 2,700s = 33,300s (9:15:00 adjusted net time)
			assert.equal(adjustedNet, 33300);

			// Cutoff at Finish is 14 hours (50,400s)
			// With 2,700s allowance, allowable cutoff extends to 53,100s (14h 45m)
			const baseCutoff = 14 * 3600;
			const extendedCutoff = db.getAdjustedCutoffSeconds(
				testEntrant.id,
				baseCutoff,
			);
			assert.equal(extendedCutoff, 53100);
		});

		it("rejects invalid non-positive allowance durations", () => {
			assert.throws(
				() =>
					db.grantTimeAllowance({
						entrantId: testEntrant.id,
						splitId: splitAid1In.id,
						startTime: new Date(),
						endTime: new Date(),
						durationSeconds: 0,
						reason: "medical_hold",
						authorizedByPersonId: "physician-1",
					}),
				/greater than zero/,
			);
		});
	});

	// ==========================================================================
	// 5. FORENSIC AUDIT TRAIL LOGGING
	// ==========================================================================
	describe("Forensic audit trail logging (split_time_audits)", () => {
		it("captures state transitions with mandatory changeReason", () => {
			const audit = db.recordSplitAudit({
				splitTimeId: "split-101",
				action: "UPDATED",
				previousState: { elapsedSeconds: 9000, dataStatus: "provisional" },
				newState: { elapsedSeconds: 8940, dataStatus: "confirmed" },
				changedByPersonId: "director-1",
				changeReason: "Timing mat backup photocell tape verification",
			});

			assert.equal(audit.action, "UPDATED");
			assert.equal(
				audit.changeReason,
				"Timing mat backup photocell tape verification",
			);
			assert.equal(db.splitTimeAudits.length, 1);
		});

		it("throws an error when changeReason is blank or whitespace", () => {
			assert.throws(
				() =>
					db.recordSplitAudit({
						splitTimeId: "split-101",
						action: "UPDATED",
						changedByPersonId: "director-1",
						changeReason: "   ",
					}),
				/Forensic audit log requires a non-empty changeReason/,
			);
		});
	});

	// ==========================================================================
	// 6. SAR STAGE 1 & STAGE 2 DETECTION QUERIES
	// ==========================================================================
	describe("SAR Stage 1 & Stage 2 detection queries", () => {
		it("detects Stage 1 Overdue runners when elapsed time exceeds projection upper band", () => {
			// Entrant punched Start (06:00:00) and Aid 1 OUT (08:45:00)
			db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "START",
				subSplitKind: "out",
				recordedTimeUtc: new Date("2026-11-05T06:00:00Z"),
				source: "rfid_transponder",
			});
			db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "AID1",
				subSplitKind: "out",
				recordedTimeUtc: new Date("2026-11-05T08:45:00Z"),
				source: "manual_web_entry",
			});

			// Projected arrival at Finish was between 11:30 and 12:00 UTC
			testEntrant.projectedArrivals = {
				[splitFinish.id]: {
					projectedUtc: new Date("2026-11-05T11:45:00Z"),
					earliestUtc: new Date("2026-11-05T11:30:00Z"),
					latestUtc: new Date("2026-11-05T12:00:00Z"),
				},
			};

			// As of 12:15:00 UTC (15 minutes overdue)
			const asOfTime = new Date("2026-11-05T12:15:00Z");
			const overdue = db.queryStage1Overdue(eventGroupId, asOfTime);

			assert.equal(overdue.length, 1);
			assert.equal(overdue[0].entrant.bibNumber, "101");
			assert.equal(overdue[0].overdueSeconds, 900); // 15 minutes overdue
		});

		it("detects Stage 2 Lingering runners dwelling in station beyond 45 minutes", () => {
			// Punched IN at Aid 1 at 08:00:00 UTC. Never punched OUT.
			db.ingestRawTimingEvent({
				eventGroupId,
				competitorNumber: "101",
				timingPointCode: "AID1",
				subSplitKind: "in",
				recordedTimeUtc: new Date("2026-11-05T08:00:00Z"),
				source: "manual_web_entry",
			});

			// As of 08:50:00 UTC (50 minutes dwelling, exceeds 45 min threshold)
			const asOfTime = new Date("2026-11-05T08:50:00Z");
			const lingering = db.queryStage2LingeringOrRetired(
				eventGroupId,
				asOfTime,
				45 * 60,
			);

			assert.equal(lingering.length, 1);
			assert.equal(lingering[0].type, "lingering_in_station");
			assert.equal(lingering[0].entrant.bibNumber, "101");
			assert.equal(lingering[0].dwellSeconds, 3000); // 50m
		});

		it("detects Stage 2 Retired on Course (ROC) runners immediately", () => {
			testEntrant.status = "retired";
			testEntrant.withdrawnAt = new Date("2026-11-05T10:15:00Z");

			const alerts = db.queryStage2LingeringOrRetired(
				eventGroupId,
				new Date("2026-11-05T10:30:00Z"),
			);

			assert.equal(alerts.length, 1);
			assert.equal(alerts[0].type, "retired_on_course");
			assert.equal(alerts[0].entrant.bibNumber, "101");
		});
	});

	// ==========================================================================
	// 7. RBAC MEDICAL DATA GATING (canViewMedicalData)
	// ==========================================================================
	describe("RBAC medical data gating (canViewMedicalData)", () => {
		it("permits organization owner, admin, or director to view medical data", () => {
			assert.equal(
				db.canViewMedicalData({
					organizationId: orgId,
					orgRoles: ["owner"],
					staffRoles: [],
					timingPointIds: [],
				}),
				true,
			);

			assert.equal(
				db.canViewMedicalData({
					organizationId: orgId,
					orgRoles: ["director"],
					staffRoles: [],
					timingPointIds: [],
				}),
				true,
			);
		});

		it("permits event staff with 'medical' or 'official' role to view medical data", () => {
			assert.equal(
				db.canViewMedicalData({
					organizationId: orgId,
					orgRoles: ["member"],
					staffRoles: ["medical"],
					timingPointIds: [tpAid1.id],
				}),
				true,
			);

			assert.equal(
				db.canViewMedicalData({
					organizationId: orgId,
					orgRoles: [],
					staffRoles: ["official"],
					timingPointIds: [],
				}),
				true,
			);
		});

		it("strictly denies plain volunteers and checkpoint captains from viewing medical data", () => {
			assert.equal(
				db.canViewMedicalData({
					organizationId: orgId,
					orgRoles: ["member"],
					staffRoles: ["volunteer"],
					timingPointIds: [tpAid1.id],
				}),
				false,
			);

			assert.equal(
				db.canViewMedicalData({
					organizationId: orgId,
					orgRoles: [],
					staffRoles: ["checkpoint_captain"],
					timingPointIds: [tpAid1.id],
				}),
				false,
			);
		});
	});
});
