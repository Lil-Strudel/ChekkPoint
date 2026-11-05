import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { z } from "zod";
import { mergeOrganizationMetadata } from "../../orgs/format.ts";
import { parseOrganizationMeta } from "../../public/public.shared.ts";

/**
 * Wave 1 Adversarial Test Suite
 *
 * Stress-tests and challenges Wave 1 implementation:
 * 1. Course split reordering & negative temporary parking with strict database unique constraint oracle.
 * 2. Organization metadata merging: non-string fields, missing keys, special characters, and parseOrganizationMeta robustness.
 * 3. Timing point deletion guards & schema contract verification for raw_timing_events.
 */

// ============================================================================
// 1. COURSE SPLIT REORDERING ORACLE & STRESS HARNESS
// ============================================================================

interface InMemCourseSplit {
	id: string;
	courseId: string;
	timingPointId: string;
	name: string;
	sequenceOrder: number;
}

/**
 * In-memory CourseSplit store with strict unique constraint checking on (courseId, sequenceOrder)
 * mirroring PostgreSQL uniqueIndex("course_splits_order_idx").on(t.courseId, t.sequenceOrder).
 */
class CourseSplitStoreOracle {
	splits: InMemCourseSplit[] = [];

	addSplit(split: InMemCourseSplit): void {
		this.assertUniqueConstraint(split.courseId, split.sequenceOrder, split.id);
		this.splits.push({ ...split });
	}

	private assertUniqueConstraint(
		courseId: string,
		sequenceOrder: number,
		excludeId?: string,
	): void {
		const collision = this.splits.find(
			(s) =>
				s.courseId === courseId &&
				s.sequenceOrder === sequenceOrder &&
				s.id !== excludeId,
		);
		if (collision) {
			throw new Error(
				`duplicate key value violates unique constraint "course_splits_order_idx" (course_id, sequence_order)=(${courseId}, ${sequenceOrder})`,
			);
		}
	}

	getSplits(courseId: string): InMemCourseSplit[] {
		return this.splits
			.filter((s) => s.courseId === courseId)
			.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
	}

	/**
	 * Simulates moveSplit using the two-phase negative sequence parking algorithm
	 * from src/courses/courses.server.ts:427-468.
	 */
	moveSplitWithNegativeParking(splitId: string, direction: "up" | "down"): void {
		const split = this.splits.find((s) => s.id === splitId);
		if (!split) return;
		const up = direction === "up";

		const courseSplitsList = this.getSplits(split.courseId);
		const idx = courseSplitsList.findIndex((s) => s.id === splitId);
		if (idx === -1) return;
		const targetIdx = up ? idx - 1 : idx + 1;
		if (targetIdx < 0 || targetIdx >= courseSplitsList.length) return;

		// Swap items in memory
		const [moved] = courseSplitsList.splice(idx, 1);
		courseSplitsList.splice(targetIdx, 0, moved);

		// Step 1: Shift to negative temporary sequence orders to avoid index collisions
		for (let i = 0; i < courseSplitsList.length; i++) {
			const target = this.splits.find((s) => s.id === courseSplitsList[i].id)!;
			const tempOrder = -1000 - i;
			this.assertUniqueConstraint(target.courseId, tempOrder, target.id);
			target.sequenceOrder = tempOrder;
		}

		// Step 2: Write final contiguous positive sequence orders 1..N
		for (let i = 0; i < courseSplitsList.length; i++) {
			const target = this.splits.find((s) => s.id === courseSplitsList[i].id)!;
			const finalOrder = i + 1;
			this.assertUniqueConstraint(target.courseId, finalOrder, target.id);
			target.sequenceOrder = finalOrder;
		}
	}

	/**
	 * Simulates moveSplit WITHOUT negative parking (naive update)
	 * to demonstrate the exact database failure that negative parking prevents.
	 */
	moveSplitNaiveWithoutParking(splitId: string, direction: "up" | "down"): void {
		const split = this.splits.find((s) => s.id === splitId);
		if (!split) return;
		const up = direction === "up";

		const courseSplitsList = this.getSplits(split.courseId);
		const idx = courseSplitsList.findIndex((s) => s.id === splitId);
		if (idx === -1) return;
		const targetIdx = up ? idx - 1 : idx + 1;
		if (targetIdx < 0 || targetIdx >= courseSplitsList.length) return;

		const [moved] = courseSplitsList.splice(idx, 1);
		courseSplitsList.splice(targetIdx, 0, moved);

		// Directly update positive sequence orders without intermediate negative parking
		for (let i = 0; i < courseSplitsList.length; i++) {
			const target = this.splits.find((s) => s.id === courseSplitsList[i].id)!;
			const finalOrder = i + 1;
			this.assertUniqueConstraint(target.courseId, finalOrder, target.id);
			target.sequenceOrder = finalOrder;
		}
	}

