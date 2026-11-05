import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	feetToMeters,
	formatDay,
	formatDuration,
	formatFeet,
	formatMiles,
	formatStart,
	metersToFeet,
	metersToFeetInput,
	metersToMiles,
	metersToMilesInput,
	milesToMeters,
	mergeOrganizationMetadata,
	parseDuration,
	subSplitBitmapLabel,
} from "../format.ts";
import {
	createEventGroupInput,
	createTimingPointInput,
	DISCIPLINES,
	slugify,
	updateOrganizationDetailsInput,
} from "../orgs.shared.ts";

describe("Organization Unit Conversions & Formatting", () => {
	it("converts miles and meters accurately", () => {
		const oneMileInMeters = 1609.344;
		assert.equal(milesToMeters(1), oneMileInMeters);
		assert.equal(metersToMiles(oneMileInMeters), 1);
		assert.equal(formatMiles(oneMileInMeters), "1 mi");
		assert.equal(metersToMilesInput(oneMileInMeters, 2), "1.00");
	});

	it("converts feet and meters accurately", () => {
		const meters = 1000;
		const expectedFeet = 3280.84;
		assert.ok(Math.abs(metersToFeet(meters) - expectedFeet) < 0.1);
		assert.equal(formatFeet(meters), "3,281 ft");
		assert.equal(metersToFeetInput(meters, 0), "3281");
		assert.ok(Math.abs(feetToMeters(expectedFeet) - meters) < 0.1);
	});

	it("formats and parses HH:MM durations", () => {
		assert.equal(formatDuration(3600), "1:00");
		assert.equal(formatDuration(5400), "1:30");
		assert.equal(formatDuration(90), "0:02"); // rounds to 2 mins
		assert.equal(parseDuration("1:30"), 5400);
		assert.equal(parseDuration("30:00"), 108000);
		assert.equal(parseDuration("invalid"), null);
	});

	it("formats day and start strings with time zones", () => {
		const utcMidnight = new Date("2026-10-15T00:00:00.000Z");
		assert.equal(formatDay(utcMidnight), "Oct 15, 2026");

		const startString = formatStart(utcMidnight, "America/Denver");
		assert.ok(startString.includes("Oct 14") || startString.includes("Oct 15"));
	});

	it("formats serialized string dates, timestamps, null, and undefined safely", () => {
		// ISO date strings (as serialized over TanStack loader JSON)
		assert.equal(formatDay("2026-10-15T00:00:00.000Z"), "Oct 15, 2026");
		const startFormatted = formatStart(
			"2026-10-15T08:00:00.000Z",
			"America/Denver",
		);
		assert.ok(startFormatted.includes("Oct 15"));
		assert.ok(startFormatted.includes("2:00 AM"));

		// Millisecond timestamp numbers
		const epochMs = new Date("2026-10-15T00:00:00.000Z").getTime();
		assert.equal(formatDay(epochMs), "Oct 15, 2026");

		// Null, undefined, and invalid dates return empty string without throwing
		assert.equal(formatDay(null), "");
		assert.equal(formatDay(undefined), "");
		assert.equal(formatDay("invalid-date-string"), "");
		assert.equal(formatStart(null, "America/Denver"), "");
		assert.equal(formatStart(undefined, "America/Denver"), "");
		assert.equal(formatStart("invalid-date-string", "America/Denver"), "");
	});

	it("labels sub-split bitmaps accurately", () => {
		assert.equal(subSplitBitmapLabel(1), "IN / Point");
		assert.equal(subSplitBitmapLabel(2), "OUT only");
		assert.equal(subSplitBitmapLabel(3), "IN + OUT");
	});
});

describe("Organization Metadata JSON Merge", () => {
	it("preserves untouched fields when updating metadata", () => {
		const existing = JSON.stringify({
			description: "Initial description",
			location: "Wasatch Range",
			timeZone: "America/Denver",
			website: "https://example.com",
			establishedYear: 2010,
			customKey: "preserved",
		});

		const updated = mergeOrganizationMetadata(existing, {
			description: "Updated description",
			location: "Salt Lake City, UT",
		});

		const parsed = JSON.parse(updated);
		assert.equal(parsed.description, "Updated description");
		assert.equal(parsed.location, "Salt Lake City, UT");
		assert.equal(parsed.timeZone, "America/Denver");
		assert.equal(parsed.website, "https://example.com");
		assert.equal(parsed.establishedYear, 2010);
		assert.equal(parsed.customKey, "preserved");
	});

	it("handles null or invalid existing metadata gracefully", () => {
		const updated = mergeOrganizationMetadata(null, {
			description: "New org",
			location: "Boulder, CO",
			timeZone: "America/Denver",
		});
		const parsed = JSON.parse(updated);
		assert.equal(parsed.description, "New org");
		assert.equal(parsed.location, "Boulder, CO");
	});

	it("deletes cleared fields when explicitly set to null or empty string", () => {
		const existing = JSON.stringify({
			description: "Old",
			website: "https://old.com",
		});
		const updated = mergeOrganizationMetadata(existing, {
			website: "",
		});
		const parsed = JSON.parse(updated);
		assert.equal(parsed.description, "Old");
		assert.equal("website" in parsed, false);
	});
});

describe("Wave 1 Zod Schemas", () => {
	it("validates slugify generator and slug constraints", () => {
		assert.equal(slugify("Wasatch 100 Miler!"), "wasatch-100-miler");
		assert.equal(slugify("Cascade Crest 2026"), "cascade-crest-2026");
	});

	it("validates updateOrganizationDetailsInput schema", () => {
		const valid = {
			organizationId: "11111111-1111-4111-8111-111111111111",
			name: "Wasatch Trail Series",
			slug: "wasatch-trail-series",
			timeZone: "America/Denver",
			description: "Premier trail running events in Utah.",
			location: "Salt Lake City, UT",
			website: "https://wasatchtrail.com",
			establishedYear: 2015,
		};
		const result = updateOrganizationDetailsInput.safeParse(valid);
		assert.equal(result.success, true);
	});

	it("validates createEventGroupInput dates", () => {
		const valid = {
			organizationId: "11111111-1111-4111-8111-111111111111",
			name: "2026 Spring Thaw",
			discipline: "trail_ultra" as const,
			startDate: "2026-04-10",
			endDate: "2026-04-12",
			timeZone: "America/Denver",
			location: "Moab, UT",
		};
		assert.equal(createEventGroupInput.safeParse(valid).success, true);

		const invalidDates = {
			...valid,
			startDate: "2026-04-12",
			endDate: "2026-04-10",
		};
		assert.equal(createEventGroupInput.safeParse(invalidDates).success, false);
	});

	it("validates timing point lat/lng coordinates", () => {
		const valid = {
			organizationId: "11111111-1111-4111-8111-111111111111",
			name: "Aid Station 1 - Big Spring",
			code: "AS1",
			latitude: 40.5,
			longitude: -111.7,
			elevationMeters: 2450,
		};
		assert.equal(createTimingPointInput.safeParse(valid).success, true);

		const invalidLat = { ...valid, latitude: 95.0 };
		assert.equal(createTimingPointInput.safeParse(invalidLat).success, false);
	});
});
