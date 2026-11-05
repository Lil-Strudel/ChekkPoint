import { z } from "zod";
import type {
	disciplineEnum,
	entrantStatusEnum,
	experienceTierEnum,
} from "../db/schema";

export type PublicDiscipline = (typeof disciplineEnum.enumValues)[number];
export type PublicExperienceTier =
	(typeof experienceTierEnum.enumValues)[number];
export type PublicEntrantStatus = (typeof entrantStatusEnum.enumValues)[number];
export type TemporalState = "live" | "upcoming" | "past";
export type PacingStrategy = "even" | "conservative" | "positive";

export const PUBLIC_DISCIPLINES: readonly PublicDiscipline[] = [
	"trail_ultra",
	"road_marathon",
	"backyard_ultra",
	"fixed_time_loop",
	"downhill_mtb",
	"xco_cycling",
	"tsd_regularity",
] as const;

export const PUBLIC_EXPERIENCE_TIERS: readonly PublicExperienceTier[] = [
	"novice",
	"intermediate",
	"veteran",
	"elite",
] as const;

export interface DisciplineMeta {
	value: PublicDiscipline;
	label: string;
	shortLabel: string;
	competitorLabel: string;
	badgeVariant: "forest" | "sage" | "clay" | "sand";
	summary: string;
	scoringSummary: string;
}

export const DISCIPLINE_META: Record<PublicDiscipline, DisciplineMeta> = {
	trail_ultra: {
		value: "trail_ultra",
		label: "Trail Ultra",
		shortLabel: "Trail ultra",
		competitorLabel: "Bib #",
		badgeVariant: "forest",
		summary:
			"Mountain point-to-point, out-and-back, and multi-loop trail ultras with aid station IN/OUT dwell tracking and hard cutoffs.",
		scoringSummary:
			"Cumulative elapsed time with mandatory checkpoint sequence validation, time allowances, and aid station departure cutoffs.",
	},
	road_marathon: {
		value: "road_marathon",
		label: "Road Marathon",
		shortLabel: "Road",
		competitorLabel: "Bib #",
		badgeVariant: "sage",
		summary:
			"Mass and wave-started road distance events with high-density chip mats, gun time vs. net time, and age-group divisions.",
		scoringSummary:
			"Wave offset net chip time for age-group awards and gun time for overall championship podiums.",
	},
	backyard_ultra: {
		value: "backyard_ultra",
		label: "Backyard Ultra",
		shortLabel: "Backyard ultra",
		competitorLabel: "Bib #",
		badgeVariant: "clay",
		summary:
			"Last Person Standing 4.1667-mile hourly loops where every competitor must toe the line at the top of each hour.",
		scoringSummary:
			"Total completed hourly yards; one winner completes a solo final yard while all others receive an official Assist (DNF).",
	},
	fixed_time_loop: {
		value: "fixed_time_loop",
		label: "Fixed-Time Loop",
		shortLabel: "Fixed time",
		competitorLabel: "Bib #",
		badgeVariant: "forest",
		summary:
			"6-hour, 12-hour, 24-hour, and 48-hour track or trail loop events maximizing total distance before the horn.",
		scoringSummary:
			"Completed lap count and cumulative distance, with tie-breaking by earliest arrival on the final completed lap.",
	},
	downhill_mtb: {
		value: "downhill_mtb",
		label: "Downhill MTB",
		shortLabel: "Downhill MTB",
		competitorLabel: "Plate #",
		badgeVariant: "clay",
		summary:
			"Staggered individual start gravity racing with optical photocell gates, intermediate speed sectors, and millisecond precision.",
		scoringSummary:
			"Individual run elapsed time (MM:SS.sss) from start wand release to finish beam break.",
	},
	xco_cycling: {
		value: "xco_cycling",
		label: "XC & Gravel",
		shortLabel: "XC & gravel",
		competitorLabel: "Plate #",
		badgeVariant: "sage",
		summary:
			"Cross-country Olympic lap races and long-course backcountry gravel grinders with feed-zone and lap timing.",
		scoringSummary:
			"Multi-lap or point-to-point elapsed time with 80% lap pull tracking and category wave standings.",
	},
	tsd_regularity: {
		value: "tsd_regularity",
		label: "TSD Regularity Rally",
		shortLabel: "Regularity rally",
		competitorLabel: "Car #",
		badgeVariant: "sand",
		summary:
			"Time-Speed-Distance road rally where driver/navigator crews maintain exact average speeds past hidden checkpoints.",
		scoringSummary:
			"Lowest cumulative penalty points across secret checkpoints; early arrivals are penalized 2x per second vs. late arrivals.",
	},
};

