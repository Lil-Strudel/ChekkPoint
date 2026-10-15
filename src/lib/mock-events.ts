import type { EventGroupSummary, LiveEventGroup } from "~/lib/events";

const HOUR_MS = 3_600_000;

// Stand-in until event groups are queried from the database; dates are
// relative to `now` so the page always has something live and upcoming.
export function getHomeEvents(now: Date) {
	const at = (hours: number) => new Date(now.getTime() + hours * HOUR_MS);

	const live: LiveEventGroup[] = [
		{
			slug: "bonneville-ridge-100",
			name: "Bonneville Ridge 100",
			organization: "Basin & Range Endurance",
			location: "Kaysville, UT",
			timeZone: "America/Denver",
			discipline: "trail_ultra",
			startDate: at(-14.4),
			endDate: at(21.6),
			races: ["100M", "50M"],
			entrants: 312,
			timeLimitHours: 36,
			onCourse: 241,
			finished: 38,
			out: 33,
		},
		{
			slug: "cedar-mesa-24",
			name: "Cedar Mesa 24",
			organization: "Slickrock Running Co.",
			location: "Blanding, UT",
			timeZone: "America/Denver",
			discipline: "fixed_time_loop",
			startDate: at(-9.2),
			endDate: at(14.8),
			races: ["24h", "12h"],
			entrants: 94,
			timeLimitHours: 24,
			onCourse: 86,
			finished: 0,
			out: 8,
		},
		{
			slug: "tamarack-gravel",
			name: "Tamarack Gravel Grind",
			organization: "Snake River Cycling",
			location: "Donnelly, ID",
			timeZone: "America/Boise",
			discipline: "xco_cycling",
			startDate: at(-3.1),
			endDate: at(4.9),
			races: ["120mi", "60mi", "30mi"],
			entrants: 228,
			timeLimitHours: 8,
			onCourse: 171,
			finished: 49,
			out: 8,
		},
	];

	const upcoming: EventGroupSummary[] = [
		{
			slug: "silver-lake-dh",
			name: "Silver Lake Downhill",
			organization: "Wasatch Gravity",
			location: "Brighton, UT",
			timeZone: "America/Denver",
			discipline: "downhill_mtb",
			startDate: at(3 * 24),
			endDate: at(3 * 24 + 8),
			races: ["Pro", "Amateur"],
			entrants: 140,
		},
		{
			slug: "owyhee-canyon-50",
			name: "Owyhee Canyon 50",
			organization: "High Desert Trail Society",
			location: "Jordan Valley, OR",
			timeZone: "America/Boise",
			discipline: "trail_ultra",
			startDate: at(10 * 24),
			endDate: at(10 * 24 + 16),
			races: ["50M", "50K"],
			entrants: 206,
		},
		{
			slug: "high-desert-regularity",
			name: "High Desert Regularity Rally",
			organization: "Great Basin Motor Club",
			location: "Ely, NV",
			timeZone: "America/Los_Angeles",
			discipline: "tsd_regularity",
			startDate: at(17 * 24),
			endDate: at(18 * 24),
			races: ["Expert", "Novice"],
			entrants: 42,
		},
		{
			slug: "red-rock-marathon",
			name: "Red Rock Road Marathon",
			organization: "Canyon Country Running",
			location: "St. George, UT",
			timeZone: "America/Denver",
			discipline: "road_marathon",
			startDate: at(31 * 24),
			endDate: at(31 * 24 + 7),
			races: ["Marathon", "Half"],
			entrants: 1860,
		},
		{
			slug: "frost-line-backyard",
			name: "Frost Line Backyard",
			organization: "Basin & Range Endurance",
			location: "Heber City, UT",
			timeZone: "America/Denver",
			discipline: "backyard_ultra",
			startDate: at(45 * 24),
			endDate: at(48 * 24),
			races: ["Last person standing"],
			entrants: 60,
		},
	];

	return { now, live, upcoming };
}
