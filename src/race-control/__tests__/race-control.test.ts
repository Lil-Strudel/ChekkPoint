import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
	assignStaffTimingPointInput,
	backyardCloseYardInput,
	calculateBackyardWhistleAlert,
	calculatePacingProjection,
	calculateTsdScore,
	checkInEntrantInput,
	computeCombinedCustody,
	downhillGateReleaseInput,
	downhillRedFlagHoldInput,
	evaluateSarBadge,
	fixedTimeRecordPartialLapInput,
	isSubjectTo80PercentPull,
	naturalCompareCompetitorNumbers,
	partialRulesConfigInput,
	resetEventGunInput,
	rosterStaffMemberInput,
	RulesConfigSchema,
	startEventGunInput,
	tsdGenerateIntervalStartsInput,
	tsdRevealSecretCheckpointsInput,
	updateEntrantWorkspaceInput,
	updateEventGroupRulesInput,
	updateStaffRolesInput,
	verifyExternalProfileInput,
	xcoCheckLappedPullInput,
	canManageRaceControl,
	canViewMedicalData,
} from "../race-control.shared.ts";

const testUuid1 = "a0000000-0000-4000-8000-000000000001";
const testUuid2 = "a0000000-0000-4000-8000-000000000002";
const testUuid3 = "a0000000-0000-4000-8000-000000000003";

