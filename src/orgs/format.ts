// A pinned locale keeps SSR and hydrated text identical.
const LOCALE = "en-US";
const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

const miles = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const feet = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

export function formatMiles(meters: number): string {
	return `${miles.format(metersToMiles(meters))} mi`;
}

export function formatFeet(meters: number): string {
	return `${feet.format(metersToFeet(meters))} ft`;
}

function toValidDate(
	date: Date | string | number | null | undefined,
): Date | null {
	if (!date) return null;
	const d =
		typeof date === "object" && date instanceof Date ? date : new Date(date);
	if (Number.isNaN(d.getTime())) return null;
	return d;
}

// Event group dates are calendar days stored as UTC midnight.
export function formatDay(
	date: Date | string | number | null | undefined,
): string {
	const d = toValidDate(date);
	if (!d) return "";
	return new Intl.DateTimeFormat(LOCALE, {
		timeZone: "UTC",
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(d);
}

export function formatStart(
	date: Date | string | number | null | undefined,
	timeZone: string,
): string {
	const d = toValidDate(date);
	if (!d) return "";
	return new Intl.DateTimeFormat(LOCALE, {
		timeZone: timeZone || "UTC",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	}).format(d);
}

export function milesToMeters(milesVal: number): number {
	return milesVal * METERS_PER_MILE;
}

export function metersToMiles(meters: number): number {
	return meters / METERS_PER_MILE;
}

export function metersToMilesInput(meters: number, digits = 2): string {
	return (meters / METERS_PER_MILE).toFixed(digits);
}

export function feetToMeters(feetVal: number): number {
	return feetVal / FEET_PER_METER;
}

export function metersToFeet(meters: number): number {
	return meters * FEET_PER_METER;
}

export function metersToFeetInput(meters: number, digits = 0): string {
	return (meters * FEET_PER_METER).toFixed(digits);
}

// "HH:MM" durations, for cutoffs measured from the race start.
export function formatDuration(seconds: number): string {
	const minutes = Math.round(seconds / 60);
	return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

export const formatDurationSeconds = formatDuration;

export function parseDuration(value: string): number | null {
	const match = /^(\d+):([0-5]\d)$/.exec(value.trim());
	if (!match) return null;
	return Number(match[1]) * 3600 + Number(match[2]) * 60;
}

export const parseDurationToSeconds = parseDuration;

export function numberOrNull(value: string): number | null {
	return value.trim() === "" ? null : Number(value);
}

export function inputValue(value: number | null | undefined, digits = 0): string {
	return value == null ? "" : String(Number(value.toFixed(digits)));
}

export function subSplitBitmapLabel(bitmap: number): string {
	if (bitmap === 3) return "IN + OUT";
	if (bitmap === 2) return "OUT only";
	return "IN / Point";
}

export interface OrganizationMetadataUpdates {
	description?: string | null;
	location?: string | null;
	timeZone?: string | null;
	website?: string | null;
	establishedYear?: number | null;
	[key: string]: unknown;
}

export function mergeOrganizationMetadata(
	existingMetadata: string | null | undefined,
	updates: OrganizationMetadataUpdates,
): string {
	let existing: Record<string, unknown> = {};
	if (existingMetadata) {
		try {
			existing = JSON.parse(existingMetadata);
		} catch {
			existing = {};
		}
	}
	const merged = { ...existing };
	for (const [key, value] of Object.entries(updates)) {
		if (value === undefined) continue;
		if (value === null || value === "") {
			delete merged[key];
		} else {
			merged[key] = value;
		}
	}
	return JSON.stringify(merged);
}
