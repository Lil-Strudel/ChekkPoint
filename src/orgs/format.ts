// A pinned locale keeps SSR and hydrated text identical.
const LOCALE = "en-US";
const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

const miles = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const feet = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

export function formatMiles(meters: number) {
	return `${miles.format(metersToMiles(meters))} mi`;
}

export function formatFeet(meters: number) {
	return `${feet.format(metersToFeet(meters))} ft`;
}

// Event group dates are calendar days stored as UTC midnight.
export function formatDay(date: Date) {
	return new Intl.DateTimeFormat(LOCALE, {
		timeZone: "UTC",
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

export function formatStart(date: Date, timeZone: string) {
	return new Intl.DateTimeFormat(LOCALE, {
		timeZone,
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	}).format(date);
}

export function milesToMeters(miles: number) {
	return miles * METERS_PER_MILE;
}

export function metersToMiles(meters: number) {
	return meters / METERS_PER_MILE;
}

export function feetToMeters(feet: number) {
	return feet / FEET_PER_METER;
}

export function metersToFeet(meters: number) {
	return meters * FEET_PER_METER;
}

// "HH:MM" durations, for cutoffs measured from the race start.
export function formatDuration(seconds: number) {
	const minutes = Math.round(seconds / 60);
	return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

export function parseDuration(value: string) {
	const match = /^(\d+):([0-5]\d)$/.exec(value.trim());
	if (!match) return null;
	return Number(match[1]) * 3600 + Number(match[2]) * 60;
}

export function numberOrNull(value: string) {
	return value.trim() === "" ? null : Number(value);
}

export function inputValue(value: number | null | undefined, digits = 0) {
	return value == null ? "" : String(Number(value.toFixed(digits)));
}
