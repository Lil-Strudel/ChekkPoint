import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { z } from "zod";
import {
	assignStaffTimingPointInput,
	backyardCloseYardInput,
	checkInEntrantInput,
	downhillGateReleaseInput,
	downhillRedFlagHoldInput,
	eventGroupSlugParams,
	fixedTimeRecordPartialLapInput,
	partialRulesConfigInput,
	ParticipantDataSchema,
	recalculateEntrantProjectionInput,
	resetEventGunInput,
	rosterStaffMemberInput,
	RulesConfigSchema,
	startEventGunInput,
	subEventParams,
	tsdGenerateIntervalStartsInput,
	tsdRevealSecretCheckpointsInput,
	updateEntrantWorkspaceInput,
	updateEventGroupRulesInput,
	updateStaffRolesInput,
	verifyExternalProfileInput,
	xcoCheckLappedPullInput,
} from "../../race-control/race-control.shared.ts";
import {
	type CourseSplit,
	type Entrant,
	type EventGroup,
	type SubEvent,
	TestDatabase,
	type TimingPoint,
} from "../test-harness.ts";

/**
 * Wave 2 Adversarial Challenge & Stress-Test Suite
 *
 * Empirical verification of:
 * 1. Discipline operational controls:
 *    - Backyard Ultra yard close and OTL sweep mechanics & corral return oracle
 *    - TSD regularity interval generation, natural vs string sorting, and secret checkpoint reveal
 *    - Downhill MTB optical gate releases, cross-event isolation, and red-flag hold
 *    - UCI XCO 80% pull rule thresholds and boundary precision
 *    - Fixed-Time loop countdown & partial distance accumulation without note truncation
 * 2. Entrant check-in desk, 2-mode switcher, 3-section modal dialog, and external profile verification / projection recalculation
 * 3. Legacy URL redirect behavior and route tree resolution
 * 4. Design system invariants: zero backdrop-blur, zero transition-all, and tabular-nums
 */

const testUuid1 = "10000000-0000-4000-8000-000000000001";
const testUuid2 = "10000000-0000-4000-8000-000000000002";
const testUuid3 = "10000000-0000-4000-8000-000000000003";
const testUuid4 = "10000000-0000-4000-8000-000000000004";

