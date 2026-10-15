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
			location: "Kaysville, UT",
			timeZone: "America/Denver",
			discipline: "trail_ultra",
			startDate: at(-14.4),
			endDate: at(21.6),
			timeLimitHours: 36,
			onCourse: 241,
		},
		{
			slug: "cedar-mesa-24",
			name: "Cedar Mesa 24",
			location: "Blanding, UT",
			timeZone: "America/Denver",
			discipline: "fixed_time_loop",
			startDate: at(-9.2),
			endDate: at(14.8),
			timeLimitHours: 24,
			onCourse: 86,
		},
		{
			slug: "tamarack-gravel",
			name: "Tamarack Gravel Grind",
			location: "Donnelly, ID",
			timeZone: "America/Boise",
			discipline: "xco_cycling",
			startDate: at(-3.1),
			endDate: at(4.9),
			timeLimitHours: 8,
			onCourse: 171,
		},
	];

	const upcoming: EventGroupSummary[] = [
		{
			slug: "silver-lake-dh",
			name: "Silver Lake Downhill",
			location: "Brighton, UT",
			timeZone: "America/Denver",
			discipline: "downhill_mtb",
			startDate: at(3 * 24),
			endDate: at(3 * 24 + 8),
		},
		{
			slug: "owyhee-canyon-50",
			name: "Owyhee Canyon 50",
			location: "Jordan Valley, OR",
			timeZone: "America/Boise",
			discipline: "trail_ultra",
			startDate: at(10 * 24),
			endDate: at(10 * 24 + 16),
		},
		{
			slug: "high-desert-regularity",
			name: "High Desert Regularity Rally",
			location: "Ely, NV",
			timeZone: "America/Los_Angeles",
			discipline: "tsd_regularity",
			startDate: at(17 * 24),
			endDate: at(18 * 24),
		},
		{
			slug: "red-rock-marathon",
			name: "Red Rock Road Marathon",
			location: "St. George, UT",
			timeZone: "America/Denver",
			discipline: "road_marathon",
			startDate: at(31 * 24),
			endDate: at(31 * 24 + 7),
		},
		{
			slug: "frost-line-backyard",
			name: "Frost Line Backyard",
			location: "Heber City, UT",
			timeZone: "America/Denver",
			discipline: "backyard_ultra",
			startDate: at(45 * 24),
			endDate: at(48 * 24),
		},
	];

	return { now, live, upcoming };
}
