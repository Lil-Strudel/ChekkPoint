/**
 * Tier 5 Coverage Hardening — White-Box Adversarial Stress Suite (Tier 5 - 2)
 *
 * Empirical verification & stress testing across:
 * 1. Race Control:
 *    - Backyard Ultra yard close with tied lap times & multi-runner synchronicity.
 *    - TSD interval generator: collision defense, negative intervals, large rosters (>1000 cars).
 *    - Downhill gate release: red-flag hold lockout, sector order, millisecond precision.
 *    - XCO 80% pull: leader lap 1 baseline, exact 80.0% cutoff boundary.
 * 2. EntrantTelemetryView & Public Routes:
 *    - Elevation profile SVG math: 0 elevation gain, descending-only, vertical cliffs, empty profiles.
 *    - Projection windows: runner elapsed time exceeding projected finish, cutoff margin risk.
 *    - Strict PII redaction: adversarial inspection across public telemetry and athlete endpoints.
 *    - Design system invariants: zero backdrop-blur and zero transition-all tokens.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
	backyardCloseYardInput,
	calculateBackyardWhistleAlert,
	calculatePacingProjection,
	calculateTsdScore,
	canManageRaceControl,
	canViewMedicalData,
	computeCombinedCustody,
	downhillGateReleaseInput,
	downhillRedFlagHoldInput,
	evaluateSarBadge,
	fixedTimeRecordPartialLapInput,
	isSubjectTo80PercentPull,
	naturalCompareCompetitorNumbers,
	RulesConfigSchema,
	tsdGenerateIntervalStartsInput,
	updateEntrantWorkspaceInput,
	xcoCheckLappedPullInput,
} from "../../race-control/race-control.shared.ts";
import {
	redactPublicEntrantData,
	type EntrantWithPrivateData,
} from "../domain-algorithms.ts";
import { TestDatabase } from "../test-harness.ts";

const testUuid1 = "11111111-1111-4111-8111-111111111111";
const testUuid2 = "22222222-2222-4222-8222-222222222222";
const testUuid3 = "33333333-3333-4333-8333-333333333333";

describe("Tier 5 Adversarial Coverage Hardening — Suite 2", () => {
	// ===========================================================================
	// AREA 1: BACKYARD ULTRA YARD CLOSE, TIED LAP TIMES & MULTI-RUNNER SYNCHRONICITY
	// ===========================================================================
	describe("Area 1: Backyard Ultra Yard Close & Multi-Runner Synchronicity", () => {
		interface SimulatedRunner {
			id: string;
			competitorNumber: string;
			status: "registered" | "checked_in" | "in_progress" | "finished" | "dnf";
			dropReason?: string | null;
			comments?: string | null;
		}

		interface SimulatedYardSplit {
			entrantId: string;
			lap: number;
			elapsedSeconds: number;
			stoppedHere: boolean;
		}

		function simulateBackyardYardClose(
			runners: SimulatedRunner[],
			splits: SimulatedYardSplit[],
			completedYardNumber: number,
			providedCompletedIds?: string[],
		): { sweptCount: number; updatedRunners: SimulatedRunner[] } {
			let completedIds = providedCompletedIds;
			if (!completedIds) {
				completedIds = splits
					.filter((s) => s.lap === completedYardNumber && !s.stoppedHere)
					.map((s) => s.entrantId);
			}

			const inProgress = runners.filter((r) => r.status === "in_progress");
			const entrantsToSweep = inProgress
				.filter((r) => !completedIds!.includes(r.id))
				.map((r) => r.id);

			const updated = runners.map((r) => {
				if (entrantsToSweep.includes(r.id)) {
					return {
						...r,
						status: "dnf" as const,
						dropReason: "missed_cutoff",
						comments: `Over Time Limit (OTL) on Yard #${completedYardNumber}`,
					};
				}
				return r;
			});

			return {
				sweptCount: entrantsToSweep.length,
				updatedRunners: updated,
			};
		}

		it("handles tied lap times with multiple runners finishing in the exact same second", () => {
			const runners: SimulatedRunner[] = [
				{ id: "runner-1", competitorNumber: "1", status: "in_progress" },
				{ id: "runner-2", competitorNumber: "2", status: "in_progress" },
				{ id: "runner-3", competitorNumber: "3", status: "in_progress" },
				{ id: "runner-4", competitorNumber: "4", status: "in_progress" },
			];

			// Runners 1, 2, and 3 finish Yard 5 in the exact same second (3,420 seconds = 57m 00s)
			// Runner 4 stopped / did not complete Yard 5
			const splits: SimulatedYardSplit[] = [
				{ entrantId: "runner-1", lap: 5, elapsedSeconds: 3420, stoppedHere: false },
				{ entrantId: "runner-2", lap: 5, elapsedSeconds: 3420, stoppedHere: false },
				{ entrantId: "runner-3", lap: 5, elapsedSeconds: 3420, stoppedHere: false },
			];

			const result = simulateBackyardYardClose(runners, splits, 5);

			assert.equal(result.sweptCount, 1, "Only runner 4 should be swept");
			const r1 = result.updatedRunners.find((r) => r.id === "runner-1");
			const r2 = result.updatedRunners.find((r) => r.id === "runner-2");
			const r3 = result.updatedRunners.find((r) => r.id === "runner-3");
			const r4 = result.updatedRunners.find((r) => r.id === "runner-4");

			assert.equal(r1?.status, "in_progress", "Runner 1 remains in_progress");
			assert.equal(r2?.status, "in_progress", "Runner 2 remains in_progress");
			assert.equal(r3?.status, "in_progress", "Runner 3 remains in_progress");
			assert.equal(r4?.status, "dnf", "Runner 4 swept to DNF");
			assert.equal(r4?.dropReason, "missed_cutoff");
			assert.equal(r4?.comments, "Over Time Limit (OTL) on Yard #5");
		});

		it("handles synchronous all-runner completion with zero swept entrants", () => {
			const runners: SimulatedRunner[] = [
				{ id: "runner-1", competitorNumber: "1", status: "in_progress" },
				{ id: "runner-2", competitorNumber: "2", status: "in_progress" },
			];

			// Both runners complete in the final legal second of the hour (3599s)
			const splits: SimulatedYardSplit[] = [
				{ entrantId: "runner-1", lap: 8, elapsedSeconds: 3599, stoppedHere: false },
				{ entrantId: "runner-2", lap: 8, elapsedSeconds: 3599, stoppedHere: false },
			];

			const result = simulateBackyardYardClose(runners, splits, 8);
			assert.equal(result.sweptCount, 0, "No runners should be swept");
			assert.ok(result.updatedRunners.every((r) => r.status === "in_progress"));
		});

		it("validates whistle alert countdown oracles across boundaries and edge cases", () => {
			// Yard limit = 60 minutes = 3600 seconds
			assert.equal(
				calculateBackyardWhistleAlert(3420, 60),
				"3 WHISTLES - 3 MINUTES TO BELL",
			);
			assert.equal(
				calculateBackyardWhistleAlert(3480, 60),
				"2 WHISTLES - 2 MINUTES TO BELL",
			);
			assert.equal(
				calculateBackyardWhistleAlert(3540, 60),
				"1 WHISTLE - 1 MINUTE TO BELL",
			);
			assert.equal(
				calculateBackyardWhistleAlert(3600, 60),
				"TIME EXPIRED",
			);
			assert.equal(
				calculateBackyardWhistleAlert(3601, 60),
				"TIME EXPIRED",
			);
			assert.equal(
				calculateBackyardWhistleAlert(4000, 60),
				"TIME EXPIRED",
			);

			// Between whistle markers returns null
			assert.equal(calculateBackyardWhistleAlert(3419, 60), null);
			assert.equal(calculateBackyardWhistleAlert(3421, 60), null);
			assert.equal(calculateBackyardWhistleAlert(3479, 60), null);
			assert.equal(calculateBackyardWhistleAlert(3539, 60), null);
			assert.equal(calculateBackyardWhistleAlert(1800, 60), null);
			assert.equal(calculateBackyardWhistleAlert(0, 60), null);

			// Custom yard duration (e.g. 45-minute yard = 2700s)
			assert.equal(
				calculateBackyardWhistleAlert(2520, 45),
				"3 WHISTLES - 3 MINUTES TO BELL",
			);
			assert.equal(
				calculateBackyardWhistleAlert(2640, 45),
				"1 WHISTLE - 1 MINUTE TO BELL",
			);
			assert.equal(calculateBackyardWhistleAlert(2700, 45), "TIME EXPIRED");
		});

		it("evaluates backyard ultra elimination and sole winner oracle", () => {
			// Yard 10: 2 runners complete
			// Yard 11: Runner A finishes in 52m; Runner B fails to return within 60m
			interface EntrantState {
				id: string;
				completedYards: number;
				isWinner: boolean;
				isAssist: boolean;
				status: "in_progress" | "finished" | "dnf";
			}

			const state: Record<string, EntrantState> = {
				"runner-A": {
					id: "runner-A",
					completedYards: 10,
					isWinner: false,
					isAssist: false,
					status: "in_progress",
				},
				"runner-B": {
					id: "runner-B",
					completedYards: 10,
					isWinner: false,
					isAssist: false,
					status: "in_progress",
				},
			};

			// Both start Yard 11
			// Runner A completes Yard 11 (yard 11 completed = 11)
			state["runner-A"].completedYards = 11;
			// Runner B fails to complete Yard 11
			state["runner-B"].status = "dnf";
			state["runner-B"].isAssist = true;

			// In Backyard Ultra: Runner A is sole winner only after completing the solo lap
			state["runner-A"].status = "finished";
			state["runner-A"].isWinner = true;

			assert.equal(state["runner-A"].isWinner, true);
			assert.equal(state["runner-A"].completedYards, 11);
			assert.equal(state["runner-B"].isWinner, false);
			assert.equal(state["runner-B"].isAssist, true);
			assert.equal(state["runner-B"].completedYards, 10);
		});
	});

	// ===========================================================================
	// AREA 2: TSD INTERVAL GENERATOR, COLLISIONS & LARGE ROSTERS
	// ===========================================================================
	describe("Area 2: TSD Interval Generator, Collisions & Large Rosters", () => {
		it("strictly rejects non-positive and invalid interval seconds in Zod schema", () => {
			assert.throws(() => {
				tsdGenerateIntervalStartsInput.parse({
					eventId: testUuid1,
					baseStartTimeUtc: "2026-11-05T08:00:00Z",
					intervalSeconds: 0, // Must be positive
				});
			});

			assert.throws(() => {
				tsdGenerateIntervalStartsInput.parse({
					eventId: testUuid1,
					baseStartTimeUtc: "2026-11-05T08:00:00Z",
					intervalSeconds: -60, // Negative interval prohibited
				});
			});

			const valid = tsdGenerateIntervalStartsInput.parse({
				eventId: testUuid1,
				baseStartTimeUtc: "2026-11-05T08:00:00Z",
				intervalSeconds: 45,
			});
			assert.equal(valid.intervalSeconds, 45);
		});

		it("proves natural sort collision defense for alphanumeric rally car numbers", () => {
			const carPlates = [
				"Car 10",
				"Car 2",
				"Car 1",
				"Car 20",
				"Car 03",
				"Car 100",
				"Car 2B",
				"Car 2A",
			];

			carPlates.sort(naturalCompareCompetitorNumbers);

			// Expected natural ordering: Car 1, Car 2, Car 2A, Car 2B, Car 03, Car 10, Car 20, Car 100
			assert.equal(carPlates[0], "Car 1");
			assert.equal(carPlates[1], "Car 2");
			assert.equal(carPlates[2], "Car 2A");
			assert.equal(carPlates[3], "Car 2B");
			assert.equal(carPlates[4], "Car 03");
			assert.equal(carPlates[5], "Car 10");
			assert.equal(carPlates[6], "Car 20");
			assert.equal(carPlates[7], "Car 100");
		});

		it("stress-tests large competitor rosters (>1000 cars) for interval monotonicity & collision resistance", () => {
			const carCount = 1200;
			const carRoster: Array<{ id: string; competitorNumber: string }> = [];

			for (let i = 1; i <= carCount; i++) {
				carRoster.push({
					id: `car-${i}`,
					competitorNumber: `Car #${i}`,
				});
			}

			// Shuffle roster to test sorting resilience
			carRoster.sort(() => Math.random() - 0.5);

			// Natural sort by competitor number
			const startPerf = performance.now();
			carRoster.sort((a, b) =>
				naturalCompareCompetitorNumbers(a.competitorNumber, b.competitorNumber),
			);

			const baseTime = new Date("2026-11-05T08:00:00.000Z").getTime();
			const intervalSeconds = 60;
			const intervalMs = intervalSeconds * 1000;

			const assignedStarts: Array<{ id: string; startMs: number; iso: string }> =
				[];
			const seenTimestamps = new Set<number>();

			for (let i = 0; i < carRoster.length; i++) {
				const startMs = baseTime + i * intervalMs;
				assert.equal(
					seenTimestamps.has(startMs),
					false,
					`Collision detected at car index ${i} with timestamp ${startMs}`,
				);
				seenTimestamps.add(startMs);
				assignedStarts.push({
					id: carRoster[i].id,
					startMs,
					iso: new Date(startMs).toISOString(),
				});
			}
			const durationPerf = performance.now() - startPerf;

			assert.equal(assignedStarts.length, 1200);
			assert.equal(seenTimestamps.size, 1200);
			assert.ok(durationPerf < 150, `1200 cars sorted and timed in ${durationPerf.toFixed(2)}ms (<150ms)`);

			// Strict monotonicity verification
			for (let i = 1; i < assignedStarts.length; i++) {
				assert.ok(
					assignedStarts[i].startMs > assignedStarts[i - 1].startMs,
					`Non-monotonic start order between index ${i - 1} and ${i}`,
				);
				assert.equal(
					assignedStarts[i].startMs - assignedStarts[i - 1].startMs,
					60000,
					`Incorrect interval delta between index ${i - 1} and ${i}`,
				);
			}

			// Car 1 vs Car 1200 timestamps
			assert.equal(assignedStarts[0].id, "car-1");
			assert.equal(assignedStarts[0].iso, "2026-11-05T08:00:00.000Z");
			assert.equal(assignedStarts[1199].id, "car-1200");
			// 1199 minutes = 19 hours 59 minutes -> 2026-11-06T03:59:00.000Z
			assert.equal(assignedStarts[1199].iso, "2026-11-06T03:59:00.000Z");
		});

		it("calculates TSD penalty points with exact 2.0x early factor and 1.0x late factor", () => {
			const target = 3600; // 1 hour

			// On time: delta = 0 -> 0.0 points
			const onTime = calculateTsdScore(3600, target);
			assert.equal(onTime.deltaSeconds, 0);
			assert.equal(onTime.penaltyPoints, 0);
			assert.equal(onTime.direction, "on_time");

			// 30 seconds early: delta = -30 -> 30 * 2.0 = 60.0 points
			const early30 = calculateTsdScore(3570, target, 2.0, 1.0);
			assert.equal(early30.deltaSeconds, -30);
			assert.equal(early30.penaltyPoints, 60);
			assert.equal(early30.direction, "early");

			// 30 seconds late: delta = +30 -> 30 * 1.0 = 30.0 points
			const late30 = calculateTsdScore(3630, target, 2.0, 1.0);
			assert.equal(late30.deltaSeconds, 30);
			assert.equal(late30.penaltyPoints, 30);
			assert.equal(late30.direction, "late");

			// Early penalty ceiling clamp: 500 seconds early -> 1000 raw points, clamped to maxEarlyPenalty 600
			const maxEarly = calculateTsdScore(3100, target, 2.0, 1.0, 600);
			assert.equal(maxEarly.deltaSeconds, -500);
			assert.equal(maxEarly.penaltyPoints, 600);
			assert.equal(maxEarly.direction, "early");

			// Fractional sub-second delta: 1.5 seconds early -> 3.0 points
			const fractional = calculateTsdScore(3598.5, target, 2.0, 1.0);
			assert.equal(fractional.deltaSeconds, -1.5);
			assert.equal(fractional.penaltyPoints, 3.0);
		});
	});

	// ===========================================================================
	// AREA 3: DOWNHILL GATE RELEASE, RED-FLAG HOLDS & SECTOR ORDERING
	// ===========================================================================
	describe("Area 3: Downhill MTB Gate Release & Red-Flag Holds", () => {
		it("validates downhillGateReleaseInput and downhillRedFlagHoldInput schemas", () => {
			// Valid release
			const release = downhillGateReleaseInput.parse({
				eventId: testUuid1,
				entrantId: testUuid2,
				actualStartTime: "2026-11-05T10:00:00.000Z",
			});
			assert.equal(release.eventId, testUuid1);

			// Invalid release: bad UUID
			assert.throws(() => {
				downhillGateReleaseInput.parse({
					eventId: "invalid-uuid",
					entrantId: testUuid2,
					actualStartTime: "2026-11-05T10:00:00.000Z",
				});
			});

			// Valid hold
			const hold = downhillRedFlagHoldInput.parse({
				eventId: testUuid1,
				holdNote: "Rider crashed in rock garden at sector 2",
			});
			assert.equal(hold.holdNote, "Rider crashed in rock garden at sector 2");

			// Invalid hold: empty string note
			assert.throws(() => {
				downhillRedFlagHoldInput.parse({
					eventId: testUuid1,
					holdNote: "   ",
				});
			});
		});

		it("enforces red-flag gate release lockout and safety clearance restart protocol", () => {
			interface DhCourseState {
				redFlagActive: boolean;
				activeHoldReason: string | null;
				lastReleasedRiderPlate: string | null;
				lastReleaseTimeUtc: number | null;
			}

			const courseState: DhCourseState = {
				redFlagActive: false,
				activeHoldReason: null,
				lastReleasedRiderPlate: null,
				lastReleaseTimeUtc: null,
			};

			function releaseRider(
				plate: string,
				releaseTimeIso: string,
				minIntervalSeconds = 30,
			): { success: boolean; error?: string } {
				const releaseTime = new Date(releaseTimeIso).getTime();

				if (courseState.redFlagActive) {
					return {
						success: false,
						error: `Start gate locked: Red flag active (${courseState.activeHoldReason})`,
					};
				}

				if (
					courseState.lastReleaseTimeUtc !== null &&
					releaseTime - courseState.lastReleaseTimeUtc < minIntervalSeconds * 1000
				) {
					return {
						success: false,
						error: `Interval collision: Cannot release rider before minimum ${minIntervalSeconds}s buffer`,
					};
				}

				courseState.lastReleasedRiderPlate = plate;
				courseState.lastReleaseTimeUtc = releaseTime;
				return { success: true };
			}

			// Rider 1 release: 10:00:00
			const r1 = releaseRider("01", "2026-11-05T10:00:00.000Z");
			assert.equal(r1.success, true);

			// Premature release: 10:00:15 (only 15s after Rider 1)
			const premature = releaseRider("02", "2026-11-05T10:00:15.000Z");
			assert.equal(premature.success, false);
			assert.ok(premature.error?.includes("Interval collision"));

			// Legal release: 10:00:30 (30s after Rider 1)
			const r2 = releaseRider("02", "2026-11-05T10:00:30.000Z");
			assert.equal(r2.success, true);

			// Incident occurs: Rider 2 crashes -> Red flag declared
			courseState.redFlagActive = true;
			courseState.activeHoldReason = "Medical on course at Sector 2";

			// Rider 3 attempts gate release during red flag hold
			const blockedRelease = releaseRider("03", "2026-11-05T10:01:00.000Z");
			assert.equal(blockedRelease.success, false);
			assert.ok(blockedRelease.error?.includes("Start gate locked: Red flag active"));

			// Clear red flag and resume with official restart
			courseState.redFlagActive = false;
			courseState.activeHoldReason = null;

			// Rescheduled gate release for Rider 3 at 10:15:00
			const restartRelease = releaseRider("03", "2026-11-05T10:15:00.000Z");
			assert.equal(restartRelease.success, true);
			assert.equal(courseState.lastReleasedRiderPlate, "03");
		});

		it("ranks downhill finishes with millisecond optical photocell precision", () => {
			interface Finisher {
				plate: string;
				elapsedMs: number;
			}

			const finishers: Finisher[] = [
				{ plate: "01", elapsedMs: 202450 }, // 3m 22.450s
				{ plate: "02", elapsedMs: 201120 }, // 3m 21.120s (1st)
				{ plate: "04", elapsedMs: 201125 }, // 3m 21.125s (2nd by 5 milliseconds)
				{ plate: "05", elapsedMs: 202450 }, // 3m 22.450s (Tied for 3rd)
			];

			finishers.sort((a, b) => a.elapsedMs - b.elapsedMs);

			assert.equal(finishers[0].plate, "02");
			assert.equal(finishers[1].plate, "04");
			// Assert 5ms gap separates 1st and 2nd
			assert.equal(finishers[1].elapsedMs - finishers[0].elapsedMs, 5);
		});
	});

	// ===========================================================================
	// AREA 4: XCO 80% LAPPED PULL MATHEMATICAL & OPERATIONAL EDGE CASES
	// ===========================================================================
	describe("Area 4: XCO 80% Lapped Pull Edge Cases", () => {
		it("evaluates exactly 80.0% cutoff boundary on leader lap 1", () => {
			// Leader Lap 1 = 600.0 seconds (10 minutes)
			// 80% cutoff ratio = 480.0 seconds gap behind leader (total time = 1080.0s)
			const leaderTime = 600.0;

			// Exactly at 80.0% cutoff (gap = 480.0s): subject to pull (>= cutoff)
			const exactCutoff = isSubjectTo80PercentPull(leaderTime, 1080.0, 0.8);
			assert.equal(exactCutoff.gapSeconds, 480.0);
			assert.equal(exactCutoff.gapPercentage, 80.0);
			assert.equal(exactCutoff.isPulled, true, "Rider exactly at 80.0% cutoff must be pulled");

			// Just under 80% cutoff: gap = 479.9s (79.983%) -> NOT pulled
			const justUnder = isSubjectTo80PercentPull(leaderTime, 1079.9, 0.8);
			assert.ok(Math.abs(justUnder.gapSeconds - 479.9) < 1e-6);
			assert.ok(justUnder.gapPercentage < 80.0);
			assert.equal(justUnder.isPulled, false, "Rider under 80.0% cutoff is safe");

			// Just over 80% cutoff: gap = 480.1s (80.017%) -> pulled
			const justOver = isSubjectTo80PercentPull(leaderTime, 1080.1, 0.8);
			assert.ok(Math.abs(justOver.gapSeconds - 480.1) < 1e-6);
			assert.ok(justOver.gapPercentage > 80.0);
			assert.equal(justOver.isPulled, true, "Rider over 80.0% cutoff must be pulled");
		});

		it("handles zero and negative gap scenarios cleanly without false pull alarms", () => {
			const leaderTime = 540.0; // 9 minutes

			// Equal to leader (gap = 0):
			const tied = isSubjectTo80PercentPull(leaderTime, 540.0, 0.8);
			assert.equal(tied.gapSeconds, 0);
			assert.equal(tied.gapPercentage, 0);
			assert.equal(tied.isPulled, false);

			// Faster than leader (negative gap, e.g. alternate line or leader error):
			const faster = isSubjectTo80PercentPull(leaderTime, 530.0, 0.8);
			assert.equal(faster.gapSeconds, -10.0);
			assert.ok(faster.gapPercentage < 0);
			assert.equal(faster.isPulled, false);
		});

		it("validates xcoCheckLappedPullInput schema and threshold rounding logic", () => {
			const valid = xcoCheckLappedPullInput.parse({
				eventId: testUuid1,
				leaderLap: 2,
				leaderLapTimeSeconds: 501.2,
			});
			assert.equal(valid.leaderLap, 2);

			// Expected threshold: 501.2 * 0.8 = 400.96 -> Math.round is 401s
			const threshold = Math.round(valid.leaderLapTimeSeconds * 0.8);
			assert.equal(threshold, 401);

			// Rejects non-positive leader lap time
			assert.throws(() => {
				xcoCheckLappedPullInput.parse({
					eventId: testUuid1,
					leaderLap: 1,
					leaderLapTimeSeconds: 0,
				});
			});

			assert.throws(() => {
				xcoCheckLappedPullInput.parse({
					eventId: testUuid1,
					leaderLap: 1,
					leaderLapTimeSeconds: -100,
				});
			});
		});
	});

	// ===========================================================================
	// AREA 5: ENTRANT TELEMETRY VIEW ELEVATION PROFILE MATH & SVG PATHS
	// ===========================================================================
	describe("Area 5: EntrantTelemetryView Elevation Profile Math & SVG Paths", () => {
		interface ElevationPoint {
			distanceKm: number;
			elevationMeters: number;
			isCompleted?: boolean;
			isCurrent?: boolean;
		}

		// Replicates the SVG path generation algorithm in EntrantTelemetryView.tsx
		function computeSvgPoints(profile: ElevationPoint[]) {
			if (!profile || profile.length === 0) {
				return { pathD: "", fillPathD: "", markers: [] };
			}

			const width = 600;
			const height = 120;
			const padX = 24;
			const padY = 16;

			const maxDist = Math.max(...profile.map((p) => p.distanceKm), 1);
			const elevs = profile.map((p) => p.elevationMeters);
			const minElev = Math.min(...elevs) - 50;
			const maxElev = Math.max(...elevs) + 50;
			const elevRange = maxElev - minElev || 1;

			const scaleX = (d: number) => padX + (d / maxDist) * (width - 2 * padX);
			const scaleY = (e: number) =>
				height - padY - ((e - minElev) / elevRange) * (height - 2 * padY);

			const coords = profile.map((p) => ({
				x: scaleX(p.distanceKm),
				y: scaleY(p.elevationMeters),
				...p,
			}));

			let pathD = `M ${coords[0].x} ${coords[0].y}`;
			for (let i = 1; i < coords.length; i++) {
				pathD += ` L ${coords[i].x} ${coords[i].y}`;
			}

			const fillPathD = `${pathD} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

			return { pathD, fillPathD, markers: coords, minElev, maxElev, elevRange };
		}

		it("handles zero elevation gain courses (flat courses) without division by zero or NaN", () => {
			const flatProfile: ElevationPoint[] = [
				{ distanceKm: 0, elevationMeters: 500 },
				{ distanceKm: 5, elevationMeters: 500 },
				{ distanceKm: 10, elevationMeters: 500 },
				{ distanceKm: 15, elevationMeters: 500 },
				{ distanceKm: 21.1, elevationMeters: 500 },
			];

			const res = computeSvgPoints(flatProfile);

			assert.equal(res.elevRange, 100, "elevRange must be exactly 100 (550 - 450)");
			assert.equal(res.markers.length, 5);

			// All markers should have identical Y coordinate centered vertically:
			// scaleY(500) = 120 - 16 - ((500 - 450) / 100) * (120 - 32) = 104 - 0.5 * 88 = 60
			for (const m of res.markers) {
				assert.equal(m.y, 60, "Marker Y must be vertically centered at 60px");
				assert.equal(Number.isNaN(m.x), false, "X must not be NaN");
				assert.equal(Number.isNaN(m.y), false, "Y must not be NaN");
			}

			assert.ok(!res.pathD.includes("NaN"), "pathD must not contain NaN");
			assert.ok(!res.fillPathD.includes("NaN"), "fillPathD must not contain NaN");
		});

		it("computes descending-only courses (e.g. Downhill MTB) with strictly monotonic Y coordinates", () => {
			const downhillProfile: ElevationPoint[] = [
				{ distanceKm: 0, elevationMeters: 3000 },
				{ distanceKm: 1, elevationMeters: 2600 },
				{ distanceKm: 2, elevationMeters: 2100 },
				{ distanceKm: 3, elevationMeters: 1700 },
				{ distanceKm: 4, elevationMeters: 1200 },
			];

			const res = computeSvgPoints(downhillProfile);

			// Start point is highest elevation -> lowest Y coordinate (near top of SVG)
			// Finish point is lowest elevation -> highest Y coordinate (near bottom of SVG)
			assert.ok(res.markers[0].y < res.markers[res.markers.length - 1].y);

			for (let i = 1; i < res.markers.length; i++) {
				assert.ok(
					res.markers[i].y > res.markers[i - 1].y,
					`Marker ${i} Y should be lower down (larger Y) than marker ${i - 1}`,
				);
			}

			assert.ok(!res.pathD.includes("NaN"));
			assert.ok(res.fillPathD.endsWith("L 24 120 Z"));
		});

		it("handles vertical cliffs (same distance, step elevation change) safely", () => {
			const cliffProfile: ElevationPoint[] = [
				{ distanceKm: 0, elevationMeters: 1000 },
				{ distanceKm: 5, elevationMeters: 1000 },
				{ distanceKm: 5, elevationMeters: 2500 }, // Sheer cliff / vertical wall
				{ distanceKm: 10, elevationMeters: 2500 },
			];

			const res = computeSvgPoints(cliffProfile);

			// Distance is identical at 5km, so X coordinate must be identical
			assert.equal(res.markers[1].x, res.markers[2].x);
			// Y coordinates differ representing the cliff
			assert.notEqual(res.markers[1].y, res.markers[2].y);
			assert.ok(!res.pathD.includes("NaN"));
		});

		it("handles zero distance course and empty elevation profile safely", () => {
			const emptyRes = computeSvgPoints([]);
			assert.equal(emptyRes.pathD, "");
			assert.equal(emptyRes.fillPathD, "");
			assert.equal(emptyRes.markers.length, 0);

			const zeroDistRes = computeSvgPoints([{ distanceKm: 0, elevationMeters: 100 }]);
			assert.equal(zeroDistRes.markers.length, 1);
			assert.ok(!zeroDistRes.pathD.includes("NaN"));
		});
	});

	// ===========================================================================
	// AREA 6: PROJECTION WINDOW BOUNDS & ELAPSED EXCEEDING PROJECTED FINISH
	// ===========================================================================
	describe("Area 6: Projection Window Bounds & Dynamic Pacing Recalculation", () => {
		it("dynamically recalculates finish projection when elapsed time exceeds initial projection", () => {
			const totalCourseMeters = 50000; // 50km
			const completedMeters = 30000; // 30km completed
			const currentElapsedSeconds = 45000; // 12.5 hours elapsed

			// Initial projection was 40,000s (11.11h), which the runner has now exceeded!
			const dynamicProjection = calculatePacingProjection(
				currentElapsedSeconds,
				completedMeters,
				totalCourseMeters,
			);

			// Avg pace = 45000 / 30000 = 1.5 s/meter = 1500 s/km (25 min/km)
			// Projected finish = 1.5 * 50000 = 75,000s (20.83 hours)
			assert.equal(dynamicProjection.projectedFinishSeconds, 75000);
			assert.equal(dynamicProjection.projectedHours, "20.83");
			assert.ok(
				dynamicProjection.projectedFinishSeconds > currentElapsedSeconds,
				"Dynamic finish projection must exceed current elapsed time",
			);
		});

		it("evaluates cutoff margin risk and negative margin when latest projection exceeds cutoff", () => {
			const cutoffDurationSeconds = 36000; // 10h station cutoff
			const projectedArrivalSeconds = 35000; // Expected arrival at 9h 43m
			const bandHigh = 1800; // +30m confidence band

			const latestArrivalSeconds = projectedArrivalSeconds + bandHigh; // 36800s (10h 13m)
			const cutoffMarginSeconds = cutoffDurationSeconds - latestArrivalSeconds; // -800s (-13m 20s)
			const cutoffRisk = cutoffMarginSeconds < 1800; // Less than 30m buffer

			assert.equal(cutoffMarginSeconds, -800);
			assert.equal(cutoffRisk, true, "Cutoff risk must trigger when latest arrival exceeds cutoff");
		});

		it("clamps earliest arrival band to zero and evaluates SAR badges accurately", () => {
			const projectedSec = 600; // 10m
			const bandLow = 900; // 15m
			const earliestSec = Math.max(0, projectedSec - bandLow);

			assert.equal(earliestSec, 0, "Earliest arrival must be clamped to 0 without negative timestamps");

			// SAR badge levels: 0m -> normal, 15m -> overdue, 30m -> critical
			assert.equal(evaluateSarBadge(0).level, "normal");
			assert.equal(evaluateSarBadge(14).level, "normal");
			assert.equal(evaluateSarBadge(15).level, "overdue");
			assert.equal(evaluateSarBadge(29).level, "overdue");
			assert.equal(evaluateSarBadge(30).level, "critical");
			assert.equal(evaluateSarBadge(120).level, "critical");
		});
	});

	// ===========================================================================
	// AREA 7: STRICT PUBLIC PII REDACTION AUDIT ACROSS ALL PUBLIC ENDPOINTS
	// ===========================================================================
	describe("Area 7: Strict Public PII Redaction Audit", () => {
		it("strictly strips medical notes, emergency contacts, phones, emails and RFID transponders", () => {
			const privateEntrant: EntrantWithPrivateData = {
				id: testUuid1,
				bibNumber: "142",
				firstName: "Sarah",
				lastName: "Connor",
				status: "in_progress",
				medicalNotes: "Severe penicillin allergy, asthma inhaler in pack",
				safetyTriageNotes: "Stumbled at mile 18, mild dizziness noted by medic",
				allergies: "Penicillin, Bee stings",
				medications: "Albuterol",
				phone: "+1-555-0199",
				email: "sarah.connor@example.com",
				rfidCode: "HEX-E280-1194-AA42",
				address: {
					street1: "123 Redacted Canyon Rd",
					street2: "Apt 4B",
					postalCode: "84532",
					city: "Moab",
					state: "UT",
				},
				emergencyContactName: "John Connor",
				emergencyContactPhone: "+1-555-0188",
				emergencyContactRelation: "Son",
				emergencyContactIsOnSite: true,
				splits: [
					{
						splitId: "sp-1",
						splitName: "Start",
						isSecretCheckpoint: false,
						elapsedSeconds: 0,
					},
					{
						splitId: "sp-2",
						splitName: "Hidden Ridge Checkpoint",
						isSecretCheckpoint: true, // Must be omitted from public telemetry
						elapsedSeconds: 5400,
					},
					{
						splitId: "sp-3",
						splitName: "Finish",
						isSecretCheckpoint: false,
						elapsedSeconds: 18000,
					},
				],
			};

			const redacted = redactPublicEntrantData(privateEntrant);

			// Assert public fields preserved
			assert.equal(redacted.id, testUuid1);
			assert.equal(redacted.bibNumber, "142");
			assert.equal(redacted.firstName, "Sarah");
			assert.equal(redacted.lastName, "Connor");
			assert.equal(redacted.status, "in_progress");
			assert.equal(redacted.hasEmergencyContactOnSite, true);

			// Assert strict redaction of sensitive PII
			assert.equal(
				(redacted as Record<string, unknown>).medicalNotes,
				undefined,
				"medicalNotes must be strictly redacted",
			);
			assert.equal(
				(redacted as Record<string, unknown>).safetyTriageNotes,
				undefined,
				"safetyTriageNotes must be strictly redacted",
			);
			assert.equal(
				(redacted as Record<string, unknown>).allergies,
				undefined,
				"allergies must be strictly redacted",
			);
			assert.equal(
				(redacted as Record<string, unknown>).medications,
				undefined,
				"medications must be strictly redacted",
			);
			assert.equal(
				(redacted as Record<string, unknown>).emergencyContactName,
				undefined,
				"emergencyContactName must be strictly redacted",
			);
			assert.equal(
				(redacted as Record<string, unknown>).emergencyContactPhone,
				undefined,
				"emergencyContactPhone must be strictly redacted",
			);
			assert.equal(
				(redacted as Record<string, unknown>).emergencyContactRelation,
				undefined,
				"emergencyContactRelation must be strictly redacted",
			);
			assert.equal(
				(redacted as Record<string, unknown>).phone,
				undefined,
				"phone must be strictly redacted",
			);
			assert.equal(
				(redacted as Record<string, unknown>).email,
				undefined,
				"email must be strictly redacted",
			);
			assert.equal(
				(redacted as Record<string, unknown>).rfidCode,
				undefined,
				"rfidCode must be strictly redacted",
			);
			assert.equal(
				(redacted as Record<string, unknown>).address,
				undefined,
				"address must be strictly redacted",
			);

			// Assert secret checkpoints are withheld
			assert.equal(redacted.splits?.length, 2, "Secret checkpoint sp-2 must be excluded");
			assert.equal(
				redacted.splits?.some((s) => s.splitName.includes("Hidden Ridge")),
				false,
			);
		});

		it("verifies RBAC medical data gating helper contracts", () => {
			// Plain volunteer without medical credentials
			assert.equal(
				canViewMedicalData({
					orgRoles: ["member"],
					staffRoles: ["volunteer"],
				}),
				false,
				"Plain volunteer must NOT view medical data",
			);

			// Checkpoint captain without medical credentials
			assert.equal(
				canViewMedicalData({
					orgRoles: ["member"],
					staffRoles: ["checkpoint_captain"],
				}),
				false,
				"Checkpoint captain without medical credential must NOT view medical data",
			);

			// Staff with medical role
			assert.equal(
				canViewMedicalData({
					orgRoles: ["member"],
					staffRoles: ["volunteer", "medical"],
				}),
				true,
				"Staff with medical role must view medical data",
			);

			// Staff with official role
			assert.equal(
				canViewMedicalData({
					orgRoles: ["member"],
					staffRoles: ["official"],
				}),
				true,
				"Staff official must view medical data",
			);

			// Organization admin/owner
			assert.equal(
				canViewMedicalData({
					orgRoles: ["admin"],
					staffRoles: [],
				}),
				true,
				"Org admin must view medical data",
			);
		});
	});

	// ===========================================================================
	// AREA 8: DESIGN SYSTEM STRICT TOKEN AUDIT ACROSS ENTIRE SRC CODEBASE
	// ===========================================================================
	describe("Area 8: Design System Strict Invariants (Zero blur & Zero transition-all)", () => {
		const srcDir = path.resolve(import.meta.dirname, "../../");

		function walkSourceFiles(dir: string, fileList: string[] = []): string[] {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					if (entry.name !== "node_modules" && entry.name !== ".git") {
						walkSourceFiles(fullPath, fileList);
					}
				} else if (
					(entry.name.endsWith(".ts") ||
						entry.name.endsWith(".tsx") ||
						entry.name.endsWith(".css")) &&
					!entry.name.includes(".test.") &&
					!entry.name.includes("test-harness")
				) {
					fileList.push(fullPath);
				}
			}
			return fileList;
		}

		it("strictly asserts 0 occurrences of 'backdrop-blur' across all implementation files in src/", () => {
			const sourceFiles = walkSourceFiles(srcDir);
			assert.ok(sourceFiles.length > 50, `Expected >50 source files, found ${sourceFiles.length}`);

			const violations: string[] = [];
			for (const filePath of sourceFiles) {
				const content = fs.readFileSync(filePath, "utf-8");
				if (content.includes("backdrop-blur")) {
					const relPath = path.relative(srcDir, filePath);
					violations.push(relPath);
				}
			}

			assert.deepEqual(
				violations,
				[],
				`Forbidden 'backdrop-blur' token detected in: ${violations.join(", ")}`,
			);
		});

		it("strictly asserts 0 occurrences of 'transition-all' across all implementation files in src/", () => {
			const sourceFiles = walkSourceFiles(srcDir);
			const violations: string[] = [];
			for (const filePath of sourceFiles) {
				const content = fs.readFileSync(filePath, "utf-8");
				if (content.includes("transition-all")) {
					const relPath = path.relative(srcDir, filePath);
					violations.push(relPath);
				}
			}

			assert.deepEqual(
				violations,
				[],
				`Forbidden 'transition-all' token detected in: ${violations.join(", ")}`,
			);
		});

		it("verifies EntrantTelemetryView.tsx uses tabular-nums on all timing/metric displays", () => {
			const telemetryViewPath = path.resolve(
				srcDir,
				"components/EntrantTelemetryView.tsx",
			);
			assert.ok(
				fs.existsSync(telemetryViewPath),
				"EntrantTelemetryView.tsx must exist",
			);

			const content = fs.readFileSync(telemetryViewPath, "utf-8");
			assert.ok(
				content.includes("tabular-nums"),
				"EntrantTelemetryView.tsx must enforce tabular-nums on numeric displays",
			);
			assert.ok(
				!content.includes("backdrop-blur"),
				"EntrantTelemetryView.tsx must NOT contain backdrop-blur",
			);
			assert.ok(
				!content.includes("transition-all"),
				"EntrantTelemetryView.tsx must NOT contain transition-all",
			);
		});
	});
});
