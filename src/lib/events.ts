import type { eventGroups } from "~/db/schema";

export type Discipline = (typeof eventGroups.$inferSelect)["discipline"];

export type EventGroupSummary = {
	slug: string;
	name: string;
	organization: string;
	location: string;
	timeZone: string;
	discipline: Discipline;
	startDate: Date;
	endDate: Date;
	races: string[];
	entrants: number;
};

export type LiveEventGroup = EventGroupSummary & {
	timeLimitHours: number;
	onCourse: number;
	finished: number;
	out: number;
};

export const disciplineLabels: Record<Discipline, string> = {
	trail_ultra: "Trail ultra",
	road_marathon: "Road",
	backyard_ultra: "Backyard ultra",
	fixed_time_loop: "Fixed time",
	downhill_mtb: "Downhill MTB",
	xco_cycling: "XC & gravel",
	tsd_regularity: "Regularity rally",
};

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// Pinned locale and a 24-hour clock keep SSR and hydrated text identical.
const LOCALE = "en-US";

export function formatRaceClock(ms: number) {
	const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function elapsedHours(group: LiveEventGroup, now: Date) {
	return (now.getTime() - group.startDate.getTime()) / HOUR_MS;
}

export function formatStartTime(group: EventGroupSummary) {
	return new Intl.DateTimeFormat(LOCALE, {
		timeZone: group.timeZone,
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
		timeZoneName: "short",
	}).format(group.startDate);
}

export function dateParts(date: Date, timeZone: string) {
	const format = (options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(LOCALE, { timeZone, ...options }).format(date);
	return {
		month: format({ month: "short" }),
		day: format({ day: "numeric" }),
		weekday: format({ weekday: "short" }),
	};
}

export function formatStartsIn(date: Date, now: Date) {
	const days = Math.round((date.getTime() - now.getTime()) / DAY_MS);
	return new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" }).format(
		days,
		"day",
	);
}
