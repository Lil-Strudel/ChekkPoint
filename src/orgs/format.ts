// A pinned locale keeps SSR and hydrated text identical.
const LOCALE = "en-US";
const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

const miles = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const feet = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

export function formatMiles(meters: number) {
	return `${miles.format(meters / METERS_PER_MILE)} mi`;
}

export function formatFeet(meters: number) {
	return `${feet.format(meters * FEET_PER_METER)} ft`;
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

// Event groups carry no time zone yet, so say which one the time is in.
export function formatStart(date: Date) {
	return new Intl.DateTimeFormat(LOCALE, {
		timeZone: "UTC",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	}).format(date);
}