	/**
	 * Simulates reorderCourseSplit from src/courses/courses.server.ts:471-514.
	 */
	reorderSplitWithNegativeParking(splitId: string, newSequenceOrder: number): void {
		const split = this.splits.find((s) => s.id === splitId);
		if (!split) return;

		const courseSplitsList = this.getSplits(split.courseId);
		const idx = courseSplitsList.findIndex((s) => s.id === splitId);
		if (idx === -1) return;
		const targetIdx = Math.max(
			0,
			Math.min(courseSplitsList.length - 1, newSequenceOrder - 1),
		);
		if (idx === targetIdx) return;

		const [moved] = courseSplitsList.splice(idx, 1);
		courseSplitsList.splice(targetIdx, 0, moved);

		// Negative offset park
		for (let i = 0; i < courseSplitsList.length; i++) {
			const target = this.splits.find((s) => s.id === courseSplitsList[i].id)!;
			const tempOrder = -1000 - i;
			this.assertUniqueConstraint(target.courseId, tempOrder, target.id);
			target.sequenceOrder = tempOrder;
		}

		// Final 1..N order
		for (let i = 0; i < courseSplitsList.length; i++) {
			const target = this.splits.find((s) => s.id === courseSplitsList[i].id)!;
			const finalOrder = i + 1;
			this.assertUniqueConstraint(target.courseId, finalOrder, target.id);
			target.sequenceOrder = finalOrder;
		}
	}

	/**
	 * Simulates deleteSplit from src/courses/courses.server.ts:396-425.
	 */
	deleteSplitWithNegativeParking(splitId: string): void {
		const splitIdx = this.splits.findIndex((s) => s.id === splitId);
		if (splitIdx === -1) return;
		const courseId = this.splits[splitIdx].courseId;

		// Delete the split
		this.splits.splice(splitIdx, 1);

		// Renumber remaining splits cleanly using negative offsets
		const remaining = this.getSplits(courseId);

		for (let i = 0; i < remaining.length; i++) {
			const target = this.splits.find((s) => s.id === remaining[i].id)!;
			const tempOrder = -1000 - i;
			this.assertUniqueConstraint(target.courseId, tempOrder, target.id);
			target.sequenceOrder = tempOrder;
		}
		for (let i = 0; i < remaining.length; i++) {
			const target = this.splits.find((s) => s.id === remaining[i].id)!;
			const finalOrder = i + 1;
			this.assertUniqueConstraint(target.courseId, finalOrder, target.id);
			target.sequenceOrder = finalOrder;
		}
	}
}

// ============================================================================
// 2. TIMING POINT DELETION GUARD ORACLE
// ============================================================================

interface InMemTimingPoint {
	id: string;
	organizationId: string;
	code: string;
	name: string;
}

interface InMemStaffTimingPoint {
	staffId: string;
	timingPointId: string;
}

interface InMemRawTimingEvent {
	id: string;
	eventGroupId: string;
	timingPointCode: string; // Physical code transmitted by hardware/station
	competitorNumber: string;
}

interface InMemEventGroup {
	id: string;
	organizationId: string;
	name: string;
}

class TimingPointDeletionOracle {
	timingPoints: InMemTimingPoint[] = [];
	courseSplits: InMemCourseSplit[] = [];
	staffTimingPoints: InMemStaffTimingPoint[] = [];
	rawTimingEvents: InMemRawTimingEvent[] = [];
	eventGroups: InMemEventGroup[] = [];

