import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	calculateDwellSeconds,
	calculateSegmentPaceSecondsPerKm,
	calculateTsdPenalty,
	damerauLevenshtein,
	formatItraCsv,
	formatStandardCsv,
	formatUltraSignupCsv,
	getTypoRecommendation,
	parseMt63Block,
	redactPublicEntrantData,
} from "../domain-algorithms.ts";

describe("Tier 1: Pure Unit Math, Algorithms & Parsers", () => {
	// ==========================================================================
	// 1. DAMERAU-LEVENSHTEIN TYPO-DEFENSE ENGINE
	// ==========================================================================
	describe("Damerau-Levenshtein typo-defense HUD (damerauLevenshtein)", () => {
		it("detects exact matches with distance 0", () => {
			assert.equal(damerauLevenshtein("142", "142"), 0);
			assert.equal(damerauLevenshtein("Bib-88", "Bib-88"), 0);
			assert.equal(damerauLevenshtein("", ""), 0);
		});

		it("detects adjacent digit transpositions with distance 1 (primary typo mode)", () => {
			// In endurance events, volunteers typing quickly frequently transpose adjacent digits
			assert.equal(damerauLevenshtein("142", "124"), 1); // 42 <-> 24
			assert.equal(damerauLevenshtein("5021", "5201"), 1); // 02 <-> 20
			assert.equal(damerauLevenshtein("987", "978"), 1); // 87 <-> 78
		});

		it("detects single-character substitutions with distance 1", () => {
			assert.equal(damerauLevenshtein("101", "102"), 1);
			assert.equal(damerauLevenshtein("350", "360"), 1);
		});

		it("detects single-character insertions and deletions with distance 1", () => {
			assert.equal(damerauLevenshtein("12", "123"), 1); // insertion
			assert.equal(damerauLevenshtein("1234", "124"), 1); // deletion of '3'
			assert.equal(damerauLevenshtein("4", "42"), 1);
		});

		it("correctly penalizes non-adjacent swaps with distance > 1", () => {
			// Swapping non-adjacent characters is NOT a single adjacent transposition
			assert.equal(damerauLevenshtein("1423", "3421"), 2);
		});

		it("handles empty string boundary conditions", () => {
			assert.equal(damerauLevenshtein("", "123"), 3);
			assert.equal(damerauLevenshtein("456", ""), 3);
		});

		it("recommends closest registered bib when edit distance <= 1", () => {
			const expectedBibs = ["124", "205", "310", "450"];
			const rec = getTypoRecommendation("142", expectedBibs);

			assert.ok(rec !== null);
			assert.equal(rec.enteredBib, "142");
			assert.equal(rec.recommendedBib, "124");
			assert.equal(rec.distance, 1);
			assert.equal(rec.confidence, "high");
		});

		it("does not recommend when candidate distance exceeds threshold", () => {
			const expectedBibs = ["999", "888", "777"];
			const rec = getTypoRecommendation("142", expectedBibs, 1);
			assert.equal(rec, null);
		});

		it("identifies exact match in candidate pool with distance 0", () => {
			const expectedBibs = ["142", "205", "310"];
			const rec = getTypoRecommendation("142", expectedBibs);
			assert.ok(rec !== null);
			assert.equal(rec.distance, 0);
			assert.equal(rec.confidence, "exact");
		});
	});

	// ==========================================================================
	// 2. MT63 HAM RADIO TEXT BLOCK PARSER
	// ==========================================================================
	describe("MT63 radio text block parser (parseMt63Block)", () => {
		it("parses valid multi-line radio transcription blocks", () => {
			const rawBlock = `
        # Net Control Ingest - Aid Station 3
        TWIN 142 IN 14:22:31 P
        TWIN 142 OUT 14:35:10
        TWIN 88 POINT 14:36:00
      `;

			const result = parseMt63Block(rawBlock);

			assert.equal(result.errors.length, 0);
			assert.equal(result.punches.length, 3);

			// Punch 1: IN with pacer
			assert.equal(result.punches[0].stationCode, "TWIN");
			assert.equal(result.punches[0].competitorNumber, "142");
			assert.equal(result.punches[0].subSplitKind, "in");
			assert.equal(result.punches[0].timeOfDay, "14:22:31");
			assert.equal(result.punches[0].withPacer, true);

			// Punch 2: OUT without pacer
			assert.equal(result.punches[1].stationCode, "TWIN");
			assert.equal(result.punches[1].competitorNumber, "142");
			assert.equal(result.punches[1].subSplitKind, "out");
			assert.equal(result.punches[1].timeOfDay, "14:35:10");
			assert.equal(result.punches[1].withPacer, false);

			// Punch 3: POINT instantaneous flying checkpoint
			assert.equal(result.punches[2].stationCode, "TWIN");
			assert.equal(result.punches[2].competitorNumber, "88");
			assert.equal(result.punches[2].subSplitKind, "point");
			assert.equal(result.punches[2].timeOfDay, "14:36:00");
			assert.equal(result.punches[2].withPacer, false);
		});

		it("normalizes case and handles varied pacer indicators (PACER, +P)", () => {
			const rawBlock = `
        twin 42 in 08:15:00 PACER
        LAKE 99 OUT 09:30:00 +P
        RIDGE 101 pt 10:45:00
      `;

			const result = parseMt63Block(rawBlock);
			assert.equal(result.errors.length, 0);
			assert.equal(result.punches.length, 3);

			assert.equal(result.punches[0].stationCode, "TWIN");
			assert.equal(result.punches[0].withPacer, true);

			assert.equal(result.punches[1].stationCode, "LAKE");
			assert.equal(result.punches[1].withPacer, true);

			assert.equal(result.punches[2].subSplitKind, "point");
			assert.equal(result.punches[2].withPacer, false);
		});

		it("flags malformed lines with descriptive error diagnostics", () => {
			const malformedBlock = `
        # Valid line
        TWIN 142 IN 14:22:31
        # Incomplete line
        TWIN 142
        # Bad kind
        TWIN 142 MAYBE 14:22:31
        # Bad timestamp format
        TWIN 142 IN 99:88:77
      `;

			const result = parseMt63Block(malformedBlock);
			assert.equal(result.punches.length, 1);
			assert.equal(result.errors.length, 3);

			assert.match(result.errors[0].reason, /Insufficient tokens/);
			assert.match(result.errors[1].reason, /Invalid split kind/);
			assert.match(result.errors[2].reason, /Malformed time of day/);
		});
	});

	// ==========================================================================
	// 3. TSD REGULARITY RALLY PENALTY ENGINE
	// ==========================================================================
	describe("TSD regularity penalty engine (calculateTsdPenalty)", () => {
		const idealSeconds = 1800; // 30-minute target stage duration

		it("charges 2.0x penalty points per second for early arrivals (discouraging speeding)", () => {
			// Arrived 30 seconds early (actual = 1770s, target = 1800s)
			const res = calculateTsdPenalty(1770, idealSeconds);

			assert.equal(res.isEarly, true);
			assert.equal(res.isLate, false);
			assert.equal(res.deviationSeconds, -30);
			assert.equal(res.penaltyPoints, 60.0); // 30 * 2.0 = 60.0 points
		});

		it("charges 1.0x penalty points per second for late arrivals", () => {
			// Arrived 30 seconds late (actual = 1830s, target = 1800s)
			const res = calculateTsdPenalty(1830, idealSeconds);

			assert.equal(res.isEarly, false);
			assert.equal(res.isLate, true);
			assert.equal(res.deviationSeconds, 30);
			assert.equal(res.penaltyPoints, 30.0); // 30 * 1.0 = 30.0 points
		});

		it("charges 0.0 penalty points for perfect on-time arrival", () => {
			const res = calculateTsdPenalty(1800, idealSeconds);

			assert.equal(res.isExact, true);
			assert.equal(res.deviationSeconds, 0);
			assert.equal(res.penaltyPoints, 0.0);
		});

		it("honors grace period window before accruing penalties", () => {
			// Grace period = 5.0 seconds
			const config = { gracePeriodSeconds: 5.0 };

			// 4 seconds early: inside grace window -> 0 penalty
			const insideEarly = calculateTsdPenalty(1796, idealSeconds, config);
			assert.equal(insideEarly.penaltyPoints, 0.0);

			// 4 seconds late: inside grace window -> 0 penalty
			const insideLate = calculateTsdPenalty(1804, idealSeconds, config);
			assert.equal(insideLate.penaltyPoints, 0.0);

			// 10 seconds early (5s beyond grace window): 5s * 2.0 = 10.0 penalty points
			const outsideEarly = calculateTsdPenalty(1790, idealSeconds, config);
			assert.equal(outsideEarly.penaltyPoints, 10.0);

			// 10 seconds late (5s beyond grace window): 5s * 1.0 = 5.0 penalty points
			const outsideLate = calculateTsdPenalty(1810, idealSeconds, config);
			assert.equal(outsideLate.penaltyPoints, 5.0);
		});
	});

	// ==========================================================================
	// 4. AID STATION DWELL TIME & SEGMENT PACE CALCULATION
	// ==========================================================================
	describe("Dwell time & segment pace calculations", () => {
		it("calculates exact in-station dwell time (outTime - inTime)", () => {
			const inTime = new Date("2026-11-05T08:00:00Z");
			const outTime = new Date("2026-11-05T08:14:30Z");

			const dwellSeconds = calculateDwellSeconds(inTime, outTime);
			assert.equal(dwellSeconds, 870); // 14 minutes 30 seconds
		});

		it("handles chronological inversion safely by returning 0", () => {
			const inTime = new Date("2026-11-05T08:15:00Z");
			const outTime = new Date("2026-11-05T08:00:00Z");

			const dwellSeconds = calculateDwellSeconds(inTime, outTime);
			assert.equal(dwellSeconds, 0);
		});

		it("returns null when either inTime or outTime is missing", () => {
			assert.equal(calculateDwellSeconds(null, new Date()), null);
			assert.equal(calculateDwellSeconds(new Date(), null), null);
		});

		it("calculates segment pace in seconds per kilometer", () => {
			const segmentDistanceMeters = 10_000; // 10 km
			const segmentDurationSeconds = 3600; // 1 hour

			const pace = calculateSegmentPaceSecondsPerKm(
				segmentDistanceMeters,
				segmentDurationSeconds,
			);
			assert.equal(pace, 360); // 360 seconds/km (6:00/km)
		});

		it("handles zero distance without crashing or returning NaN/Infinity", () => {
			const pace = calculateSegmentPaceSecondsPerKm(0, 3600);
			assert.equal(pace, null);
		});

		it("handles negative duration safely by returning null", () => {
			const pace = calculateSegmentPaceSecondsPerKm(10_000, -500);
			assert.equal(pace, null);
		});
	});

	// ==========================================================================
	// 5. OFFICIAL CSV EXPORTS (ULTRASIGNUP, ITRA, STANDARD)
	// ==========================================================================
	describe("Official CSV formatting & header compliance", () => {
		const sampleRunners = [
			{
				place: 1,
				bib: "101",
				firstName: "Elena",
				lastName: "Vance",
				age: 34,
				gender: "F",
				birthDate: "1992-04-12",
				nationality: "USA",
				city: "Moab",
				state: "UT",
				totalElapsedSeconds: 78540, // 21:49:00
				status: "finished",
				division: "F Open",
			},
			{
				place: 2,
				bib: "42",
				firstName: 'Marcus "Speedy"',
				lastName: "Kane, Jr.",
				age: 29,
				gender: "M",
				birthDate: "1997-08-23",
				nationality: "CAN",
				city: "Banff",
				state: "AB",
				totalElapsedSeconds: 82110, // 22:48:30
				status: "finished",
				division: "M Open",
			},
			{
				place: null,
				bib: "7",
				firstName: "Sarah",
				lastName: "Connor",
				age: 41,
				gender: "F",
				birthDate: "1985-02-14",
				nationality: "USA",
				city: "Los Angeles",
				state: "CA",
				totalElapsedSeconds: null,
				status: "dnf",
				division: "F Masters",
			},
		];

		it("formats UltraSignup CSV with exact required headers and field escaping", () => {
			const csv = formatUltraSignupCsv(sampleRunners);
			const lines = csv.trim().split("\n");

			// Header verification
			assert.equal(
				lines[0],
				"Place,First Name,Last Name,Age,Gender,City,State,Bib,Time,Status",
			);

			// Line 1: Normal finisher
			assert.equal(
				lines[1],
				"1,Elena,Vance,34,F,Moab,UT,101,21:49:00,Finished",
			);

			// Line 2: Escaped quotes and commas in name
			assert.equal(
				lines[2],
				'2,"Marcus ""Speedy""","Kane, Jr.",29,M,Banff,AB,42,22:48:30,Finished',
			);

			// Line 3: DNF with empty place and time
			assert.equal(lines[3], ",Sarah,Connor,41,F,Los Angeles,CA,7,,DNF");
		});

		it("formats ITRA CSV with exact required headers and category mapping", () => {
			const csv = formatItraCsv(sampleRunners);
			const lines = csv.trim().split("\n");

			assert.equal(
				lines[0],
				"Bib,First Name,Last Name,Gender,Birth Date,Nationality,Time,Rank,Category,Status",
			);

			assert.equal(
				lines[1],
				"101,Elena,Vance,F,1992-04-12,USA,21:49:00,1,F Open,FINISHER",
			);

			assert.equal(
				lines[3],
				"7,Sarah,Connor,F,1985-02-14,USA,,,F Masters,DNF",
			);
		});

		it("formats Standard ChekkPoint CSV with penalty points", () => {
			const runnersWithPenalties = [
				{
					...sampleRunners[0],
					penaltyPoints: 0,
				},
				{
					...sampleRunners[1],
					penaltyPoints: 45.0,
				},
			];

			const csv = formatStandardCsv(runnersWithPenalties);
			const lines = csv.trim().split("\n");

			assert.equal(
				lines[0],
				"Place,Bib,Name,Gender,Age,Division,Status,TotalTime,PenaltyPoints",
			);

			assert.equal(
				lines[1],
				"1,101,Elena Vance,F,34,F Open,finished,21:49:00,0",
			);

			assert.equal(
				lines[2],
				'2,42,"Marcus ""Speedy"" Kane, Jr.",M,29,M Open,finished,22:48:30,45',
			);
		});
	});

	// ==========================================================================
	// 6. STRICT PUBLIC PII & MEDICAL DATA REDACTION
	// ==========================================================================
	describe("Strict public PII & medical redaction logic (redactPublicEntrantData)", () => {
		const privilegedEntrant = {
			id: "entrant-101",
			bibNumber: "101",
			firstName: "Elena",
			lastName: "Vance",
			status: "in_progress",
			medicalNotes: "Severe penicillin allergy, carries EpiPen in vest",
			safetyTriageNotes: "Treated for mild hypothermia at AS2 (Lambs Canyon)",
			allergies: "Penicillin, Bee stings",
			medications: "Albuterol inhaler",
			phone: "+1-801-555-0199",
			email: "elena.vance@example.com",
			rfidCode: "RFID-99042",
			address: { street: "123 Trail Rd", city: "Moab", state: "UT" },
			emergencyContactName: "David Vance",
			emergencyContactPhone: "+1-801-555-0188",
			emergencyContactRelation: "Spouse",
			emergencyContactIsOnSite: true,
			splits: [
				{ splitId: "sp-1", splitName: "Start", isSecretCheckpoint: false, elapsedSeconds: 0 },
				{ splitId: "sp-2", splitName: "Hidden Speed Trap", isSecretCheckpoint: true, elapsedSeconds: 3600 },
				{ splitId: "sp-3", splitName: "Finish", isSecretCheckpoint: false, elapsedSeconds: 7200 },
			],
		};

		it("completely strips sensitive medical and safety triage fields", () => {
			const redacted = redactPublicEntrantData(privilegedEntrant);

			// Assert private fields are deleted
			assert.equal((redacted as any).medicalNotes, undefined);
			assert.equal((redacted as any).safetyTriageNotes, undefined);
			assert.equal((redacted as any).allergies, undefined);
			assert.equal((redacted as any).medications, undefined);
		});

		it("completely strips direct contact phone numbers, emails, addresses and RFID transponder IDs", () => {
			const redacted = redactPublicEntrantData(privilegedEntrant);

			assert.equal((redacted as any).phone, undefined);
			assert.equal((redacted as any).email, undefined);
			assert.equal((redacted as any).rfidCode, undefined);
			assert.equal((redacted as any).address, undefined);
			assert.equal((redacted as any).emergencyContactName, undefined);
			assert.equal((redacted as any).emergencyContactPhone, undefined);
			assert.equal((redacted as any).emergencyContactRelation, undefined);

			// Only the non-identifying boolean flag is preserved
			assert.equal(redacted.hasEmergencyContactOnSite, true);
		});

		it("hides secret checkpoints from public split timeline during active race", () => {
			const redacted = redactPublicEntrantData(privilegedEntrant, {
				revealSecretSplits: false,
			});

			assert.ok(redacted.splits);
			assert.equal(redacted.splits.length, 2);
			assert.equal(redacted.splits[0].splitName, "Start");
			assert.equal(redacted.splits[1].splitName, "Finish");

			// Secret split must not exist
			assert.equal(
				redacted.splits.some((s) => s.splitName === "Hidden Speed Trap"),
				false,
			);
		});

		it("reveals secret checkpoints post-race when revealSecretSplits is enabled", () => {
			const revealed = redactPublicEntrantData(privilegedEntrant, {
				revealSecretSplits: true,
			});

			assert.ok(revealed.splits);
			assert.equal(revealed.splits.length, 3);
			assert.equal(revealed.splits[1].splitName, "Hidden Speed Trap");
		});
	});
});
