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
} from "../field-ops.shared.ts";
import { canViewMedicalData } from "../../race-control/race-control.shared.ts";

const testUuid1 = "b0000000-0000-4000-8000-000000000001";
const testUuid2 = "b0000000-0000-4000-8000-000000000002";
const testUuid3 = "b0000000-0000-4000-8000-000000000003";

describe("Wave 3: Field Operations, Volunteer Logger, Bib Grid & SAR Triage", () => {
	// ===========================================================================
	// 1. DAMERAU-LEVENSHTEIN TYPO-DEFENSE ENGINE
	// ===========================================================================
	describe("1. Damerau-Levenshtein Distance & Typo Defense", () => {
		it("returns 0 for identical strings", () => {
			assert.equal(damerauLevenshtein("142", "142"), 0);
			assert.equal(damerauLevenshtein("TWIN", "TWIN"), 0);
			assert.equal(damerauLevenshtein("", ""), 0);
		});

		it("detects single character adjacent transpositions (edit distance 1)", () => {
			// Critical for volunteers reversing digits under race-day fatigue
			assert.equal(damerauLevenshtein("142", "124"), 1);
			assert.equal(damerauLevenshtein("102", "120"), 1);
			assert.equal(damerauLevenshtein("42", "24"), 1);
			assert.equal(damerauLevenshtein("AB", "BA"), 1);
		});

		it("detects single insertion, deletion, and substitution", () => {
			assert.equal(damerauLevenshtein("142", "1423"), 1); // insertion
			assert.equal(damerauLevenshtein("142", "14"), 1); // deletion
			assert.equal(damerauLevenshtein("142", "143"), 1); // substitution
		});

		it("calculates compound distances for non-adjacent edits", () => {
			assert.equal(damerauLevenshtein("142", "999"), 3);
			assert.equal(damerauLevenshtein("142", "421"), 2);
		});

		it("suggests high-confidence typo recommendations from candidate bibs", () => {
			const candidates = ["124", "188", "204", "300"];
			// Entered '142', which is a transposition of registered '124'
			const rec = getTypoRecommendation("142", candidates);
			assert.ok(rec);
			assert.equal(rec.enteredBib, "142");
			assert.equal(rec.recommendedBib, "124");
			assert.equal(rec.distance, 1);
			assert.equal(rec.confidence, "high");
		});

		it("returns exact confidence when entered bib matches candidate exactly", () => {
			const candidates = ["124", "142", "188"];
			const rec = getTypoRecommendation("142", candidates);
			assert.ok(rec);
			assert.equal(rec.confidence, "exact");
			assert.equal(rec.distance, 0);
		});

		it("returns null when distance exceeds threshold", () => {
			const candidates = ["900", "950"];
			const rec = getTypoRecommendation("142", candidates, 1);
			assert.equal(rec, null);
		});
	});

	// ===========================================================================
	// 2. MT63 DIGITAL HAM RADIO TEXT BLOCK PARSER
	// ===========================================================================
	describe("2. MT63 Digital Amateur Radio Parser", () => {
		it("parses valid standard MT63 punch lines", () => {
			const rawBlock = `
				TWIN 142 IN 14:22:31 P
				TWIN 142 OUT 14:35:10
				HOPE 88 POINT 14:40:00
				WINFIELD 204 IN 15:00:00 +P
			`;

			const result = parseMt63Block(rawBlock);
			assert.equal(result.errors.length, 0);
			assert.equal(result.punches.length, 4);

			const p0 = result.punches[0];
			assert.equal(p0.stationCode, "TWIN");
			assert.equal(p0.competitorNumber, "142");
			assert.equal(p0.subSplitKind, "in");
			assert.equal(p0.timeOfDay, "14:22:31");
			assert.equal(p0.withPacer, true);

			const p1 = result.punches[1];
			assert.equal(p1.stationCode, "TWIN");
			assert.equal(p1.competitorNumber, "142");
			assert.equal(p1.subSplitKind, "out");
			assert.equal(p1.withPacer, false);

			const p2 = result.punches[2];
			assert.equal(p2.stationCode, "HOPE");
			assert.equal(p2.competitorNumber, "88");
			assert.equal(p2.subSplitKind, "point");

			const p3 = result.punches[3];
			assert.equal(p3.withPacer, true);
		});

		it("safely handles comments and blank lines", () => {
			const raw = `
				# Morning Ham Radio Transmission
				// Operator W7XYZ
				TWIN 101 IN 08:30:00
				
				# End of Burst
			`;
			const res = parseMt63Block(raw);
			assert.equal(res.punches.length, 1);
			assert.equal(res.punches[0].competitorNumber, "101");
			assert.equal(res.errors.length, 0);
		});

		it("reports line errors for malformed tokens or invalid split kinds", () => {
			const malformed = `
				TWIN 101
				TWIN 102 INVALID 10:00:00
				TWIN 103 IN 99:99:99
			`;
			const res = parseMt63Block(malformed);
			assert.equal(res.punches.length, 0);
			assert.equal(res.errors.length, 3);
			assert.ok(res.errors[0].reason.includes("Insufficient tokens"));
			assert.ok(res.errors[1].reason.includes("Invalid split kind"));
			assert.ok(res.errors[2].reason.includes("Malformed time"));
		});
	});

	// ===========================================================================
	// 3. DWELL & SEGMENT PACE CALCULATION ENGINES
	// ===========================================================================
	describe("3. Station Dwell Time & Segment Pace Calculations", () => {
		it("calculates dwell time in seconds between arrival and departure", () => {
			const inTime = new Date("2026-11-05T14:00:00.000Z");
			const outTime = new Date("2026-11-05T14:15:30.000Z"); // 15m 30s = 930s
			const dwell = calculateDwellSeconds(inTime, outTime);
			assert.equal(dwell, 930);
		});

		it("handles chronological inversion safely by clamping to 0", () => {
			const inTime = new Date("2026-11-05T14:30:00.000Z");
			const outTime = new Date("2026-11-05T14:00:00.000Z");
			const dwell = calculateDwellSeconds(inTime, outTime);
			assert.equal(dwell, 0);
		});

		it("returns null when either arrival or departure is missing", () => {
			assert.equal(calculateDwellSeconds(null, new Date()), null);
			assert.equal(calculateDwellSeconds(new Date(), null), null);
		});

		it("computes segment pace in seconds per kilometer", () => {
			// 10 km in 50 minutes (3000 seconds) -> 300 s/km (5:00/km)
			const pace = calculateSegmentPaceSecondsPerKm(10000, 3000);
			assert.equal(pace, 300);
		});

		it("handles zero and negative distances safely without division by zero", () => {
			assert.equal(calculateSegmentPaceSecondsPerKm(0, 3000), null);
			assert.equal(calculateSegmentPaceSecondsPerKm(-500, 3000), null);
			assert.equal(calculateSegmentPaceSecondsPerKm(1000, 0), null);
		});
	});

	// ===========================================================================
	// 4. TSD REGULARITY MOTORSPORT PENALTY ENGINE
	// ===========================================================================
	describe("4. TSD Regularity Penalty Calculations", () => {
		it("penalizes early arrival past checkpoints at 2.0x factor", () => {
			// Ideal: 600s. Actual: 570s (30s early) -> 30 * 2.0 = 60 penalty points
			const penalty = calculateTsdPenalty(570, 600, {
				earlyPenaltyFactor: 2.0,
				latePenaltyFactor: 1.0,
			});
			assert.equal(penalty.isEarly, true);
			assert.equal(penalty.isLate, false);
			assert.equal(penalty.deviationSeconds, -30);
			assert.equal(penalty.penaltyPoints, 60);
		});

		it("penalizes late arrival past checkpoints at 1.0x factor", () => {
			// Ideal: 600s. Actual: 630s (30s late) -> 30 * 1.0 = 30 penalty points
			const penalty = calculateTsdPenalty(630, 600, {
				earlyPenaltyFactor: 2.0,
				latePenaltyFactor: 1.0,
			});
			assert.equal(penalty.isEarly, false);
			assert.equal(penalty.isLate, true);
			assert.equal(penalty.deviationSeconds, 30);
			assert.equal(penalty.penaltyPoints, 30);
		});

		it("accrues 0 points within the grace period window", () => {
			const penalty = calculateTsdPenalty(602, 600, {
				gracePeriodSeconds: 3.0,
			});
			assert.equal(penalty.isExact, true);
			assert.equal(penalty.penaltyPoints, 0);
		});
	});

	// ===========================================================================
	// 5. ZOD SCHEMA CONTRACTS & MUTATION VALIDATORS
	// ===========================================================================
	describe("5. Zod Input Schema Validations", () => {
		it("validates recordStationSplitInput with defaults", () => {
			const parsed = recordStationSplitInput.parse({
				eventGroupId: testUuid1,
				competitorNumber: "142",
				timingPointCode: "TWIN",
				subSplitKind: "in",
				recordedTimeUtc: "2026-11-05T14:30:00Z",
			});
			assert.equal(parsed.competitorNumber, "142");
			assert.equal(parsed.timingPointCode, "TWIN");
			assert.equal(parsed.subSplitKind, "in");
			assert.equal(parsed.source, "manual_web_entry");
			assert.equal(parsed.withPacer, false);
			assert.ok(parsed.recordedTimeUtc instanceof Date);
		});

		it("validates quickActionSplitInput for 1-tap actions", () => {
			const parsedIn = quickActionSplitInput.parse({
				eventGroupId: testUuid1,
				timingPointId: testUuid2,
				entrantId: testUuid3,
				action: "record_in",
			});
			assert.equal(parsedIn.action, "record_in");
			assert.ok(parsedIn.recordedTimeUtc instanceof Date);

			const parsedDrop = quickActionSplitInput.parse({
				eventGroupId: testUuid1,
				timingPointId: testUuid2,
				entrantId: testUuid3,
				action: "stopped_here",
			});
			assert.equal(parsedDrop.action, "stopped_here");
		});

		it("validates reportRunnerDropInput distinguishing dnf vs retired", () => {
			const dnfDrop = reportRunnerDropInput.parse({
				eventGroupId: testUuid1,
				entrantId: testUuid2,
				timingPointId: testUuid3,
				dropKind: "dnf",
				dropReason: "hypothermia",
			});
			assert.equal(dnfDrop.dropKind, "dnf");
			assert.equal(dnfDrop.dropReason, "hypothermia");

			const rocDrop = reportRunnerDropInput.parse({
				eventGroupId: testUuid1,
				entrantId: testUuid2,
				dropKind: "retired",
				dropLocationDescription: "Mile 35 near creek",
			});
			assert.equal(rocDrop.dropKind, "retired");
			assert.equal(rocDrop.dropLocationDescription, "Mile 35 near creek");
		});

		it("validates simulateTestPulseInput with defaults", () => {
			const pulse = simulateTestPulseInput.parse({
				eventGroupId: testUuid1,
				timingPointCode: "FINISH",
				competitorNumber: "101",
			});
			assert.equal(pulse.subSplitKind, "point");
			assert.equal(pulse.source, "optical_photocell");
		});
	});

	// ===========================================================================
	// 6. RBAC MEDICAL ACCESS CONTROL & PII GATING
	// ===========================================================================
	describe("6. Medical Clearance & Triage Notes Access Gating", () => {
		it("grants medical access to Organization Owner, Admin, and Director", () => {
			assert.equal(canViewMedicalData({ orgRoles: ["owner"], staffRoles: [] }), true);
			assert.equal(canViewMedicalData({ orgRoles: ["admin"], staffRoles: [] }), true);
			assert.equal(canViewMedicalData({ orgRoles: ["director"], staffRoles: [] }), true);
		});

		it("grants medical access to Medical Lead and Official staff roles", () => {
			assert.equal(canViewMedicalData({ orgRoles: [], staffRoles: ["medical"] }), true);
			assert.equal(canViewMedicalData({ orgRoles: [], staffRoles: ["official"] }), true);
		});

		it("strictly denies medical access to Volunteers, Checkpoint Captains, and Members", () => {
			assert.equal(canViewMedicalData({ orgRoles: ["member"], staffRoles: [] }), false);
			assert.equal(canViewMedicalData({ orgRoles: [], staffRoles: ["volunteer"] }), false);
			assert.equal(
				canViewMedicalData({ orgRoles: [], staffRoles: ["checkpoint_captain"] }),
				false,
			);
			assert.equal(canViewMedicalData({ orgRoles: [], staffRoles: [] }), false);
		});
	});

	// ===========================================================================
	// 7. DESIGN SYSTEM & KIOSK FULL-SCREEN INVARIANT AUDIT
	// ===========================================================================
	describe("7. Design System Invariants (Zero blur, Zero transition-all, Kiosk)", () => {
		const wave3Files = [
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

		it("asserts exactly 0 occurrences of 'backdrop-blur' across all Wave 3 files", () => {
			for (const rel of wave3Files) {
				const fullPath = path.join(process.cwd(), rel);
				if (fs.existsSync(fullPath)) {
					const content = fs.readFileSync(fullPath, "utf-8");
					assert.equal(
						content.includes("backdrop-blur"),
						false,
						`Forbidden token 'backdrop-blur' found in ${rel}`,
					);
				}
			}
		});

		it("asserts exactly 0 occurrences of 'transition-all' across all Wave 3 files", () => {
			for (const rel of wave3Files) {
				const fullPath = path.join(process.cwd(), rel);
				if (fs.existsSync(fullPath)) {
					const content = fs.readFileSync(fullPath, "utf-8");
					assert.equal(
						content.includes("transition-all"),
						false,
						`Forbidden token 'transition-all' found in ${rel}`,
					);
				}
			}
		});

		it("verifies kiosk mode suppression of Header and Footer on /logger route in __root.tsx", () => {
			const rootPath = path.join(process.cwd(), "src/routes/__root.tsx");
			assert.ok(fs.existsSync(rootPath), "src/routes/__root.tsx must exist");
			const rootContent = fs.readFileSync(rootPath, "utf-8");
			assert.ok(
				rootContent.includes("isLogger"),
				"__root.tsx must check for isLogger to suppress header/footer in kiosk mode",
			);
			assert.ok(
				rootContent.includes("endsWith('/logger')") ||
					rootContent.includes('endsWith("/logger")'),
				"__root.tsx must detect pathname ending with /logger",
			);
		});

		it("verifies all 6 new Wave 3 routes are registered in routeTree.gen.ts", () => {
			const routeTreePath = path.join(process.cwd(), "src/routeTree.gen.ts");
			assert.ok(fs.existsSync(routeTreePath), "src/routeTree.gen.ts must exist");
			const treeContent = fs.readFileSync(routeTreePath, "utf-8");

			const expectedRoutes = [
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/stations/",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/stations/$timingPointId",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/logger",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/sar",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/sar",
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/raw-stream",
			];

			for (const r of expectedRoutes) {
				assert.ok(
					treeContent.includes(r),
					`routeTree.gen.ts must contain registered route '${r}'`,
				);
			}
		});
	});
});