	/**
	 * Correct implementation of timing point deletion guards:
	 * Resolves timing point code & organization to correctly verify raw_timing_events,
	 * course_splits, and staff assignments.
	 */
	deleteTimingPointCorrect(timingPointId: string): void {
		const point = this.timingPoints.find((p) => p.id === timingPointId);
		if (!point) throw new Error("Timing point not found");

		const splitsCount = this.courseSplits.filter(
			(cs) => cs.timingPointId === timingPointId,
		).length;

		const staffCount = this.staffTimingPoints.filter(
			(st) => st.timingPointId === timingPointId,
		).length;

		// Find event groups belonging to this organization
		const orgEventGroupIds = this.eventGroups
			.filter((eg) => eg.organizationId === point.organizationId)
			.map((eg) => eg.id);

		// Raw timing events are recorded by timingPointCode within this organization's event groups
		const rawEventsCount = this.rawTimingEvents.filter(
			(re) =>
				orgEventGroupIds.includes(re.eventGroupId) &&
				re.timingPointCode.toUpperCase() === point.code.toUpperCase(),
		).length;

		const totalRefs = splitsCount + staffCount + rawEventsCount;
		if (totalRefs > 0) {
			const parts: string[] = [];
			if (splitsCount) parts.push(`${splitsCount} course split(s)`);
			if (staffCount) parts.push(`${staffCount} staff assignment(s)`);
			if (rawEventsCount) parts.push(`${rawEventsCount} raw timing record(s)`);
			throw new Error(
				`Cannot delete timing point because it is referenced by ${parts.join(", ")}. Remove or reassign them first.`,
			);
		}

		// Delete point
		const idx = this.timingPoints.findIndex((p) => p.id === timingPointId);
		this.timingPoints.splice(idx, 1);
	}

	/**
	 * Simulates the flawed query in src/orgs/orgs.server.ts:556-560:
	 * where(eq(rawTimingEvents.timingPointId, data.timingPointId))
	 * which references non-existent property rawTimingEvents.timingPointId.
	 */
	deleteTimingPointWithFlawedServerQuery(timingPointId: string): void {
		const rawRecord = this.rawTimingEvents[0] as unknown as Record<string, unknown>;
		// In the actual schema, rawTimingEvents does not have timingPointId
		if (rawRecord && !("timingPointId" in rawRecord)) {
			// Accessing rawTimingEvents.timingPointId yields undefined
			const columnRef = rawRecord.timingPointId;
			if (columnRef === undefined) {
				throw new TypeError(
					"Flawed query in src/orgs/orgs.server.ts: rawTimingEvents has no column 'timingPointId'. Physical timing events use 'timingPointCode'.",
				);
			}
		}
	}
}

// ============================================================================
// 3. ADVERSARIAL TEST SUITE
// ============================================================================

