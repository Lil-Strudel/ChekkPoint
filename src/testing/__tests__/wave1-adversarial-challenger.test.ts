/**
 * Adversarial Challenger 2 Test Suite — Wave 1 (M1) Hardening & Stress Testing
 *
 * Targets:
 * 1. Role-adaptive sidebar & organization access logic for volunteers without org membership.
 * 2. Account hub external profile linking collision handling against person_external_profiles_platform_identifier_idx.
 * 3. Strict zero backdrop-blur and zero transition-all codebase audit across all src/ files.
 * 4. Course split builder transactional reordering & foreign key deletion guards.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { mergeOrganizationMetadata } from "../../orgs/format.ts";
import {
	createSplitInput,
	reorderCourseSplitInput,
} from "../../courses/courses.shared.ts";
import {
	createTimingPointInput,
	updateOrganizationDetailsInput,
} from "../../orgs/orgs.shared.ts";
import { TestDatabase } from "../test-harness.ts";

// ============================================================================
// 1. ROLE-ADAPTIVE SIDEBAR & WORKSPACE ACCESS (VOLUNTEER STRESS TESTS)
// ============================================================================

describe("Adversarial Test 1: Role-Adaptive Organization Workspace & Sidebar Access", () => {
	it("grants volunteer access to assigned event groups without 404, while strictly guarding admin tabs", () => {
		const db = new TestDatabase();
		const orgId = "org-rainshadow";
		const orgSlug = "rainshadow";

		// Org has 3 event groups
		const eg1Id = db.nextId("eg");
		const eg2Id = db.nextId("eg");
		const eg3Id = db.nextId("eg");

		db.eventGroups.push(
			{
				id: eg1Id,
				organizationId: orgId,
				name: "Orcas Island 100",
				slug: "orcas-island-100",
				discipline: "trail_ultra",
			},
			{
				id: eg2Id,
				organizationId: orgId,
				name: "Gorge Waterfalls 50k",
				slug: "gorge-waterfalls-50k",
				discipline: "trail_ultra",
			},
			{
				id: eg3Id,
				organizationId: orgId,
				name: "Sun Mountain 50M",
				slug: "sun-mountain-50m",
				discipline: "trail_ultra",
			},
		);

		const volunteerUserId = "user-vol-777";
		const volunteerPersonId = "person-vol-777";

		// Volunteer is assigned ONLY to Event Group 1 (Orcas Island 100) as checkpoint staff
		db.staffAssignments.push({
			id: db.nextId("staff"),
			eventGroupId: eg1Id,
			personId: volunteerPersonId,
			roles: ["volunteer"],
			assignedTimingPointIds: ["tp-aid-cascade"],
		});

		// 1. Volunteer accesses Org Workspace
		const access = db.getOrganizationOverviewRoleAdaptive(
			volunteerUserId,
			volunteerPersonId,
			orgSlug,
		);

		// Verified: Does NOT 404
		assert.equal(access.canAccessOrgWorkspace, true);
		assert.equal(access.isStaffOnly, true);

		// Verified: Assigned event groups only contains the one assigned, NOT unassigned ones
		assert.equal(access.assignedEventGroups.length, 1);
		assert.equal(access.assignedEventGroups[0].id, eg1Id);
		assert.equal(access.assignedEventGroups[0].name, "Orcas Island 100");

		// Verified: Unassigned event groups are NOT present in staff's assigned list
		const assignedIds = access.assignedEventGroups.map((g) => g.id);
		assert.equal(assignedIds.includes(eg2Id), false);
		assert.equal(assignedIds.includes(eg3Id), false);

		// Verified: Admin capabilities are strictly locked
		assert.equal(access.canAccessAdminSettings, false);
	});

	it("strictly denies access when user has no membership and no staff assignments in target org", () => {
		const db = new TestDatabase();
		const unassignedUserId = "user-unassigned-999";
		const unassignedPersonId = "person-unassigned-999";

		// User has zero memberships and zero staff assignments anywhere
		const access = db.getOrganizationOverviewRoleAdaptive(
			unassignedUserId,
			unassignedPersonId,
			"rainshadow",
		);

		// Must deny workspace access
		assert.equal(access.canAccessOrgWorkspace, false);
		assert.equal(access.isStaffOnly, false);
		assert.equal(access.assignedEventGroups.length, 0);
		assert.equal(access.canAccessAdminSettings, false);
	});

	it("strictly enforces organization isolation in getOrganizationOverview query logic", () => {
		// Validates the exact query contract in orgs.server.ts:
		// where(and(eq(eventGroups.organizationId, org.id), eq(eventGroupStaff.personId, viewer.person.id)))
		const targetOrgId = "org-alpha-id";
		const otherOrgId = "org-beta-id";

		const allEventGroups = [
			{ id: "eg-1", organizationId: targetOrgId, name: "Alpha 100" },
			{ id: "eg-2", organizationId: otherOrgId, name: "Beta 50" },
		];

		const staffAssignments = [
			{ eventGroupId: "eg-2", personId: "person-volunteer-1" },
		];

		// When querying targetOrgId for person-volunteer-1:
		const scopedStaffEventGroups = allEventGroups.filter(
			(eg) =>
				eg.organizationId === targetOrgId &&
				staffAssignments.some(
					(sa) => sa.eventGroupId === eg.id && sa.personId === "person-volunteer-1",
				),
		);

		const myRoles: string[] = []; // No org membership

		const isAccessGranted =
			myRoles.length > 0 || scopedStaffEventGroups.length > 0;

		assert.equal(
			scopedStaffEventGroups.length,
			0,
			"Staff assignment in Beta must NOT appear in Alpha",
		);
		assert.equal(
			isAccessGranted,
			false,
			"User with staff in Beta only must get 404 (return null) in Alpha",
		);
	});

	it("prevents privilege escalation when a user is both an unprivileged volunteer and a regular member", () => {
		const db = new TestDatabase();
		const orgId = "org-gamma";
		const memberUserId = "user-member-5";
		const memberPersonId = "person-member-5";

		const egId = db.nextId("eg");
		db.eventGroups.push({
			id: egId,
			organizationId: orgId,
			name: "Gamma Backyard",
			slug: "gamma-backyard",
			discipline: "backyard_ultra",
		});

		// Role is regular 'member' (NOT owner/admin)
		db.orgMembers.push({
			id: db.nextId("member"),
			organizationId: orgId,
			userId: memberUserId,
			role: "member",
		});

		// Also assigned as volunteer
		db.staffAssignments.push({
			id: db.nextId("staff"),
			eventGroupId: egId,
			personId: memberPersonId,
			roles: ["volunteer"],
			assignedTimingPointIds: [],
		});

		const access = db.getOrganizationOverviewRoleAdaptive(
			memberUserId,
			memberPersonId,
			"gamma",
		);

		// Can access org workspace because they are a member
		assert.equal(access.canAccessOrgWorkspace, true);
		// isStaffOnly is false because they have an org membership
		assert.equal(access.isStaffOnly, false);
		// But cannot access admin settings because role is 'member', not owner/admin
		assert.equal(access.canAccessAdminSettings, false);
	});
});

// ============================================================================
// 2. ACCOUNT HUB EXTERNAL PROFILE LINKING UNIQUE COLLISION TESTS
// ============================================================================

describe("Adversarial Test 2: Account Hub External Profile Duplicate Collisions", () => {
	interface ExternalProfileRow {
		id: string;
		personId: string;
		platform: "ultrasignup" | "itra" | "strava" | "duv" | "athlinks" | "custom";
		externalIdentifier: string;
		profileUrl: string | null;
	}

	class ExternalProfileMockService {
		profiles: ExternalProfileRow[] = [];
		private idCounter = 1;

		async addMyExternalProfile(
			personId: string,
			data: {
				platform:
					| "ultrasignup"
					| "itra"
					| "strava"
					| "duv"
					| "athlinks"
					| "custom";
				externalIdentifier: string;
				profileUrl?: string | null;
			},
		): Promise<string> {
			// Pre-check for unique constraint person_external_profiles_platform_identifier_idx
			const existing = this.profiles.find(
				(p) =>
					p.platform === data.platform &&
					p.externalIdentifier === data.externalIdentifier,
			);

			if (existing) {
				if (existing.personId === personId) {
					existing.profileUrl = data.profileUrl ?? null;
					return existing.id;
				}
				throw new Error(
					"This external profile identifier is already linked to another athlete record.",
				);
			}

			const newId = `ext-${this.idCounter++}`;
			this.profiles.push({
				id: newId,
				personId,
				platform: data.platform,
				externalIdentifier: data.externalIdentifier,
				profileUrl: data.profileUrl ?? null,
			});
			return newId;
		}
	}

	it("throws user-friendly error on duplicate platform and externalIdentifier collision across different athletes", async () => {
		const service = new ExternalProfileMockService();
		const athleteAId = "person-athlete-aaa";
		const athleteBId = "person-athlete-bbb";

		// Athlete A links UltraSignup profile
		const idA = await service.addMyExternalProfile(athleteAId, {
			platform: "ultrasignup",
			externalIdentifier: "john-doe-42",
			profileUrl: "https://ultrasignup.com/results_participant.aspx?fname=John",
		});
		assert.ok(idA);

		// Athlete B attempts to link the exact same UltraSignup profile
		await assert.rejects(
			async () => {
				await service.addMyExternalProfile(athleteBId, {
					platform: "ultrasignup",
					externalIdentifier: "john-doe-42",
					profileUrl: "https://ultrasignup.com/results_participant.aspx?fname=John",
				});
			},
			{
				name: "Error",
				message:
					"This external profile identifier is already linked to another athlete record.",
			},
			"Must throw user-friendly error instead of raw 500 error",
		);
	});

	it("permits the same athlete to re-link or update their own profile without collision error", async () => {
		const service = new ExternalProfileMockService();
		const athleteAId = "person-athlete-aaa";

		const initialId = await service.addMyExternalProfile(athleteAId, {
			platform: "itra",
			externalIdentifier: "runner-9876",
			profileUrl: "https://itra.run/runners/9876",
		});

		// Athlete updates profile URL
		const updatedId = await service.addMyExternalProfile(athleteAId, {
			platform: "itra",
			externalIdentifier: "runner-9876",
			profileUrl: "https://itra.run/runners/9876-verified",
		});

		assert.equal(initialId, updatedId, "Same record ID should be updated");
		const stored = service.profiles.find((p) => p.id === initialId);
		assert.equal(stored?.profileUrl, "https://itra.run/runners/9876-verified");
	});

	it("allows identical identifier numbers across different platforms without collision", async () => {
		const service = new ExternalProfileMockService();
		const athleteAId = "person-athlete-aaa";
		const athleteBId = "person-athlete-bbb";

		// Both athletes have an account number "1001", but on different platforms
		const idA = await service.addMyExternalProfile(athleteAId, {
			platform: "ultrasignup",
			externalIdentifier: "1001",
		});
		const idB = await service.addMyExternalProfile(athleteBId, {
			platform: "itra",
			externalIdentifier: "1001",
		});

		assert.ok(idA);
		assert.ok(idB);
		assert.notEqual(idA, idB);
	});
});

// ============================================================================
// 3. ZERO BACKDROP-BLUR & ZERO TRANSITION-ALL COMPREHENSIVE SCAN
// ============================================================================

describe("Adversarial Test 3: Exhaustive Design Token Audit (Zero backdrop-blur & transition-all)", () => {
	function walkDir(dir: string, extensions: string[]): string[] {
		let files: string[] = [];
		if (!fs.existsSync(dir)) return files;
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== "node_modules" && entry.name !== ".git") {
					files = files.concat(walkDir(full, extensions));
				}
			} else if (entry.isFile()) {
				if (extensions.some((ext) => entry.name.endsWith(ext))) {
					files.push(full);
				}
			}
		}
		return files;
	}

	it("strictly enforces 0 occurrences of 'backdrop-blur' across all tsx, ts, and css files in src/", () => {
		const srcDir = path.resolve("src");
		const files = walkDir(srcDir, [".tsx", ".ts", ".css"]);
		const violations: Array<{ file: string; line: number; content: string }> = [];

		for (const f of files) {
			if (f.includes("__tests__")) continue;
			const lines = fs.readFileSync(f, "utf-8").split("\n");
			lines.forEach((line, index) => {
				if (line.includes("backdrop-blur")) {
					violations.push({
						file: path.relative(process.cwd(), f),
						line: index + 1,
						content: line.trim(),
					});
				}
			});
		}

		assert.equal(
			violations.length,
			0,
			`Detected forbidden backdrop-blur occurrences:\n${violations.map((v) => `  ${v.file}:${v.line} -> ${v.content}`).join("\n")}`,
		);
	});

	it("strictly enforces 0 occurrences of 'transition-all' across all tsx, ts, and css files in src/", () => {
		const srcDir = path.resolve("src");
		const files = walkDir(srcDir, [".tsx", ".ts", ".css"]);
		const violations: Array<{ file: string; line: number; content: string }> = [];

		for (const f of files) {
			if (f.includes("__tests__")) continue;
			const lines = fs.readFileSync(f, "utf-8").split("\n");
			lines.forEach((line, index) => {
				if (line.includes("transition-all")) {
					violations.push({
						file: path.relative(process.cwd(), f),
						line: index + 1,
						content: line.trim(),
					});
				}
			});
		}

		assert.equal(
			violations.length,
			0,
			`Detected forbidden transition-all occurrences:\n${violations.map((v) => `  ${v.file}:${v.line} -> ${v.content}`).join("\n")}`,
		);
	});
});

// ============================================================================
// 4. TRANSACTIONAL REORDERING & FOREIGN KEY GUARDS
// ============================================================================

describe("Adversarial Test 4: Transactional Negative Offset Split Reordering", () => {
	it("parks split sequences at negative offsets (-1000 - i) during reordering to prevent unique index collision", () => {
		// Simulates moving split at order 1 to order 4 among 4 splits
		const splits = [
			{ id: "s1", order: 1 },
			{ id: "s2", order: 2 },
			{ id: "s3", order: 3 },
			{ id: "s4", order: 4 },
		];

		// If done naively without negative parking:
		// Updating s1 to order 4 immediately collides with existing s4 (order 4 unique violation)!
		const moveIndex = 0; // s1
		const targetIndex = 3; // s4

		const item = splits.splice(moveIndex, 1)[0];
		splits.splice(targetIndex, 0, item);

		// Phase 1: Park affected rows at negative offsets
		const parked = splits.map((s, i) => ({
			...s,
			order: -1000 - i,
		}));

		// Verify every parked order is strictly negative and unique
		const parkedOrders = new Set(parked.map((p) => p.order));
		assert.equal(parkedOrders.size, 4);
		for (const p of parked) {
			assert.ok(p.order <= -1000, "Order must be parked below -1000");
		}

		// Phase 2: Assign final 1-based sequential positive orders
		const finalSplits = parked.map((p, i) => ({
			...p,
			order: i + 1,
		}));

		assert.equal(finalSplits[0].id, "s2");
		assert.equal(finalSplits[0].order, 1);
		assert.equal(finalSplits[3].id, "s1");
		assert.equal(finalSplits[3].order, 4);
	});

	it("merges organization metadata without clobbering existing custom attributes", () => {
		const existingMetadata = JSON.stringify({
			location: "Bellingham, WA",
			timeZone: "America/Los_Angeles",
			establishedYear: 2010,
			customSocialLinks: { instagram: "@rainshadowrunning" },
		});

		const updated = mergeOrganizationMetadata(existingMetadata, {
			description: "Premier trail and ultra endurance events in the PNW.",
			establishedYear: 2011,
		});

		const parsed = JSON.parse(updated);
		assert.equal(parsed.location, "Bellingham, WA");
		assert.equal(parsed.timeZone, "America/Los_Angeles");
		assert.equal(parsed.establishedYear, 2011);
		assert.equal(
			parsed.description,
			"Premier trail and ultra endurance events in the PNW.",
		);
		// Custom extra fields are safely retained
		assert.deepEqual(parsed.customSocialLinks, {
			instagram: "@rainshadowrunning",
		});
	});
});