export interface ExperienceTierMeta {
	value: PublicExperienceTier;
	label: string;
	badgeVariant: "sand" | "sage" | "forest" | "clay";
	description: string;
}

export const EXPERIENCE_TIER_META: Record<
	PublicExperienceTier,
	ExperienceTierMeta
> = {
	novice: {
		value: "novice",
		label: "Novice",
		badgeVariant: "sand",
		description: "Building initial ultra & endurance checkpoint history",
	},
	intermediate: {
		value: "intermediate",
		label: "Intermediate",
		badgeVariant: "sage",
		description: "Established multi-event finisher with verified split pacing",
	},
	veteran: {
		value: "veteran",
		label: "Veteran",
		badgeVariant: "forest",
		description: "Seasoned multi-year endurance athlete with high finish rate",
	},
	elite: {
		value: "elite",
		label: "Elite",
		badgeVariant: "clay",
		description: "Top-percentile podium contender & high ITRA/UltraSignup rank",
	},
};

export const ENTRANT_STATUS_META: Record<
	PublicEntrantStatus,
	{
		label: string;
		badgeVariant: "forest" | "sage" | "clay" | "sand" | "destructive";
	}
> = {
	registered: { label: "Registered", badgeVariant: "sand" },
	checked_in: { label: "Checked in", badgeVariant: "sage" },
	dns: { label: "DNS", badgeVariant: "sand" },
	in_progress: { label: "On course", badgeVariant: "clay" },
	finished: { label: "Finished", badgeVariant: "forest" },
	dnf: { label: "DNF (Aid Station)", badgeVariant: "sand" },
	retired: { label: "ROC (Out on Course)", badgeVariant: "destructive" },
	dq: { label: "DQ", badgeVariant: "destructive" },
	otl: { label: "Over Time Limit", badgeVariant: "clay" },
};

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

export function getEventGroupTemporalState(
	startDate: Date | string,
	endDate: Date | string,
	now: Date = new Date(),
): TemporalState {
	const startMs =
		typeof startDate === "string"
			? new Date(startDate).getTime()
			: startDate.getTime();
	const endMs =
		typeof endDate === "string"
			? new Date(endDate).getTime()
			: endDate.getTime();
	const nowMs = now.getTime();

	if (nowMs >= startMs && nowMs <= endMs) {
		return "live";
	}
	if (nowMs < startMs) {
		return "upcoming";
	}
	return "past";
}

export function formatDuration(
	totalSeconds: number | null | undefined,
	options?: { showMillis?: boolean },
): string {
	if (
		totalSeconds === null ||
		totalSeconds === undefined ||
		Number.isNaN(totalSeconds)
	) {
		return "—";
	}
	const clamped = Math.max(0, totalSeconds);
	const wholeSeconds = Math.floor(clamped);
	const millis = Math.round((clamped - wholeSeconds) * 1000);
	const hours = Math.floor(wholeSeconds / 3600);
	const minutes = Math.floor((wholeSeconds % 3600) / 60);
	const seconds = wholeSeconds % 60;

	const base = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	if (options?.showMillis) {
		return `${base}.${String(millis).padStart(3, "0")}`;
	}
	return base;
}

export function formatPacePerMile(
	secondsPerKm: number | null | undefined,
): string {
	if (
		secondsPerKm === null ||
		secondsPerKm === undefined ||
		secondsPerKm <= 0 ||
		Number.isNaN(secondsPerKm)
	) {
		return "—";
	}
	const secondsPerMile = Math.round(secondsPerKm * 1.609344);
	const mins = Math.floor(secondsPerMile / 60);
	const secs = secondsPerMile % 60;
	return `${mins}:${String(secs).padStart(2, "0")} /mi`;
}

export function formatDistanceMiles(
	meters: number | null | undefined,
	decimals = 1,
): string {
	if (meters === null || meters === undefined || Number.isNaN(meters)) {
		return "—";
	}
	const miles = meters / METERS_PER_MILE;
	return `${miles.toFixed(decimals)} mi`;
}

export function formatElevationFeet(meters: number | null | undefined): string {
	if (meters === null || meters === undefined || Number.isNaN(meters)) {
		return "—";
	}
	const feet = Math.round(meters * FEET_PER_METER);
	return `${new Intl.NumberFormat("en-US").format(feet)} ft`;
}

