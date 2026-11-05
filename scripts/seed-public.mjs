import pg from "pg";

if (!process.env.DATABASE_URL) {
	console.error("DATABASE_URL is not set. Check your .env file.");
	process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const now = new Date();
const hoursFromNow = (h) => new Date(now.getTime() + h * 3_600_000);
const daysFromNow = (d) => new Date(now.getTime() + d * 24 * 3_600_000);

// Deterministic UUIDs for idempotent seeding
const ORGS = {
	wasatch: "10000000-0000-4000-8000-000000000001",
	highDesert: "10000000-0000-4000-8000-000000000002",
	owyhee: "10000000-0000-4000-8000-000000000003",
};

const TIMING_POINTS = {
	startKaysville: "20000000-0000-4000-8000-000000000001",
	francisPeak: "20000000-0000-4000-8000-000000000002",
	bigMountain: "20000000-0000-4000-8000-000000000003",
	lambsCanyon: "20000000-0000-4000-8000-000000000004",
	brightonLodge: "20000000-0000-4000-8000-000000000005",
	homesteadFinish: "20000000-0000-4000-8000-000000000006",
	dhStartGate: "20000000-0000-4000-8000-000000000007",
	dhRockGarden: "20000000-0000-4000-8000-000000000008",
	dhFinishArena: "20000000-0000-4000-8000-000000000009",
	rallyStartEly: "20000000-0000-4000-8000-000000000010",
	rallyConnorsPass: "20000000-0000-4000-8000-000000000011",
	rallySecretGate: "20000000-0000-4000-8000-000000000012",
	rallyFinishEureka: "20000000-0000-4000-8000-000000000013",
	owyheeRim: "20000000-0000-4000-8000-000000000014",
	owyheeCorral: "20000000-0000-4000-8000-000000000015",
};

const COURSES = {
	bonneville100: "30000000-0000-4000-8000-000000000001",
	bonneville50: "30000000-0000-4000-8000-000000000002",
	wasatchCrest50k: "30000000-0000-4000-8000-000000000003",
	silverLakeDh: "30000000-0000-4000-8000-000000000004",
	highDesertRally: "30000000-0000-4000-8000-000000000005",
	owyheeCanyon50: "30000000-0000-4000-8000-000000000006",
	frostLineYard: "30000000-0000-4000-8000-000000000007",
};

const SPLITS = {
	b100_s1: "40000000-0000-4000-8000-000000000001",
	b100_s2: "40000000-0000-4000-8000-000000000002",
	b100_s3: "40000000-0000-4000-8000-000000000003",
	b100_s4: "40000000-0000-4000-8000-000000000004",
	b100_s5: "40000000-0000-4000-8000-000000000005",
	b50_s1: "40000000-0000-4000-8000-000000000006",
	b50_s2: "40000000-0000-4000-8000-000000000007",
	b50_s3: "40000000-0000-4000-8000-000000000008",
	w50k_s1: "40000000-0000-4000-8000-000000000009",
	w50k_s2: "40000000-0000-4000-8000-000000000010",
	w50k_s3: "40000000-0000-4000-8000-000000000011",
	dh_s1: "40000000-0000-4000-8000-000000000012",
	dh_s2: "40000000-0000-4000-8000-000000000013",
	rally_s1: "40000000-0000-4000-8000-000000000014",
	rally_secret: "40000000-0000-4000-8000-000000000015",
	rally_s2: "40000000-0000-4000-8000-000000000016",
	owyhee_s1: "40000000-0000-4000-8000-000000000017",
	owyhee_s2: "40000000-0000-4000-8000-000000000018",
	frost_s1: "40000000-0000-4000-8000-000000000019",
};

const EVENT_GROUPS = {
	bonneville100: "50000000-0000-4000-8000-000000000001",
	silverLakeDh: "50000000-0000-4000-8000-000000000002",
	owyheeCanyon50: "50000000-0000-4000-8000-000000000003",
	highDesertRally: "50000000-0000-4000-8000-000000000004",
	wasatchCrest50k: "50000000-0000-4000-8000-000000000005",
	frostLineBackyard: "50000000-0000-4000-8000-000000000006",
};

const EVENTS = {
	b100_100m: "60000000-0000-4000-8000-000000000001",
	b100_50m: "60000000-0000-4000-8000-000000000002",
	dh_pro: "60000000-0000-4000-8000-000000000003",
	owyhee_50m: "60000000-0000-4000-8000-000000000004",
	rally_open: "60000000-0000-4000-8000-000000000005",
	crest_50k: "60000000-0000-4000-8000-000000000006",
	frost_yard: "60000000-0000-4000-8000-000000000007",
};

const PEOPLE = {
	elena: "70000000-0000-4000-8000-000000000001",
	marcus: "70000000-0000-4000-8000-000000000002",
	soren: "70000000-0000-4000-8000-000000000003",
	talia: "70000000-0000-4000-8000-000000000004",
	devon: "70000000-0000-4000-8000-000000000005",
	claire: "70000000-0000-4000-8000-000000000006",
	kenji: "70000000-0000-4000-8000-000000000007",
	hannah: "70000000-0000-4000-8000-000000000008",
	wyatt: "70000000-0000-4000-8000-000000000009",
	maya: "70000000-0000-4000-8000-000000000010",
	liam: "70000000-0000-4000-8000-000000000011",
	nora: "70000000-0000-4000-8000-000000000012",
};

try {
	await client.query("BEGIN");

	// 1. Seed Organizations
	const orgRows = [
		{
			id: ORGS.wasatch,
			name: "Wasatch Mountain Endurance",
			slug: "wasatch-mountain-endurance",
			metadata: JSON.stringify({
				location: "Kaysville, UT",
				timeZone: "America/Denver",
				establishedYear: 2014,
				website: "https://wasatchendurance.example.org",
				description:
					"Stewards of high-altitude singletrack ultras along the Wasatch Front and Great Basin ridgelines.",
			}),
		},
		{
			id: ORGS.highDesert,
			name: "High Desert Gravity & Rally Club",
			slug: "high-desert-gravity-rally",
			metadata: JSON.stringify({
				location: "Brighton, UT & Ely, NV",
				timeZone: "America/Denver",
				establishedYear: 2018,
				website: "https://highdesertgravity.example.org",
				description:
					"Precision optical downhill MTB timing and Time-Speed-Distance backcountry regularity rallies.",
			}),
		},
		{
			id: ORGS.owyhee,
			name: "Owyhee Backcountry Collective",
			slug: "owyhee-backcountry-collective",
			metadata: JSON.stringify({
				location: "Jordan Valley, OR",
				timeZone: "America/Boise",
				establishedYear: 2019,
				website: "https://owyheecollective.example.org",
				description:
					"Remote desert canyon endurance runs powered by offline checkpoint tablets and HF/VHF radio links.",
			}),
		},
	];

	for (const org of orgRows) {
		await client.query(
			`INSERT INTO organizations (id, name, slug, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         slug = EXCLUDED.slug,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()`,
			[org.id, org.name, org.slug, org.metadata],
		);
	}

	// 2. Seed Timing Points
	const tpRows = [
		[
			TIMING_POINTS.startKaysville,
			ORGS.wasatch,
			"Kaysville Trailhead Start",
			"KAYSVILLE_START",
			41.0352,
			-111.9385,
			1480,
		],
		[
			TIMING_POINTS.francisPeak,
			ORGS.wasatch,
			"Francis Peak Radar Towers",
			"FRANCIS_PEAK",
			41.0321,
			-111.8381,
			2910,
		],
		[
			TIMING_POINTS.bigMountain,
			ORGS.wasatch,
			"Big Mountain Pass Aid",
			"BIG_MTN_PASS",
			40.8286,
			-111.6522,
			2265,
		],
		[
			TIMING_POINTS.lambsCanyon,
			ORGS.wasatch,
			"Lambs Canyon Trailhead",
			"LAMBS_CANYON",
			40.7405,
			-111.6788,
			1890,
		],
		[
			TIMING_POINTS.brightonLodge,
			ORGS.wasatch,
			"Brighton Alpine Lodge",
			"BRIGHTON_LODGE",
			40.598,
			-111.5832,
			2670,
		],
		[
			TIMING_POINTS.homesteadFinish,
			ORGS.wasatch,
			"Midway Homestead Finish",
			"HOMESTEAD_FIN",
			40.5247,
			-111.4868,
			1710,
		],
		[
			TIMING_POINTS.dhStartGate,
			ORGS.highDesert,
			"Crest Express Upper Hut",
			"DH_START_HUT",
			40.5995,
			-111.589,
			2980,
		],
		[
			TIMING_POINTS.dhRockGarden,
			ORGS.highDesert,
			"Granite Chute Speed Trap",
			"DH_ROCK_SPLIT",
			40.595,
			-111.586,
			2640,
		],
		[
			TIMING_POINTS.dhFinishArena,
			ORGS.highDesert,
			"Millicent Base Coral",
			"DH_FINISH",
			40.591,
			-111.582,
			2360,
		],
		[
			TIMING_POINTS.rallyStartEly,
			ORGS.highDesert,
			"Ely Historic Depot Parc Fermé",
			"ELY_START",
			39.2474,
			-114.8886,
			1960,
		],
		[
			TIMING_POINTS.rallyConnorsPass,
			ORGS.highDesert,
			"Connors Pass Summit Control",
			"CONNORS_PASS",
			39.0402,
			-114.648,
			2354,
		],
		[
			TIMING_POINTS.rallySecretGate,
			ORGS.highDesert,
			"Hidden Newark Valley Timing Beam",
			"SECRET_NEWARK",
			39.42,
			-115.65,
			1810,
		],
		[
			TIMING_POINTS.rallyFinishEureka,
			ORGS.highDesert,
			"Eureka Opera House Finish",
			"EUREKA_FIN",
			39.5122,
			-115.9606,
			1975,
		],
		[
			TIMING_POINTS.owyheeRim,
			ORGS.owyhee,
			"Leslie Gulch Rim Station",
			"LESLIE_RIM",
			43.298,
			-117.241,
			1390,
		],
		[
			TIMING_POINTS.owyheeCorral,
			ORGS.owyhee,
			"Succor Creek Canyon Finish",
			"SUCCOR_FIN",
			43.475,
			-117.122,
			985,
		],
	];

	for (const tp of tpRows) {
		await client.query(
			`INSERT INTO timing_points (id, organization_id, name, code, latitude, longitude, elevation_meters, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         code = EXCLUDED.code,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         elevation_meters = EXCLUDED.elevation_meters`,
			tp,
		);
	}

	// 3. Seed Courses
	const courseRows = [
		[
			COURSES.bonneville100,
			ORGS.wasatch,
			"Bonneville Ridge 100M Championship Course",
			161200,
			7350,
			"https://example.org/gpx/bonneville-100m.gpx",
			null,
		],
		[
			COURSES.bonneville50,
			ORGS.wasatch,
			"Bonneville Ridge 50M High-Route",
			81000,
			3680,
			"https://example.org/gpx/bonneville-50m.gpx",
			COURSES.bonneville100,
		],
		[
			COURSES.wasatchCrest50k,
			ORGS.wasatch,
			"Wasatch Crest 50K Ridge Traverse",
			50200,
			2420,
			"https://example.org/gpx/wasatch-crest-50k.gpx",
			null,
		],
		[
			COURSES.silverLakeDh,
			ORGS.highDesert,
			"Silver Lake World Cup Downhill Track",
			3450,
			620,
			null,
			null,
		],
		[
			COURSES.highDesertRally,
			ORGS.highDesert,
			"Loneliest Road TSD Regularity Stage",
			185000,
			1420,
			null,
			null,
		],
		[
			COURSES.owyheeCanyon50,
			ORGS.owyhee,
			"Owyhee Canyonlands 50M Loop",
			80500,
			2890,
			"https://example.org/gpx/owyhee-50m.gpx",
			null,
		],
		[
			COURSES.frostLineYard,
			ORGS.wasatch,
			"Frost Line 4.167M Backyard Loop",
			6705.6,
			145,
			null,
			null,
		],
	];

	for (const c of courseRows) {
		await client.query(
			`INSERT INTO courses (id, organization_id, name, distance_meters, elevation_gain_meters, gpx_route_url, copied_from_course_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         distance_meters = EXCLUDED.distance_meters,
         elevation_gain_meters = EXCLUDED.elevation_gain_meters,
         gpx_route_url = EXCLUDED.gpx_route_url,
         copied_from_course_id = EXCLUDED.copied_from_course_id`,
			c,
		);
	}

	// 4. Seed Course Splits
	const splitRows = [
		// Bonneville 100M (5 splits)
		[
			SPLITS.b100_s1,
			COURSES.bonneville100,
			TIMING_POINTS.francisPeak,
			"Francis Peak Towers (M18.6)",
			1,
			30000,
			3,
			6 * 3600,
			null,
			false,
		],
		[
			SPLITS.b100_s2,
			COURSES.bonneville100,
			TIMING_POINTS.bigMountain,
			"Big Mountain Pass (M38.5)",
			2,
			62000,
			3,
			13 * 3600,
			null,
			false,
		],
		[
			SPLITS.b100_s3,
			COURSES.bonneville100,
			TIMING_POINTS.lambsCanyon,
			"Lambs Canyon Aid (M59.0)",
			3,
			95000,
			3,
			20 * 3600,
			null,
			false,
		],
		[
			SPLITS.b100_s4,
			COURSES.bonneville100,
			TIMING_POINTS.brightonLodge,
			"Brighton Lodge (M79.5)",
			4,
			128000,
			3,
			28 * 3600,
			null,
			false,
		],
		[
			SPLITS.b100_s5,
			COURSES.bonneville100,
			TIMING_POINTS.homesteadFinish,
			"Midway Homestead Finish (M100.2)",
			5,
			161200,
			1,
			36 * 3600,
			null,
			false,
		],
		// Bonneville 50M (3 splits)
		[
			SPLITS.b50_s1,
			COURSES.bonneville50,
			TIMING_POINTS.lambsCanyon,
			"Lambs Canyon Aid (M19.3)",
			1,
			31000,
			3,
			6 * 3600,
			null,
			false,
		],
		[
			SPLITS.b50_s2,
			COURSES.bonneville50,
			TIMING_POINTS.brightonLodge,
			"Brighton Lodge (M36.0)",
			2,
			58000,
			3,
			11 * 3600,
			null,
			false,
		],
		[
			SPLITS.b50_s3,
			COURSES.bonneville50,
			TIMING_POINTS.homesteadFinish,
			"Midway Homestead Finish (M50.3)",
			3,
			81000,
			1,
			16 * 3600,
			null,
			false,
		],
		// Wasatch Crest 50K
		[
			SPLITS.w50k_s1,
			COURSES.wasatchCrest50k,
			TIMING_POINTS.bigMountain,
			"Big Mountain Aid (M12.4)",
			1,
			20000,
			3,
			4 * 3600,
			null,
			false,
		],
		[
			SPLITS.w50k_s2,
			COURSES.wasatchCrest50k,
			TIMING_POINTS.brightonLodge,
			"Brighton Crest Saddle (M21.7)",
			2,
			35000,
			3,
			7 * 3600,
			null,
			false,
		],
		[
			SPLITS.w50k_s3,
			COURSES.wasatchCrest50k,
			TIMING_POINTS.homesteadFinish,
			"Homestead Finish Line (M31.2)",
			3,
			50200,
			1,
			10 * 3600,
			null,
			false,
		],
		// Silver Lake DH
		[
			SPLITS.dh_s1,
			COURSES.silverLakeDh,
			TIMING_POINTS.dhRockGarden,
			"Granite Chute Intermediate Split",
			1,
			1800,
			1,
			null,
			null,
			false,
		],
		[
			SPLITS.dh_s2,
			COURSES.silverLakeDh,
			TIMING_POINTS.dhFinishArena,
			"Millicent Base Finish Beam",
			2,
			3450,
			1,
			null,
			null,
			false,
		],
		// High Desert Regularity Rally (includes 1 secret checkpoint)
		[
			SPLITS.rally_s1,
			COURSES.highDesertRally,
			TIMING_POINTS.rallyConnorsPass,
			"Connors Pass Time Control",
			1,
			55000,
			1,
			null,
			2400,
			false,
		],
		[
			SPLITS.rally_secret,
			COURSES.highDesertRally,
			TIMING_POINTS.rallySecretGate,
			"Secret Newark Valley Control",
			2,
			122000,
			1,
			null,
			5280,
			true,
		],
		[
			SPLITS.rally_s2,
			COURSES.highDesertRally,
			TIMING_POINTS.rallyFinishEureka,
			"Eureka Opera House Finish Control",
			3,
			185000,
			1,
			null,
			8100,
			false,
		],
		// Owyhee Canyon 50
		[
			SPLITS.owyhee_s1,
			COURSES.owyheeCanyon50,
			TIMING_POINTS.owyheeRim,
			"Leslie Gulch Rim Aid Station",
			1,
			42000,
			3,
			8 * 3600,
			null,
			false,
		],
		[
			SPLITS.owyhee_s2,
			COURSES.owyheeCanyon50,
			TIMING_POINTS.owyheeCorral,
			"Succor Creek Canyon Finish",
			2,
			80500,
			1,
			15 * 3600,
			null,
			false,
		],
		// Frost Line Backyard
		[
			SPLITS.frost_s1,
			COURSES.frostLineYard,
			TIMING_POINTS.homesteadFinish,
			"Yard Corral Bell Line (4.167M)",
			1,
			6705.6,
			1,
			3600,
			null,
			false,
		],
	];

	for (const sp of splitRows) {
		await client.query(
			`INSERT INTO course_splits (
         id, course_id, timing_point_id, name, sequence_order,
         distance_from_start_meters, sub_split_bitmap, cutoff_duration_seconds,
         tsd_ideal_duration_seconds, is_secret_checkpoint, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         sequence_order = EXCLUDED.sequence_order,
         distance_from_start_meters = EXCLUDED.distance_from_start_meters,
         sub_split_bitmap = EXCLUDED.sub_split_bitmap,
         cutoff_duration_seconds = EXCLUDED.cutoff_duration_seconds,
         tsd_ideal_duration_seconds = EXCLUDED.tsd_ideal_duration_seconds,
         is_secret_checkpoint = EXCLUDED.is_secret_checkpoint`,
			sp,
		);
	}

	// 5. Seed Event Groups (1 Live Now, 3 Upcoming, 2 Past Completed)
	const defaultRules = JSON.stringify({
		timeFormat: "HH:MM:SS",
		displayPrecisionDecimals: 0,
		allowSelfCheckIn: false,
		requirePacerRegistration: true,
		earlyPenaltyFactor: 2.0,
		latePenaltyFactor: 1.0,
		gracePeriodSeconds: 0.0,
		yardDistanceMiles: 4.166667,
		yardTimeLimitSeconds: 3600,
	});

	const groupRows = [
		[
			EVENT_GROUPS.bonneville100,
			ORGS.wasatch,
			"Bonneville Ridge 100",
			"bonneville-ridge-100",
			"trail_ultra",
			defaultRules,
			hoursFromNow(-14.5),
			hoursFromNow(21.5),
		],
		[
			EVENT_GROUPS.silverLakeDh,
			ORGS.highDesert,
			"Silver Lake Downhill",
			"silver-lake-dh",
			"downhill_mtb",
			JSON.stringify({
				...JSON.parse(defaultRules),
				timeFormat: "MM:SS.sss",
				displayPrecisionDecimals: 3,
			}),
			daysFromNow(4),
			daysFromNow(4.35),
		],
		[
			EVENT_GROUPS.owyheeCanyon50,
			ORGS.owyhee,
			"Owyhee Canyon 50",
			"owyhee-canyon-50",
			"trail_ultra",
			defaultRules,
			daysFromNow(11),
			daysFromNow(11.7),
		],
		[
			EVENT_GROUPS.highDesertRally,
			ORGS.highDesert,
			"High Desert Regularity Rally",
			"high-desert-regularity",
			"tsd_regularity",
			defaultRules,
			daysFromNow(19),
			daysFromNow(20),
		],
		[
			EVENT_GROUPS.wasatchCrest50k,
			ORGS.wasatch,
			"Wasatch Crest Autumn 50K",
			"wasatch-crest-50k",
			"trail_ultra",
			defaultRules,
			daysFromNow(-14),
			daysFromNow(-13.5),
		],
		[
			EVENT_GROUPS.frostLineBackyard,
			ORGS.wasatch,
			"Frost Line Backyard Ultra",
			"frost-line-backyard",
			"backyard_ultra",
			defaultRules,
			daysFromNow(-42),
			daysFromNow(-40),
		],
	];

	for (const eg of groupRows) {
		await client.query(
			`INSERT INTO event_groups (
         id, organization_id, name, slug, discipline, rules_config, start_date, end_date, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         slug = EXCLUDED.slug,
         discipline = EXCLUDED.discipline,
         rules_config = EXCLUDED.rules_config,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date`,
			eg,
		);
	}

	// 6. Seed Events (Sub-events)
	const eventRows = [
		[
			EVENTS.b100_100m,
			EVENT_GROUPS.bonneville100,
			COURSES.bonneville100,
			"100 Mile Endurance Run",
			1,
			hoursFromNow(-14.5),
			hoursFromNow(-14.5),
		],
		[
			EVENTS.b100_50m,
			EVENT_GROUPS.bonneville100,
			COURSES.bonneville50,
			"50 Mile Ridge Challenge",
			1,
			hoursFromNow(-12.0),
			hoursFromNow(-12.0),
		],
		[
			EVENTS.dh_pro,
			EVENT_GROUPS.silverLakeDh,
			COURSES.silverLakeDh,
			"Pro Gravity Finals",
			1,
			daysFromNow(4),
			null,
		],
		[
			EVENTS.owyhee_50m,
			EVENT_GROUPS.owyheeCanyon50,
			COURSES.owyheeCanyon50,
			"50 Mile Canyonlands Ultra",
			1,
			daysFromNow(11),
			null,
		],
		[
			EVENTS.rally_open,
			EVENT_GROUPS.highDesertRally,
			COURSES.highDesertRally,
			"Historic & Open Regularity Division",
			1,
			daysFromNow(19),
			null,
		],
		[
			EVENTS.crest_50k,
			EVENT_GROUPS.wasatchCrest50k,
			COURSES.wasatchCrest50k,
			"50K Mountain Championship",
			1,
			daysFromNow(-14),
			daysFromNow(-14),
		],
		[
			EVENTS.frost_yard,
			EVENT_GROUPS.frostLineBackyard,
			COURSES.frostLineYard,
			"Last Person Standing Championship",
			34,
			daysFromNow(-42),
			daysFromNow(-42),
		],
	];

	for (const ev of eventRows) {
		await client.query(
			`INSERT INTO events (
         id, event_group_id, course_id, name, laps_required, scheduled_start, actual_start, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         course_id = EXCLUDED.course_id,
         laps_required = EXCLUDED.laps_required,
         scheduled_start = EXCLUDED.scheduled_start,
         actual_start = EXCLUDED.actual_start`,
			ev,
		);
	}

	// 7. Seed People (Public Athletes)
	const peopleRows = [
		[
			PEOPLE.elena,
			"Elena",
			"Rostova",
			"F",
			{ city: "Salt Lake City", state: "UT", country: "US" },
			"elena",
			"veteran",
			24,
			22,
			2,
			0.083,
			161200,
			7800,
			345,
			94.6,
			742,
			"2026-10-18",
		],
		[
			PEOPLE.marcus,
			"Marcus",
			"Vance",
			"M",
			{ city: "Boulder", state: "CO", country: "US" },
			"marcus",
			"elite",
			31,
			29,
			2,
			0.064,
			168000,
			9200,
			312,
			97.8,
			818,
			"2026-10-18",
		],
		[
			PEOPLE.soren,
			"Soren",
			"Lindqvist",
			"M",
			{ city: "Park City", state: "UT", country: "US" },
			"soren",
			"elite",
			19,
			18,
			1,
			0.052,
			161200,
			7600,
			328,
			95.2,
			785,
			"2026-09-20",
		],
		[
			PEOPLE.talia,
			"Talia",
			"Chen",
			"F",
			{ city: "Boise", state: "ID", country: "US" },
			"talia",
			"veteran",
			16,
			15,
			1,
			0.062,
			100000,
			4800,
			368,
			91.4,
			695,
			"2026-10-18",
		],
		[
			PEOPLE.devon,
			"Devon",
			"Brooks",
			"M",
			{ city: "Ogden", state: "UT", country: "US" },
			"devon",
			"intermediate",
			9,
			7,
			2,
			0.222,
			81000,
			3800,
			415,
			82.1,
			610,
			"2026-08-12",
		],
		[
			PEOPLE.claire,
			"Claire",
			"Ashford",
			"F",
			{ city: "Bend", state: "OR", country: "US" },
			"claire",
			"elite",
			27,
			26,
			1,
			0.037,
			227990,
			6400,
			338,
			96.9,
			768,
			"2026-09-24",
		],
		[
			PEOPLE.kenji,
			"Kenji",
			"Takahashi",
			"M",
			{ city: "Flagstaff", state: "AZ", country: "US" },
			"kenji",
			"veteran",
			21,
			19,
			2,
			0.095,
			161200,
			7350,
			356,
			89.7,
			680,
			"2026-10-18",
		],
		[
			PEOPLE.hannah,
			"Hannah",
			"McBride",
			"F",
			{ city: "Heber City", state: "UT", country: "US" },
			"hannah",
			"intermediate",
			8,
			7,
			1,
			0.125,
			80500,
			3400,
			428,
			79.5,
			585,
			"2026-07-14",
		],
		[
			PEOPLE.wyatt,
			"Wyatt",
			"Callahan",
			"M",
			{ city: "Jackson", state: "WY", country: "US" },
			"wyatt",
			"novice",
			3,
			2,
			1,
			0.333,
			50200,
			2420,
			465,
			71.2,
			520,
			"2026-10-18",
		],
		[
			PEOPLE.maya,
			"Maya",
			"Solis",
			"F",
			{ city: "Durango", state: "CO", country: "US" },
			"maya",
			"veteran",
			14,
			13,
			1,
			0.071,
			100000,
			5100,
			382,
			88.3,
			660,
			"2026-09-24",
		],
		[
			PEOPLE.liam,
			"Liam",
			"O'Connor",
			"M",
			{ city: "Reno", state: "NV", country: "US" },
			"liam",
			"intermediate",
			11,
			10,
			1,
			0.091,
			81000,
			3680,
			395,
			84.0,
			625,
			"2026-06-05",
		],
		[
			PEOPLE.nora,
			"Nora",
			"Lindholm",
			"F",
			{ city: "Missoula", state: "MT", country: "US" },
			"nora",
			"novice",
			4,
			4,
			0,
			0.0,
			50200,
			2420,
			440,
			76.8,
			555,
			"2026-10-18",
		],
	];

	for (let i = 0; i < peopleRows.length; i++) {
		const p = peopleRows[i];
		const summaryId = `71000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
		await client.query(
			`INSERT INTO people (id, first_name, last_name, gender, address, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         gender = EXCLUDED.gender,
         address = EXCLUDED.address`,
			[p[0], p[1], p[2], p[3], JSON.stringify(p[4])],
		);

		await client.query(
			`INSERT INTO person_historical_summaries (
         id, person_id, experience_tier, total_races, total_finishes, total_dnfs,
         dnf_rate, max_distance_meters, max_elevation_gain_meters, avg_pace_seconds_per_km,
         ultrasignup_rank, itra_performance_index, last_race_date, confidence_score, computed_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0.98, NOW())
       ON CONFLICT (person_id) DO UPDATE SET
         experience_tier = EXCLUDED.experience_tier,
         total_races = EXCLUDED.total_races,
         total_finishes = EXCLUDED.total_finishes,
         total_dnfs = EXCLUDED.total_dnfs,
         dnf_rate = EXCLUDED.dnf_rate,
         max_distance_meters = EXCLUDED.max_distance_meters,
         max_elevation_gain_meters = EXCLUDED.max_elevation_gain_meters,
         avg_pace_seconds_per_km = EXCLUDED.avg_pace_seconds_per_km,
         ultrasignup_rank = EXCLUDED.ultrasignup_rank,
         itra_performance_index = EXCLUDED.itra_performance_index,
         last_race_date = EXCLUDED.last_race_date,
         computed_at = NOW()`,
			[
				summaryId,
				p[0],
				p[6],
				p[7],
				p[8],
				p[9],
				p[10],
				p[11],
				p[12],
				p[13],
				p[14],
				p[15],
				p[16],
			],
		);

		// External Profiles (UltraSignup & ITRA)
		const extId1 = `72000000-0000-4000-8000-${String(i * 2 + 1).padStart(12, "0")}`;
		const extId2 = `72000000-0000-4000-8000-${String(i * 2 + 2).padStart(12, "0")}`;
		await client.query(
			`INSERT INTO person_external_profiles (
         id, person_id, platform, external_identifier, profile_url,
         verification_status, match_confidence, scrape_status, created_at, updated_at
       )
       VALUES ($1, $2, 'ultrasignup', $3, $4, 'auto_verified', 0.99, 'succeeded', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         external_identifier = EXCLUDED.external_identifier,
         profile_url = EXCLUDED.profile_url,
         verification_status = EXCLUDED.verification_status`,
			[
				extId1,
				p[0],
				`us-${p[5]}`,
				`https://ultrasignup.com/results_participant.aspx?fname=${p[1]}&lname=${p[2]}`,
			],
		);

		await client.query(
			`INSERT INTO person_external_profiles (
         id, person_id, platform, external_identifier, profile_url,
         verification_status, match_confidence, scrape_status, created_at, updated_at
       )
       VALUES ($1, $2, 'itra', $3, $4, 'auto_verified', 0.97, 'succeeded', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         external_identifier = EXCLUDED.external_identifier,
         profile_url = EXCLUDED.profile_url,
         verification_status = EXCLUDED.verification_status`,
			[extId2, p[0], `itra-${1000 + i}`, `https://itra.run/Runners/${p[5]}`],
		);
	}

	// 8. Seed Person Race History (Historical external results)
	const historyRows = [
		[
			"73000000-0000-4000-8000-000000000001",
			PEOPLE.elena,
			"ultrasignup",
			"Bear 100 Mile Endurance Run",
			"2025-09-26",
			160934,
			"100M",
			6700,
			79940,
			"22:12:20",
			4,
			1,
			215,
			"finished",
		],
		[
			"73000000-0000-4000-8000-000000000002",
			PEOPLE.elena,
			"itra",
			"Speedgoat 50K Mountain Race",
			"2025-07-25",
			50000,
			"50K",
			3600,
			21495,
			"05:58:15",
			6,
			2,
			340,
			"finished",
		],
		[
			"73000000-0000-4000-8000-000000000003",
			PEOPLE.marcus,
			"ultrasignup",
			"Hardrock Hundred Endurance Run",
			"2025-07-11",
			161739,
			"100M",
			10050,
			89650,
			"24:54:10",
			2,
			2,
			142,
			"finished",
		],
		[
			"73000000-0000-4000-8000-000000000004",
			PEOPLE.marcus,
			"itra",
			"Zegama-Aizkorri Maratoia",
			"2025-05-24",
			42195,
			"Marathon",
			2736,
			14530,
			"04:02:10",
			9,
			9,
			410,
			"finished",
		],
		[
			"73000000-0000-4000-8000-000000000005",
			PEOPLE.soren,
			"ultrasignup",
			"Western States 100",
			"2025-06-28",
			161300,
			"100M",
			5500,
			58920,
			"16:22:00",
			7,
			7,
			298,
			"finished",
		],
		[
			"73000000-0000-4000-8000-000000000006",
			PEOPLE.talia,
			"ultrasignup",
			"Miwok 100K Trail Race",
			"2025-05-02",
			100000,
			"100K",
			3600,
			35640,
			"09:54:00",
			5,
			2,
			280,
			"finished",
		],
		[
			"73000000-0000-4000-8000-000000000007",
			PEOPLE.claire,
			"duv",
			"Big Backyard Individual Championship",
			"2025-10-19",
			227990,
			"34 Yards",
			4930,
			122400,
			"34:00:00",
			1,
			1,
			75,
			"finished",
		],
		[
			"73000000-0000-4000-8000-000000000008",
			PEOPLE.kenji,
			"ultrasignup",
			"Mogollon Monster 100",
			"2025-09-12",
			161000,
			"100M",
			6800,
			86700,
			"24:05:00",
			8,
			7,
			118,
			"finished",
		],
	];

	for (const h of historyRows) {
		await client.query(
			`INSERT INTO person_race_history (
         id, person_id, platform, race_name, race_date, distance_meters, distance_label,
         elevation_gain_meters, elapsed_seconds, finish_time_formatted,
         overall_place, gender_place, total_finishers, status, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       ON CONFLICT (id) DO UPDATE SET
         race_name = EXCLUDED.race_name,
         race_date = EXCLUDED.race_date,
         finish_time_formatted = EXCLUDED.finish_time_formatted,
         overall_place = EXCLUDED.overall_place`,
			h,
		);
	}

	// 9. Seed Entrants across Live, Past, and Upcoming Events
	const soloData = JSON.stringify({
		kind: "solo_competitor",
		pacerName: "Crew Support Verified",
	});

	const entrantRows = [
		// LIVE: Bonneville Ridge 100M
		[
			"80000000-0000-4000-8000-000000000001",
			EVENTS.b100_100m,
			PEOPLE.marcus,
			"101",
			"in_progress",
			"Open M",
			soloData,
			18.5 * 3600,
			false,
		],
		[
			"80000000-0000-4000-8000-000000000002",
			EVENTS.b100_100m,
			PEOPLE.elena,
			"104",
			"in_progress",
			"Open F",
			soloData,
			20.2 * 3600,
			false,
		],
		[
			"80000000-0000-4000-8000-000000000003",
			EVENTS.b100_100m,
			PEOPLE.soren,
			"108",
			"in_progress",
			"Open M",
			soloData,
			19.4 * 3600,
			false,
		],
		[
			"80000000-0000-4000-8000-000000000004",
			EVENTS.b100_100m,
			PEOPLE.kenji,
			"119",
			"in_progress",
			"M40-49",
			soloData,
			24.8 * 3600,
			false,
		],
		[
			"80000000-0000-4000-8000-000000000005",
			EVENTS.b100_100m,
			PEOPLE.devon,
			"142",
			"dnf",
			"Open M",
			soloData,
			31.5 * 3600,
			true,
		],
		// LIVE: Bonneville Ridge 50M (Some already finished!)
		[
			"80000000-0000-4000-8000-000000000006",
			EVENTS.b100_50m,
			PEOPLE.talia,
			"502",
			"finished",
			"Open F",
			soloData,
			9.4 * 3600,
			false,
		],
		[
			"80000000-0000-4000-8000-000000000007",
			EVENTS.b100_50m,
			PEOPLE.liam,
			"514",
			"finished",
			"Open M",
			soloData,
			10.2 * 3600,
			false,
		],
		[
			"80000000-0000-4000-8000-000000000008",
			EVENTS.b100_50m,
			PEOPLE.hannah,
			"527",
			"in_progress",
			"F30-39",
			soloData,
			12.8 * 3600,
			false,
		],
		// PAST: Wasatch Crest 50K
		[
			"80000000-0000-4000-8000-000000000009",
			EVENTS.crest_50k,
			PEOPLE.marcus,
			"12",
			"finished",
			"Open M",
			soloData,
			4.5 * 3600,
			false,
		],
		[
			"80000000-0000-4000-8000-000000000010",
			EVENTS.crest_50k,
			PEOPLE.elena,
			"19",
			"finished",
			"Open F",
			soloData,
			4.9 * 3600,
			false,
		],
		[
			"80000000-0000-4000-8000-000000000011",
			EVENTS.crest_50k,
			PEOPLE.nora,
			"44",
			"finished",
			"Open F",
			soloData,
			5.8 * 3600,
			false,
		],
		[
			"80000000-0000-4000-8000-000000000012",
			EVENTS.crest_50k,
			PEOPLE.wyatt,
			"63",
			"dnf",
			"Open M",
			soloData,
			7.2 * 3600,
			true,
		],
		// PAST: Frost Line Backyard Ultra
		[
			"80000000-0000-4000-8000-000000000013",
			EVENTS.frost_yard,
			PEOPLE.claire,
			"1",
			"finished",
			"Open",
			soloData,
			34 * 3600,
			false,
		],
		[
			"80000000-0000-4000-8000-000000000014",
			EVENTS.frost_yard,
			PEOPLE.maya,
			"7",
			"dnf",
			"Open",
			soloData,
			33 * 3600,
			false,
		],
		// UPCOMING: Owyhee Canyon 50
		[
			"80000000-0000-4000-8000-000000000015",
			EVENTS.owyhee_50m,
			PEOPLE.talia,
			"201",
			"registered",
			"Open F",
			soloData,
			9.1 * 3600,
			false,
		],
		[
			"80000000-0000-4000-8000-000000000016",
			EVENTS.owyhee_50m,
			PEOPLE.soren,
			"205",
			"registered",
			"Open M",
			soloData,
			8.3 * 3600,
			false,
		],
	];

	for (let i = 0; i < entrantRows.length; i++) {
		const ent = entrantRows[i];
		const projId = `81000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
		await client.query(
			`INSERT INTO entrants (
         id, event_id, person_id, competitor_number, status, division, participant_data, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         division = EXCLUDED.division,
         competitor_number = EXCLUDED.competitor_number`,
			[ent[0], ent[1], ent[2], ent[3], ent[4], ent[5], ent[6]],
		);

		await client.query(
			`INSERT INTO entrant_historical_projections (
         id, entrant_id, person_id, projected_finish_seconds, expected_cutoff_risk, projection_method, computed_at
       )
       VALUES ($1, $2, $3, $4, $5, 'historical_pacing', NOW())
       ON CONFLICT (entrant_id) DO UPDATE SET
         projected_finish_seconds = EXCLUDED.projected_finish_seconds,
         expected_cutoff_risk = EXCLUDED.expected_cutoff_risk,
         computed_at = NOW()`,
			[projId, ent[0], ent[2], Math.round(ent[7]), ent[8]],
		);
	}

	// 10. Seed Scored Split Times
	const scoredSplits = [
		// Marcus (#101) through Brighton Lodge (M79.5) on Bonneville 100
		[
			"90000000-0000-4000-8000-000000000001",
			"80000000-0000-4000-8000-000000000001",
			SPLITS.b100_s1,
			"out",
			hoursFromNow(-11.4),
			3.1 * 3600,
			120,
			372,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000002",
			"80000000-0000-4000-8000-000000000001",
			SPLITS.b100_s2,
			"out",
			hoursFromNow(-7.8),
			6.7 * 3600,
			180,
			405,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000003",
			"80000000-0000-4000-8000-000000000001",
			SPLITS.b100_s3,
			"out",
			hoursFromNow(-4.1),
			10.4 * 3600,
			240,
			403,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000004",
			"80000000-0000-4000-8000-000000000001",
			SPLITS.b100_s4,
			"out",
			hoursFromNow(-0.3),
			14.2 * 3600,
			210,
			414,
			false,
		],
		// Elena (#104) through Brighton Lodge on Bonneville 100
		[
			"90000000-0000-4000-8000-000000000005",
			"80000000-0000-4000-8000-000000000002",
			SPLITS.b100_s1,
			"out",
			hoursFromNow(-11.2),
			3.3 * 3600,
			140,
			396,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000006",
			"80000000-0000-4000-8000-000000000002",
			SPLITS.b100_s2,
			"out",
			hoursFromNow(-7.4),
			7.1 * 3600,
			195,
			427,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000007",
			"80000000-0000-4000-8000-000000000002",
			SPLITS.b100_s3,
			"out",
			hoursFromNow(-3.5),
			11.0 * 3600,
			220,
			425,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000008",
			"80000000-0000-4000-8000-000000000002",
			SPLITS.b100_s4,
			"in",
			hoursFromNow(-0.1),
			14.4 * 3600,
			90,
			370,
			false,
		],
		// Soren (#108) through Lambs Canyon (cleared upstream gate for Brighton Lodge)
		[
			"90000000-0000-4000-8000-000000000009",
			"80000000-0000-4000-8000-000000000003",
			SPLITS.b100_s1,
			"out",
			hoursFromNow(-11.1),
			3.4 * 3600,
			110,
			408,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000010",
			"80000000-0000-4000-8000-000000000003",
			SPLITS.b100_s2,
			"out",
			hoursFromNow(-7.2),
			7.3 * 3600,
			160,
			438,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000011",
			"80000000-0000-4000-8000-000000000003",
			SPLITS.b100_s3,
			"out",
			hoursFromNow(-3.1),
			11.4 * 3600,
			200,
			447,
			false,
		],
		// Kenji (#119) through Big Mountain Pass
		[
			"90000000-0000-4000-8000-000000000012",
			"80000000-0000-4000-8000-000000000004",
			SPLITS.b100_s1,
			"out",
			hoursFromNow(-10.5),
			4.0 * 3600,
			150,
			480,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000013",
			"80000000-0000-4000-8000-000000000004",
			SPLITS.b100_s2,
			"out",
			hoursFromNow(-5.6),
			8.9 * 3600,
			240,
			551,
			false,
		],
		// Devon (#142) DNF at Big Mountain Pass
		[
			"90000000-0000-4000-8000-000000000014",
			"80000000-0000-4000-8000-000000000005",
			SPLITS.b100_s1,
			"out",
			hoursFromNow(-9.8),
			4.7 * 3600,
			180,
			564,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000015",
			"80000000-0000-4000-8000-000000000005",
			SPLITS.b100_s2,
			"in",
			hoursFromNow(-4.0),
			10.5 * 3600,
			600,
			652,
			true,
		],
		// Talia (#502) FINISHED Bonneville 50M
		[
			"90000000-0000-4000-8000-000000000016",
			"80000000-0000-4000-8000-000000000006",
			SPLITS.b50_s1,
			"out",
			hoursFromNow(-8.8),
			3.2 * 3600,
			90,
			371,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000017",
			"80000000-0000-4000-8000-000000000006",
			SPLITS.b50_s2,
			"out",
			hoursFromNow(-5.7),
			6.3 * 3600,
			120,
			413,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000018",
			"80000000-0000-4000-8000-000000000006",
			SPLITS.b50_s3,
			"in",
			hoursFromNow(-2.8),
			9.2 * 3600 + 145,
			0,
			380,
			false,
		],
		// Liam (#514) FINISHED Bonneville 50M
		[
			"90000000-0000-4000-8000-000000000019",
			"80000000-0000-4000-8000-000000000007",
			SPLITS.b50_s1,
			"out",
			hoursFromNow(-8.4),
			3.6 * 3600,
			110,
			418,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000020",
			"80000000-0000-4000-8000-000000000007",
			SPLITS.b50_s2,
			"out",
			hoursFromNow(-5.0),
			7.0 * 3600,
			140,
			453,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000021",
			"80000000-0000-4000-8000-000000000007",
			SPLITS.b50_s3,
			"in",
			hoursFromNow(-1.9),
			10.1 * 3600 + 82,
			0,
			404,
			false,
		],
		// Hannah (#527) at Brighton Lodge on Bonneville 50M
		[
			"90000000-0000-4000-8000-000000000022",
			"80000000-0000-4000-8000-000000000008",
			SPLITS.b50_s1,
			"out",
			hoursFromNow(-7.6),
			4.4 * 3600,
			150,
			510,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000023",
			"80000000-0000-4000-8000-000000000008",
			SPLITS.b50_s2,
			"out",
			hoursFromNow(-3.4),
			8.6 * 3600,
			180,
			560,
			false,
		],
		// PAST: Wasatch Crest 50K Finishers
		[
			"90000000-0000-4000-8000-000000000024",
			"80000000-0000-4000-8000-000000000009",
			SPLITS.w50k_s1,
			"out",
			daysFromNow(-13.92),
			1.7 * 3600,
			45,
			306,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000025",
			"80000000-0000-4000-8000-000000000009",
			SPLITS.w50k_s2,
			"out",
			daysFromNow(-13.86),
			3.1 * 3600,
			60,
			336,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000026",
			"80000000-0000-4000-8000-000000000009",
			SPLITS.w50k_s3,
			"in",
			daysFromNow(-13.81),
			4.42 * 3600,
			0,
			312,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000027",
			"80000000-0000-4000-8000-000000000010",
			SPLITS.w50k_s1,
			"out",
			daysFromNow(-13.91),
			1.85 * 3600,
			50,
			333,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000028",
			"80000000-0000-4000-8000-000000000010",
			SPLITS.w50k_s2,
			"out",
			daysFromNow(-13.85),
			3.35 * 3600,
			65,
			360,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000029",
			"80000000-0000-4000-8000-000000000010",
			SPLITS.w50k_s3,
			"in",
			daysFromNow(-13.79),
			4.78 * 3600,
			0,
			339,
			false,
		],
		[
			"90000000-0000-4000-8000-000000000030",
			"80000000-0000-4000-8000-000000000011",
			SPLITS.w50k_s3,
			"in",
			daysFromNow(-13.75),
			5.65 * 3600,
			0,
			405,
			false,
		],
		// PAST: Frost Line Backyard Winner Claire (#1)
		[
			"90000000-0000-4000-8000-000000000031",
			"80000000-0000-4000-8000-000000000013",
			SPLITS.frost_s1,
			"in",
			daysFromNow(-40.58),
			34 * 3600 - 420,
			0,
			450,
			false,
		],
	];

	for (const sst of scoredSplits) {
		await client.query(
			`INSERT INTO scored_split_times (
         id, entrant_id, course_split_id, lap, sub_split_kind,
         absolute_time_utc, elapsed_seconds, dwell_seconds,
         segment_pace_seconds_per_km, penalty_points, stopped_here, data_status,
         created_at, updated_at
       )
       VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, 0, $9, 'confirmed', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         absolute_time_utc = EXCLUDED.absolute_time_utc,
         elapsed_seconds = EXCLUDED.elapsed_seconds,
         dwell_seconds = EXCLUDED.dwell_seconds,
         segment_pace_seconds_per_km = EXCLUDED.segment_pace_seconds_per_km,
         stopped_here = EXCLUDED.stopped_here,
         updated_at = NOW()`,
			sst,
		);
	}

	await client.query("COMMIT");
	console.log(
		"Seeded public ChekkPoint entities (3 Orgs, 7 Courses, 6 Event Groups, 12 Athletes, Entrants & Splits).",
	);
} catch (err) {
	await client.query("ROLLBACK");
	console.error("Failed to seed public data:", err);
	process.exit(1);
} finally {
	await client.end();
}
