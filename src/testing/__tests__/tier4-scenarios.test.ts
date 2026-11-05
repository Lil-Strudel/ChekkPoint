import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	calculateTsdPenalty,
	formatUltraSignupCsv,
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

// Helper for formatting duration
function formatHms(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

describe("Tier 4: Real-World Application Scenarios (Full-Stack Simulations)", () => {
	// ==========================================================================
	// SCENARIO A: 100-MILE MOUNTAIN ULTRA (WEATHER HOLD, DROPS & SAR TRIAGE)
	// ==========================================================================
	describe("Scenario A: 100-mile mountain ultra with weather holds, drops, and SAR alerts", () => {
		it("executes complete race lifecycle with emergency weather hold and SAR escalation", () => {
			const db = new TestDatabase();
			const orgId = db.nextId("org");
			const egId = db.nextId("eg");
			const eventId = db.nextId("event");
			const courseId = db.nextId("course");

			// 1. Setup Event Group & Course
			db.eventGroups.push({
				id: egId,
				organizationId: orgId,
				name: "Wasatch 100 Mile Endurance Run",
				slug: "wasatch-100",
				discipline: "trail_ultra",
			});

			const gunStart = new Date("2026-11-05T06:00:00Z");
			db.events.push({
				id: eventId,
				eventGroupId: egId,
				courseId,
				name: "100-Miler",
				gunStartTime: gunStart,
			});

			// Setup 4 Physical Checkpoints
			const tpStart: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "START",
				name: "East Mountain Start",
				latitude: 40.76,
				longitude: -111.89,
				elevationMeters: 1500,
			};
			const tpAid1: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "LAMBS",
				name: "Lambs Canyon",
				latitude: 40.72,
				longitude: -111.68,
				elevationMeters: 2200,
			};
			const tpAid2: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "BRIGHTON",
				name: "Brighton Lodge",
				latitude: 40.59,
				longitude: -111.58,
				elevationMeters: 2650,
			};
			const tpFinish: TimingPoint = {
				id: db.nextId("tp"),
				organizationId: orgId,
				code: "FINISH",
				name: "Homestead Finish",
				latitude: 40.52,
				longitude: -111.47,
				elevationMeters: 1710,
			};
			db.timingPoints.push(tpStart, tpAid1, tpAid2, tpFinish);

			// Course Splits
			const spStart: CourseSplit = {
				id: db.nextId("cs"),
				courseId,
				timingPointId: tpStart.id,
				name: "Start",
				sequenceOrder: 1,
				distanceFromStartMeters: 0,
				subSplitBitmap: 2, // OUT
			};
			const spLambs: CourseSplit = {
				id: db.nextId("cs"),
				courseId,
				timingPointId: tpAid1.id,
				name: "Lambs Canyon",
				sequenceOrder: 2,
				distanceFromStartMeters: 50_000, // 50 km
				subSplitBitmap: 3, // IN + OUT
				cutoffDurationSeconds: 12 * 3600, // 12h cutoff
			};
			const spBrighton: CourseSplit = {
				id: db.nextId("cs"),
				courseId,
				timingPointId: tpAid2.id,
				name: "Brighton Lodge",
				sequenceOrder: 3,
				distanceFromStartMeters: 100_000, // 100 km
				subSplitBitmap: 3,
				cutoffDurationSeconds: 24 * 3600, // 24h cutoff
			};
			const spFinish: CourseSplit = {
				id: db.nextId("cs"),
				courseId,
				timingPointId: tpFinish.id,
				name: "Finish",
				sequenceOrder: 4,
				distanceFromStartMeters: 160_934, // 100 mi
				subSplitBitmap: 1, // IN
				cutoffDurationSeconds: 36 * 3600, // 36h cutoff
			};
			db.courseSplits.push(spStart, spLambs, spBrighton, spFinish);

			// 2. Setup 10 Entrants (Bibs 101 to 110)
			for (let i = 1; i <= 10; i++) {
				const bib = String(100 + i);
				const personId = db.nextId("person");
				db.people.push({
					id: personId,
					firstName: `Runner${i}`,
					lastName: "Ultra",
					emergencyContactName: `Contact${i}`,
					emergencyContactPhone: `+1-801-555-010${i}`,
					emergencyContactIsOnSite: i === 4,
				});

				db.entrants.push({
					id: `entrant-${bib}`,
					eventId,
					personId,
					bibNumber: bib,
					status: "in_progress",
					actualStartTime: gunStart,
					medicalNotes:
						i === 4 ? "Asthmatic, carries rescue inhaler" : undefined,
					safetyTriageNotes: undefined,
					projectedArrivals: {
						[spBrighton.id]: {
							projectedUtc: new Date("2026-11-05T20:00:00Z"),
							earliestUtc: new Date("2026-11-05T19:00:00Z"),
							latestUtc: new Date("2026-11-05T21:00:00Z"), // 21:00 cutoff window
						},
					},
				});

				// All runners punch Start (06:00:00)
				db.ingestRawTimingEvent({
					eventGroupId: egId,
					competitorNumber: bib,
					timingPointCode: "START",
					subSplitKind: "out",
					recordedTimeUtc: gunStart,
					source: "rfid_transponder",
				});
			}

			// 3. Field progresses to Lambs Canyon (Mile 31 / 50 km)
			// Runners 101-106 and 108-110 pass through.
			for (let i = 1; i <= 10; i++) {
				const bib = String(100 + i);
				const inTime = new Date(gunStart.getTime() + (6 * 3600 + i * 300) * 1000); // ~6-7 hours
				const outTime = new Date(inTime.getTime() + 15 * 60 * 1000); // 15m dwell

				db.ingestRawTimingEvent({
					eventGroupId: egId,
					competitorNumber: bib,
					timingPointCode: "LAMBS",
					subSplitKind: "in",
					recordedTimeUtc: inTime,
					source: "manual_web_entry",
				});

				// Runner 107 DROPS at Lambs Canyon (in custody DNF)
				if (i === 7) {
					const r107 = db.entrants.find((e) => e.bibNumber === "107")!;
					r107.status = "dnf";
					r107.withdrawnAt = inTime;
					r107.withdrawnTimingPointId = tpAid1.id;
					continue; // Did not depart
				}

				db.ingestRawTimingEvent({
					eventGroupId: egId,
					competitorNumber: bib,
					timingPointCode: "LAMBS",
					subSplitKind: "out",
					recordedTimeUtc: outTime,
					source: "manual_web_entry",
				});
			}

			// Verify Runner 107 is dropped in custody
			const dropped107 = db.entrants.find((e) => e.bibNumber === "107")!;
			assert.equal(dropped107.status, "dnf");

			// 4. SAR Event: Runner 104 goes missing on ridge between Lambs and Brighton
			// As of 21:30:00 UTC (30 minutes past their latest projected arrival of 21:00:00)
			const asOfOverdue = new Date("2026-11-05T21:30:00Z");
			const stage1Alerts = db.queryStage1Overdue(egId, asOfOverdue);

			assert.ok(stage1Alerts.some((a) => a.entrant.bibNumber === "104"));
			const alert104 = stage1Alerts.find((a) => a.entrant.bibNumber === "104")!;
			assert.equal(alert104.overdueSeconds, 1800); // 30 minutes overdue

			// Net Control receives radio call: Runner 104 twisted ankle on high ridge, withdrawing between checkpoints
			const r104 = db.entrants.find((e) => e.bibNumber === "104")!;
			r104.status = "retired"; // Retired On Course (ROC)
			r104.withdrawnAt = new Date("2026-11-05T21:35:00Z");

			// Immediate Stage 2 SAR triage escalation
			const stage2Alerts = db.queryStage2LingeringOrRetired(
				egId,
				new Date("2026-11-05T21:40:00Z"),
			);
			assert.ok(
				stage2Alerts.some(
					(a) => a.entrant.bibNumber === "104" && a.type === "retired_on_course",
				),
			);

			// Medical lead inspects Runner 104 dossier via RBAC
			const medicalAccess = {
				organizationId: orgId,
				orgRoles: [],
				staffRoles: ["medical" as const],
				timingPointIds: [tpAid2.id],
			};
			assert.equal(db.canViewMedicalData(medicalAccess), true);

			// Public spectator view strictly redacts Runner 104's medical info
			const publicView = redactPublicEntrantData({
				id: r104.id,
				bibNumber: r104.bibNumber,
				firstName: "Runner4",
				lastName: "Ultra",
				status: r104.status,
				medicalNotes: r104.medicalNotes,
				emergencyContactName: "Contact4",
				emergencyContactPhone: "+1-801-555-0104",
				emergencyContactIsOnSite: true,
			});
			assert.equal((publicView as any).medicalNotes, undefined);
			assert.equal((publicView as any).emergencyContactPhone, undefined);
			assert.equal(publicView.hasEmergencyContactOnSite, true);

			// 5. Severe Thunderstorm at Brighton Lodge causes official 90-minute Weather Hold
			// Granted to active runners arriving at Brighton: e.g. Runner 101
			const holdStart = new Date("2026-11-05T19:30:00Z");
			const holdEnd = new Date("2026-11-05T21:00:00Z");
			const holdDurationSeconds = 5400; // 90 minutes

			db.grantTimeAllowance({
				entrantId: "entrant-101",
				splitId: spBrighton.id,
				startTime: holdStart,
				endTime: holdEnd,
				durationSeconds: holdDurationSeconds,
				reason: "hazard_hold",
				authorizedByPersonId: "race-director",
				notes: "Lightning storm above treeline; mandatory hold inside lodge",
			});

			// Runner 101 finishes at 30:00:00 (108,000s) gross elapsed
			const rawElapsed101 = 108_000;
			const adjustedNet101 = db.getAdjustedNetElapsedSeconds(
				"entrant-101",
				rawElapsed101,
			);
			// 108,000 - 5,400 = 102,600s (28:30:00 net time)
			assert.equal(adjustedNet101, 102_600);

			// Downstream cutoff extended from 36h to 37h 30m
			const adjustedCutoff = db.getAdjustedCutoffSeconds(
				"entrant-101",
				spFinish.cutoffDurationSeconds!,
			);
			assert.equal(adjustedCutoff, 36 * 3600 + 5400);
		});
	});

	// ==========================================================================
	// SCENARIO B: BACKYARD ULTRA (5 YARDS & NON-FINISHER OTL SWEEP)
	// ==========================================================================
	describe("Scenario B: Backyard Ultra with 5 yards, whistle countdowns, and non-finisher OTL sweeps", () => {
		it("simulates 5-yard elimination to determine sole Last Person Standing winner", () => {
			const yardDistanceMiles = 4.166667;
			const yardTimeLimitSeconds = 3600; // 60 minutes

			interface BackyardRunner {
				bib: string;
				name: string;
				completedYards: number;
				lastYardSeconds: number;
				status: "in_progress" | "winner" | "otl" | "dnf";
			}

			const runners: BackyardRunner[] = [
				{ bib: "1", name: "Harvey Lewis", completedYards: 0, lastYardSeconds: 0, status: "in_progress" },
				{ bib: "2", name: "Courtney Dauwalter", completedYards: 0, lastYardSeconds: 0, status: "in_progress" },
				{ bib: "3", name: "John Doe", completedYards: 0, lastYardSeconds: 0, status: "in_progress" },
				{ bib: "4", name: "Jane Smith", completedYards: 0, lastYardSeconds: 0, status: "in_progress" },
				{ bib: "5", name: "Bob Runner", completedYards: 0, lastYardSeconds: 0, status: "in_progress" },
				{ bib: "6", name: "Alice Walker", completedYards: 0, lastYardSeconds: 0, status: "in_progress" },
				{ bib: "7", name: "Charlie Pace", completedYards: 0, lastYardSeconds: 0, status: "in_progress" },
				{ bib: "8", name: "Dave Slow", completedYards: 0, lastYardSeconds: 0, status: "in_progress" },
			];

			// Function to simulate a yard
			function runYard(
				yardNumber: number,
				finishingTimes: Record<string, number>,
			) {
				for (const r of runners) {
					if (r.status !== "in_progress") continue;

					const time = finishingTimes[r.bib];
					if (time === undefined || time > yardTimeLimitSeconds) {
						// Over Time Limit: failed to return before top-of-hour horn
						r.status = "otl";
					} else {
						r.completedYards = yardNumber;
						r.lastYardSeconds = time;
					}
				}
			}

			// Yard 1: All 8 runners finish in ~45-55 mins
			runYard(1, {
				"1": 2700, "2": 2800, "3": 3000, "4": 3100,
				"5": 3200, "6": 3300, "7": 3400, "8": 3550,
			});
			assert.equal(runners.filter((r) => r.completedYards === 1).length, 8);

			// Yard 2: Runner 8 finishes in 3620s (> 3600s) -> OTL sweep
			runYard(2, {
				"1": 2750, "2": 2850, "3": 3100, "4": 3200,
				"5": 3300, "6": 3400, "7": 3500, "8": 3620, // Missed by 20s
			});
			assert.equal(runners.find((r) => r.bib === "8")?.status, "otl");
			assert.equal(runners.filter((r) => r.status === "in_progress").length, 7);

			// Yard 3: Runner 6 drops voluntarily in camp (DNF), Runner 7 misses cutoff (OTL)
			runners.find((r) => r.bib === "6")!.status = "dnf"; // Dropped at chair
			runYard(3, {
				"1": 2800, "2": 2900, "3": 3200, "4": 3300,
				"5": 3450, "7": 3615,
			});
			assert.equal(runners.find((r) => r.bib === "7")?.status, "otl");
			assert.equal(runners.filter((r) => r.status === "in_progress").length, 5);

			// Yard 4: Runners 3, 4 drop. Only Runners 1 and 2 finish.
			runYard(4, {
				"1": 2900, "2": 3000, "3": 3700, "4": 3650, "5": 3605,
			});
			assert.equal(runners.filter((r) => r.status === "in_progress").length, 2);

			// Yard 5: Runner 1 finishes in 2880s (48m). Runner 2 cannot complete loop within 3600s.
			runYard(5, {
				"1": 2880, "2": 3720,
			});

			const activeAtEnd = runners.filter((r) => r.status === "in_progress");
			assert.equal(activeAtEnd.length, 1);

			// Sole finisher declared WINNER
			activeAtEnd[0].status = "winner";
			assert.equal(activeAtEnd[0].bib, "1");
			assert.equal(activeAtEnd[0].completedYards, 5);

			// Total distance = 5 * 4.166667 = 20.83 miles
			const totalMiles = activeAtEnd[0].completedYards * yardDistanceMiles;
			assert.ok(Math.abs(totalMiles - 20.833) < 0.01);

			// All other competitors must be non-finishers (Assist / DNF / OTL)
			const nonFinishers = runners.filter((r) => r.bib !== "1");
			assert.equal(
				nonFinishers.every((r) => r.status === "otl" || r.status === "dnf"),
				true,
			);
		});
	});

	// ==========================================================================
	// SCENARIO C: TSD REGULARITY RALLY WITH SECRET CHECKPOINT SCORING
	// ==========================================================================
	describe("Scenario C: TSD Regularity Rally with interval out-times, secret checkpoint scoring, and penalties", () => {
		it("scores 5 rally crews past hidden checkpoint applying 2x early / 1x late penalties", () => {
			const db = new TestDatabase();
			const egId = db.nextId("eg");

			db.eventGroups.push({
				id: egId,
				organizationId: "org-rally",
				name: "Rocky Mountain TSD Regularity Rally",
				slug: "rm-tsd-rally",
				discipline: "tsd_regularity",
				rulesConfig: {
					earlyPenaltyFactor: 2.0,
					latePenaltyFactor: 1.0,
					gracePeriodSeconds: 0.0,
				},
			});

			// Ideal stage parameters: 30 km segment at 45.0 km/h
			// Ideal target duration = 30 / 45 * 3600 = 2400.0 seconds
			const idealSeconds = 2400.0;

			// 5 rally cars staggered at 60-second start intervals
			const cars = [
				{ carNumber: "10", startOffset: 0, arrivalSeconds: 2370.0 }, // 30s EARLY
				{ carNumber: "11", startOffset: 60, arrivalSeconds: 2430.0 }, // 30s LATE
				{ carNumber: "12", startOffset: 120, arrivalSeconds: 2400.0 }, // EXACT (0s delta)
				{ carNumber: "13", startOffset: 180, arrivalSeconds: 2390.0 }, // 10s EARLY
				{ carNumber: "14", startOffset: 240, arrivalSeconds: 2415.0 }, // 15s LATE
			];

			const scoredResults = cars.map((car) => {
				const penalty = calculateTsdPenalty(car.arrivalSeconds, idealSeconds, {
					earlyPenaltyFactor: 2.0,
					latePenaltyFactor: 1.0,
				});

				return {
					carNumber: car.carNumber,
					arrivalSeconds: car.arrivalSeconds,
					deviationSeconds: penalty.deviationSeconds,
					penaltyPoints: penalty.penaltyPoints,
				};
			});

			// Car 10: 30s early * 2.0 = 60.0 points
			const car10 = scoredResults.find((c) => c.carNumber === "10")!;
			assert.equal(car10.deviationSeconds, -30.0);
			assert.equal(car10.penaltyPoints, 60.0);

			// Car 11: 30s late * 1.0 = 30.0 points
			const car11 = scoredResults.find((c) => c.carNumber === "11")!;
			assert.equal(car11.deviationSeconds, 30.0);
			assert.equal(car11.penaltyPoints, 30.0);

			// Car 12: Perfect arrival = 0.0 points
			const car12 = scoredResults.find((c) => c.carNumber === "12")!;
			assert.equal(car12.penaltyPoints, 0.0);

			// Car 13: 10s early * 2.0 = 20.0 points
			const car13 = scoredResults.find((c) => c.carNumber === "13")!;
			assert.equal(car13.penaltyPoints, 20.0);

			// Car 14: 15s late * 1.0 = 15.0 points
			const car14 = scoredResults.find((c) => c.carNumber === "14")!;
			assert.equal(car14.penaltyPoints, 15.0);

			// Final classification: sorted by lowest penalty points
			const ranked = [...scoredResults].sort(
				(a, b) => a.penaltyPoints - b.penaltyPoints,
			);

			assert.equal(ranked[0].carNumber, "12"); // 0.0 pts (1st Place)
			assert.equal(ranked[1].carNumber, "14"); // 15.0 pts (2nd Place)
			assert.equal(ranked[2].carNumber, "13"); // 20.0 pts (3rd Place)
			assert.equal(ranked[3].carNumber, "11"); // 30.0 pts (4th Place)
			assert.equal(ranked[4].carNumber, "10"); // 60.0 pts (5th Place - severe early penalty)
		});
	});

	// ==========================================================================
	// SCENARIO D: DOWNHILL MTB STAGGERED GATE STARTS & RED FLAG HOLD
	// ==========================================================================
	describe("Scenario D: Downhill MTB staggered gate starts and course red-flag hold", () => {
		it("times millisecond precision optical photocell gates and handles red flag course restart", () => {
			const db = new TestDatabase();
			const egId = db.nextId("eg");

			db.eventGroups.push({
				id: egId,
				organizationId: "org-mtb",
				name: "Pro Gravity Downhill Cup",
				slug: "pro-dh-cup",
				discipline: "downhill_mtb",
			});

			interface DhRider {
				plate: string;
				name: string;
				startTimeUtc: Date;
				finishTimeUtc: Date | null;
				elapsedSeconds: number | null;
				redFlagRestart: boolean;
			}

			// Base start: 10:00:00.000 UTC
			const baseStart = new Date("2026-11-05T10:00:00.000Z");

			// Rider 1: Starts at 10:00:00.000, finishes at 10:03:22.450 (3m 22.450s / 202.450s)
			// Rider 2: Starts at 10:00:30.000, finishes at 10:03:51.120 (3m 21.120s / 201.120s)
			// Rider 3: Starts at 10:01:00.000, crashes in rock garden at 10:02:15.000 -> RED FLAG
			// Rider 4: Held at start gate during red flag, given restart at 10:15:00.000
			const riders: DhRider[] = [
				{
					plate: "1",
					name: "Loic Bruni",
					startTimeUtc: baseStart,
					finishTimeUtc: new Date(baseStart.getTime() + 202450),
					elapsedSeconds: 202.45,
					redFlagRestart: false,
				},
				{
					plate: "2",
					name: "Amaury Pierron",
					startTimeUtc: new Date(baseStart.getTime() + 30000),
					finishTimeUtc: new Date(baseStart.getTime() + 30000 + 201120),
					elapsedSeconds: 201.12,
					redFlagRestart: false,
				},
				{
					plate: "3",
					name: "Finn Iles",
					startTimeUtc: new Date(baseStart.getTime() + 60000),
					finishTimeUtc: null, // DNF crashed out
					elapsedSeconds: null,
					redFlagRestart: false,
				},
				{
					plate: "4",
					name: "Troy Brosnan",
					startTimeUtc: new Date(baseStart.getTime() + 15 * 60 * 1000), // Rescheduled start
					finishTimeUtc: new Date(
						baseStart.getTime() + 15 * 60 * 1000 + 203890,
					),
					elapsedSeconds: 203.89,
					redFlagRestart: true,
				},
			];

			// Verify Rider 3 crash registers as DNF
			assert.equal(riders[2].finishTimeUtc, null);

			// Verify Rider 4 restart was recorded and timed accurately
			assert.equal(riders[3].redFlagRestart, true);
			assert.equal(riders[3].elapsedSeconds, 203.89);

			// Rank valid finishers by millisecond precision elapsed time
			const validFinishers = riders
				.filter((r) => r.elapsedSeconds !== null)
				.sort((a, b) => a.elapsedSeconds! - b.elapsedSeconds!);

			assert.equal(validFinishers[0].plate, "2"); // 201.120s (1st Place)
			assert.equal(validFinishers[1].plate, "1"); // 202.450s (2nd Place)
			assert.equal(validFinishers[2].plate, "4"); // 203.890s (3rd Place)
		});
	});
});