export function formatPersonDisplayName(person: {
	firstName: string;
	lastName: string;
	useInitialsOnly?: boolean;
}): string {
	const first = person.firstName.trim();
	const last = person.lastName.trim();
	if (person.useInitialsOnly) {
		const fInit = first ? `${first[0].toUpperCase()}.` : "";
		const lInit = last ? `${last[0].toUpperCase()}.` : "";
		return `${fInit} ${lInit}`.trim();
	}
	return `${first} ${last}`.trim();
}

export function formatSubSplitKindLabel(bitmap: number): string {
	if (bitmap === 3) return "IN + OUT";
	if (bitmap === 2) return "OUT only";
	return "IN / Point";
}

export function parseOrganizationMeta(metadata: string | null | undefined): {
	location: string;
	timeZone: string;
	description: string;
	website?: string;
	establishedYear?: number;
} {
	const fallback = {
		location: "Wasatch Front, UT",
		timeZone: "America/Denver",
		description:
			"Endurance race organization timing checkpoints and publishing verified results on ChekkPoint.",
	};
	if (!metadata) return fallback;
	try {
		const parsed = JSON.parse(metadata) as Record<string, unknown>;
		return {
			location:
				typeof parsed.location === "string" && parsed.location
					? parsed.location
					: fallback.location,
			timeZone:
				typeof parsed.timeZone === "string" && parsed.timeZone
					? parsed.timeZone
					: fallback.timeZone,
			description:
				typeof parsed.description === "string" && parsed.description
					? parsed.description
					: fallback.description,
			website: typeof parsed.website === "string" ? parsed.website : undefined,
			establishedYear:
				typeof parsed.establishedYear === "number"
					? parsed.establishedYear
					: undefined,
		};
	} catch {
		return fallback;
	}
}

export interface EffortSplitInput {
	id: string;
	name: string;
	sequenceOrder: number;
	distanceFromStartMeters: number;
	elevationMeters?: number | null;
	subSplitBitmap: number;
	cutoffDurationSeconds?: number | null;
}

export interface CalculatedEffortSplit {
	splitId: string;
	name: string;
	sequenceOrder: number;
	distanceFromStartMeters: number;
	segmentDistanceMeters: number;
	elevationMeters: number | null;
	subSplitBitmap: number;
	predictedElapsedSeconds: number;
	predictedElapsedFormatted: string;
	segmentSeconds: number;
	segmentPaceSecondsPerKm: number;
	segmentPaceFormatted: string;
	timeOfDayFormatted: string;
	isNighttime: boolean;
	cutoffDurationSeconds: number | null;
	cutoffBufferSeconds: number | null;
	cutoffBufferFormatted: string;
	cutoffStatus: "safe" | "tight" | "missed" | "none";
}

export interface CalculateEffortInput {
	totalDistanceMeters: number;
	targetFinishSeconds: number;
	startTimeHHMM: string;
	strategy: PacingStrategy;
	splits: EffortSplitInput[];
}

function parseStartTimeMinutes(hhmm: string): number {
	const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
	if (!match) return 6 * 60; // default 06:00
	const hours = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)));
	const mins = Math.min(59, Math.max(0, Number.parseInt(match[2], 10)));
	return hours * 60 + mins;
}

function formatClockTimeOfDay(
	startMinutesFromMidnight: number,
	elapsedSeconds: number,
): { formatted: string; isNighttime: boolean } {
	const totalMinutes =
		startMinutesFromMidnight + Math.round(elapsedSeconds / 60);
	const dayOffset = Math.floor(totalMinutes / (24 * 60));
	const minuteOfDay = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
	const hour24 = Math.floor(minuteOfDay / 60);
	const minute = minuteOfDay % 60;

	const period = hour24 >= 12 ? "PM" : "AM";
	const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
	const daySuffix = dayOffset > 0 ? ` (+${dayOffset}d)` : "";
	const isNighttime = hour24 < 6 || hour24 >= 20;

	return {
		formatted: `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}${daySuffix}`,
		isNighttime,
	};
}

/**
 * Pure Pace Calculator ("Plan My Effort") engine for public course pages.
 * Models cumulative arrival times, segment paces, time-of-day, and cutoff buffers.
 */
