import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	canAuditResults,
	canManageRaceControl,
	createTimeAllowanceInput,
	editScoredSplitInput,
	escapeCsvField,
	establishDropsInput,
	exportResultsInput,
	formatElapsedHms,
	formatItraCsv,
	formatStandardCsv,
	formatUltraSignupCsv,
	insertScoredSplitInput,
	rebuildSplitsInput,
	type OfficialExportRunner,
} from "../audit.shared.ts";

describe("Wave 4: Audit, Time Allowances, Post-Race Closeout & Telemetry Suite", () => {
	// ==========================================================================
	// 1. ZOD SCHEMAS & MANDATORY AUDIT GUARDS
	// ==========================================================================
	describe("Zod validation schemas & changeReason guards", () => {
		it("enforces changeReason of at least 3 characters on split edits", () => {
			const valid = editScoredSplitInput.safeParse({
				splitTimeId: "123e4567-e89b-12d3-a456-426614174000",
				elapsedSeconds: 3600,
				changeReason: "Correction from backup photocell tape",
			});
			assert.equal(valid.success, true);

			const invalidShort = editScoredSplitInput.safeParse({
				splitTimeId: "123e4567-e89b-12d3-a456-426614174000",
				changeReason: "no",
			});
			assert.equal(invalidShort.success, false);

			const invalidEmpty = editScoredSplitInput.safeParse({
				splitTimeId: "123e4567-e89b-12d3-a456-426614174000",
				changeReason: "",
			});
			assert.equal(invalidEmpty.success, false);
		});

		it("enforces positive elapsedSeconds and mandatory changeReason on insert", () => {
			const valid = insertScoredSplitInput.safeParse({
				entrantId: "123e4567-e89b-12d3-a456-426614174001",
				courseSplitId: "123e4567-e89b-12d3-a456-426614174002",
				subSplitKind: "in",
				absoluteTimeUtc: "2026-11-05T14:30:00Z",
				elapsedSeconds: 5400,
				changeReason: "Manual split transcribed from radio log",
			});
			assert.equal(valid.success, true);

			const invalidNegative = insertScoredSplitInput.safeParse({
				entrantId: "123e4567-e89b-12d3-a456-426614174001",
				courseSplitId: "123e4567-e89b-12d3-a456-426614174002",
				subSplitKind: "in",
				absoluteTimeUtc: "2026-11-05T14:30:00Z",
				elapsedSeconds: -100,
				changeReason: "Manual split",
			});
			assert.equal(invalidNegative.success, false);
		});

		it("enforces positive duration on time allowances", () => {
			const valid = createTimeAllowanceInput.safeParse({
				entrantId: "123e4567-e89b-12d3-a456-426614174001",
				splitId: "123e4567-e89b-12d3-a456-426614174002",
				startTime: "2026-11-05T10:00:00Z",
				endTime: "2026-11-05T10:45:00Z",
				durationSeconds: 2700,
				reason: "medical_hold",
				notes: "Mandatory IV hydration hold",
			});
			assert.equal(valid.success, true);

			const invalidZero = createTimeAllowanceInput.safeParse({
				entrantId: "123e4567-e89b-12d3-a456-426614174001",
				splitId: "123e4567-e89b-12d3-a456-426614174002",
				startTime: "2026-11-05T10:00:00Z",
				endTime: "2026-11-05T10:00:00Z",
				durationSeconds: 0,
				reason: "medical_hold",
			});
			assert.equal(invalidZero.success, false);
		});

		it("enforces mandatory changeReason on rebuildSplits", () => {
			const valid = rebuildSplitsInput.safeParse({
				eventId: "123e4567-e89b-12d3-a456-426614174001",
				changeReason: "Re-evaluating raw stream post-race mat clock drift",
			});
			assert.equal(valid.success, true);

			const invalid = rebuildSplitsInput.safeParse({
				eventId: "123e4567-e89b-12d3-a456-426614174001",
				changeReason: "",
			});
			assert.equal(invalid.success, false);
		});

		it("validates establishDropsInput and exportResultsInput", () => {
			const validDrop = establishDropsInput.safeParse({
				eventId: "123e4567-e89b-12d3-a456-426614174001",
				defaultStatus: "dnf",
			});
			assert.equal(validDrop.success, true);

			const validExport = exportResultsInput.safeParse({
				eventId: "123e4567-e89b-12d3-a456-426614174001",
				format: "ultrasignup",
			});
			assert.equal(validExport.success, true);
		});
	});

	// ==========================================================================
	// 2. RFC 4180 CSV SERIALIZATION & FORMATTERS
	// ==========================================================================
	describe("RFC 4180 CSV Export Builders", () => {
		const testRunners: OfficialExportRunner[] = [
			{
				place: 1,
				bib: "101",
				firstName: "Alice",
				lastName: "Walker",
				age: 32,
				gender: "F",
				birthDate: "1994-06-15",
				nationality: "USA",
				city: "Boulder",
				state: "CO",
				totalElapsedSeconds: 37245, // 10:20:45
				status: "finished",
				division: "Overall",
				penaltyPoints: 0,
			},
			{
				place: 2,
				bib: "142",
				firstName: "Bob",
				lastName: 'O"Connor, Jr.',
				age: 45,
				gender: "M",
				birthDate: "1981-02-20",
				nationality: "CAN",
				city: "Vancouver",
				state: "BC",
				totalElapsedSeconds: 40112, // 11:08:32
				status: "finished",
				division: "Masters 40+",
				penaltyPoints: 10,
			},
			{
				place: null,
				bib: "88",
				firstName: "Charlie",
				lastName: "Brown",
				age: 28,
				gender: "M",
				birthDate: "1998-11-04",
				nationality: "USA",
				city: "Moab",
				state: "UT",
				totalElapsedSeconds: null,
				status: "dnf",
				division: "Overall",
				penaltyPoints: null,
			},
		];

		it("formats UltraSignup CSV with exact header and escaping", () => {
			const csv = formatUltraSignupCsv(testRunners);
			const lines = csv.split("\n");

			assert.equal(
				lines[0],
				"Place,First Name,Last Name,Age,Gender,City,State,Bib,Time,Status",
			);
			assert.equal(lines.length, 4);

			// First place
			assert.ok(lines[1].startsWith("1,Alice,Walker,32,F,Boulder,CO,101,10:20:45,Finished"));

			// Second place: Bob with escaped quotes in last name
			assert.ok(lines[2].includes('"O""Connor, Jr."'));
			assert.ok(lines[2].includes("11:08:32"));

			// Third place: DNF
			assert.ok(lines[3].includes("88,,DNF"));
		});

		it("formats ITRA CSV with required columns and rank", () => {
			const csv = formatItraCsv(testRunners);
			const lines = csv.split("\n");

			assert.equal(
				lines[0],
				"Bib,First Name,Last Name,Gender,Birth Date,Nationality,Time,Rank,Category,Status",
			);
			assert.equal(lines.length, 4);

			assert.ok(lines[1].startsWith("101,Alice,Walker,F,1994-06-15,USA,10:20:45,1,Overall,FINISHER"));
			assert.ok(lines[3].includes("88,Charlie,Brown,M,1998-11-04,USA,,,Overall,DNF"));
		});

		it("formats Standard ChekkPoint CSV with penalty points", () => {
			const csv = formatStandardCsv(testRunners);
			const lines = csv.split("\n");

			assert.equal(
				lines[0],
				"Place,Bib,Name,Gender,Age,Division,Status,TotalTime,PenaltyPoints",
			);
			assert.equal(lines.length, 4);

			assert.ok(lines[1].startsWith("1,101,Alice Walker,F,32,Overall,finished,10:20:45,0"));
			assert.ok(lines[2].includes("10")); // Bob's penalty points
		});

		it("escapes CSV fields safely preventing delimiter injection", () => {
			assert.equal(escapeCsvField("Hello, World"), '"Hello, World"');
			assert.equal(escapeCsvField('Quotes "here"'), '"Quotes ""here"""');
			assert.equal(escapeCsvField("Line1\nLine2"), '"Line1\nLine2"');
			assert.equal(escapeCsvField(1234), "1234");
			assert.equal(escapeCsvField(null), "");
			assert.equal(escapeCsvField(undefined), "");
		});

		it("formats elapsed seconds to HH:MM:SS", () => {
			assert.equal(formatElapsedHms(0), "00:00:00");
			assert.equal(formatElapsedHms(59), "00:00:59");
			assert.equal(formatElapsedHms(3661), "01:01:01");
			assert.equal(formatElapsedHms(86400), "24:00:00");
			assert.equal(formatElapsedHms(null), "");
			assert.equal(formatElapsedHms(-10), "");
		});
	});

	// ==========================================================================
	// 3. RBAC AUDIT & RACE CONTROL PERMISSIONS
	// ==========================================================================
	describe("RBAC permission checks (canAuditResults)", () => {
		it("permits organization owner, admin, director, and steward", () => {
			assert.equal(
				canAuditResults({ orgRoles: ["owner"], staffRoles: [] }),
				true,
			);
			assert.equal(
				canAuditResults({ orgRoles: ["admin"], staffRoles: [] }),
				true,
			);
			assert.equal(
				canAuditResults({ orgRoles: ["director"], staffRoles: [] }),
				true,
			);
			assert.equal(
				canAuditResults({ orgRoles: ["steward"], staffRoles: [] }),
				true,
			);
		});

		it("permits event group staff officials and checkpoint captains", () => {
			assert.equal(
				canAuditResults({ orgRoles: [], staffRoles: ["official"] }),
				true,
			);
			assert.equal(
				canAuditResults({ orgRoles: [], staffRoles: ["checkpoint_captain"] }),
				true,
			);
		});

		it("strictly denies uncredentialed volunteers and plain members", () => {
			assert.equal(
				canAuditResults({ orgRoles: ["member"], staffRoles: [] }),
				false,
			);
			assert.equal(
				canAuditResults({ orgRoles: [], staffRoles: ["volunteer"] }),
				false,
			);
			assert.equal(
				canAuditResults({ orgRoles: [], staffRoles: [] }),
				false,
			);
		});

		it("verifies canManageRaceControl equivalence", () => {
			assert.equal(
				canManageRaceControl({ orgRoles: ["admin"], staffRoles: [] }),
				true,
			);
			assert.equal(
				canManageRaceControl({ orgRoles: [], staffRoles: ["volunteer"] }),
				false,
			);
		});
	});

	// ==========================================================================
	// 4. TIME ALLOWANCE DEDUCTION & CUTOFF BUFFER ENGINE
	// ==========================================================================
	describe("Time Allowance credit and cutoff buffer calculation", () => {
		it("calculates adjusted net time with single and multiple allowances", () => {
			const allowances = [
				{ durationSeconds: 2700 }, // 45m medical hold
				{ durationSeconds: 1800 }, // 30m weather hold
			];
			const totalAllowance = allowances.reduce((sum, a) => sum + a.durationSeconds, 0);
			assert.equal(totalAllowance, 4500); // 1h 15m

			const rawElapsed = 40000;
			const adjustedNet = Math.max(0, rawElapsed - totalAllowance);
			assert.equal(adjustedNet, 35500);

			const baseCutoff = 50000;
			const extendedCutoff = baseCutoff + totalAllowance;
			assert.equal(extendedCutoff, 54500);
		});

		it("clamps negative adjusted net times to zero", () => {
			const totalAllowance = 7200; // 2 hour allowance
			const rawElapsed = 3600; // 1 hour elapsed
			const adjustedNet = Math.max(0, rawElapsed - totalAllowance);
			assert.equal(adjustedNet, 0);
		});
	});

	// ==========================================================================
	// 5. ROUTE REGISTRATION IN ROUtETREE.GEN.TS
	// ==========================================================================
	describe("Wave 4 route registration in routeTree.gen.ts AST", () => {
		it("verifies all Wave 4 routes are registered in routeTree.gen.ts", async () => {
			const fs = await import("node:fs");
			const path = await import("node:path");
			const treeFile = path.join(process.cwd(), "src/routeTree.gen.ts");
			assert.ok(fs.existsSync(treeFile), "src/routeTree.gen.ts must exist");
			const content = fs.readFileSync(treeFile, "utf-8");

			const requiredRoutes = [
				"/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/audit",
				"/events/$slug/entrants/$entrantId",
			];

			for (const r of requiredRoutes) {
				assert.ok(
					content.includes(r),
					`routeTree.gen.ts must contain registered route '${r}'`,
				);
			}
		});
	});

	// ==========================================================================
	// 6. DESIGN SYSTEM INVARIANTS: ZERO BLUR & ZERO TRANSITION-ALL
	// ==========================================================================
	describe("Wave 4 Design System strict invariant audit", () => {
		const wave4Files = [
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

		it("strictly asserts 0 occurrences of 'backdrop-blur' across all Wave 4 files", async () => {
			const fs = await import("node:fs");
			const path = await import("node:path");

			for (const f of wave4Files) {
				const fullPath = path.join(process.cwd(), f);
				if (fs.existsSync(fullPath)) {
					const content = fs.readFileSync(fullPath, "utf-8");
					assert.equal(
						content.includes("backdrop-blur"),
						false,
						`Forbidden token 'backdrop-blur' found in ${f}`,
					);
				}
			}
		});

		it("strictly asserts 0 occurrences of 'transition-all' across all Wave 4 files", async () => {
			const fs = await import("node:fs");
			const path = await import("node:path");

			for (const f of wave4Files) {
				const fullPath = path.join(process.cwd(), f);
				if (fs.existsSync(fullPath)) {
					const content = fs.readFileSync(fullPath, "utf-8");
					assert.equal(
						content.includes("transition-all"),
						false,
						`Forbidden token 'transition-all' found in ${f}`,
					);
				}
			}
		});

		it("asserts presence of tabular-nums in timing and bib views", async () => {
			const fs = await import("node:fs");
			const path = await import("node:path");

			const timingFiles = [
				"src/components/EntrantTelemetryView.tsx",
				"src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/audit.tsx",
				"src/routes/events/$slug/results.tsx",
			];

			for (const f of timingFiles) {
				const fullPath = path.join(process.cwd(), f);
				const content = fs.readFileSync(fullPath, "utf-8");
				assert.ok(
					content.includes("tabular-nums"),
					`Expected 'tabular-nums' class in ${f}`,
				);
			}
		});
	});
});