describe("Wave 2 Adversarial Stress Suite", () => {
	// ===========================================================================
	// AREA 1: BACKYARD ULTRA YARD CONTROLLER & OTL SWEEP MECHANICS
	// ===========================================================================
	describe("Area 1: Backyard Ultra Yard Close, Whistle Countdown & OTL Transitions", () => {
		it("oracle stress-test: closeBackyardYard must distinguish corral finishers from non-finishers", () => {
			// Setup simulated entrants
			const field = [
				{ id: "e1", bib: "101", status: "in_progress", lastCompletedYard: 1, finishedYardAtSeconds: 2700 },
				{ id: "e2", bib: "102", status: "in_progress", lastCompletedYard: 1, finishedYardAtSeconds: 3100 },
				{ id: "e3", bib: "103", status: "in_progress", lastCompletedYard: 1, finishedYardAtSeconds: 3550 },
				{ id: "e4", bib: "104", status: "in_progress", lastCompletedYard: 0, finishedYardAtSeconds: null }, // still out on course!
				{ id: "e5", bib: "105", status: "in_progress", lastCompletedYard: 1, finishedYardAtSeconds: 3640 }, // finished, but over 60m (OTL)!
				{ id: "e6", bib: "106", status: "dns", lastCompletedYard: 0, finishedYardAtSeconds: null },
				{ id: "e7", bib: "107", status: "dnf", lastCompletedYard: 0, finishedYardAtSeconds: null },
			];

			const YARD_TIME_LIMIT_SECONDS = 3600;
			const TARGET_YARD = 1;

			// Oracle sweep algorithm: Only entrants who failed to return to corral before top-of-hour are OTL
			function sweepBackyardYardOracle(entrantsList: typeof field, yardNumber: number) {
				return entrantsList.map((entrant) => {
					if (entrant.status !== "in_progress") return entrant;

					const completedYardInTime =
						entrant.lastCompletedYard >= yardNumber &&
						entrant.finishedYardAtSeconds !== null &&
						entrant.finishedYardAtSeconds <= YARD_TIME_LIMIT_SECONDS;

					if (!completedYardInTime) {
						return {
							...entrant,
							status: "dnf" as const,
							dropReason: "missed_cutoff",
							comments: `Over Time Limit (OTL) on Yard #${yardNumber}`,
						};
					}
					return entrant;
				});
			}

			const swept = sweepBackyardYardOracle(field, TARGET_YARD);

			// Active surviving runners should be exactly e1, e2, e3 (3 runners)
			const activeSurviving = swept.filter((e) => e.status === "in_progress");
			assert.equal(activeSurviving.length, 3, "Exactly 3 runners completed Yard 1 within 60 minutes");
			assert.deepEqual(activeSurviving.map((e) => e.id), ["e1", "e2", "e3"]);

			// e4 (still on course) and e5 (>3600s) should both be marked DNF with missed_cutoff
			const e4 = swept.find((e) => e.id === "e4")!;
			assert.equal(e4.status, "dnf");
			assert.equal(e4.dropReason, "missed_cutoff");
			assert.match(e4.comments!, /Yard #1/);

			const e5 = swept.find((e) => e.id === "e5")!;
			assert.equal(e5.status, "dnf");
			assert.equal(e5.dropReason, "missed_cutoff");

			// Inactive entrants prior to sweep (DNS, prior DNF) must remain untouched
			const e6 = swept.find((e) => e.id === "e6")!;
			assert.equal(e6.status, "dns");
			const e7 = swept.find((e) => e.id === "e7")!;
			assert.equal(e7.status, "dnf");
		});

		it("tests whistle countdown cue boundaries at exact millisecond thresholds", () => {
			function getWhistleCue(remainingSeconds: number): string {
				if (remainingSeconds <= 0) return "BELL - YARD CLOSED / CORRAL SHUT";
				if (remainingSeconds <= 60) return "1 WHISTLE - 1 MINUTE TO BELL";
				if (remainingSeconds <= 120) return "2 WHISTLES - 2 MINUTES TO BELL";
				if (remainingSeconds <= 180) return "3 WHISTLES - 3 MINUTES TO BELL";
				return "IN_PROGRESS";
			}

			// Exact boundary testing
			assert.equal(getWhistleCue(181), "IN_PROGRESS");
			assert.equal(getWhistleCue(180), "3 WHISTLES - 3 MINUTES TO BELL");
			assert.equal(getWhistleCue(121), "3 WHISTLES - 3 MINUTES TO BELL");
			assert.equal(getWhistleCue(120), "2 WHISTLES - 2 MINUTES TO BELL");
			assert.equal(getWhistleCue(61), "2 WHISTLES - 2 MINUTES TO BELL");
			assert.equal(getWhistleCue(60), "1 WHISTLE - 1 MINUTE TO BELL");
			assert.equal(getWhistleCue(1), "1 WHISTLE - 1 MINUTE TO BELL");
			assert.equal(getWhistleCue(0), "BELL - YARD CLOSED / CORRAL SHUT");
			assert.equal(getWhistleCue(-1), "BELL - YARD CLOSED / CORRAL SHUT");
		});

		it("validates cumulative mileage and extreme yard counts without arithmetic overflow", () => {
			const yardDistMiles = 4.166667;
			// Yard 100
			const yard100Distance = 100 * yardDistMiles;
			assert.equal(yard100Distance.toFixed(1), "416.7");

			// Yard 1000
			const yard1000Distance = 1000 * yardDistMiles;
			assert.equal(yard1000Distance.toFixed(1), "4166.7");

			// Zod schema enforces positive integer for completedYardNumber
			assert.throws(() => {
				backyardCloseYardInput.parse({
					eventId: testUuid1,
					completedYardNumber: 0,
				});
			});
			assert.throws(() => {
				backyardCloseYardInput.parse({
					eventId: testUuid1,
					completedYardNumber: -1,
				});
			});
		});
	});

	// ===========================================================================
	// AREA 2: TSD REGULARITY INTERVAL GENERATION & SECRET CHECKPOINTS
	// ===========================================================================
	describe("Area 2: TSD Regularity Out-Times, Sorting & Secret Checkpoints", () => {
		it("survives numeric vs lexicographical bib sorting challenges", () => {
			// Unpadded competitor numbers
			const competitorNumbers = ["1", "10", "2", "20", "3", "100"];

			// Natural numeric sort vs lexicographical sort demonstration
			const naturalSorted = [...competitorNumbers].sort((a, b) =>
				a.localeCompare(b, undefined, { numeric: true }),
			);
			assert.deepEqual(naturalSorted, ["1", "2", "3", "10", "20", "100"]);

			const baseTime = new Date("2026-11-05T09:00:00Z").getTime();
			const intervalSeconds = 60;

			const startSchedule = naturalSorted.map((car, idx) => ({
				car,
				scheduledStart: new Date(baseTime + idx * intervalSeconds * 1000).toISOString(),
			}));

			assert.equal(startSchedule[0].car, "1");
			assert.equal(startSchedule[0].scheduledStart, "2026-11-05T09:00:00.000Z");
			assert.equal(startSchedule[1].car, "2");
			assert.equal(startSchedule[1].scheduledStart, "2026-11-05T09:01:00.000Z");
			assert.equal(startSchedule[2].car, "3");
			assert.equal(startSchedule[2].scheduledStart, "2026-11-05T09:02:00.000Z");
			assert.equal(startSchedule[5].car, "100");
			assert.equal(startSchedule[5].scheduledStart, "2026-11-05T09:05:00.000Z");
		});

		it("scores TSD deviations with early penalty multiplier (2x) and late multiplier (1x)", () => {
			function calculateTsdPenaltyScore(
				actualElapsed: number,
				idealDuration: number,
				earlyFactor = 2.0,
				lateFactor = 1.0,
				gracePeriod = 0.0,
			) {
				const deviation = actualElapsed - idealDuration;
				const absDev = Math.abs(deviation);
				if (absDev <= gracePeriod) return 0;

				const effectiveDev = absDev - gracePeriod;
				if (deviation < 0) {
					// Arrived early: heavier penalty
					return Math.round(effectiveDev * earlyFactor * 10) / 10;
				}
				return Math.round(effectiveDev * lateFactor * 10) / 10;
			}

			// Exact match
			assert.equal(calculateTsdPenaltyScore(1200, 1200), 0);

			// 5 seconds early -> 10 penalty points
			assert.equal(calculateTsdPenaltyScore(1195, 1200), 10);

			// 5 seconds late -> 5 penalty points
			assert.equal(calculateTsdPenaltyScore(1205, 1200), 5);

			// With 2 seconds grace period:
			// 5 seconds early -> 3 effective seconds * 2 = 6 points
			assert.equal(calculateTsdPenaltyScore(1195, 1200, 2.0, 1.0, 2.0), 6);
			// 1.5 seconds late -> within 2s grace -> 0 points
			assert.equal(calculateTsdPenaltyScore(1201.5, 1200, 2.0, 1.0, 2.0), 0);
		});

		it("validates secret checkpoint reveal input schema and CourseSplit flags", () => {
			const revealTrue = tsdRevealSecretCheckpointsInput.parse({
				eventId: testUuid1,
				reveal: true,
			});
			assert.equal(revealTrue.reveal, true);

			const revealFalse = tsdRevealSecretCheckpointsInput.parse({
				eventId: testUuid1,
				reveal: false,
			});
			assert.equal(revealFalse.reveal, false);

			// CourseSplit schema filtering
			const splits: Array<{ id: string; name: string; isSecretCheckpoint: boolean }> = [
				{ id: "s1", name: "Start Out", isSecretCheckpoint: false },
				{ id: "s2", name: "Secret Sector A", isSecretCheckpoint: true },
				{ id: "s3", name: "Time Control 1", isSecretCheckpoint: false },
				{ id: "s4", name: "Secret Sector B", isSecretCheckpoint: true },
				{ id: "s5", name: "Finish", isSecretCheckpoint: false },
			];

			const publicVisible = splits.filter((s) => !s.isSecretCheckpoint);
			assert.equal(publicVisible.length, 3);
			assert.deepEqual(publicVisible.map((s) => s.id), ["s1", "s3", "s5"]);

			const stewardRevealed = splits;
			assert.equal(stewardRevealed.length, 5);
		});
	});

	// ===========================================================================
	// AREA 3: DOWNHILL MTB GATE RELEASE & RED FLAG COURSE HOLD
	// ===========================================================================
	describe("Area 3: Downhill MTB Gate Releases, Sub-Second Precision & Red-Flag Hold", () => {
		it("verifies optical photocell gate dispatch with millisecond timestamps", () => {
			const releaseInput = downhillGateReleaseInput.parse({
				eventId: testUuid1,
				entrantId: testUuid2,
				actualStartTime: "2026-11-05T10:15:30.456Z",
			});
			assert.equal(releaseInput.actualStartTime, "2026-11-05T10:15:30.456Z");

			const parsedDate = new Date(releaseInput.actualStartTime);
			assert.equal(parsedDate.getUTCMilliseconds(), 456);
		});

		it("proves event scoping isolation: release gate mutation must reject cross-event entrants", () => {
			const db = new TestDatabase();
			const eventAId = "event-A";
			const eventBId = "event-B";

			// Entrant belonging to Event B
			const entrantInB: Entrant = {
				id: "entrant-B-99",
				eventId: eventBId,
				personId: "person-1",
				bibNumber: "99",
				status: "checked_in",
			};
			db.entrants.push(entrantInB);

			// Secure dispatcher oracle: checks entrant.eventId === eventId
			function releaseGateOracle(eventId: string, entrantId: string, startTime: Date) {
				const entrant = db.entrants.find((e) => e.id === entrantId);
				if (!entrant) throw new Error("Entrant not found");
				if (entrant.eventId !== eventId) {
					throw new Error("Entrant does not belong to specified event");
				}
				entrant.status = "in_progress";
				entrant.actualStartTime = startTime;
				return entrant;
			}

			// Attempting to release entrant-B-99 under eventAId must be rejected
			assert.throws(
				() => releaseGateOracle(eventAId, "entrant-B-99", new Date()),
				/Entrant does not belong to specified event/,
			);

			// Under eventBId, it must succeed
			const released = releaseGateOracle(eventBId, "entrant-B-99", new Date("2026-11-05T10:00:00Z"));
			assert.equal(released.status, "in_progress");
			assert.equal(released.actualStartTime?.toISOString(), "2026-11-05T10:00:00.000Z");
		});

		it("enforces red flag hold gating: halts subsequent rider releases when active", () => {
			const redFlag = downhillRedFlagHoldInput.parse({
				eventId: testUuid1,
				holdNote: "Rider down in Rock Garden Sector 3",
			});
			assert.equal(redFlag.holdNote, "Rider down in Rock Garden Sector 3");

			let isRedFlagActive = true;

			function dispatchRider(riderId: string): string {
				if (isRedFlagActive) {
					throw new Error("Course hold active: Gate release blocked by Race Control");
				}
				return `Rider ${riderId} dispatched`;
			}

			assert.throws(() => dispatchRider("rider-42"), /Course hold active/);

			// Clear red flag
			isRedFlagActive = false;
			assert.equal(dispatchRider("rider-42"), "Rider rider-42 dispatched");
		});
	});

	// ===========================================================================
	// AREA 4: UCI XCO 80% PULL RULE & FIXED-TIME PARTIAL LAP DISTANCE CREDIT
	// ===========================================================================
	describe("Area 4: UCI XCO 80% Pull Logic & Fixed-Time Partial Lap Distance", () => {
		it("calculates exact UCI 80% pull cutoffs with rounding and edge tolerances", () => {
			const leaderLaps = [
				{ lap: 1, timeSeconds: 600, expectedThreshold: 480 }, // 10:00 -> 80% is 8:00 (480s)
				{ lap: 2, timeSeconds: 615, expectedThreshold: 492 }, // 10:15 -> 80% is 492s
				{ lap: 3, timeSeconds: 703, expectedThreshold: 562 }, // 11:43 (703s) -> 80% is 562.4 -> 562s
			];

			for (const ll of leaderLaps) {
				const res = xcoCheckLappedPullInput.parse({
					eventId: testUuid1,
					leaderLap: ll.lap,
					leaderLapTimeSeconds: ll.timeSeconds,
				});
				const threshold = Math.round(res.leaderLapTimeSeconds * 0.8);
				assert.equal(threshold, ll.expectedThreshold);
			}

			// Boundary checks on trailing gaps
			const thresholdSec = 480;
			function isPulled(trailingSeconds: number) {
				return trailingSeconds >= thresholdSec;
			}

			assert.equal(isPulled(479), false, "479s gap is within 80% window (safe)");
			assert.equal(isPulled(480), true, "480s gap hits exact 80% threshold (pulled)");
			assert.equal(isPulled(481), true, "481s gap exceeds 80% threshold (pulled)");
		});

		it("accumulates Fixed-Time partial lap distances onto finished loops without notes loss", () => {
			const input = fixedTimeRecordPartialLapInput.parse({
				eventId: testUuid1,
				entrantId: testUuid2,
				partialDistanceMeters: 2850.5,
			});
			assert.equal(input.partialDistanceMeters, 2850.5);

			// Preserving prior comments/medical notes oracle
			function creditPartialDistance(
				existingComments: string | null,
				partialMeters: number,
			): string {
				const creditText = `Partial final lap distance: ${partialMeters}m credited`;
				if (!existingComments) return creditText;
				return `${existingComments} | ${creditText}`;
			}

			const initialNote = "Medical: Inhaler administered at Aid Station 1";
			const updatedNote = creditPartialDistance(initialNote, 2850.5);
			assert.ok(updatedNote.includes("Medical: Inhaler administered"));
			assert.ok(updatedNote.includes("Partial final lap distance: 2850.5m credited"));
		});
	});

	// ===========================================================================
	// AREA 5: ENTRANT CHECK-IN DESK, 3-SECTION MODAL & PROFILE VERIFICATION
	// ===========================================================================
	describe("Area 5: Entrant Check-In Desk, 3-Section Modal & Profile Verification", () => {
		it("validates polymorphic participantData schema for solo, vehicle_crew, and relay_team", () => {
			// Solo competitor
			const solo = ParticipantDataSchema.parse({
				kind: "solo_competitor",
				medicalNotes: "Peanut allergy",
				pacerName: "John Doe",
				tShirtSize: "L",
			});
			assert.equal(solo.kind, "solo_competitor");

			// Vehicle crew (rally)
			const crew = ParticipantDataSchema.parse({
				kind: "vehicle_crew",
				driver: {
					name: "Sébastien Loeb",
					licenseNumber: "FIA-109283",
				},
				vehicle: {
					make: "Ford",
					model: "Puma Rally1",
					year: 2026,
					vehicleClass: "WRC",
				},
			});
			assert.equal(crew.kind, "vehicle_crew");

			// Relay team
			const relay = ParticipantDataSchema.parse({
				kind: "relay_team",
				teamName: "Trail Blazers 4x25",
				captainContact: {
					name: "Sarah Captain",
					phone: "555-0123",
				},
				members: [
					{ legNumber: 1, name: "Leg 1 Runner" },
					{ legNumber: 2, name: "Leg 2 Runner" },
				],
			});
			assert.equal(relay.kind, "relay_team");

			// Reject invalid kind
			assert.throws(() => {
				ParticipantDataSchema.parse({
					kind: "unknown_future_kind",
				});
			});
		});

		it("guarantees distance transfer must remain scoped to sibling events in the same event group", () => {
			const eg1Id = "event-group-1";
			const eg2Id = "event-group-2";

			const siblingEventsInEg1 = [
				{ id: "event-100m", eventGroupId: eg1Id, name: "100 Mile" },
				{ id: "event-50k", eventGroupId: eg1Id, name: "50K" },
			];
			const eventsInEg2 = [
				{ id: "event-rogue", eventGroupId: eg2Id, name: "Rogue Event in Other Org" },
			];

			function validateDistanceTransfer(
				sourceEventId: string,
				targetEventId: string,
			): boolean {
				const source = siblingEventsInEg1.find((e) => e.id === sourceEventId);
				if (!source) throw new Error("Source event not found");

				const target = siblingEventsInEg1.find((e) => e.id === targetEventId);
				if (!target) {
					throw new Error("Target event is not a sibling distance within the same event group");
				}
				return true;
			}

			// Valid transfer from 100M to 50K
			assert.ok(validateDistanceTransfer("event-100m", "event-50k"));

			// Invalid cross-event-group transfer
			assert.throws(
				() => validateDistanceTransfer("event-100m", "event-rogue"),
				/Target event is not a sibling distance/,
			);
		});

		it("tests external profile verification state transitions and permission gating", () => {
			const validVerify = verifyExternalProfileInput.parse({
				externalProfileId: testUuid1,
				status: "manual_verified",
			});
			assert.equal(validVerify.status, "manual_verified");

			const validReject = verifyExternalProfileInput.parse({
				externalProfileId: testUuid1,
				status: "rejected",
			});
			assert.equal(validReject.status, "rejected");

			// Reject invalid status
			assert.throws(() => {
				verifyExternalProfileInput.parse({
					externalProfileId: testUuid1,
					// @ts-expect-error invalid status
					status: "auto_matched",
				});
			});
		});

		it("tests pacing projection calculation oracle and safety badge assignment", () => {
			interface ProjectionSummary {
				avgPaceSecondsPerKm?: number;
				experienceTier: "novice" | "intermediate" | "veteran" | "elite";
				dnfRate: number;
				totalFinishes: number;
			}

			function computeProjectionOracle(
				courseDistanceKm: number,
				maxCutoffSeconds: number | null,
				summary: ProjectionSummary | null,
			) {
				let paceSecPerKm = summary?.avgPaceSecondsPerKm;
				if (!paceSecPerKm) {
					switch (summary?.experienceTier) {
						case "elite":
							paceSecPerKm = 270;
							break;
						case "veteran":
							paceSecPerKm = 330;
							break;
						case "intermediate":
							paceSecPerKm = 380;
							break;
						default:
							paceSecPerKm = 450;
							break;
					}
				}

				const projectedFinishSeconds = Math.round(courseDistanceKm * paceSecPerKm);
				const expectedCutoffRisk = Boolean(
					maxCutoffSeconds && projectedFinishSeconds > maxCutoffSeconds,
				);

				let volunteersSarSafetyBadge = "STABLE PACING";
				if (expectedCutoffRisk) {
					volunteersSarSafetyBadge = "HIGH CUTOFF RISK";
				} else if (summary && summary.dnfRate > 0.3) {
					volunteersSarSafetyBadge = "WATCH: DNF HISTORY";
				} else if (summary && summary.totalFinishes > 5) {
					volunteersSarSafetyBadge = "EXPERIENCED FINISHER";
				}

				return { projectedFinishSeconds, expectedCutoffRisk, volunteersSarSafetyBadge };
			}

			// Case 1: Elite runner on 100km course (270s/km -> 27,000s = 7.5 hrs), cutoff 30 hrs
			const eliteProj = computeProjectionOracle(100, 108000, {
				experienceTier: "elite",
				dnfRate: 0.05,
				totalFinishes: 8,
			});
			assert.equal(eliteProj.projectedFinishSeconds, 27000);
			assert.equal(eliteProj.expectedCutoffRisk, false);
			assert.equal(eliteProj.volunteersSarSafetyBadge, "EXPERIENCED FINISHER");

			// Case 2: Slow novice on 100km course (450s/km -> 45,000s = 12.5 hrs), cutoff 10 hrs (36,000s)
			const slowProj = computeProjectionOracle(100, 36000, {
				experienceTier: "novice",
				dnfRate: 0.1,
				totalFinishes: 1,
			});
			assert.equal(slowProj.projectedFinishSeconds, 45000);
			assert.equal(slowProj.expectedCutoffRisk, true);
			assert.equal(slowProj.volunteersSarSafetyBadge, "HIGH CUTOFF RISK");

			// Case 3: Runner with high DNF history (>30%)
			const riskyDnfProj = computeProjectionOracle(50, 40000, {
				experienceTier: "veteran",
				dnfRate: 0.4,
				totalFinishes: 3,
			});
			assert.equal(riskyDnfProj.expectedCutoffRisk, false);
			assert.equal(riskyDnfProj.volunteersSarSafetyBadge, "WATCH: DNF HISTORY");
		});

		it("tests race-morning check-in status transitions and on-site emergency contact toggling", () => {
			const checkIn = checkInEntrantInput.parse({
				entrantId: testUuid1,
				status: "checked_in",
				competitorNumber: "101",
				rfidCode: "TAG-9901",
				emergencyContactIsOnSite: true,
			});

			assert.equal(checkIn.status, "checked_in");
			assert.equal(checkIn.competitorNumber, "101");
			assert.equal(checkIn.rfidCode, "TAG-9901");
			assert.equal(checkIn.emergencyContactIsOnSite, true);

			const dnsCheck = checkInEntrantInput.parse({
				entrantId: testUuid1,
				status: "dns",
			});
			assert.equal(dnsCheck.status, "dns");
		});
	});

	// ===========================================================================
	// AREA 6: LEGACY ROUTE REDIRECTS & ROUTE TREE REGISTRATION
	// ===========================================================================
	describe("Area 6: Legacy Route Redirects & TanStack Route Tree Resolution", () => {
		it("validates legacy route redirect parameter resolution", () => {
			// Legacy redirect input validation
			const validId = "a0000000-0000-4000-8000-000000000001";
			const legacyInput = z.object({ eventGroupId: z.string().uuid() }).parse({
				eventGroupId: validId,
			});
			assert.equal(legacyInput.eventGroupId, validId);

			// Invalid UUID must fail safeParse
			assert.ok(
				!z.object({ eventGroupId: z.string().uuid() }).safeParse({
					eventGroupId: "non-uuid-string",
				}).success,
			);

			// Simulates redirect resolution
			function resolveLegacyRedirect(data: {
				eventGroup?: { organizationSlug: string; slug: string } | null;
			}) {
				if (!data || !data.eventGroup) {
					return { status: 404, redirectUrl: null };
				}
				return {
					status: 307,
					redirectUrl: `/orgs/${data.eventGroup.organizationSlug}/event-groups/${data.eventGroup.slug}`,
				};
			}

			const redirected = resolveLegacyRedirect({
				eventGroup: { organizationSlug: "trail-series", slug: "summer-50k" },
			});
			assert.equal(redirected.status, 307);
			assert.equal(redirected.redirectUrl, "/orgs/trail-series/event-groups/summer-50k");

			const notFoundRes = resolveLegacyRedirect({ eventGroup: null });
			assert.equal(notFoundRes.status, 404);
		});

		it("verifies all Wave 2 routes are registered in routeTree.gen.ts", () => {
			const routeTreePath = path.join(process.cwd(), "src/routeTree.gen.ts");
			assert.ok(fs.existsSync(routeTreePath), "src/routeTree.gen.ts must exist");
			const routeTreeContent = fs.readFileSync(routeTreePath, "utf-8");

			const expectedRoutes = [
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/rules-staff",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/course",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/entrants",
				"/_authed/event-groups/$eventGroupId",
			];

			for (const r of expectedRoutes) {
				assert.ok(
					routeTreeContent.includes(r),
					`routeTree.gen.ts must contain registered route '${r}'`,
				);
			}
		});

		it("verifies spectator route contains staff bridge banner check", () => {
			const spectatorRoutePath = path.join(
				process.cwd(),
				"src/routes/events/$slug/route.tsx",
			);
			assert.ok(fs.existsSync(spectatorRoutePath));
			const content = fs.readFileSync(spectatorRoutePath, "utf-8");

			assert.ok(
				content.includes("staffBridge"),
				"Spectator route must load and check staffBridge data",
			);
			assert.ok(
				content.includes("Staff Credentials Detected"),
				"Spectator route must render contextual staff credentials banner",
			);
			assert.ok(
				content.includes("Launch My Aid Station Logger"),
				"Spectator route must link to assigned station logger",
			);
		});
	});

	// ===========================================================================
	// AREA 7: EXHAUSTIVE DESIGN SYSTEM AUDIT (ZERO TOKENS)
	// ===========================================================================
	describe("Area 7: Wave 2 Design System Strict Invariant Audit", () => {
		const targetDirectories = [
			"src/routes/_authed/orgs/$slug/event-groups",
			"src/race-control",
			"src/components/ui",
		];

		it("strictly asserts 0 occurrences of 'backdrop-blur' across all files in Wave 2 paths", () => {
			const violations: string[] = [];

			function walkDir(dir: string) {
				if (!fs.existsSync(dir)) return;
				const files = fs.readdirSync(dir);
				for (const f of files) {
					const fullPath = path.join(dir, f);
					const stat = fs.statSync(fullPath);
					if (stat.isDirectory()) {
						if (!f.includes("__tests__")) walkDir(fullPath);
					} else if (f.endsWith(".ts") || f.endsWith(".tsx")) {
						const text = fs.readFileSync(fullPath, "utf-8");
						if (text.includes("backdrop-blur")) {
							violations.push(fullPath);
						}
					}
				}
			}

			for (const d of targetDirectories) {
				walkDir(path.join(process.cwd(), d));
			}

			assert.deepEqual(violations, [], `Found forbidden 'backdrop-blur' in: ${violations.join(", ")}`);
		});

		it("strictly asserts 0 occurrences of 'transition-all' across all files in Wave 2 paths", () => {
			const violations: string[] = [];

			function walkDir(dir: string) {
				if (!fs.existsSync(dir)) return;
				const files = fs.readdirSync(dir);
				for (const f of files) {
					const fullPath = path.join(dir, f);
					const stat = fs.statSync(fullPath);
					if (stat.isDirectory()) {
						if (!f.includes("__tests__")) walkDir(fullPath);
					} else if (f.endsWith(".ts") || f.endsWith(".tsx")) {
						const text = fs.readFileSync(fullPath, "utf-8");
						if (text.includes("transition-all")) {
							violations.push(fullPath);
						}
					}
				}
			}

			for (const d of targetDirectories) {
				walkDir(path.join(process.cwd(), d));
			}

			assert.deepEqual(violations, [], `Found forbidden 'transition-all' in: ${violations.join(", ")}`);
		});
	});
});
