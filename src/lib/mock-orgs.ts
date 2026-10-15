import type { OrganizationInput, OrgWorkspace } from "~/lib/organizations";

const HOUR_MS = 3_600_000;
const DAY_HOURS = 24;

// Created in the browser only, so SSR never sees them: a hard refresh of a
// new org 404s until the real insert exists.
const createdOrgs: OrgWorkspace[] = [];

// Stand-in until organizations are queried from the database; dates are
// relative to `now` so every org has something past, live and upcoming.
function seedOrgs(now: Date): OrgWorkspace[] {
	const at = (hours: number) => new Date(now.getTime() + hours * HOUR_MS);

	return [
		{
			name: "Wasatch Trail Runners",
			slug: "wasatch-trail-runners",
			eventGroups: [
				{
					slug: "bonneville-ridge-weekend",
					name: "Bonneville Ridge Weekend",
					location: "Kaysville, UT",
					timeZone: "America/Denver",
					discipline: "trail_ultra",
					startDate: at(-14.4),
					endDate: at(21.6),
					events: [
						{
							name: "100 Mile",
							courseName: "Bonneville Ridge 100",
							scheduledStart: at(-14.4),
							lapsRequired: 1,
						},
						{
							name: "50K",
							courseName: "Francis Peak 50K",
							scheduledStart: at(-12.4),
							lapsRequired: 1,
						},
					],
				},
				{
					slug: "frost-line-backyard",
					name: "Frost Line Backyard",
					location: "Heber City, UT",
					timeZone: "America/Denver",
					discipline: "backyard_ultra",
					startDate: at(45 * DAY_HOURS),
					endDate: at(48 * DAY_HOURS),
					events: [
						{
							name: "Backyard Ultra",
							courseName: "Frost Line Yard",
							scheduledStart: at(45 * DAY_HOURS),
							lapsRequired: 1,
						},
					],
				},
				{
					slug: "spring-thaw-25k",
					name: "Spring Thaw 25K",
					location: "Park City, UT",
					timeZone: "America/Denver",
					discipline: "trail_ultra",
					startDate: at(-160 * DAY_HOURS),
					endDate: at(-160 * DAY_HOURS + 6),
					events: [
						{
							name: "25K",
							courseName: "Round Valley 25K",
							scheduledStart: at(-160 * DAY_HOURS),
							lapsRequired: 1,
						},
						{
							name: "10K",
							courseName: "Round Valley 10K",
							scheduledStart: at(-160 * DAY_HOURS + 0.5),
							lapsRequired: 1,
						},
					],
				},
			],
			courses: [
				{
					name: "Bonneville Ridge 100",
					distanceMeters: 160_934,
					elevationGainMeters: 7_010,
				},
				{
					name: "Francis Peak 50K",
					distanceMeters: 50_000,
					elevationGainMeters: 2_350,
				},
				{
					name: "Frost Line Yard",
					distanceMeters: 6_706,
					elevationGainMeters: 61,
				},
				{
					name: "Round Valley 25K",
					distanceMeters: 25_000,
					elevationGainMeters: 640,
				},
				{
					name: "Round Valley 10K",
					distanceMeters: 10_000,
					elevationGainMeters: null,
				},
			],
			timingPoints: [
				{ name: "Start / Finish", code: "START", elevationMeters: 1_312 },
				{ name: "Francis Peak", code: "FRANCIS", elevationMeters: 2_865 },
				{ name: "Big Mountain Pass", code: "BIGMTN", elevationMeters: 2_143 },
				{ name: "Lambs Canyon", code: "LAMBS", elevationMeters: 1_890 },
				{
					name: "Round Valley Trailhead",
					code: "RV_TH",
					elevationMeters: null,
				},
			],
			members: [
				{ name: "Dana Whitlock", email: "dana@example.com", role: "owner" },
				{ name: "Marcus Ortega", email: "marcus@example.com", role: "admin" },
				{ name: "Priya Raman", email: "priya@example.com", role: "volunteer" },
				{ name: "Sam Kealoha", email: "sam@example.com", role: "volunteer" },
			],
		},
		{
			name: "Silver Lake Gravity",
			slug: "silver-lake-gravity",
			eventGroups: [
				{
					slug: "silver-lake-downhill",
					name: "Silver Lake Downhill",
					location: "Brighton, UT",
					timeZone: "America/Denver",
					discipline: "downhill_mtb",
					startDate: at(3 * DAY_HOURS),
					endDate: at(3 * DAY_HOURS + 8),
					events: [
						{
							name: "Pro",
							courseName: "Hidden Canyon DH",
							scheduledStart: at(3 * DAY_HOURS + 4),
							lapsRequired: 2,
						},
						{
							name: "Amateur",
							courseName: "Hidden Canyon DH",
							scheduledStart: at(3 * DAY_HOURS),
							lapsRequired: 2,
						},
					],
				},
			],
			courses: [
				{
					name: "Hidden Canyon DH",
					distanceMeters: 3_200,
					elevationGainMeters: null,
				},
			],
			timingPoints: [
				{ name: "Top Start", code: "TOP", elevationMeters: 3_048 },
				{ name: "Bottom Finish", code: "BOTTOM", elevationMeters: 2_652 },
			],
			members: [
				{ name: "Jo Lindqvist", email: "jo@example.com", role: "owner" },
			],
		},
	];
}

export function getMyOrgs(now: Date) {
	return [...seedOrgs(now), ...createdOrgs];
}

export function getOrg(slug: string, now: Date) {
	return getMyOrgs(now).find((org) => org.slug === slug);
}

export function createMockOrg(input: OrganizationInput) {
	const org: OrgWorkspace = {
		...input,
		eventGroups: [],
		courses: [],
		timingPoints: [],
		members: [],
	};
	createdOrgs.push(org);
	return org;
}