export function calculateEffortSplits(
	input: CalculateEffortInput,
): CalculatedEffortSplit[] {
	const totalDist = Math.max(1, input.totalDistanceMeters);
	const targetSec = Math.max(60, input.targetFinishSeconds);
	const startMins = parseStartTimeMinutes(input.startTimeHHMM);

	// Strategy fade coefficient alpha in g(f) = f * (1 - alpha * (1 - f))
	// alpha = 0 -> even pace
	// alpha = 0.08 -> conservative (~8% second-half fade)
	// alpha = 0.16 -> positive (~16% mountain/night fatigue fade)
	const alpha =
		input.strategy === "even"
			? 0
			: input.strategy === "conservative"
				? 0.08
				: 0.16;

	const ordered = [...input.splits].sort(
		(a, b) => a.sequenceOrder - b.sequenceOrder,
	);

	let prevDistMeters = 0;
	let prevElapsedSeconds = 0;

	return ordered.map((split) => {
		const clampedDist = Math.min(
			totalDist,
			Math.max(prevDistMeters, split.distanceFromStartMeters),
		);
		const f = clampedDist / totalDist;
		const timeFraction = f * (1 - alpha * (1 - f));
		const predictedElapsedSeconds = Math.round(targetSec * timeFraction);

		const segmentDistanceMeters = Math.max(0, clampedDist - prevDistMeters);
		const segmentSeconds = Math.max(
			0,
			predictedElapsedSeconds - prevElapsedSeconds,
		);
		const segmentPaceSecondsPerKm =
			segmentDistanceMeters > 0
				? segmentSeconds / (segmentDistanceMeters / 1000)
				: targetSec / (totalDist / 1000);

		const tod = formatClockTimeOfDay(startMins, predictedElapsedSeconds);

		const cutoff =
			split.cutoffDurationSeconds !== undefined &&
			split.cutoffDurationSeconds !== null
				? split.cutoffDurationSeconds
				: null;
		const buffer = cutoff !== null ? cutoff - predictedElapsedSeconds : null;

		let cutoffStatus: CalculatedEffortSplit["cutoffStatus"] = "none";
		let cutoffBufferFormatted = "No cutoff";
		if (buffer !== null) {
			if (buffer < 0) {
				cutoffStatus = "missed";
				cutoffBufferFormatted = `-${formatDuration(Math.abs(buffer))}`;
			} else if (buffer < 1800) {
				cutoffStatus = "tight";
				cutoffBufferFormatted = `+${formatDuration(buffer)}`;
			} else {
				cutoffStatus = "safe";
				cutoffBufferFormatted = `+${formatDuration(buffer)}`;
			}
		}

		prevDistMeters = clampedDist;
		prevElapsedSeconds = predictedElapsedSeconds;

		return {
			splitId: split.id,
			name: split.name,
			sequenceOrder: split.sequenceOrder,
			distanceFromStartMeters: split.distanceFromStartMeters,
			segmentDistanceMeters,
			elevationMeters: split.elevationMeters ?? null,
			subSplitBitmap: split.subSplitBitmap,
			predictedElapsedSeconds,
			predictedElapsedFormatted: formatDuration(predictedElapsedSeconds),
			segmentSeconds,
			segmentPaceSecondsPerKm,
			segmentPaceFormatted: formatPacePerMile(segmentPaceSecondsPerKm),
			timeOfDayFormatted: tod.formatted,
			isNighttime: tod.isNighttime,
			cutoffDurationSeconds: cutoff,
			cutoffBufferSeconds: buffer,
			cutoffBufferFormatted,
			cutoffStatus,
		};
	});
}

// ============================================================================
// ZOD VALIDATORS FOR PUBLIC SERVER FUNCTIONS
// ============================================================================

export const omniboxSearchInput = z.object({
	query: z.string().trim().max(100).default(""),
});

export const eventsDirectoryInput = z.object({
	query: z.string().trim().max(100).optional(),
	discipline: z.enum(PUBLIC_DISCIPLINES).optional(),
	tab: z.enum(["all", "live", "upcoming", "past"]).optional(),
});

export const eventGroupSlugInput = z.object({
	slug: z.string().trim().min(1),
});

export const athletesDirectoryInput = z.object({
	query: z.string().trim().max(100).optional(),
	tier: z.enum(PUBLIC_EXPERIENCE_TIERS).optional(),
	discipline: z.enum(PUBLIC_DISCIPLINES).optional(),
});

export const athleteIdInput = z.object({
	personId: z.string().trim().min(1),
});

export const courseIdInput = z.object({
	courseId: z.string().trim().min(1),
});

export const organizerSlugInput = z.object({
	slug: z.string().trim().min(1),
});