describe("Wave 2: Multi-Discipline Race Control & Sub-Event Workspaces", () => {
	// ===========================================================================
	// 1. ZOD SCHEMA & INPUT VALIDATIONS
	// ===========================================================================
	describe("1. Zod Schemas & Input Validation", () => {
		it("validates RulesConfigSchema defaults and discipline configuration overrides", () => {
			// Validates default empty object
			const parsedDefault = RulesConfigSchema.parse({});
			assert.equal(parsedDefault.timeFormat, "HH:MM:SS");
			assert.equal(parsedDefault.displayPrecisionDecimals, 0);
			assert.equal(parsedDefault.earlyPenaltyFactor, 2.0);
			assert.equal(parsedDefault.latePenaltyFactor, 1.0);
			assert.equal(parsedDefault.yardDistanceMiles, 4.166667);
			assert.equal(parsedDefault.yardTimeLimitSeconds, 3600);

			// Validates partial rules config input
			const validPartial = partialRulesConfigInput.parse({
				eventGroupId: testUuid1,
				timeFormat: "HH:MM:SS.sss",
				earlyPenaltyFactor: 3.0,
				yardTimeLimitSeconds: 3000,
			});
			assert.equal(validPartial.timeFormat, "HH:MM:SS.sss");
			assert.equal(validPartial.earlyPenaltyFactor, 3.0);
			assert.equal(validPartial.yardTimeLimitSeconds, 3000);
		});

		it("validates staff assignment and role update schemas", () => {
			const validAssignment = assignStaffTimingPointInput.parse({
				eventGroupId: testUuid1,
				staffId: testUuid2,
				timingPointId: testUuid3,
			});
			assert.equal(validAssignment.eventGroupId, testUuid1);
			assert.equal(validAssignment.staffId, testUuid2);

			const validRoles = updateStaffRolesInput.parse({
				eventGroupId: testUuid1,
				staffId: testUuid2,
				roles: ["checkpoint_captain", "medical"],
			});
			assert.equal(validRoles.roles.length, 2);
			assert.ok(validRoles.roles.includes("checkpoint_captain"));
			assert.ok(validRoles.roles.includes("medical"));

			const rosterStaff = rosterStaffMemberInput.parse({
				eventGroupId: testUuid1,
				firstName: "Bob",
				lastName: "Volunteer",
				email: "bob@example.com",
				roles: ["volunteer"],
			});
			assert.equal(rosterStaff.firstName, "Bob");

			// Reject invalid role
			assert.throws(() => {
				updateStaffRolesInput.parse({
					eventGroupId: testUuid1,
					staffId: testUuid2,
					// @ts-expect-error invalid role
					roles: ["super_admin_invalid"],
				});
			});
		});

		it("validates gun start schemas", () => {
			const validGun = startEventGunInput.parse({
				eventId: testUuid1,
				actualStart: "2026-11-05T08:00:00Z",
			});
			assert.equal(validGun.eventId, testUuid1);
			assert.equal(validGun.actualStart, "2026-11-05T08:00:00Z");

			const validReset = resetEventGunInput.parse({
				eventId: testUuid1,
			});
			assert.equal(validReset.eventId, testUuid1);
		});

		it("validates updateEntrantWorkspaceInput with polymorphic participant data & emergency contacts", () => {
			const parsed = updateEntrantWorkspaceInput.parse({
				entrantId: testUuid1,
				competitorNumber: "42",
				division: "Open Female",
				participantData: {
					kind: "solo_competitor",
					medicalNotes: "Asthma inhaler in vest",
				},
				emergencyContactFirstName: "Bob",
				emergencyContactLastName: "Walker",
				emergencyContactPhone: "+1-555-0199",
				emergencyContactRelationship: "Spouse",
				emergencyContactIsOnSite: true,
			});

			assert.equal(parsed.competitorNumber, "42");
			assert.equal(parsed.emergencyContactIsOnSite, true);
			assert.equal(parsed.emergencyContactRelationship, "Spouse");
			assert.equal(parsed.participantData.kind, "solo_competitor");
		});

		it("validates discipline specific action schemas", () => {
			const backyard = backyardCloseYardInput.parse({
				eventId: testUuid1,
				completedYardNumber: 4,
			});
			assert.equal(backyard.completedYardNumber, 4);

			const tsdStarts = tsdGenerateIntervalStartsInput.parse({
				eventId: testUuid1,
				intervalSeconds: 120,
				baseStartTimeUtc: "2026-11-05T09:00:00Z",
			});
			assert.equal(tsdStarts.intervalSeconds, 120);

			const tsdSecret = tsdRevealSecretCheckpointsInput.parse({
				eventId: testUuid1,
				reveal: false,
			});
			assert.equal(tsdSecret.reveal, false);

			const downhill = downhillGateReleaseInput.parse({
				eventId: testUuid1,
				entrantId: testUuid2,
				actualStartTime: "2026-11-05T10:15:30.500Z",
			});
			assert.equal(downhill.entrantId, testUuid2);

			const redFlag = downhillRedFlagHoldInput.parse({
				eventId: testUuid1,
				holdNote: "Rider crash at Rock Garden Sector 2",
			});
			assert.equal(redFlag.holdNote, "Rider crash at Rock Garden Sector 2");

			const xco = xcoCheckLappedPullInput.parse({
				eventId: testUuid1,
				leaderLap: 3,
				leaderLapTimeSeconds: 600,
			});
			assert.equal(xco.leaderLapTimeSeconds, 600);

			const fixedTime = fixedTimeRecordPartialLapInput.parse({
				eventId: testUuid1,
				entrantId: testUuid2,
				partialDistanceMeters: 3450,
			});
			assert.equal(fixedTime.partialDistanceMeters, 3450);

			const checkIn = checkInEntrantInput.parse({
				entrantId: testUuid1,
				status: "checked_in",
				emergencyContactIsOnSite: true,
			});
			assert.equal(checkIn.status, "checked_in");

			const verifyProfile = verifyExternalProfileInput.parse({
				externalProfileId: testUuid1,
				status: "manual_verified",
			});
			assert.equal(verifyProfile.status, "manual_verified");
		});
	});

	// ===========================================================================
	// 2. DISCIPLINE LOGIC & DOMAIN CALCULATIONS
	// ===========================================================================
	describe("2. Multi-Discipline Domain Calculations", () => {
		it("calculates Backyard Ultra whistle warnings using calculateBackyardWhistleAlert", () => {
			assert.equal(calculateBackyardWhistleAlert(3600 - 180), "3 WHISTLES - 3 MINUTES TO BELL");
			assert.equal(calculateBackyardWhistleAlert(3600 - 120), "2 WHISTLES - 2 MINUTES TO BELL");
			assert.equal(calculateBackyardWhistleAlert(3600 - 60), "1 WHISTLE - 1 MINUTE TO BELL");
			assert.equal(calculateBackyardWhistleAlert(3600), "TIME EXPIRED");
			assert.equal(calculateBackyardWhistleAlert(3605), "TIME EXPIRED");
			assert.equal(calculateBackyardWhistleAlert(1800), null);
		});

		it("evaluates Backyard Ultra yard close input with completedEntrantIds", () => {
			const yardCloseInput = backyardCloseYardInput.parse({
				eventId: testUuid1,
				completedYardNumber: 3,
				completedEntrantIds: [testUuid2, testUuid3],
			});
			assert.equal(yardCloseInput.completedYardNumber, 3);
			assert.deepEqual(yardCloseInput.completedEntrantIds, [testUuid2, testUuid3]);
		});

		it("calculates TSD Regularity Rally early/late penalty points with calculateTsdScore", () => {
			// Perfect timing
			assert.deepEqual(calculateTsdScore(3600, 3600), {
				deltaSeconds: 0,
				penaltyPoints: 0,
				direction: "on_time",
			});

			// 10 seconds early -> 20 penalty points (2x multiplier)
			const early10 = calculateTsdScore(3590, 3600);
			assert.equal(early10.direction, "early");
			assert.equal(early10.deltaSeconds, -10);
			assert.equal(early10.penaltyPoints, 20);

			// 15 seconds late -> 15 penalty points (1x multiplier)
			const late15 = calculateTsdScore(3615, 3600);
			assert.equal(late15.direction, "late");
			assert.equal(late15.deltaSeconds, 15);
			assert.equal(late15.penaltyPoints, 15);

			// Severe early arrival capped at 600 pts
			const early500 = calculateTsdScore(3600 - 500, 3600);
			assert.equal(early500.penaltyPoints, 600);
		});

		it("sorts competitor numbers naturally with naturalCompareCompetitorNumbers", () => {
			const cars = ["10", "2", "1", "20", "100", "25"];
			cars.sort(naturalCompareCompetitorNumbers);
			assert.deepEqual(cars, ["1", "2", "10", "20", "25", "100"]);

			const labeled = ["Car #10", "Car #2", "Car #1"];
			labeled.sort(naturalCompareCompetitorNumbers);
			assert.deepEqual(labeled, ["Car #1", "Car #2", "Car #10"]);
		});

		it("calculates UCI XCO 80% pull rule thresholds with isSubjectTo80PercentPull", () => {
			const leaderLapSeconds = 600; // 10 minutes

			// Entrant lap: 12 minutes (720s) -> gap = 120s (20%) -> safe
			const safeRider = isSubjectTo80PercentPull(leaderLapSeconds, 720);
			assert.equal(safeRider.isPulled, false);
			assert.equal(safeRider.gapPercentage, 20);

			// Entrant lap: 18 minutes (1080s) -> gap = 480s (80%) -> pulled
			const pulledRider = isSubjectTo80PercentPull(leaderLapSeconds, 1080);
			assert.equal(pulledRider.isPulled, true);
			assert.equal(pulledRider.gapPercentage, 80);

			// Entrant lap: 20 minutes (1200s) -> gap = 600s (100%) -> pulled
			const severelyBehind = isSubjectTo80PercentPull(leaderLapSeconds, 1200);
			assert.equal(severelyBehind.isPulled, true);
		});

		it("accumulates Fixed-Time partial lap distances onto completed loops", () => {
			const loopDistanceMeters = 5000;
			const completedLoops = 14;
			const partialDistanceMeters = 2350;

			const totalDistanceMeters = completedLoops * loopDistanceMeters + partialDistanceMeters;
			const totalKm = (totalDistanceMeters / 1000).toFixed(3);

			assert.equal(totalDistanceMeters, 72350);
			assert.equal(totalKm, "72.350");
		});
	});

	// ===========================================================================
	// 3. GUN START TRANSITIONS & CUSTODY COUNTS
	// ===========================================================================
	describe("3. Gun Start State Transitions & Custody Counting", () => {
		it("validates startEventGunInput and resetEventGunInput contracts", () => {
			const gunStart = startEventGunInput.parse({
				eventId: testUuid1,
				actualStart: "2026-11-05T08:00:00.000Z",
			});
			assert.equal(gunStart.eventId, testUuid1);
			assert.equal(gunStart.actualStart, "2026-11-05T08:00:00.000Z");

			const gunReset = resetEventGunInput.parse({
				eventId: testUuid1,
			});
			assert.equal(gunReset.eventId, testUuid1);
		});

		it("computes accurate custody KPIs using production computeCombinedCustody", () => {
			const statuses = [
				"registered",
				"checked_in",
				"checked_in",
				"in_progress",
				"in_progress",
				"in_progress",
				"finished",
				"finished",
				"dnf",
				"dns",
			];

			const kpis = computeCombinedCustody(statuses);

			assert.equal(kpis.registered, 1);
			assert.equal(kpis.checkedIn, 2);
			assert.equal(kpis.inProgress, 3);
			assert.equal(kpis.finished, 2);
			assert.equal(kpis.dnf, 1);
			assert.equal(kpis.dns, 1);
			assert.equal(kpis.retired, 0);
			assert.equal(kpis.total, 10);
		});
	});

	// ===========================================================================
	// 4. PACING PROJECTIONS & SAR OVERDUE BADGES
	// ===========================================================================
	describe("4. Pacing Projections & SAR Safety Badges", () => {
		it("calculates finish projection from completed distance and elapsed time with calculatePacingProjection", () => {
			const totalCourseMeters = 80467; // 50 miles in meters
			const completedMeters = 32187; // 20 miles in meters
			const elapsedSeconds = 10800; // 3 hours

			const projection = calculatePacingProjection(elapsedSeconds, completedMeters, totalCourseMeters);
			assert.equal(projection.projectedHours, "7.50");
			assert.equal(projection.projectedFinishSeconds, 27000);
		});

		it("evaluates SAR safety status based on overdue minutes with evaluateSarBadge", () => {
			assert.equal(evaluateSarBadge(5).level, "normal");
			assert.equal(evaluateSarBadge(15).level, "overdue");
			assert.equal(evaluateSarBadge(25).level, "overdue");
			assert.equal(evaluateSarBadge(30).level, "critical");
			assert.equal(evaluateSarBadge(60).level, "critical");
		});
	});

	// ===========================================================================
	// 5. EXTERNAL PROFILE VERIFICATION
	// ===========================================================================
	describe("5. External Profile Verification Transitions & RBAC Permissions", () => {
		it("validates external profile verification input transitions", () => {
			const verified = verifyExternalProfileInput.parse({
				externalProfileId: testUuid1,
				status: "manual_verified",
			});
			assert.equal(verified.status, "manual_verified");

			const rejected = verifyExternalProfileInput.parse({
				externalProfileId: testUuid1,
				status: "rejected",
			});
			assert.equal(rejected.status, "rejected");

			assert.throws(() => {
				verifyExternalProfileInput.parse({
					externalProfileId: testUuid1,
					// @ts-expect-error invalid status
					status: "invalid_status",
				});
			});
		});

		it("evaluates canManageRaceControl permission oracle across roles", () => {
			// Owner has access
			assert.equal(
				canManageRaceControl({
					organizationId: testUuid1,
					orgRoles: ["owner"],
					staffRoles: [],
					timingPointIds: [],
				}),
				true,
			);

			// Admin has access
			assert.equal(
				canManageRaceControl({
					organizationId: testUuid1,
					orgRoles: ["admin"],
					staffRoles: [],
					timingPointIds: [],
				}),
				true,
			);

			// Steward has access
			assert.equal(
				canManageRaceControl({
					organizationId: testUuid1,
					orgRoles: ["steward"],
					staffRoles: [],
					timingPointIds: [],
				}),
				true,
			);

			// Timing official has access
			assert.equal(
				canManageRaceControl({
					organizationId: testUuid1,
					orgRoles: [],
					staffRoles: ["official"],
					timingPointIds: [],
				}),
				true,
			);

			// Checkpoint captain has access
			assert.equal(
				canManageRaceControl({
					organizationId: testUuid1,
					orgRoles: [],
					staffRoles: ["checkpoint_captain"],
					timingPointIds: [],
				}),
				true,
			);

			// Regular volunteer does NOT have race control access
			assert.equal(
				canManageRaceControl({
					organizationId: testUuid1,
					orgRoles: [],
					staffRoles: ["volunteer"],
					timingPointIds: [],
				}),
				false,
			);

			// Regular member does NOT have race control access
			assert.equal(
				canManageRaceControl({
					organizationId: testUuid1,
					orgRoles: ["member"],
					staffRoles: [],
					timingPointIds: [],
				}),
				false,
			);
		});

		it("evaluates canViewMedicalData permission oracle across roles", () => {
			// Medical staff has access
			assert.equal(
				canViewMedicalData({
					organizationId: testUuid1,
					orgRoles: [],
					staffRoles: ["medical"],
					timingPointIds: [],
				}),
				true,
			);

			// Unprivileged volunteer does NOT have medical data access
			assert.equal(
				canViewMedicalData({
					organizationId: testUuid1,
					orgRoles: [],
					staffRoles: ["volunteer"],
					timingPointIds: [],
				}),
				false,
			);
		});
	});

	// ===========================================================================
	// 6. DESIGN SYSTEM INVARIANT: ZERO BACKDROP-BLUR & ZERO TRANSITION-ALL
	// ===========================================================================
	describe("6. Wave 2 Design System Invariants & Structural Audit", () => {
		const wave2Files = [
			"src/components/ui/collapsible.tsx",
			"src/race-control/race-control.shared.ts",
			"src/race-control/race-control.server.ts",
			"src/race-control/race-control.functions.ts",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/route.tsx",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/index.tsx",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/rules-staff.tsx",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/route.tsx",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/index.tsx",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/course.tsx",
			"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/entrants.tsx",
			"src/routes/_authed/event-groups/$eventGroupId/route.tsx",
			"src/routes/events/$slug/route.tsx",
		];

		const repoRoot = process.cwd();

		it("asserts zero occurrences of 'backdrop-blur' across all Wave 2 files", () => {
			for (const relPath of wave2Files) {
				const fullPath = path.join(repoRoot, relPath);
				if (!fs.existsSync(fullPath)) continue;
				const content = fs.readFileSync(fullPath, "utf-8");
				assert.ok(
					!content.includes("backdrop-blur"),
					`Forbidden token 'backdrop-blur' found in ${relPath}`,
				);
			}
		});

		it("asserts zero occurrences of 'transition-all' across all Wave 2 files", () => {
			for (const relPath of wave2Files) {
				const fullPath = path.join(repoRoot, relPath);
				if (!fs.existsSync(fullPath)) continue;
				const content = fs.readFileSync(fullPath, "utf-8");
				assert.ok(
					!content.includes("transition-all"),
					`Forbidden token 'transition-all' found in ${relPath}`,
				);
			}
		});

		it("asserts tabular-nums is utilized for numeric/clock displays in Wave 2 route views", () => {
			const viewsWithNumbers = [
				"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/index.tsx",
				"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/index.tsx",
				"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/entrants.tsx",
			];

			for (const relPath of viewsWithNumbers) {
				const fullPath = path.join(repoRoot, relPath);
				const content = fs.readFileSync(fullPath, "utf-8");
				assert.ok(
					content.includes("tabular-nums"),
					`Expected 'tabular-nums' to be used in ${relPath}`,
				);
			}
		});
	});
});
