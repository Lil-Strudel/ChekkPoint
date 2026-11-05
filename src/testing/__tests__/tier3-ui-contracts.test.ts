import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
	DecoupledFifoChuteQueue,
	KeypadInputBuffer,
} from "../domain-algorithms.ts";
import { TestDatabase } from "../test-harness.ts";

describe("Tier 3: Cross-Feature Combinations & Headless UI Contracts", () => {
	// ==========================================================================
	// 1. KOBALTE ACCESSIBLE PRIMITIVE CONTRACTS
	// ==========================================================================
	describe("Kobalte accessible primitive contracts (Dialog, Switch, etc.)", () => {
		it("verifies Dialog component contract and Kobalte exports", async () => {
			const dialogPath = path.resolve("src/components/ui/dialog.tsx");
			assert.ok(
				fs.existsSync(dialogPath),
				"src/components/ui/dialog.tsx must exist",
			);

			const content = fs.readFileSync(dialogPath, "utf-8");

			// Contract must export essential accessible sub-components
			assert.match(content, /export const Dialog =/);
			assert.match(content, /export const DialogTrigger =/);
			assert.match(content, /export const DialogContent =/);
			assert.match(content, /export const DialogTitle =/);
			assert.match(content, /export const DialogDescription =/);

			// Must not contain forbidden performance-degrading CSS
			assert.equal(
				content.includes("backdrop-blur"),
				false,
				"dialog.tsx must not use backdrop-blur",
			);
			assert.equal(
				content.includes("transition-all"),
				false,
				"dialog.tsx must not use transition-all",
			);
		});

		it("verifies Switch component contract and Kobalte data-state attributes", async () => {
			const switchPath = path.resolve("src/components/ui/switch.tsx");
			assert.ok(
				fs.existsSync(switchPath),
				"src/components/ui/switch.tsx must exist",
			);

			const content = fs.readFileSync(switchPath, "utf-8");

			assert.match(content, /export const Switch =/);
			assert.match(content, /export const SwitchControl =/);
			assert.match(content, /export const SwitchThumb =/);

			// Accessible Kobalte data-state selector attributes
			assert.match(
				content,
				/data-\[checked\]:/,
				"Switch must use Kobalte data-[checked] state styling",
			);

			assert.equal(
				content.includes("backdrop-blur"),
				false,
				"switch.tsx must not use backdrop-blur",
			);
			assert.equal(
				content.includes("transition-all"),
				false,
				"switch.tsx must not use transition-all",
			);
		});
	});

	// ==========================================================================
	// 2. 10-KEY KEYPAD BUFFER & DECOUPLED FIFO CHUTE QUEUE
	// ==========================================================================
	describe("10-key keypad input buffer + FIFO chute queue decoupling", () => {
		it("manipulates keypad entry buffer accurately (push, backspace, clear, commit)", () => {
			const keypad = new KeypadInputBuffer();

			keypad.pushDigit("1");
			keypad.pushDigit("4");
			keypad.pushDigit("2");
			assert.equal(keypad.current, "142");

			keypad.backspace();
			assert.equal(keypad.current, "14");

			keypad.pushDigit("0");
			assert.equal(keypad.current, "140");

			// Non-digit inputs should be strictly filtered out
			keypad.pushDigit("x");
			keypad.pushDigit("-");
			assert.equal(keypad.current, "140");

			const committed = keypad.commit();
			assert.equal(committed, "140");
			assert.equal(keypad.current, ""); // Cleared after commit
		});

		it("decouples rapid pack arrivals into FIFO chute timestamps and backfills bibs", () => {
			const chute = new DecoupledFifoChuteQueue();

			// 4 runners rush across the line in 1.5 seconds.
			// Volunteer taps "Punch" 4 times rapidly without typing bibs yet.
			const t1 = new Date("2026-11-05T08:30:00.100Z");
			const t2 = new Date("2026-11-05T08:30:00.550Z");
			const t3 = new Date("2026-11-05T08:30:01.000Z");
			const t4 = new Date("2026-11-05T08:30:01.450Z");

			chute.recordTimestamp({ timestamp: t1, subSplitKind: "in" });
			chute.recordTimestamp({ timestamp: t2, subSplitKind: "in" });
			chute.recordTimestamp({ timestamp: t3, subSplitKind: "in" });
			chute.recordTimestamp({ timestamp: t4, subSplitKind: "in" });

			assert.equal(chute.getPendingCount(), 4);
			assert.equal(chute.getAssignedCount(), 0);

			// Volunteer identifies bibs sequentially as runners queue in the hydration chute
			const assigned1 = chute.assignNextBib("101");
			const assigned2 = chute.assignNextBib("205");
			const assigned3 = chute.assignNextBib("42");
			const assigned4 = chute.assignNextBib("88");

			assert.equal(chute.getPendingCount(), 0);
			assert.equal(chute.getAssignedCount(), 4);

			// Strict FIFO preservation: oldest timestamp assigned first
			assert.equal(assigned1?.assignedBib, "101");
			assert.equal(assigned1?.timestampUtc, t1);

			assert.equal(assigned2?.assignedBib, "205");
			assert.equal(assigned2?.timestampUtc, t2);

			assert.equal(assigned3?.assignedBib, "42");
			assert.equal(assigned3?.timestampUtc, t3);

			assert.equal(assigned4?.assignedBib, "88");
			assert.equal(assigned4?.timestampUtc, t4);
		});
	});

	// ==========================================================================
	// 3. ZERO BACKDROP-BLUR & ZERO TRANSITION-ALL CODEBASE AUDIT
	// ==========================================================================
	describe("Zero backdrop-blur and zero transition-all automated structural checks", () => {
		function findFilesRecursive(dir: string, extensions: string[]): string[] {
			let results: string[] = [];
			if (!fs.existsSync(dir)) return results;

			const entries = fs.readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					if (entry.name !== "node_modules" && entry.name !== ".git") {
						results = results.concat(findFilesRecursive(fullPath, extensions));
					}
				} else if (entry.isFile()) {
					if (extensions.some((ext) => entry.name.endsWith(ext))) {
						results.push(fullPath);
					}
				}
			}
			return results;
		}

		it("asserts exactly 0 occurrences of 'backdrop-blur' anywhere in src/", () => {
			const srcDir = path.resolve("src");
			const files = findFilesRecursive(srcDir, [".ts", ".tsx", ".css"]);
			const violations: Array<{ file: string; line: number; text: string }> = [];

			for (const file of files) {
				// Skip test files themselves
				if (file.includes("__tests__")) continue;

				const content = fs.readFileSync(file, "utf-8");
				const lines = content.split("\n");

				lines.forEach((lineText, idx) => {
					if (lineText.includes("backdrop-blur")) {
						violations.push({
							file: path.relative(process.cwd(), file),
							line: idx + 1,
							text: lineText.trim(),
						});
					}
				});
			}

			assert.equal(
				violations.length,
				0,
				`Found ${violations.length} forbidden 'backdrop-blur' instances:\n` +
					violations
						.map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
						.join("\n"),
			);
		});

		it("asserts exactly 0 occurrences of 'transition-all' anywhere in src/", () => {
			const srcDir = path.resolve("src");
			const files = findFilesRecursive(srcDir, [".ts", ".tsx", ".css"]);
			const violations: Array<{ file: string; line: number; text: string }> = [];

			for (const file of files) {
				if (file.includes("__tests__")) continue;

				const content = fs.readFileSync(file, "utf-8");
				const lines = content.split("\n");

				lines.forEach((lineText, idx) => {
					if (lineText.includes("transition-all")) {
						violations.push({
							file: path.relative(process.cwd(), file),
							line: idx + 1,
							text: lineText.trim(),
						});
					}
				});
			}

			assert.equal(
				violations.length,
				0,
				`Found ${violations.length} forbidden 'transition-all' instances:\n` +
					violations
						.map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
						.join("\n"),
			);
		});
	});

	// ==========================================================================
	// 4. ROLE-ADAPTIVE ACCESS CONTRACT
	// ==========================================================================
	describe("Role-adaptive access contract (volunteers without org membership)", () => {
		it("permits volunteers without org membership to access assigned event groups without 404", () => {
			const db = new TestDatabase();
			const orgId = db.nextId("org");
			const eventGroupId = db.nextId("eg");

			db.eventGroups.push({
				id: eventGroupId,
				organizationId: orgId,
				name: "Desert Solstice 24H",
				slug: "desert-solstice-24h",
				discipline: "fixed_time_loop",
			});

			const volunteerUserId = "user-vol-99";
			const volunteerPersonId = "person-vol-99";

			// Assign volunteer as checkpoint staff ONLY (no orgMembers record)
			db.staffAssignments.push({
				id: db.nextId("staff"),
				eventGroupId,
				personId: volunteerPersonId,
				roles: ["volunteer"],
				assignedTimingPointIds: ["tp-aid-1"],
			});

			const access = db.getOrganizationOverviewRoleAdaptive(
				volunteerUserId,
				volunteerPersonId,
				"desert-solstice",
			);

			// Volunteer CAN access the workspace layout
			assert.equal(access.canAccessOrgWorkspace, true);
			assert.equal(access.isStaffOnly, true);
			assert.equal(access.assignedEventGroups.length, 1);
			assert.equal(access.assignedEventGroups[0].id, eventGroupId);

			// Volunteer CANNOT access org administration / settings tabs
			assert.equal(access.canAccessAdminSettings, false);
		});

		it("grants full admin access to organization owners and admins", () => {
			const db = new TestDatabase();
			const orgId = db.nextId("org");
			const ownerUserId = "user-owner-1";

			db.orgMembers.push({
				id: db.nextId("member"),
				organizationId: orgId,
				userId: ownerUserId,
				role: "owner",
			});

			const access = db.getOrganizationOverviewRoleAdaptive(
				ownerUserId,
				null,
				"desert-solstice",
			);

			assert.equal(access.canAccessOrgWorkspace, true);
			assert.equal(access.isStaffOnly, false);
			assert.equal(access.canAccessAdminSettings, true);
		});
	});
});