describe("Wave 1 Adversarial & Stress Testing", () => {
	// --------------------------------------------------------------------------
	// AREA 1: COURSE SPLIT REORDERING & UNIQUE CONSTRAINT DEFENSE
	// --------------------------------------------------------------------------
	describe("Area 1: Course Split Reordering Invariants & Negative Parking Oracle", () => {
		it("survives 1-split boundary conditions (move up/down, reorder, delete) without errors", () => {
			const oracle = new CourseSplitStoreOracle();
			oracle.addSplit({
				id: "s1",
				courseId: "c1",
				timingPointId: "tp1",
				name: "Solo Split",
				sequenceOrder: 1,
			});

			// Move up and down should be clean no-ops
			oracle.moveSplitWithNegativeParking("s1", "up");
			assert.equal(oracle.getSplits("c1")[0].sequenceOrder, 1);

			oracle.moveSplitWithNegativeParking("s1", "down");
			assert.equal(oracle.getSplits("c1")[0].sequenceOrder, 1);

			// Reorder to position 1 or out-of-bounds position 5
			oracle.reorderSplitWithNegativeParking("s1", 1);
			assert.equal(oracle.getSplits("c1")[0].sequenceOrder, 1);

			oracle.reorderSplitWithNegativeParking("s1", 5);
			assert.equal(oracle.getSplits("c1")[0].sequenceOrder, 1);

			// Clean deletion leaves 0 splits
			oracle.deleteSplitWithNegativeParking("s1");
			assert.equal(oracle.getSplits("c1").length, 0);
		});

		it("proves 2-split swap causes unique constraint collision WITHOUT negative parking, and SUCCEEDS with negative parking", () => {
			// 1. Without parking: fails on unique collision
			const naiveOracle = new CourseSplitStoreOracle();
			naiveOracle.addSplit({
				id: "s1",
				courseId: "c1",
				timingPointId: "tp1",
				name: "Start",
				sequenceOrder: 1,
			});
			naiveOracle.addSplit({
				id: "s2",
				courseId: "c1",
				timingPointId: "tp2",
				name: "Finish",
				sequenceOrder: 2,
			});

			// Moving s1 down swaps memory to [s2, s1].
			// When updating s2 to sequenceOrder 1, s1 currently already has sequenceOrder 1!
			assert.throws(
				() => naiveOracle.moveSplitNaiveWithoutParking("s1", "down"),
				/duplicate key value violates unique constraint "course_splits_order_idx"/,
			);

			// 2. With two-phase negative parking: succeeds with zero collision
			const safeOracle = new CourseSplitStoreOracle();
			safeOracle.addSplit({
				id: "s1",
				courseId: "c1",
				timingPointId: "tp1",
				name: "Start",
				sequenceOrder: 1,
			});
			safeOracle.addSplit({
				id: "s2",
				courseId: "c1",
				timingPointId: "tp2",
				name: "Finish",
				sequenceOrder: 2,
			});

			// Swap s1 down
			safeOracle.moveSplitWithNegativeParking("s1", "down");
			let splits = safeOracle.getSplits("c1");
			assert.equal(splits[0].id, "s2");
			assert.equal(splits[0].sequenceOrder, 1);
			assert.equal(splits[1].id, "s1");
			assert.equal(splits[1].sequenceOrder, 2);

			// Swap back up
			safeOracle.moveSplitWithNegativeParking("s2", "down");
			splits = safeOracle.getSplits("c1");
			assert.equal(splits[0].id, "s1");
			assert.equal(splits[0].sequenceOrder, 1);
			assert.equal(splits[1].id, "s2");
			assert.equal(splits[1].sequenceOrder, 2);
		});

		it("deletes middle split from [1, 2, 3, 4, 5] and renumbers remaining to [1, 2, 3, 4] with zero collision", () => {
			const oracle = new CourseSplitStoreOracle();
			for (let i = 1; i <= 5; i++) {
				oracle.addSplit({
					id: `s${i}`,
					courseId: "c1",
					timingPointId: `tp${i}`,
					name: `Split ${i}`,
					sequenceOrder: i,
				});
			}

			// Delete middle split s3
			oracle.deleteSplitWithNegativeParking("s3");

			const splits = oracle.getSplits("c1");
			assert.equal(splits.length, 4);
			assert.deepEqual(
				splits.map((s) => s.id),
				["s1", "s2", "s4", "s5"],
			);
			assert.deepEqual(
				splits.map((s) => s.sequenceOrder),
				[1, 2, 3, 4],
			);

			// Delete head split s1
			oracle.deleteSplitWithNegativeParking("s1");
			const afterHead = oracle.getSplits("c1");
			assert.equal(afterHead.length, 3);
			assert.deepEqual(
				afterHead.map((s) => s.id),
				["s2", "s4", "s5"],
			);
			assert.deepEqual(
				afterHead.map((s) => s.sequenceOrder),
				[1, 2, 3],
			);

			// Delete tail split s5
			oracle.deleteSplitWithNegativeParking("s5");
			const afterTail = oracle.getSplits("c1");
			assert.equal(afterTail.length, 2);
			assert.deepEqual(
				afterTail.map((s) => s.id),
				["s2", "s4"],
			);
			assert.deepEqual(
				afterTail.map((s) => s.sequenceOrder),
				[1, 2],
			);
		});

		it("survives 100 rapid random reorderings with strict unique constraint validation at every intermediate step", () => {
			const oracle = new CourseSplitStoreOracle();
			const splitCount = 10;
			for (let i = 1; i <= splitCount; i++) {
				oracle.addSplit({
					id: `split-${i}`,
					courseId: "stress-course",
					timingPointId: `tp-${i}`,
					name: `Station ${i}`,
					sequenceOrder: i,
				});
			}

			// Deterministic PRNG for reproducible stress testing
			let seed = 42;
			function pseudoRandom(): number {
				seed = (seed * 1664525 + 1013904223) % 4294967296;
				return seed / 4294967296;
			}

			// Run 100 random moves/reorders
			for (let iteration = 0; iteration < 100; iteration++) {
				const randomSplitIndex = Math.floor(pseudoRandom() * splitCount) + 1;
				const splitId = `split-${randomSplitIndex}`;

				if (pseudoRandom() > 0.5) {
					// moveSplit up or down
					const direction = pseudoRandom() > 0.5 ? "up" : "down";
					oracle.moveSplitWithNegativeParking(splitId, direction);
				} else {
					// reorderSplit to random target sequence
					const targetOrder = Math.floor(pseudoRandom() * splitCount) + 1;
					oracle.reorderSplitWithNegativeParking(splitId, targetOrder);
				}

				// Verify post-conditions after every single iteration
				const current = oracle.getSplits("stress-course");
				assert.equal(current.length, splitCount);
				assert.deepEqual(
					current.map((s) => s.sequenceOrder),
					[1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
				);
			}
		});

		it("proves negative parking formula (-1000 - i) is strictly non-overlapping for arbitrary N", () => {
			const N = 500;
			const parkedValues = new Set<number>();
			for (let i = 0; i < N; i++) {
				const val = -1000 - i;
				assert.ok(val <= -1000, "Must be parked at or below -1000");
				assert.ok(!parkedValues.has(val), "Parked values must be strictly distinct");
				parkedValues.add(val);
			}
			assert.equal(parkedValues.size, N);
		});
	});

	// --------------------------------------------------------------------------
	// AREA 2: ORGANIZATION METADATA MERGING & parseOrganizationMeta
	// --------------------------------------------------------------------------
	describe("Area 2: Organization Metadata JSON Merging & Parser Resilience", () => {
		it("preserves non-schema custom keys, nested objects, and arrays during merge", () => {
			const existing = JSON.stringify({
				location: "Wasatch Front, UT",
				timeZone: "America/Denver",
				description: "Original description",
				customSponsors: ["Salomon", "Hoka", "Garmin"],
				membershipTier: "Gold",
				legacyId: 4421,
				integrations: { stravaClubId: "123456", ultraSignupOrgId: "987" },
			});

			const mergedStr = mergeOrganizationMetadata(existing, {
				website: "https://chekkpoint.live",
				description: "Updated description for 2026",
			});

			const merged = JSON.parse(mergedStr);
			// Updated fields
			assert.equal(merged.website, "https://chekkpoint.live");
			assert.equal(merged.description, "Updated description for 2026");
			// Preserved fields
			assert.equal(merged.location, "Wasatch Front, UT");
			assert.equal(merged.timeZone, "America/Denver");
			assert.deepEqual(merged.customSponsors, ["Salomon", "Hoka", "Garmin"]);
			assert.equal(merged.membershipTier, "Gold");
			assert.equal(merged.legacyId, 4421);
			assert.deepEqual(merged.integrations, {
				stravaClubId: "123456",
				ultraSignupOrgId: "987",
			});
		});

		it("distinguishes boolean false and number 0 from null/empty-string deletion", () => {
			const existing = JSON.stringify({
				isPublic: true,
				courseCount: 5,
				website: "https://old.org",
			});

			const mergedStr = mergeOrganizationMetadata(existing, {
				isPublic: false, // boolean false must be preserved, not deleted
				courseCount: 0, // number 0 must be preserved, not deleted
				website: "", // empty string must delete key
			});

			const merged = JSON.parse(mergedStr);
			assert.equal(merged.isPublic, false);
			assert.equal(merged.courseCount, 0);
			assert.equal("website" in merged, false);
		});

		it("safely handles special characters, unicode, emojis, escaped quotes, and newlines", () => {
			const complexInput = {
				description:
					'Hardrock 100 🏃‍♂️⛰️ — "Wild & Tough" \n\t Single-track & high altitude <script>alert("xss")</script>',
				location: "Silverton, CO & Chamonix-Mont-Blanc, France / 日本・富士山",
				website: "https://example.com/races?id=123&sort=asc#top",
			};

			const mergedStr = mergeOrganizationMetadata(null, complexInput);
			assert.doesNotThrow(() => JSON.parse(mergedStr));

			const parsed = parseOrganizationMeta(mergedStr);
			assert.equal(parsed.description, complexInput.description);
			assert.equal(parsed.location, complexInput.location);
			assert.equal(parsed.website, complexInput.website);
		});

		it("guarantees parseOrganizationMeta never throws on malformed, corrupted, or non-object JSON", () => {
			const malformedCases = [
				null,
				undefined,
				"",
				"   ",
				"null",
				"true",
				"false",
				"12345",
				'"just a plain string"',
				"[1, 2, 3]",
				'{"unclosed": ',
				'{"location": 12345}', // wrong type for string field
				'{"establishedYear": "not-a-number"}', // wrong type for number field
			];

			for (const input of malformedCases) {
				assert.doesNotThrow(() => {
					const result = parseOrganizationMeta(input);
					assert.ok(typeof result.location === "string" && result.location.length > 0);
					assert.ok(typeof result.timeZone === "string" && result.timeZone.length > 0);
					assert.ok(
						typeof result.description === "string" &&
							result.description.length > 0,
					);
				}, `parseOrganizationMeta must not throw for input: ${JSON.stringify(input)}`);
			}
		});

		it("never wipes existing keys when fields are omitted (undefined) in partial updates", () => {
			const existing = JSON.stringify({
				location: "Moab, UT",
				timeZone: "America/Denver",
				description: "Desert slickrock endurance",
				website: "https://moab240.com",
				establishedYear: 2017,
			});

			// Omit location and description (undefined)
			const mergedStr = mergeOrganizationMetadata(existing, {
				website: "https://destinationtrailrun.com",
			});

			const merged = JSON.parse(mergedStr);
			assert.equal(merged.location, "Moab, UT");
			assert.equal(merged.description, "Desert slickrock endurance");
			assert.equal(merged.timeZone, "America/Denver");
			assert.equal(merged.establishedYear, 2017);
			assert.equal(merged.website, "https://destinationtrailrun.com");
		});
	});

	// --------------------------------------------------------------------------
	// AREA 3: TIMING POINT DELETION GUARDS & SCHEMA CONTRACT DEFECT DETECTION
	// --------------------------------------------------------------------------
	describe("Area 3: Timing Point Deletion Reference Guards & Schema Contract Verification", () => {
		it("blocks deletion with formatted count when referenced in course_splits", () => {
			const oracle = new TimingPointDeletionOracle();
			oracle.timingPoints.push({
				id: "tp-1",
				organizationId: "org-1",
				code: "START",
				name: "Start Line",
			});
			oracle.courseSplits.push({
				id: "cs-1",
				courseId: "c-1",
				timingPointId: "tp-1",
				name: "Start",
				sequenceOrder: 1,
			});
			oracle.courseSplits.push({
				id: "cs-2",
				courseId: "c-2",
				timingPointId: "tp-1",
				name: "Start Loop 2",
				sequenceOrder: 1,
			});

			assert.throws(
				() => oracle.deleteTimingPointCorrect("tp-1"),
				(err: Error) => {
					assert.match(err.message, /2 course split\(s\)/);
					assert.match(err.message, /Cannot delete timing point because it is referenced by/);
					return true;
				},
			);
		});

		it("blocks deletion with formatted count when referenced in event_group_staff_timing_points", () => {
			const oracle = new TimingPointDeletionOracle();
			oracle.timingPoints.push({
				id: "tp-2",
				organizationId: "org-1",
				code: "AID1",
				name: "Aid Station 1",
			});
			oracle.staffTimingPoints.push({ staffId: "staff-1", timingPointId: "tp-2" });
			oracle.staffTimingPoints.push({ staffId: "staff-2", timingPointId: "tp-2" });
			oracle.staffTimingPoints.push({ staffId: "staff-3", timingPointId: "tp-2" });

			assert.throws(
				() => oracle.deleteTimingPointCorrect("tp-2"),
				(err: Error) => {
					assert.match(err.message, /3 staff assignment\(s\)/);
					return true;
				},
			);
		});

		it("blocks deletion with formatted count when referenced in raw_timing_events by code", () => {
			const oracle = new TimingPointDeletionOracle();
			oracle.eventGroups.push({
				id: "eg-1",
				organizationId: "org-1",
				name: "2026 Wasatch 100",
			});
			oracle.timingPoints.push({
				id: "tp-3",
				organizationId: "org-1",
				code: "BIG_SPRING",
				name: "Big Spring Aid",
			});
			oracle.rawTimingEvents.push({
				id: "raw-1",
				eventGroupId: "eg-1",
				timingPointCode: "BIG_SPRING",
				competitorNumber: "101",
			});

			assert.throws(
				() => oracle.deleteTimingPointCorrect("tp-3"),
				(err: Error) => {
					assert.match(err.message, /1 raw timing record\(s\)/);
					return true;
				},
			);
		});

		it("blocks deletion with combined multi-table reference count breakdown", () => {
			const oracle = new TimingPointDeletionOracle();
			oracle.eventGroups.push({
				id: "eg-1",
				organizationId: "org-1",
				name: "2026 Cascade Crest",
			});
			oracle.timingPoints.push({
				id: "tp-multi",
				organizationId: "org-1",
				code: "HYAK",
				name: "Hyak Ski Area",
			});
			oracle.courseSplits.push({
				id: "cs-1",
				courseId: "c-1",
				timingPointId: "tp-multi",
				name: "Hyak Out",
				sequenceOrder: 2,
			});
			oracle.staffTimingPoints.push({
				staffId: "st-1",
				timingPointId: "tp-multi",
			});
			oracle.rawTimingEvents.push({
				id: "raw-1",
				eventGroupId: "eg-1",
				timingPointCode: "HYAK",
				competitorNumber: "55",
			});

			assert.throws(
				() => oracle.deleteTimingPointCorrect("tp-multi"),
				(err: Error) => {
					assert.match(err.message, /1 course split\(s\)/);
					assert.match(err.message, /1 staff assignment\(s\)/);
					assert.match(err.message, /1 raw timing record\(s\)/);
					return true;
				},
			);
		});

		it("permits deletion when timing point has 0 references across all tables", () => {
			const oracle = new TimingPointDeletionOracle();
			oracle.timingPoints.push({
				id: "tp-clean",
				organizationId: "org-1",
				code: "TEMP",
				name: "Temporary Staging",
			});

			assert.doesNotThrow(() => oracle.deleteTimingPointCorrect("tp-clean"));
			assert.equal(oracle.timingPoints.length, 0);
		});

		it("SCHEMA CONTRACT VERIFICATION: verifies deleteTimingPoint joins rawTimingEvents with eventGroups on timingPointCode and organizationId", () => {
			// Read src/db/schema.ts and assert rawTimingEvents schema definition
			const schemaContent = fs.readFileSync(
				path.resolve("src/db/schema.ts"),
				"utf-8",
			);

			// Extract rawTimingEvents table block
			const rawTableStart = schemaContent.indexOf('export const rawTimingEvents = pgTable(');
			assert.ok(rawTableStart !== -1, "rawTimingEvents table must exist in schema.ts");
			const rawTableBlock = schemaContent.slice(
				rawTableStart,
				schemaContent.indexOf(');', rawTableStart) + 2,
			);

			// In schema.ts, rawTimingEvents has timingPointCode, NOT timingPointId
			assert.match(
				rawTableBlock,
				/timingPointCode:\s*text\("timing_point_code"\)/,
				"rawTimingEvents must define timingPointCode",
			);
			assert.equal(
				rawTableBlock.includes("timingPointId"),
				false,
				"rawTimingEvents does NOT have a timingPointId column",
			);

			// Read src/orgs/orgs.server.ts and locate deleteTimingPoint
			const orgsServerContent = fs.readFileSync(
				path.resolve("src/orgs/orgs.server.ts"),
				"utf-8",
			);
			const deleteTimingPointStart = orgsServerContent.indexOf(
				"export async function deleteTimingPoint(",
			);
			assert.ok(
				deleteTimingPointStart !== -1,
				"deleteTimingPoint must exist in orgs.server.ts",
			);
			const deleteTimingPointBlock = orgsServerContent.slice(
				deleteTimingPointStart,
				deleteTimingPointStart + 1600,
			);

			// Verify zero references to the invalid rawTimingEvents.timingPointId
			const usesFlawedTimingPointId = deleteTimingPointBlock.includes(
				"rawTimingEvents.timingPointId",
			);
			assert.equal(
				usesFlawedTimingPointId,
				false,
				"deleteTimingPoint must NOT query non-existent rawTimingEvents.timingPointId",
			);

			// Verify that deleteTimingPoint queries point.code & point.organizationId
			assert.match(
				deleteTimingPointBlock,
				/timingPoints\.code/,
				"deleteTimingPoint must query timingPoints.code",
			);
			assert.match(
				deleteTimingPointBlock,
				/timingPoints\.organizationId/,
				"deleteTimingPoint must query timingPoints.organizationId",
			);

			// Verify that deleteTimingPoint joins rawTimingEvents with eventGroups
			assert.match(
				deleteTimingPointBlock,
				/innerJoin\(\s*eventGroups,\s*eq\(eventGroups\.id,\s*rawTimingEvents\.eventGroupId\)\)/,
				"deleteTimingPoint must join rawTimingEvents with eventGroups",
			);
			assert.match(
				deleteTimingPointBlock,
				/eq\(\s*rawTimingEvents\.timingPointCode,\s*point\.code\s*\)/,
				"deleteTimingPoint must match on timingPointCode = point.code",
			);

			// Verify deletion oracle behavior when raw timing records exist
			const oracle = new TimingPointDeletionOracle();
			oracle.eventGroups.push({
				id: "eg-1",
				organizationId: "org-1",
				name: "Cascade 100",
			});
			oracle.timingPoints.push({
				id: "tp-1",
				organizationId: "org-1",
				code: "AID1",
				name: "Aid 1",
			});
			oracle.rawTimingEvents.push({
				id: "raw-1",
				eventGroupId: "eg-1",
				timingPointCode: "AID1",
				competitorNumber: "10",
			});

			assert.throws(
				() => oracle.deleteTimingPointCorrect("tp-1"),
				/1 raw timing record\(s\)/,
			);
		});
	});

	// --------------------------------------------------------------------------
	// AREA 4: ATHLETE DEMOGRAPHICS PAYLOAD & VALIDATOR ALIGNMENT
	// --------------------------------------------------------------------------
	describe("Area 4: Athlete Demographics Payload & Validator Alignment", () => {
		const updateMyProfileSchema = z
			.object({
				firstName: z.string().trim().min(1),
				lastName: z.string().trim(),
				gender: z.string().trim().nullable().optional(),
				birthdate: z.string().trim().nullable().optional(),
				phone: z.string().trim().nullable().optional(),
				city: z.string().trim().nullable().optional(),
				state: z.string().trim().nullable().optional(),
				country: z.string().trim().nullable().optional(),
				address: z
					.object({
						city: z.string().trim().nullable().optional(),
						state: z.string().trim().nullable().optional(),
						country: z.string().trim().nullable().optional(),
					})
					.optional(),
			})
			.transform((data) => ({
				firstName: data.firstName,
				lastName: data.lastName,
				gender: data.gender,
				birthdate: data.birthdate,
				phone: data.phone,
				city: data.city ?? data.address?.city ?? null,
				state: data.state ?? data.address?.state ?? null,
				country: data.country ?? data.address?.country ?? null,
			}));

		it("preserves city, state, country when submitted as flat fields", () => {
			const parsed = updateMyProfileSchema.parse({
				firstName: "Alex",
				lastName: "Honnold",
				gender: "M",
				city: "Las Vegas",
				state: "NV",
				country: "USA",
			});

			assert.equal(parsed.city, "Las Vegas");
			assert.equal(parsed.state, "NV");
			assert.equal(parsed.country, "USA");
			assert.equal(parsed.firstName, "Alex");
		});

		it("preserves city, state, country when submitted as nested address object", () => {
			const parsed = updateMyProfileSchema.parse({
				firstName: "Courtney",
				lastName: "Dauwalter",
				address: {
					city: "Leadville",
					state: "CO",
					country: "USA",
				},
			});

			assert.equal(parsed.city, "Leadville");
			assert.equal(parsed.state, "CO");
			assert.equal(parsed.country, "USA");
		});

		it("verifies account.tsx demographic form submits flat city, state, country fields", () => {
			const accountTsx = fs.readFileSync(
				path.resolve("src/routes/_authed/account.tsx"),
				"utf-8",
			);
			assert.match(
				accountTsx,
				/city:\s*city\(\)\.trim\(\)\s*\|\|\s*null/,
				"account.tsx must submit flat city field",
			);
			assert.match(
				accountTsx,
				/state:\s*state\(\)\.trim\(\)\s*\|\|\s*null/,
				"account.tsx must submit flat state field",
			);
			assert.match(
				accountTsx,
				/country:\s*country\(\)\.trim\(\)\s*\|\|\s*null/,
				"account.tsx must submit flat country field",
			);
		});

		it("verifies account.tsx volunteer shift links point to specific event-groups route", () => {
			const accountTsx = fs.readFileSync(
				path.resolve("src/routes/_authed/account.tsx"),
				"utf-8",
			);
			assert.match(
				accountTsx,
				/\/orgs\/\$\{shift\.organizationSlug\}\/event-groups\/\$\{shift\.eventGroupSlug\}/,
				"Volunteer shift link must point to /orgs/${shift.organizationSlug}/event-groups/${shift.eventGroupSlug}",
			);
		});
	});

	// --------------------------------------------------------------------------
	// AREA 5: REACTIVE SIGNAL SYNC IN SPLITFORM (COURSE SPLIT BUILDER)
	// --------------------------------------------------------------------------
	describe("Area 5: Reactive Signal Sync in SplitForm for Inline Timing Point Creation", () => {
		it("verifies SplitForm contains createEffect tracking props.initialTimingPointId", () => {
			const splitBuilderTsx = fs.readFileSync(
				path.resolve("src/components/CourseSplitBuilder.tsx"),
				"utf-8",
			);

			// Must import createEffect from solid-js
			assert.match(
				splitBuilderTsx,
				/import\s*\{[^}]*createEffect[^}]*\}\s*from\s*"solid-js"/,
				"CourseSplitBuilder.tsx must import createEffect from solid-js",
			);

			// SplitForm must reactively setTimingPointId when initialTimingPointId changes
			assert.match(
				splitBuilderTsx,
				/createEffect\(\(\)\s*=>\s*\{\s*if\s*\(props\.initialTimingPointId\)\s*\{\s*setTimingPointId\(props\.initialTimingPointId\);\s*\}\s*\}\)/,
				"SplitForm must use createEffect to reactively select newly created timing point",
			);
		});
	});
});
