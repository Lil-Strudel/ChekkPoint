/**
 * Adversarial Challenger Test Suite — Wave 3 (M3 / TODO-016)
 *
 * Empirical verification & stress testing across all Wave 3 requirements:
 * 1. Damerau-Levenshtein Typo-Defense HUD & Recommendation Engine
 *    - Adjacent transpositions (2, 3, 4, 6 digits), single insertions/deletions/substitutions.
 *    - Boundary conditions: empty strings, identical strings, large 7-digit bibs, whitespace.
 *    - Typo recommendation thresholds & confidence scoring.
 *    - Property-based randomized adjacent transposition generator.
 * 2. MT63 Amateur Radio Digital Text Block Parsing & Noise Resilience
 *    - Valid 500/1000/2000 blocks with transmission headers.
 *    - Missing headers, comments, trailing whitespace.
 *    - Acoustic noise bursts, malformed tokens, invalid timestamps.
 *    - Checksum trailers & multi-station radio bursts.
 * 3. Search & Rescue (SAR) Two-Stage Triage Logic & Alert Oracles
 *    - Stage 1: Overdue detection beyond upper projection band & expectedCutoffRisk.
 *    - Stage 2: Lingering dwell detection (>45m threshold) & Retired on Course (ROC).
 *    - Exclusions: finished, registered, or safely stopped runners do not trigger false alerts.
 * 4. DNF vs. Retired on Course (ROC) Differentiation
 *    - DNF: Safe station custody, sets status 'dnf', stoppedHere split flag, cross-check board zone.
 *    - ROC: Withdrawn between checkpoints, sets status 'retired', drop location notes, triggers Stage 2 alert.
 * 5. Medical Data RBAC Gating & Emergency Dossier Protection
 *    - canViewMedicalData matrix across org and staff roles.
 *    - Strict masking: medicalNotes and safetyTriageNotes redacted for non-privileged viewers.
 *    - Non-medical emergency contacts preserved for life-safety operations.
 * 6. 30-Second Cluster Deduplication in Station Split Ingestion
 *    - De-bouncing within 30s window (delta = 0s, 10s, 30s) -> duplicate_subordinate.
 *    - Punch past 30s window -> matched.
 *    - Independent subSplitKind (IN vs OUT within 15s) correctly recorded without false deduplication.
 *    - Station code and bib number isolation.
 * 7. Strict Design System Invariants & Full-Screen Kiosk Mode
 *    - 0 instances of backdrop-blur and 0 instances of transition-all.
 *    - Kiosk layout mode header/footer suppression on /logger in __root.tsx.
 *    - Route AST manifest registration in routeTree.gen.ts.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
	calculateDwellSeconds,
	calculateSegmentPaceSecondsPerKm,
	calculateTsdPenalty,
	damerauLevenshtein,
	getTypoRecommendation,
	parseMt63Block,
	quickActionSplitInput,
	recordStationSplitInput,
	reportRunnerDropInput,
	simulateTestPulseInput,
} from "../../field-ops/field-ops.shared.ts";
import {
	canManageRaceControl,
	canViewMedicalData,
} from "../../race-control/race-control.shared.ts";
import { TestDatabase } from "../test-harness.ts";

const testUuid1 = "a0000000-0000-4000-8000-000000000001";
const testUuid2 = "a0000000-0000-4000-8000-000000000002";
const testUuid3 = "a0000000-0000-4000-8000-000000000003";
const testUuid4 = "a0000000-0000-4000-8000-000000000004";

describe("Wave 3 Adversarial & Empirical Stress Suite", () => {
	// ===========================================================================
	// AREA 1: DAMERAU-LEVENSHTEIN TYPO DISTANCE & RECOMMENDATION ORACLES
	// ===========================================================================
	describe("Area 1: Damerau-Levenshtein Typo Distance & Recommendation Stress", () => {
		it("detects exact matches with distance 0 and exact confidence", () => {
			assert.equal(damerauLevenshtein("142", "142"), 0);
			assert.equal(damerauLevenshtein("TWIN_LAKES", "TWIN_LAKES"), 0);
			assert.equal(damerauLevenshtein("", ""), 0);

			const rec = getTypoRecommendation("142", ["100", "142", "200"]);
			assert.ok(rec);
			assert.equal(rec.distance, 0);
			assert.equal(rec.confidence, "exact");
			assert.equal(rec.recommendedBib, "142");
		});

		it("detects single adjacent transpositions with distance 1 across various lengths", () => {
			// 2-character transposition
			assert.equal(damerauLevenshtein("12", "21"), 1);
			assert.equal(damerauLevenshtein("AB", "BA"), 1);

			// 3-character transposition (primary runner bib typo mode)
			assert.equal(damerauLevenshtein("142", "124"), 1); // 42 <-> 24
			assert.equal(damerauLevenshtein("142", "412"), 1); // 14 <-> 41

			// 4-character transposition
			assert.equal(damerauLevenshtein("1024", "1204"), 1); // 02 <-> 20
			assert.equal(damerauLevenshtein("1024", "1042"), 1); // 24 <-> 42

			// 6-character transposition
			assert.equal(damerauLevenshtein("123456", "124356"), 1); // 34 <-> 43
		});

		it("detects single insertions, deletions, and substitutions with distance 1", () => {
			// Insertions (prefix, infix, suffix)
			assert.equal(damerauLevenshtein("123", "0123"), 1);
			assert.equal(damerauLevenshtein("123", "1923"), 1);
			assert.equal(damerauLevenshtein("123", "1234"), 1);

			// Deletions (prefix, infix, suffix)
			assert.equal(damerauLevenshtein("123", "23"), 1);
			assert.equal(damerauLevenshtein("123", "13"), 1);
			assert.equal(damerauLevenshtein("123", "12"), 1);

			// Substitutions
			assert.equal(damerauLevenshtein("101", "102"), 1);
			assert.equal(damerauLevenshtein("142", "143"), 1);
			assert.equal(damerauLevenshtein("900", "800"), 1);
		});

		it("distinguishes non-adjacent swaps as compound edits (distance >= 2)", () => {
			// Non-adjacent swap is NOT a single transposition
			assert.equal(damerauLevenshtein("1234", "4231"), 2);
			assert.equal(damerauLevenshtein("1423", "3421"), 2);
			assert.equal(damerauLevenshtein("123", "321"), 2);
		});

		it("handles extreme boundary inputs: empty strings, large 7-digit bibs, whitespace", () => {
			assert.equal(damerauLevenshtein("", "12345"), 5);
			assert.equal(damerauLevenshtein("12345", ""), 5);

			// Whitespace trimming invariant
			assert.equal(damerauLevenshtein("  142  ", "142"), 0);
			assert.equal(damerauLevenshtein("  142  ", "  124  "), 1);

			// Large 7-digit numbers
			assert.equal(damerauLevenshtein("1000000", "1000001"), 1);
			assert.equal(damerauLevenshtein("9999999", "9999998"), 1);
			assert.equal(damerauLevenshtein("1234567", "1234576"), 1);
		});

		it("property-based fuzzing: 50 randomized adjacent transpositions must all yield distance 1", () => {
			const digits = "0123456789";
			for (let i = 0; i < 50; i++) {
				const len = 4 + (i % 5); // lengths 4 to 8
				const chars: string[] = [];
				for (let k = 0; k < len; k++) {
					chars.push(digits[Math.floor(Math.random() * digits.length)]);
				}
				// Pick random adjacent index to swap
				const swapIdx = Math.floor(Math.random() * (len - 1));
				if (chars[swapIdx] === chars[swapIdx + 1]) {
					// Ensure distinct characters for transposition
					chars[swapIdx + 1] = digits[(digits.indexOf(chars[swapIdx]) + 1) % 10];
				}
				const orig = chars.join("");
				const transposedArr = [...chars];
				const tmp = transposedArr[swapIdx];
				transposedArr[swapIdx] = transposedArr[swapIdx + 1];
				transposedArr[swapIdx + 1] = tmp;
				const transposed = transposedArr.join("");

				const dist = damerauLevenshtein(orig, transposed);
				assert.equal(
					dist,
					1,
					`Failed on adjacent transposition of '${orig}' -> '${transposed}' at index ${swapIdx}`,
				);
			}
		});

		it("evaluates typo recommendations with distance thresholds and confidence ratings", () => {
			const registeredBibs = ["124", "188", "204", "300", "950"];

			// High confidence: transposition of 124
			const rec1 = getTypoRecommendation("142", registeredBibs);
			assert.ok(rec1);
			assert.equal(rec1.recommendedBib, "124");
			assert.equal(rec1.distance, 1);
			assert.equal(rec1.confidence, "high");

			// Null recommendation when distance > maxDistance (default 1)
			const rec2 = getTypoRecommendation("999", registeredBibs, 1);
			assert.equal(rec2, null);

			// Moderate confidence when maxDistance is expanded to 2
			const rec3 = getTypoRecommendation("952", registeredBibs, 2);
			assert.ok(rec3);
			assert.equal(rec3.recommendedBib, "950");
			assert.equal(rec3.distance, 1); // 952 vs 950 is 1 substitution

			// Empty inputs return null
			assert.equal(getTypoRecommendation("", registeredBibs), null);
			assert.equal(getTypoRecommendation("   ", registeredBibs), null);
			assert.equal(getTypoRecommendation("142", []), null);
		});
	});

	// ===========================================================================
	// AREA 2: MT63 DIGITAL HAM RADIO PARSING & ACOUSTIC NOISE RESILIENCE
	// ===========================================================================
	describe("Area 2: MT63 Amateur Radio Block Parsing & Acoustic Noise Resilience", () => {
		it("parses valid MT63 500/1000/2000 transmission blocks with various header formats", () => {
			const block500 = `
				# [MT63-500 W7XYZ 2026-11-05]
				TWIN 101 IN 08:30:00
				TWIN 101 OUT 08:45:00
			`;
			const res500 = parseMt63Block(block500);
			assert.equal(res500.errors.length, 0);
			assert.equal(res500.punches.length, 2);
			assert.equal(res500.punches[0].stationCode, "TWIN");
			assert.equal(res500.punches[0].competitorNumber, "101");
			assert.equal(res500.punches[0].subSplitKind, "in");

			const block1000 = `
				// MT63-1000 BURST #4 - AID STATION 3
				HOPE 142 POINT 10:15:30 P
				HOPE 188 PT 10:16:00
			`;
			const res1000 = parseMt63Block(block1000);
			assert.equal(res1000.errors.length, 0);
			assert.equal(res1000.punches.length, 2);
			assert.equal(res1000.punches[0].subSplitKind, "point");
			assert.equal(res1000.punches[0].withPacer, true);
			assert.equal(res1000.punches[1].subSplitKind, "point"); // 'pt' alias

			const block2000 = `
				# === MT63-2000 NET CONTROL LOG ===
				# High-Speed Acoustic Transmission
				WINFIELD #204 IN 12:00:00 +P
				WINFIELD #204 OUT 12:10:00
			`;
			const res2000 = parseMt63Block(block2000);
			assert.equal(res2000.errors.length, 0);
			assert.equal(res2000.punches.length, 2);
			assert.equal(res2000.punches[0].competitorNumber, "204"); // stripped '#' prefix
			assert.equal(res2000.punches[0].withPacer, true);
		});

		it("parses headless blocks starting directly on line 1 without headers", () => {
			const headless = "TWIN 55 IN 14:00:00\nTWIN 55 OUT 14:15:00";
			const res = parseMt63Block(headless);
			assert.equal(res.punches.length, 2);
			assert.equal(res.errors.length, 0);
		});

		it("normalizes short times (HH:MM) to standard HH:MM:00", () => {
			const shortTimeBlock = "TWIN 88 IN 09:15\nTWIN 88 OUT 09:30";
			const res = parseMt63Block(shortTimeBlock);
			assert.equal(res.errors.length, 0);
			assert.equal(res.punches[0].timeOfDay, "09:15:00");
			assert.equal(res.punches[1].timeOfDay, "09:30:00");
		});

		it("resiliently handles acoustic garbled noise, reporting errors without crashing", () => {
			const noisyBlock = `
				# MT63 Burst with Atmospheric Noise
				TWIN 101 IN 08:30:00
				$$$ NOISE BURST &&%#@!
				TRUNCATED_LINE_BIB
				TWIN 102 INVALID_KIND 08:35:00
				TWIN 103 IN 25:99:99
				HOPE 104 OUT 08:40:00
			`;

			const res = parseMt63Block(noisyBlock);
			// 2 valid punches (101, 104)
			assert.equal(res.punches.length, 2);
			assert.equal(res.punches[0].competitorNumber, "101");
			assert.equal(res.punches[1].competitorNumber, "104");

			// 4 errors captured with line numbers and reasons
			assert.equal(res.errors.length, 4);
			assert.ok(
				res.errors.some((e) => e.reason.includes("Insufficient tokens")),
				"Must report Insufficient tokens for truncated line",
			);
			assert.ok(
				res.errors.some((e) => e.reason.includes("Invalid split kind")),
				"Must report Invalid split kind for garbled noise or invalid kind",
			);
			assert.ok(
				res.errors.some((e) => e.reason.includes("Malformed time")),
				"Must report Malformed time for invalid 25:99:99",
			);
		});

		it("handles transmission checksum footers gracefully", () => {
			const blockWithChecksum = `
				TWIN 101 IN 08:30:00
				TWIN 102 IN 08:31:00
				# CHECKSUM: 4A8F
				CRC: 9912 VALID
			`;
			const res = parseMt63Block(blockWithChecksum);
			assert.equal(res.punches.length, 2);
			// CRC line is logged as an invalid line, not a crash or silent failure
			assert.equal(res.errors.length, 1);
		});

		it("processes multi-station bursts in chronological line order", () => {
			const multiStation = `
				TWIN 101 IN 08:00:00
				TWIN 101 OUT 08:15:00
				HOPE 101 IN 10:00:00
				HOPE 101 OUT 10:10:00
				FINISH 101 POINT 12:00:00
			`;
			const res = parseMt63Block(multiStation);
			assert.equal(res.punches.length, 5);
			assert.equal(res.punches[0].stationCode, "TWIN");
			assert.equal(res.punches[2].stationCode, "HOPE");
			assert.equal(res.punches[4].stationCode, "FINISH");
		});
	});

	// ===========================================================================
	// AREA 3: SAR TWO-STAGE TRIAGE LOGIC & ALERT ORACLES
	// ===========================================================================
	describe("Area 3: SAR Two-Stage Triage Logic & Alert Oracles", () => {
		it("Stage 1: triggers overdue alert when in_progress runner exceeds upper projection band", () => {
			const db = new TestDatabase();
			const egId = db.nextId("eg");
			const courseId = db.nextId("course");
			const evId = db.nextId("ev");
			const tp1Id = db.nextId("tp1");
			const tp2Id = db.nextId("tp2");

			db.timingPoints.push(
				{ id: tp1Id, organizationId: "org-1", code: "START", name: "Start Line", latitude: 0, longitude: 0 },
				{ id: tp2Id, organizationId: "org-1", code: "AID1", name: "Aid Station 1", latitude: 0, longitude: 0 },
			);

			const cs1: any = { id: "cs-start", courseId, timingPointId: tp1Id, name: "Start", sequenceOrder: 1, distanceFromStartMeters: 0, subSplitBitmap: 2 };
			const cs2: any = { id: "cs-aid1", courseId, timingPointId: tp2Id, name: "Aid 1", sequenceOrder: 2, distanceFromStartMeters: 10000, subSplitBitmap: 3 };
			db.courseSplits.push(cs1, cs2);

			const runnerBib = "101";
			const runnerId = "runner-101";
			const gunStart = new Date("2026-11-05T08:00:00Z");

			db.events.push({ id: evId, eventGroupId: egId, courseId, name: "50k", gunStartTime: gunStart });
			db.entrants.push({
				id: runnerId,
				eventId: evId,
				personId: "person-101",
				bibNumber: runnerBib,
				status: "in_progress",
				actualStartTime: gunStart,
				projectedArrivals: {
					"cs-aid1": {
						projectedUtc: new Date("2026-11-05T09:00:00Z"),
						earliestUtc: new Date("2026-11-05T08:50:00Z"),
						latestUtc: new Date("2026-11-05T09:15:00Z"), // Upper confidence bound
					},
				},
			});

			// Runner departed start
			db.scoredSplitTimes.push({
				id: "split-start",
				entrantId: runnerId,
				courseSplitId: "cs-start",
				lap: 1,
				subSplitKind: "out",
				absoluteTimeUtc: gunStart,
				elapsedSeconds: 0,
				penaltyPoints: 0,
				stoppedHere: false,
				dataStatus: "valid",
				createdAt: gunStart,
				updatedAt: gunStart,
			});

			// Case A: asOfTime = 09:10:00Z (before upper bound 09:15:00Z) -> NOT overdue
			const alertsA = db.queryStage1Overdue(egId, new Date("2026-11-05T09:10:00Z"));
			assert.equal(alertsA.length, 0);

			// Case B: asOfTime = 09:30:00Z (15 minutes past upper bound 09:15:00Z) -> OVERDUE
			const alertsB = db.queryStage1Overdue(egId, new Date("2026-11-05T09:30:00Z"));
			assert.equal(alertsB.length, 1);
			assert.equal(alertsB[0].entrant.bibNumber, runnerBib);
			assert.equal(alertsB[0].overdueSeconds, 15 * 60); // 900 seconds
		});

		it("Stage 2: triggers lingering alert when dwell inside station exceeds 45 minutes", () => {
			const db = new TestDatabase();
			const egId = db.nextId("eg");
			const courseId = db.nextId("course");
			const tpId = db.nextId("tp");

			db.timingPoints.push({ id: tpId, organizationId: "org-1", code: "TWIN", name: "Twin Lakes", latitude: 0, longitude: 0 });
			db.courseSplits.push({ id: "cs-twin", courseId, timingPointId: tpId, name: "Twin Lakes", sequenceOrder: 2, distanceFromStartMeters: 20000, subSplitBitmap: 3 });

			const runnerId = "runner-102";
			db.entrants.push({
				id: runnerId,
				eventId: "ev-1",
				personId: "person-102",
				bibNumber: "102",
				status: "in_progress",
			});

			const inTime = new Date("2026-11-05T12:00:00Z");
			// Recorded IN split without OUT split
			db.scoredSplitTimes.push({
				id: "split-in",
				entrantId: runnerId,
				courseSplitId: "cs-twin",
				lap: 1,
				subSplitKind: "in",
				absoluteTimeUtc: inTime,
				elapsedSeconds: 7200,
				penaltyPoints: 0,
				stoppedHere: false,
				dataStatus: "valid",
				createdAt: inTime,
				updatedAt: inTime,
			});

			// Case A: 40 minutes dwell -> safe (under 45m threshold)
			const alertsA = db.queryStage2LingeringOrRetired(egId, new Date("2026-11-05T12:40:00Z"));
			assert.equal(alertsA.length, 0);

			// Case B: 50 minutes dwell -> lingering alert triggered
			const alertsB = db.queryStage2LingeringOrRetired(egId, new Date("2026-11-05T12:50:00Z"));
			assert.equal(alertsB.length, 1);
			assert.equal(alertsB[0].type, "lingering_in_station");
			assert.equal(alertsB[0].dwellSeconds, 50 * 60);
			assert.equal(alertsB[0].timingPointName, "Twin Lakes");

			// Case C: OUT punch is recorded -> lingering alert clears immediately
			db.scoredSplitTimes.push({
				id: "split-out",
				entrantId: runnerId,
				courseSplitId: "cs-twin",
				lap: 1,
				subSplitKind: "out",
				absoluteTimeUtc: new Date("2026-11-05T12:52:00Z"),
				elapsedSeconds: 7200 + 3120,
				penaltyPoints: 0,
				stoppedHere: false,
				dataStatus: "valid",
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			const alertsC = db.queryStage2LingeringOrRetired(egId, new Date("2026-11-05T12:55:00Z"));
			assert.equal(alertsC.length, 0);
		});

		it("Stage 2: triggers Retired on Course (ROC) alert immediately with drop location notes", () => {
			const db = new TestDatabase();
			const egId = db.nextId("eg");

			db.entrants.push({
				id: "runner-roc",
				eventId: "ev-1",
				personId: "person-roc",
				bibNumber: "103",
				status: "retired", // Retired on course
				withdrawnAt: new Date("2026-11-05T13:00:00Z"),
			});

			const alerts = db.queryStage2LingeringOrRetired(egId, new Date("2026-11-05T13:10:00Z"));
			assert.equal(alerts.length, 1);
			assert.equal(alerts[0].type, "retired_on_course");
			assert.equal(alerts[0].entrant.bibNumber, "103");
			assert.ok(alerts[0].details.includes("withdrew between checkpoints"));
		});

		it("excludes DNS, DNF, and finished runners from Stage 1 overdue false alarms", () => {
			const db = new TestDatabase();
			const egId = db.nextId("eg");

			db.entrants.push(
				{ id: "e-dns", eventId: "ev-1", personId: "p-1", bibNumber: "10", status: "dns" },
				{ id: "e-dnf", eventId: "ev-1", personId: "p-2", bibNumber: "20", status: "dnf" },
				{ id: "e-fin", eventId: "ev-1", personId: "p-3", bibNumber: "30", status: "finished" },
			);

			const alerts = db.queryStage1Overdue(egId, new Date("2026-11-05T18:00:00Z"));
			assert.equal(alerts.length, 0);
		});
	});

	// ===========================================================================
	// AREA 4: DNF VS RETIRED ON COURSE (ROC) DIFFERENTIATION
	// ===========================================================================
	describe("Area 4: DNF vs. Retired on Course (ROC) Differentiation", () => {
		it("validates reportRunnerDropInput schema enforcing dropKind discrimination", () => {
			const dnfInput = reportRunnerDropInput.parse({
				eventGroupId: testUuid1,
				entrantId: testUuid2,
				timingPointId: testUuid3,
				dropKind: "dnf",
				dropReason: "hypothermia",
			});
			assert.equal(dnfInput.dropKind, "dnf");
			assert.equal(dnfInput.timingPointId, testUuid3);

			const rocInput = reportRunnerDropInput.parse({
				eventGroupId: testUuid1,
				entrantId: testUuid2,
				dropKind: "retired",
				dropLocationDescription: "Mile 23.5 near rocky creek crossing",
				dropReason: "twisted ankle",
			});
			assert.equal(rocInput.dropKind, "retired");
			assert.equal(rocInput.dropLocationDescription, "Mile 23.5 near rocky creek crossing");

			// Invalid drop kind rejected
			assert.throws(() => {
				reportRunnerDropInput.parse({
					eventGroupId: testUuid1,
					entrantId: testUuid2,
					dropKind: "quit",
				});
			});
		});

		it("verifies DNF stops safely at station custody without triggering Stage 2 ROC alert", () => {
			const db = new TestDatabase();
			const egId = db.nextId("eg");
			const tpId = db.nextId("tp");

			db.timingPoints.push({ id: tpId, organizationId: "org-1", code: "AID1", name: "Aid 1", latitude: 0, longitude: 0 });
			const entrant: any = {
				id: "runner-dnf",
				eventId: "ev-1",
				personId: "p-dnf",
				bibNumber: "104",
				status: "dnf",
				withdrawnTimingPointId: tpId,
			};
			db.entrants.push(entrant);

			// Stage 2 check: DNF is NOT a retired_on_course alert
			const alerts = db.queryStage2LingeringOrRetired(egId, new Date("2026-11-05T14:00:00Z"));
			assert.equal(alerts.length, 0);
		});
	});

	// ===========================================================================
	// AREA 5: MEDICAL DATA RBAC GATING & EMERGENCY DOSSIER PROTECTION
	// ===========================================================================
	describe("Area 5: Medical Data RBAC Gating & Emergency Dossier Protection", () => {
		it("strictly grants medical data viewing privileges ONLY to authorized roles", () => {
			// Privileged Org Roles: owner, admin, director
			assert.equal(canViewMedicalData({ orgRoles: ["owner"], staffRoles: [] }), true);
			assert.equal(canViewMedicalData({ orgRoles: ["admin"], staffRoles: [] }), true);
			assert.equal(canViewMedicalData({ orgRoles: ["director"], staffRoles: [] }), true);

			// Privileged Staff Roles: medical, official
			assert.equal(canViewMedicalData({ orgRoles: [], staffRoles: ["medical"] }), true);
			assert.equal(canViewMedicalData({ orgRoles: [], staffRoles: ["official"] }), true);

			// Multi-role combinations
			assert.equal(canViewMedicalData({ orgRoles: ["member"], staffRoles: ["medical"] }), true);
			assert.equal(canViewMedicalData({ orgRoles: ["steward"], staffRoles: ["official"] }), true);
		});

		it("strictly denies medical data viewing to unprivileged volunteers and members", () => {
			assert.equal(canViewMedicalData({ orgRoles: ["member"], staffRoles: [] }), false);
			assert.equal(canViewMedicalData({ orgRoles: ["steward"], staffRoles: [] }), false);
			assert.equal(canViewMedicalData({ orgRoles: [], staffRoles: ["volunteer"] }), false);
			assert.equal(canViewMedicalData({ orgRoles: [], staffRoles: ["checkpoint_captain"] }), false);
			assert.equal(canViewMedicalData({ orgRoles: [], staffRoles: [] }), false);
			assert.equal(canViewMedicalData({ orgRoles: ["spectator" as any], staffRoles: [] }), false);
		});

		it("simulates emergency dossier redaction oracle: masks medicalNotes & safetyTriageNotes", () => {
			const sensitiveDossier = {
				entrantId: "entrant-1",
				bibNumber: "142",
				fullName: "Jane Doe",
				participantData: {
					kind: "solo_competitor",
					rawMedicalNotes: "Severe bee venom allergy; carries twin EpiPens in left hydration pouch.",
				},
				historicalSummary: {
					safetyTriageNotes: "Collateral ligament strain at Mile 45 in 2024; required trekking poles.",
				},
				emergencyContact: {
					name: "John Doe",
					phone: "+1-555-0199",
					relation: "Spouse",
					isOnSite: true,
				},
			};

			function getProjectedDossier(access: { orgRoles: string[]; staffRoles: string[] }) {
				const isPrivileged = canViewMedicalData(access as any);
				return {
					entrantId: sensitiveDossier.entrantId,
					bibNumber: sensitiveDossier.bibNumber,
					fullName: sensitiveDossier.fullName,
					medicalNotes: isPrivileged ? sensitiveDossier.participantData.rawMedicalNotes : null,
					safetyTriageNotes: isPrivileged ? sensitiveDossier.historicalSummary.safetyTriageNotes : null,
					emergencyContact: sensitiveDossier.emergencyContact, // Preserved for all SAR field staff
					isMedicalDataMasked: !isPrivileged,
				};
			}

			// Case 1: Field Volunteer (unprivileged)
			const volunteerView = getProjectedDossier({ orgRoles: [], staffRoles: ["volunteer"] });
			assert.equal(volunteerView.isMedicalDataMasked, true);
			assert.equal(volunteerView.medicalNotes, null);
			assert.equal(volunteerView.safetyTriageNotes, null);
			// Emergency contact remains unmasked for volunteer communication
			assert.equal(volunteerView.emergencyContact.name, "John Doe");
			assert.equal(volunteerView.emergencyContact.isOnSite, true);

			// Case 2: Medical Lead (privileged)
			const medicalView = getProjectedDossier({ orgRoles: [], staffRoles: ["medical"] });
			assert.equal(medicalView.isMedicalDataMasked, false);
			assert.equal(
				medicalView.medicalNotes,
				"Severe bee venom allergy; carries twin EpiPens in left hydration pouch.",
			);
			assert.equal(
				medicalView.safetyTriageNotes,
				"Collateral ligament strain at Mile 45 in 2024; required trekking poles.",
			);

			// Case 3: Race Director / Org Admin (privileged)
			const adminView = getProjectedDossier({ orgRoles: ["admin"], staffRoles: [] });
			assert.equal(adminView.isMedicalDataMasked, false);
			assert.ok(adminView.medicalNotes !== null);
		});
	});

	// ===========================================================================
	// AREA 6: 30-SECOND CLUSTER DEDUPLICATION IN STATION SPLIT INGESTION
	// ===========================================================================
	describe("Area 6: 30-Second Cluster Deduplication in Station Split Ingestion", () => {
		it("clusters rapid duplicate punches within 30s as duplicate_subordinate", () => {
			const db = new TestDatabase();
			const egId = "eg-1";
			const bib = "142";
			const code = "TWIN";
			const baseTime = new Date("2026-11-05T12:00:00.000Z");

			// Configure db with timing point and runner
			db.timingPoints.push({ id: "tp-1", organizationId: "org-1", code, name: "Twin Lakes", latitude: 0, longitude: 0 });
			db.courseSplits.push({ id: "cs-1", courseId: "c-1", timingPointId: "tp-1", name: "Twin", sequenceOrder: 1, distanceFromStartMeters: 10000, subSplitBitmap: 3 });
			db.events.push({ id: "ev-1", eventGroupId: egId, courseId: "c-1", name: "50M", gunStartTime: new Date("2026-11-05T08:00:00Z") });
			db.entrants.push({ id: "ent-1", eventId: "ev-1", personId: "p-1", bibNumber: bib, status: "in_progress" });

			// Punch 1: Original arrival punch at t = 0s
			const res1 = db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: bib,
				timingPointCode: code,
				subSplitKind: "in",
				recordedTimeUtc: baseTime,
				source: "manual_web_entry",
			});
			assert.equal(res1.rawEvent.status, "matched");
			assert.ok(res1.scoredSplit !== null);
			assert.equal(db.scoredSplitTimes.length, 1);

			// Punch 2: Rapid de-bounce duplicate at t + 10s (within 30s of Punch 1)
			const res2 = db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: bib,
				timingPointCode: code,
				subSplitKind: "in",
				recordedTimeUtc: new Date(baseTime.getTime() + 10000),
				source: "rfid_transponder",
			});
			assert.equal(res2.rawEvent.status, "duplicate_subordinate");
			assert.equal(res2.scoredSplit, null);
			assert.equal(res2.rawEvent.auditNote, "Clustered with earlier raw pulse");
			assert.equal(db.scoredSplitTimes.length, 1); // Scored splits unchanged

			// Punch 3: Boundary edge case at exact t + 30.000s (within 30s of Punch 1)
			const res3 = db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: bib,
				timingPointCode: code,
				subSplitKind: "in",
				recordedTimeUtc: new Date(baseTime.getTime() + 30000),
				source: "manual_web_entry",
			});
			assert.equal(res3.rawEvent.status, "duplicate_subordinate");
			assert.equal(res3.scoredSplit, null);

			// Punch 4: Outside cluster window (31s after Punch 3, at t + 61s) -> accepted as fresh event
			const res4 = db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: bib,
				timingPointCode: code,
				subSplitKind: "in",
				recordedTimeUtc: new Date(baseTime.getTime() + 61000),
				source: "manual_web_entry",
			});
			assert.equal(res4.rawEvent.status, "matched");
			assert.ok(res4.scoredSplit !== null);
		});

		it("accepts subsequent punch when interval exceeds 30 seconds from single punch", () => {
			const db = new TestDatabase();
			const egId = "eg-1";
			const bib = "88";
			const code = "TWIN";
			const t0 = new Date("2026-11-05T12:00:00.000Z");
			const t31 = new Date("2026-11-05T12:00:31.000Z"); // 31s later

			db.timingPoints.push({ id: "tp-1", organizationId: "org-1", code, name: "Twin Lakes", latitude: 0, longitude: 0 });
			db.courseSplits.push({ id: "cs-1", courseId: "c-1", timingPointId: "tp-1", name: "Twin", sequenceOrder: 1, distanceFromStartMeters: 10000, subSplitBitmap: 3 });
			db.events.push({ id: "ev-1", eventGroupId: egId, courseId: "c-1", name: "50M", gunStartTime: new Date("2026-11-05T08:00:00Z") });
			db.entrants.push({ id: "ent-1", eventId: "ev-1", personId: "p-1", bibNumber: bib, status: "in_progress" });

			const p1 = db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: bib,
				timingPointCode: code,
				subSplitKind: "in",
				recordedTimeUtc: t0,
				source: "manual_web_entry",
			});
			assert.equal(p1.rawEvent.status, "matched");

			const p2 = db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: bib,
				timingPointCode: code,
				subSplitKind: "in",
				recordedTimeUtc: t31,
				source: "manual_web_entry",
			});
			assert.equal(p2.rawEvent.status, "matched");
			assert.ok(p2.scoredSplit !== null);
		});

		it("does NOT deduplicate punches with different subSplitKinds (e.g. IN at 0s, OUT at 15s)", () => {
			const db = new TestDatabase();
			const egId = "eg-1";
			const bib = "142";
			const code = "TWIN";
			const inTime = new Date("2026-11-05T12:00:00.000Z");
			const outTime = new Date("2026-11-05T12:00:15.000Z"); // Runner grabs water and leaves in 15 seconds

			db.timingPoints.push({ id: "tp-1", organizationId: "org-1", code, name: "Twin Lakes", latitude: 0, longitude: 0 });
			db.courseSplits.push({ id: "cs-1", courseId: "c-1", timingPointId: "tp-1", name: "Twin", sequenceOrder: 1, distanceFromStartMeters: 10000, subSplitBitmap: 3 });
			db.events.push({ id: "ev-1", eventGroupId: egId, courseId: "c-1", name: "50M", gunStartTime: new Date("2026-11-05T08:00:00Z") });
			db.entrants.push({ id: "ent-1", eventId: "ev-1", personId: "p-1", bibNumber: bib, status: "in_progress" });

			// IN punch
			const resIn = db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: bib,
				timingPointCode: code,
				subSplitKind: "in",
				recordedTimeUtc: inTime,
				source: "manual_web_entry",
			});
			assert.equal(resIn.rawEvent.status, "matched");

			// OUT punch 15s later
			const resOut = db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: bib,
				timingPointCode: code,
				subSplitKind: "out",
				recordedTimeUtc: outTime,
				source: "manual_web_entry",
			});
			assert.equal(resOut.rawEvent.status, "matched");
			assert.ok(resOut.scoredSplit !== null);
			// Accurately computed dwell time of 15 seconds
			assert.equal(resOut.scoredSplit?.dwellSeconds, 15);
		});

		it("does NOT deduplicate punches for different timing points or different runners within 30s", () => {
			const db = new TestDatabase();
			const egId = "eg-1";
			const time = new Date("2026-11-05T12:00:00.000Z");

			db.timingPoints.push(
				{ id: "tp-1", organizationId: "org-1", code: "TWIN", name: "Twin", latitude: 0, longitude: 0 },
				{ id: "tp-2", organizationId: "org-1", code: "HOPE", name: "Hope", latitude: 0, longitude: 0 },
			);
			db.courseSplits.push(
				{ id: "cs-1", courseId: "c-1", timingPointId: "tp-1", name: "Twin", sequenceOrder: 1, distanceFromStartMeters: 10000, subSplitBitmap: 3 },
				{ id: "cs-2", courseId: "c-1", timingPointId: "tp-2", name: "Hope", sequenceOrder: 2, distanceFromStartMeters: 20000, subSplitBitmap: 3 },
			);
			db.events.push({ id: "ev-1", eventGroupId: egId, courseId: "c-1", name: "50M", gunStartTime: new Date("2026-11-05T08:00:00Z") });
			db.entrants.push(
				{ id: "ent-1", eventId: "ev-1", personId: "p-1", bibNumber: "101", status: "in_progress" },
				{ id: "ent-2", eventId: "ev-1", personId: "p-2", bibNumber: "102", status: "in_progress" },
			);

			// Runner 101 at TWIN
			const p1 = db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: "101",
				timingPointCode: "TWIN",
				subSplitKind: "in",
				recordedTimeUtc: time,
				source: "manual_web_entry",
			});
			assert.equal(p1.rawEvent.status, "matched");

			// Runner 102 at TWIN (same time, different bib)
			const p2 = db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: "102",
				timingPointCode: "TWIN",
				subSplitKind: "in",
				recordedTimeUtc: time,
				source: "manual_web_entry",
			});
			assert.equal(p2.rawEvent.status, "matched");

			// Runner 101 at HOPE (different station)
			const p3 = db.ingestRawTimingEvent({
				eventGroupId: egId,
				competitorNumber: "101",
				timingPointCode: "HOPE",
				subSplitKind: "in",
				recordedTimeUtc: new Date(time.getTime() + 5000),
				source: "manual_web_entry",
			});
			assert.equal(p3.rawEvent.status, "matched");
		});
	});

	// ===========================================================================
	// AREA 7: DESIGN SYSTEM INVARIANTS, KIOSK FULL-SCREEN & ROUTE REGISTRATION
	// ===========================================================================
	describe("Area 7: Design System Invariants, Kiosk Mode & AST Registration", () => {
		const wave3SourceFiles = [
			"src/components/ui/popover.tsx",
			"src/components/ui/sheet.tsx",
			"src/field-ops/field-ops.shared.ts",
			"src/field-ops/field-ops.server.ts",
			"src/field-ops/field-ops.functions.ts",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/stations/index.tsx",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/stations/$timingPointId.tsx",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/logger.tsx",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/sar.tsx",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/sar.tsx",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/raw-stream.tsx",
		];

		it("strictly asserts 0 occurrences of 'backdrop-blur' across all Wave 3 implementation files", () => {
			for (const file of wave3SourceFiles) {
				const fullPath = path.join(process.cwd(), file);
				if (fs.existsSync(fullPath)) {
					const content = fs.readFileSync(fullPath, "utf-8");
					assert.equal(
						content.includes("backdrop-blur"),
						false,
						`Prohibited 'backdrop-blur' found in ${file}`,
					);
				}
			}
		});

		it("strictly asserts 0 occurrences of 'transition-all' across all Wave 3 implementation files", () => {
			for (const file of wave3SourceFiles) {
				const fullPath = path.join(process.cwd(), file);
				if (fs.existsSync(fullPath)) {
					const content = fs.readFileSync(fullPath, "utf-8");
					assert.equal(
						content.includes("transition-all"),
						false,
						`Prohibited 'transition-all' found in ${file}`,
					);
				}
			}
		});

		it("verifies kiosk mode suppression of global navigation in __root.tsx", () => {
			const rootFile = path.join(process.cwd(), "src/routes/__root.tsx");
			assert.ok(fs.existsSync(rootFile), "src/routes/__root.tsx must exist");
			const content = fs.readFileSync(rootFile, "utf-8");
			assert.ok(
				content.includes("isLogger"),
				"__root.tsx must define reactive isLogger check",
			);
			assert.ok(
				content.includes(".endsWith('/logger')") || content.includes('.endsWith("/logger")'),
				"__root.tsx must check for path ending with /logger",
			);
		});

		it("verifies all 6 new Wave 3 routes are registered in routeTree.gen.ts AST manifest", () => {
			const treeFile = path.join(process.cwd(), "src/routeTree.gen.ts");
			assert.ok(fs.existsSync(treeFile), "src/routeTree.gen.ts must exist");
			const content = fs.readFileSync(treeFile, "utf-8");

			const requiredRoutes = [
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/stations/",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/stations/$timingPointId",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/logger",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/sar",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/sar",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/raw-stream",
			];

			for (const r of requiredRoutes) {
				assert.ok(
					content.includes(r),
					`routeTree.gen.ts must contain registered route '${r}'`,
				);
			}
		});
	});

	describe("Area 8: Wave 3 Remediation Verification & Logger Integrity", () => {
		const validUuid1 = "11111111-1111-4111-8111-111111111111";
		const validUuid2 = "22222222-2222-4222-8222-222222222222";

		it("validates reportRunnerDropInput accepts competitorNumber when entrantId is omitted", () => {
			const parsed = reportRunnerDropInput.parse({
				eventGroupId: validUuid1,
				competitorNumber: "142",
				dropKind: "dnf",
				dropReason: "voluntary",
			});
			assert.equal(parsed.eventGroupId, validUuid1);
			assert.equal(parsed.competitorNumber, "142");
			assert.equal(parsed.entrantId, undefined);
		});

		it("validates reportRunnerDropInput accepts entrantId without competitorNumber", () => {
			const parsed = reportRunnerDropInput.parse({
				eventGroupId: validUuid1,
				entrantId: validUuid2,
				dropKind: "retired",
				dropLocationDescription: "Mile 30 bridge",
			});
			assert.equal(parsed.entrantId, validUuid2);
			assert.equal(parsed.dropKind, "retired");
		});

		it("rejects reportRunnerDropInput when neither entrantId nor competitorNumber is provided", () => {
			assert.throws(
				() =>
					reportRunnerDropInput.parse({
						eventGroupId: validUuid1,
						dropKind: "dnf",
					}),
				/Either entrantId or competitorNumber must be provided/,
			);
		});

		it("strictly rejects empty string '' for eventGroupId in recordSplit and recordDrop", () => {
			const splitRes = recordStationSplitInput.safeParse({
				eventGroupId: "",
				competitorNumber: "142",
				timingPointCode: "TWIN",
				subSplitKind: "in",
				recordedTimeUtc: new Date(),
			});
			assert.equal(splitRes.success, false);
			assert.equal(splitRes.error?.issues[0]?.message, "Invalid UUID");

			const dropRes = reportRunnerDropInput.safeParse({
				eventGroupId: "",
				competitorNumber: "142",
				dropKind: "dnf",
			});
			assert.equal(dropRes.success, false);
			assert.equal(dropRes.error?.issues[0]?.message, "Invalid UUID");
		});

		it("verifies genuine Damerau-Levenshtein Typo HUD wiring and rendering in logger.tsx", () => {
			const loggerPath = path.join(
				process.cwd(),
				"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/logger.tsx",
			);
			assert.ok(fs.existsSync(loggerPath));
			const code = fs.readFileSync(loggerPath, "utf-8");

			// Must not be a dummy stub returning null
			assert.ok(
				!code.includes("const typoRecommendation = (): TypoRecommendation | null => {\n\t\tconst raw = bibInput().trim();\n\t\tif (!raw || raw.length < 1) return null;\n\t\t// Dummy mock candidate pool"),
				"logger.tsx must not contain the dummy facade typoRecommendation",
			);

			// Must invoke getTypoRecommendation
			assert.ok(
				code.includes("getTypoRecommendation(raw, candidateBibs()"),
				"logger.tsx must invoke getTypoRecommendation with candidateBibs()",
			);

			// Must render Typo-Defense HUD in JSX
			assert.ok(
				code.includes("Typo Defense:"),
				"logger.tsx must render Typo Defense banner in JSX",
			);
			assert.ok(
				code.includes("Replace with #"),
				"logger.tsx must provide 1-click replacement button in JSX",
			);
			assert.ok(
				code.includes("Unregistered Bib:"),
				"logger.tsx must render unregistered bib warning in JSX",
			);
		});

		it("verifies genuine eventGroupId mutation payloads in logger.tsx", () => {
			const loggerPath = path.join(
				process.cwd(),
				"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/logger.tsx",
			);
			const code = fs.readFileSync(loggerPath, "utf-8");

			// Must pass genuine eventGroupId()
			assert.ok(
				code.includes("eventGroupId: eventGroupId()"),
				"logger.tsx must pass eventGroupId: eventGroupId() to mutations",
			);

			// Must NOT pass empty string "" for eventGroupId or entrantId
			assert.ok(
				!code.includes('eventGroupId: ""'),
				'logger.tsx must never pass eventGroupId: ""',
			);
			assert.ok(
				!code.includes('entrantId: ""'),
				'logger.tsx must never pass entrantId: ""',
			);
		});

		it("verifies responsive Mobile Bottom Sheet for screens < lg in logger.tsx", () => {
			const loggerPath = path.join(
				process.cwd(),
				"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/logger.tsx",
			);
			const code = fs.readFileSync(loggerPath, "utf-8");

			// Must use Kobalte Sheet primitives
			assert.ok(code.includes("<Sheet"), "logger.tsx must render <Sheet");
			assert.ok(
				code.includes("<SheetTrigger"),
				"logger.tsx must render <SheetTrigger",
			);
			assert.ok(
				code.includes('side="bottom"'),
				'logger.tsx must configure SheetContent side="bottom"',
			);

			// Trigger must be responsive (< lg only)
			assert.ok(
				code.includes("lg:hidden"),
				"logger.tsx must provide mobile-only (lg:hidden) trigger pill",
			);

			// Desktop aside must remain desktop-only
			assert.ok(
				code.includes("hidden lg:flex"),
				"logger.tsx desktop queue must be hidden on mobile (hidden lg:flex)",
			);
		});

		it("verifies @media print layout formatting in stations/$timingPointId.tsx", () => {
			const stationPath = path.join(
				process.cwd(),
				"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/stations/$timingPointId.tsx",
			);
			assert.ok(fs.existsSync(stationPath));
			const code = fs.readFileSync(stationPath, "utf-8");

			// Must contain print:hidden
			assert.ok(
				code.includes("print:hidden"),
				"stations/$timingPointId.tsx must include print:hidden utility classes",
			);

			// Must contain dedicated print table
			assert.ok(
				code.includes("hidden print:block"),
				"stations/$timingPointId.tsx must include dedicated hidden print:block roster table",
			);
			assert.ok(
				code.includes("Official Aid Station Backup & Custody Sheet"),
				"stations/$timingPointId.tsx must render official print header",
			);
		});

		it("verifies kiosk mode supports both /logger and /logger/ trailing slash in __root.tsx", () => {
			const rootPath = path.join(process.cwd(), "src/routes/__root.tsx");
			const code = fs.readFileSync(rootPath, "utf-8");

			assert.ok(
				code.includes('.endsWith("/logger")') &&
					code.includes('.endsWith("/logger/")'),
				"__root.tsx must check both .endsWith('/logger') and .endsWith('/logger/')",
			);
		});
	});
});
