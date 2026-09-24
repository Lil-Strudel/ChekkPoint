/**
 * Pure Client-Safe Schema Metadata Dictionary
 *
 * Contains rich operational descriptions, domain rules, relationship graphs,
 * field specifications, and enum catalogs for all ChekkPoint database tables.
 *
 * ZERO runtime database or server dependencies.
 */

export type CollectionCategory =
	| "Core Hierarchy"
	| "Course & Geography"
	| "Participants"
	| "Competitor History & Intelligence"
	| "Write Plane (Audit Ledger)"
	| "Read Plane (Standings)"
	| "Operations & Audits"
	| "System Demo";

export type CollectionKey =
	| "organizations"
	| "eventGroups"
	| "courses"
	| "events"
	| "timingPoints"
	| "courseSplits"
	| "people"
	| "entrants"
	| "personExternalProfiles"
	| "personRaceHistory"
	| "personHistoricalSummaries"
	| "entrantHistoricalProjections"
	| "rawTimingEvents"
	| "scoredSplitTimes"
	| "timeAllowances"
	| "splitTimeAudits"
	| "helloWorld";

export const ALL_COLLECTION_KEYS: readonly CollectionKey[] = [
	"organizations",
	"eventGroups",
	"courses",
	"events",
	"timingPoints",
	"courseSplits",
	"people",
	"entrants",
	"personExternalProfiles",
	"personRaceHistory",
	"personHistoricalSummaries",
	"entrantHistoricalProjections",
	"rawTimingEvents",
	"scoredSplitTimes",
	"timeAllowances",
	"splitTimeAudits",
	"helloWorld",
] as const;

export function isCollectionKey(key: string): key is CollectionKey {
	return (ALL_COLLECTION_KEYS as readonly string[]).includes(key);
}

export interface FieldMetadata {
	name: string;
	type: string;
	nullable: boolean;
	defaultValue?: string;
	constraints?: string[];
	description: string;
}

export interface RelationshipMetadata {
	kind: "belongsTo" | "hasMany";
	targetCollectionId: CollectionKey;
	foreignKey: string;
	description: string;
}

export interface EnumMetadata {
	name: string;
	values: { value: string; label: string; description: string }[];
}

export interface PolymorphicSchemaMetadata {
	name: string;
	description: string;
	fields: {
		name: string;
		type: string;
		optional?: boolean;
		description: string;
	}[];
}

export interface IndexMetadata {
	name: string;
	columns: string[];
	unique?: boolean;
	rationale: string;
}

export interface CollectionMetadata {
	id: CollectionKey;
	name: string;
	tableName: string;
	category: CollectionCategory;
	badge: string;
	shortDescription: string;
	operationalPurpose: string;
	relationships: RelationshipMetadata[];
	fields: FieldMetadata[];
	enums?: EnumMetadata[];
	polymorphicSchemas?: PolymorphicSchemaMetadata[];
	indexes: IndexMetadata[];
}

export const COLLECTION_CATEGORIES: readonly CollectionCategory[] = [
	"Core Hierarchy",
	"Course & Geography",
	"Participants",
	"Competitor History & Intelligence",
	"Write Plane (Audit Ledger)",
	"Read Plane (Standings)",
	"Operations & Audits",
	"System Demo",
] as const;

export const COLLECTIONS: readonly CollectionMetadata[] = [
	{
		id: "organizations",
		name: "Organizations",
		tableName: "organizations",
		category: "Core Hierarchy",
		badge: "Multi-Tenant Root",
		shortDescription:
			"Root tenant entity representing governing bodies, race directors, and timing service companies.",
		operationalPurpose:
			"The top-level organizational umbrella in ChekkPoint. All event groups, courses, and ground timing points cascade down from an organization. This multi-tenant boundary isolates configuration and ensures authorization barriers between race directors.",
		relationships: [
			{
				kind: "hasMany",
				targetCollectionId: "eventGroups",
				foreignKey: "organizationId",
				description:
					"Event weekends and race groups hosted by this organization.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "courses",
				foreignKey: "organizationId",
				description:
					"Standardized courses and GPX tracks curated by this organization.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "timingPoints",
				foreignKey: "organizationId",
				description:
					"Physical timing hardware and checkpoint stations owned/managed by this organization.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique tenant identifier.",
			},
			{
				name: "name",
				type: "text",
				nullable: false,
				description:
					'Display name of the organization (e.g. "Wasatch Mountain Club").',
			},
			{
				name: "slug",
				type: "text",
				nullable: false,
				constraints: ["Unique"],
				description:
					"URL-safe routing identifier used in tenant subdomains or paths.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "UTC registration timestamp.",
			},
			{
				name: "updatedAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "UTC last modification timestamp.",
			},
		],
		indexes: [
			{
				name: "organizations_slug_unique",
				columns: ["slug"],
				unique: true,
				rationale:
					"Ensures URL slugs are strictly unique across all tenants for web routing.",
			},
		],
	},
	{
		id: "eventGroups",
		name: "Event Groups",
		tableName: "event_groups",
		category: "Core Hierarchy",
		badge: "Operational Boundary",
		shortDescription:
			"The fundamental weekend/venue grouping sharing physical bib space, timing points, and volunteers.",
		operationalPurpose:
			"EventGroup represents races occurring on the same day/weekend sharing physical infrastructure (volunteers, timing gates, bib series, e.g. 100M, 50M, 20M). Raw timing pulses are ingested at the EventGroup level so field volunteers and transponder mats do not need to guess which race distance a runner is competing in.",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "organizations",
				foreignKey: "organizationId",
				description: "Parent organization managing this race weekend.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "events",
				foreignKey: "eventGroupId",
				description:
					"Individual race distances and divisions competing within this weekend.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "rawTimingEvents",
				foreignKey: "eventGroupId",
				description:
					"All ingested raw timing pulses recorded across the entire weekend.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique event group identifier.",
			},
			{
				name: "organizationId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> organizations.id"],
				description: "Owning organization.",
			},
			{
				name: "name",
				type: "text",
				nullable: false,
				description:
					'Human-readable weekend title (e.g. "Wasatch 100 Weekend 2026").',
			},
			{
				name: "slug",
				type: "text",
				nullable: false,
				description: "URL slug for the event weekend.",
			},
			{
				name: "discipline",
				type: "disciplineEnum",
				nullable: false,
				constraints: ["Enum"],
				description:
					"Sporting discipline defining scoring rules and calculation pipelines.",
			},
			{
				name: "rulesConfig",
				type: "jsonb (RulesConfig)",
				nullable: false,
				constraints: ["Zod Validated"],
				description:
					"Event-level time formatting, precision decimals, TSD penalty factors, and backyard ultra rules.",
			},
			{
				name: "startDate",
				type: "timestamp with time zone",
				nullable: false,
				description: "Weekend opening / venue access start timestamp.",
			},
			{
				name: "endDate",
				type: "timestamp with time zone",
				nullable: false,
				description: "Weekend closing / course breakdown end timestamp.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Creation timestamp.",
			},
		],
		enums: [
			{
				name: "discipline",
				values: [
					{
						value: "trail_ultra",
						label: "Trail Ultra",
						description:
							"Point-to-point, out-and-back, or multi-loop trail ultramarathons with aid station cutoffs.",
					},
					{
						value: "road_marathon",
						label: "Road Marathon",
						description:
							"Road distance events featuring mass/wave starts and gun vs. net chip timing.",
					},
					{
						value: "backyard_ultra",
						label: "Backyard Ultra",
						description:
							"Last Person Standing format with hourly elimination loops (4.167 miles every 60 min).",
					},
					{
						value: "fixed_time_loop",
						label: "Fixed-Time Loop",
						description:
							"Timed endurance events (6h, 12h, 24h, 48h) maximizing completed mileage.",
					},
					{
						value: "downhill_mtb",
						label: "Downhill MTB",
						description:
							"Individual staggered flying finishes with millisecond photocell precision.",
					},
					{
						value: "xco_cycling",
						label: "Cross-Country Cycling",
						description:
							"Cross-country and gravel mass or wave races scored by completed laps and gun delta.",
					},
					{
						value: "tsd_regularity",
						label: "TSD Regularity",
						description:
							"Time-Speed-Distance motorsport scoring based on absolute deviation from target passage times.",
					},
				],
			},
		],
		polymorphicSchemas: [
			{
				name: "RulesConfig",
				description:
					"Configurable scoring rules controlling time format, precision, and penalty multipliers.",
				fields: [
					{
						name: "timeFormat",
						type: "'HH:MM:SS' | 'HH:MM:SS.sss' | 'MM:SS.sss'",
						description: "Display formatting pattern for web standings.",
					},
					{
						name: "displayPrecisionDecimals",
						type: "number (0-3)",
						description:
							"Number of decimal digits shown on public leaderboards.",
					},
					{
						name: "allowSelfCheckIn",
						type: "boolean",
						description: "Enables racer self-service mobile check-in.",
					},
					{
						name: "requirePacerRegistration",
						type: "boolean",
						description:
							"Enforces mandatory pacer bib registration before course entry.",
					},
					{
						name: "earlyPenaltyFactor",
						type: "number (default 2.0)",
						description:
							"TSD regularity penalty factor for premature checkpoint arrival (penalizes speeding).",
					},
					{
						name: "latePenaltyFactor",
						type: "number (default 1.0)",
						description:
							"TSD regularity penalty factor for late checkpoint arrival.",
					},
					{
						name: "gracePeriodSeconds",
						type: "number (default 0.0)",
						description: "Deviation window before penalty points accrue.",
					},
					{
						name: "yardDistanceMiles",
						type: "number (default 4.166667)",
						description: "Official loop distance for backyard ultras.",
					},
					{
						name: "yardTimeLimitSeconds",
						type: "number (default 3600)",
						description: "Hourly time limit to complete each yard.",
					},
				],
			},
		],
		indexes: [
			{
				name: "event_groups_org_idx",
				columns: ["organizationId"],
				rationale:
					"Accelerates tenant-filtered event lookups in administrative portals.",
			},
			{
				name: "event_groups_slug_idx",
				columns: ["slug"],
				rationale: "Optimizes public URL route resolution.",
			},
		],
	},
	{
		id: "courses",
		name: "Courses",
		tableName: "courses",
		category: "Course & Geography",
		badge: "Physical Track",
		shortDescription:
			"Physical course track, distance, elevation profile, and GPX navigation route file.",
		operationalPurpose:
			"Defines the immutable physical track for an athletic competition. Distinct from an Event (which has a scheduled time and competitors) and CourseSplits (which are logical checkpoints along this course). Can be reused year over year or across multiple events.",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "organizations",
				foreignKey: "organizationId",
				description: "Owning organization.",
			},
			{
				kind: "belongsTo",
				targetCollectionId: "courses",
				foreignKey: "copiedFromCourseId",
				description:
					"Source template or previous edition course this course was copied from.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "courses",
				foreignKey: "copiedFromCourseId",
				description: "Derived courses created by copying this course layout.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "events",
				foreignKey: "courseId",
				description: "Races running along this physical course.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "courseSplits",
				foreignKey: "courseId",
				description:
					"Checkpoints and milestone splits defined along this course.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique course identifier.",
			},
			{
				name: "organizationId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> organizations.id"],
				description: "Owning organization.",
			},
			{
				name: "name",
				type: "text",
				nullable: false,
				description: 'Course title (e.g. "Western States 100 Trail").',
			},
			{
				name: "distanceMeters",
				type: "double precision",
				nullable: false,
				description: "Official measured course distance in meters.",
			},
			{
				name: "elevationGainMeters",
				type: "integer",
				nullable: true,
				description: "Cumulative positive elevation gain in meters.",
			},
			{
				name: "gpxRouteUrl",
				type: "text",
				nullable: true,
				description: "Public URL to the official GPX elevation route file.",
			},
			{
				name: "copiedFromCourseId",
				type: "uuid",
				nullable: true,
				constraints: ["FK -> courses.id", "ON DELETE SET NULL"],
				description:
					"Optional reference to the source course from which this course was cloned or derived.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Creation timestamp.",
			},
		],
		indexes: [
			{
				name: "courses_org_idx",
				columns: ["organizationId"],
				rationale: "Accelerates course catalog browsing by organization.",
			},
			{
				name: "courses_copied_from_idx",
				columns: ["copiedFromCourseId"],
				rationale:
					"Accelerates lookup of course copy hierarchies, templates, and provenance lineage.",
			},
		],
	},
	{
		id: "events",
		name: "Events",
		tableName: "events",
		category: "Core Hierarchy",
		badge: "Race Instance",
		shortDescription:
			"A specific race contest within an EventGroup running over a Course.",
		operationalPurpose:
			"The specific competitive race instance (e.g. '100 Mile Championship', '50K Solo', 'Pro Men DH'). Binds an EventGroup and a Course together with scheduled start times, lap counts, and registered entrants.",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "eventGroups",
				foreignKey: "eventGroupId",
				description: "Parent event group weekend.",
			},
			{
				kind: "belongsTo",
				targetCollectionId: "courses",
				foreignKey: "courseId",
				description: "Course track this event takes place on.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "entrants",
				foreignKey: "eventId",
				description: "Roster of scored competitors registered for this race.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique event identifier.",
			},
			{
				name: "eventGroupId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> eventGroups.id"],
				description: "Parent event group.",
			},
			{
				name: "courseId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> courses.id"],
				description: "Physical course.",
			},
			{
				name: "name",
				type: "text",
				nullable: false,
				description: 'Race title (e.g. "100 Mile Championship").',
			},
			{
				name: "lapsRequired",
				type: "integer",
				nullable: false,
				defaultValue: "1",
				description:
					"Number of full course circuits required to complete the race.",
			},
			{
				name: "scheduledStart",
				type: "timestamp with time zone",
				nullable: false,
				description: "Official scheduled gun time.",
			},
			{
				name: "actualStart",
				type: "timestamp with time zone",
				nullable: true,
				description: "Observed actual gun firing timestamp.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Creation timestamp.",
			},
		],
		indexes: [
			{
				name: "events_group_idx",
				columns: ["eventGroupId"],
				rationale:
					"Accelerates retrieval of all race divisions within an event weekend.",
			},
			{
				name: "events_course_idx",
				columns: ["courseId"],
				rationale:
					"Enables fast lookup of events sharing a specific course track.",
			},
		],
	},
	{
		id: "timingPoints",
		name: "Timing Points",
		tableName: "timing_points",
		category: "Course & Geography",
		badge: "Ground Station",
		shortDescription:
			"Physical coordinates and ground hardware location where volunteers or transponder mats sit.",
		operationalPurpose:
			"TimingPoint represents a physical ground station (e.g. 'Twin Lakes Aid Station Tent' at GPS 39.08, -106.38). Hardware devices transmit raw pulses tagged with the TimingPoint code. Runners on out-and-back or multi-loop courses may pass the same physical TimingPoint multiple times under different CourseSplits.",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "organizations",
				foreignKey: "organizationId",
				description: "Owning organization.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "courseSplits",
				foreignKey: "timingPointId",
				description:
					"Course splits mapped to this physical checkpoint location.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique timing point identifier.",
			},
			{
				name: "organizationId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> organizations.id"],
				description: "Owning organization.",
			},
			{
				name: "name",
				type: "text",
				nullable: false,
				description: 'Descriptive name (e.g. "Twin Lakes Aid Station Tent").',
			},
			{
				name: "code",
				type: "text",
				nullable: false,
				constraints: ["Unique with organizationId"],
				description:
					'Short identifier transmitted by hardware or acoustic radio (e.g. "TWIN_LAKES").',
			},
			{
				name: "latitude",
				type: "double precision",
				nullable: true,
				description: "WGS84 latitude coordinate.",
			},
			{
				name: "longitude",
				type: "double precision",
				nullable: true,
				description: "WGS84 longitude coordinate.",
			},
			{
				name: "elevationMeters",
				type: "integer",
				nullable: true,
				description: "Altitude above sea level in meters.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Creation timestamp.",
			},
		],
		indexes: [
			{
				name: "timing_points_org_code_idx",
				columns: ["organizationId", "code"],
				unique: true,
				rationale:
					"Prevents code collisions while allowing short reusable codes across organizations.",
			},
		],
	},
	{
		id: "courseSplits",
		name: "Course Splits",
		tableName: "course_splits",
		category: "Course & Geography",
		badge: "Logical Milestone",
		shortDescription:
			"A logical milestone along a course at a cumulative distance, pointing to a physical TimingPoint.",
		operationalPurpose:
			"CourseSplit links cumulative distance along a course to a physical TimingPoint. For example, on an out-and-back course, 'Mile 39.5 Outbound' and 'Mile 60.5 Inbound' are two distinct courseSplits with different sequence orders, but both point to the same physical timingPoint ('TWIN_LAKES').",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "courses",
				foreignKey: "courseId",
				description: "Course track containing this split.",
			},
			{
				kind: "belongsTo",
				targetCollectionId: "timingPoints",
				foreignKey: "timingPointId",
				description: "Physical ground station where this split is recorded.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "scoredSplitTimes",
				foreignKey: "courseSplitId",
				description:
					"Materialized split times achieved by competitors at this station.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "timeAllowances",
				foreignKey: "splitId",
				description: "Medical or hazard holds applied at this station.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique course split identifier.",
			},
			{
				name: "courseId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> courses.id"],
				description: "Course track.",
			},
			{
				name: "timingPointId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> timingPoints.id"],
				description: "Physical timing station.",
			},
			{
				name: "name",
				type: "text",
				nullable: false,
				description: 'Split milestone name (e.g. "Twin Lakes Inbound").',
			},
			{
				name: "sequenceOrder",
				type: "integer",
				nullable: false,
				constraints: ["Unique with courseId"],
				description: "1-based chronological checkpoint progression order.",
			},
			{
				name: "distanceFromStartMeters",
				type: "double precision",
				nullable: false,
				description: "Cumulative distance from start line in meters.",
			},
			{
				name: "subSplitBitmap",
				type: "integer",
				nullable: false,
				defaultValue: "1",
				description:
					"Bitmask: 1=IN (arrival), 2=OUT (departure), 3=IN+OUT (dwell tracked).",
			},
			{
				name: "cutoffDurationSeconds",
				type: "integer",
				nullable: true,
				description:
					"Mandatory station departure cutoff duration relative to event gun start.",
			},
			{
				name: "tsdIdealDurationSeconds",
				type: "double precision",
				nullable: true,
				description:
					"Target ideal elapsed seconds for TSD regularity rally scoring.",
			},
			{
				name: "isSecretCheckpoint",
				type: "boolean",
				nullable: false,
				defaultValue: "false",
				description:
					"Secret regularity stage checkpoint hidden from competitor roadbooks.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Creation timestamp.",
			},
		],
		indexes: [
			{
				name: "course_splits_order_idx",
				columns: ["courseId", "sequenceOrder"],
				unique: true,
				rationale:
					"Guarantees strict sequential ordering of checkpoints along a course.",
			},
			{
				name: "course_splits_course_dist_idx",
				columns: ["courseId", "distanceFromStartMeters"],
				rationale:
					"Accelerates distance-based milestone queries and elevation profile charting.",
			},
		],
	},
	{
		id: "people",
		name: "People",
		tableName: "people",
		category: "Participants",
		badge: "Global Identity",
		shortDescription:
			"Global human identity record with contact info, emergency contacts, and multi-role assignments.",
		operationalPurpose:
			"Centralizes individual identity across the platform. Holds contact details and a roles array ('racer', 'volunteer', 'pacer', 'crew', 'official', 'emergency_contact'). Maintaining roles on the person record allows instant volunteer, competitor, and emergency contact directory lookups without complex multi-table joins.",
		relationships: [
			{
				kind: "hasMany",
				targetCollectionId: "entrants",
				foreignKey: "personId",
				description: "Races this person is or has competed in.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "entrants",
				foreignKey: "emergencyContactPersonId",
				description:
					"Entrants for whom this person serves as designated emergency contact.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "personExternalProfiles",
				foreignKey: "personId",
				description:
					"External athletic platform profiles (UltraSignup, Strava, DUV, ITRA).",
			},
			{
				kind: "hasMany",
				targetCollectionId: "personRaceHistory",
				foreignKey: "personId",
				description: "Individual past race results achieved across platforms.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "personHistoricalSummaries",
				foreignKey: "personId",
				description:
					"Materialized 1:1 career intelligence rollup and experience tier.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "entrantHistoricalProjections",
				foreignKey: "personId",
				description:
					"Event-specific pacing projections and safety triage models.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique person identifier.",
			},
			{
				name: "firstName",
				type: "text",
				nullable: false,
				description: "First name.",
			},
			{
				name: "lastName",
				type: "text",
				nullable: false,
				description: "Last name.",
			},
			{
				name: "gender",
				type: "text",
				nullable: true,
				description: "Gender identity for category assignment.",
			},
			{
				name: "birthdate",
				type: "text",
				nullable: true,
				description: "Birthdate string (YYYY-MM-DD) for age-group calculation.",
			},
			{
				name: "email",
				type: "text",
				nullable: true,
				description: "Primary contact email.",
			},
			{
				name: "phone",
				type: "text",
				nullable: true,
				description: "Mobile contact phone.",
			},
			{
				name: "address",
				type: "jsonb (AddressSchema)",
				nullable: true,
				description: "Residential address.",
			},
			{
				name: "roles",
				type: "jsonb (Array<PersonRole>)",
				nullable: false,
				defaultValue: "[]",
				description:
					"Assigned roles: 'racer', 'volunteer', 'pacer', 'crew', 'official', 'emergency_contact'.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Creation timestamp.",
			},
		],
		indexes: [
			{
				name: "people_email_idx",
				columns: ["email"],
				rationale:
					"Accelerates user authentication and participant lookup during registration.",
			},
			{
				name: "people_name_idx",
				columns: ["lastName", "firstName"],
				rationale:
					"Speeds up competitor alphabetical searches in timing kiosks.",
			},
		],
	},
	{
		id: "entrants",
		name: "Entrants",
		tableName: "entrants",
		category: "Participants",
		badge: "Scored Competitor",
		shortDescription:
			"The scored competitive unit in a race (Bib #, Plate #, or Car #) and polymorphic participant data.",
		operationalPurpose:
			"The primary unit of competition and leaderboards. Links a Person to an Event. Supports polymorphic participant configurations: Solo Competitor, Vehicle Crew (driver + co-driver + car details), or Relay Team (squad members + leg assignments). Tracks bib/plate number, RFID chip code, wave start offsets, and drop status.",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "events",
				foreignKey: "eventId",
				description: "Event in which this entrant is competing.",
			},
			{
				kind: "belongsTo",
				targetCollectionId: "people",
				foreignKey: "personId",
				description: "Person who registered or captains this entry.",
			},
			{
				kind: "belongsTo",
				targetCollectionId: "courseSplits",
				foreignKey: "droppedSplitId",
				description:
					"Checkpoint where competitor dropped / DNF'd if applicable.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "scoredSplitTimes",
				foreignKey: "entrantId",
				description: "Chronological scored splits recorded for this entrant.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "timeAllowances",
				foreignKey: "entrantId",
				description:
					"Authorized time allowances or holds granted to this competitor.",
			},
			{
				kind: "belongsTo",
				targetCollectionId: "people",
				foreignKey: "emergencyContactPersonId",
				description:
					"Designated emergency contact person (normalized 1:1 relation).",
			},
			{
				kind: "hasMany",
				targetCollectionId: "entrantHistoricalProjections",
				foreignKey: "entrantId",
				description:
					"Event-specific materialized pacing projection and safety model.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique entrant identifier.",
			},
			{
				name: "eventId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> events.id"],
				description: "Race event.",
			},
			{
				name: "personId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> people.id"],
				description: "Registered person.",
			},
			{
				name: "competitorNumber",
				type: "text",
				nullable: false,
				constraints: ["Unique with eventId"],
				description: "Assigned bib number, bike plate, or car number.",
			},
			{
				name: "rfidCode",
				type: "text",
				nullable: true,
				description: "Transponder chip serial number.",
			},
			{
				name: "status",
				type: "entrantStatusEnum",
				nullable: false,
				defaultValue: "'registered'",
				constraints: ["Enum"],
				description:
					"Competitive lifecycle state (registered, checked_in, in_progress, finished, dnf, retired, dq, otl).",
			},
			{
				name: "division",
				type: "text",
				nullable: false,
				description:
					'Scoring division (e.g. "Open M", "F40-49", "Pro Men DH").',
			},
			{
				name: "participantData",
				type: "jsonb (ParticipantData)",
				nullable: false,
				constraints: ["Discriminated Union"],
				description:
					"Polymorphic payload: SoloCompetitor, VehicleCrew, or RelayTeam.",
			},
			{
				name: "emergencyContactPersonId",
				type: "uuid",
				nullable: true,
				constraints: ["FK -> people.id", "ON DELETE SET NULL"],
				description: "Primary emergency contact person record.",
			},
			{
				name: "emergencyContactRelationship",
				type: "text",
				nullable: true,
				description:
					"Relationship to competitor (e.g. Spouse, Parent, Friend, Coach).",
			},
			{
				name: "emergencyContactIsOnSite",
				type: "boolean",
				nullable: false,
				defaultValue: "false",
				description:
					"Whether the emergency contact is physically on-site at the event.",
			},
			{
				name: "scheduledStartTime",
				type: "timestamp with time zone",
				nullable: true,
				description: "Wave or staggered departure target.",
			},
			{
				name: "actualStartTime",
				type: "timestamp with time zone",
				nullable: true,
				description: "Verified chip detection at start line.",
			},
			{
				name: "droppedSplitId",
				type: "uuid",
				nullable: true,
				constraints: ["FK -> courseSplits.id"],
				description: "Checkpoint where competitor withdrew.",
			},
			{
				name: "dropReason",
				type: "text",
				nullable: true,
				description:
					"Drop cause: 'voluntary', 'medical', 'mechanical', 'missed_cutoff'.",
			},
			{
				name: "dropLocationDescription",
				type: "text",
				nullable: true,
				description:
					"Search and rescue narrative if retired on course between stations.",
			},
			{
				name: "comments",
				type: "text",
				nullable: true,
				description: "Steward or medical notes.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Creation timestamp.",
			},
		],
		enums: [
			{
				name: "entrant_status",
				values: [
					{
						value: "registered",
						label: "Registered",
						description: "Signed up, bib/plate assigned.",
					},
					{
						value: "checked_in",
						label: "Checked In",
						description: "Verified at venue, mandatory gear inspected.",
					},
					{
						value: "dns",
						label: "Did Not Start",
						description: "Withdrew before crossing official start line.",
					},
					{
						value: "in_progress",
						label: "In Progress",
						description: "Active on course; past start line.",
					},
					{
						value: "finished",
						label: "Finished",
						description: "Legally completed all required splits.",
					},
					{
						value: "dnf",
						label: "Did Not Finish (In Custody)",
						description: "Dropped at an official checkpoint and accounted for.",
					},
					{
						value: "retired",
						label: "Retired On Course (SAR Alert)",
						description:
							"Withdrew between checkpoints; search and rescue protocol initiated.",
					},
					{
						value: "dq",
						label: "Disqualified",
						description:
							"Sanctioned by race stewards for course cutting or rules violations.",
					},
					{
						value: "otl",
						label: "Over Time Limit",
						description: "Cut off by station departure threshold.",
					},
				],
			},
		],
		polymorphicSchemas: [
			{
				name: "SoloCompetitor",
				description: "Standard competitor schema for running and solo cycling.",
				fields: [
					{
						name: "kind",
						type: "'solo_competitor'",
						description: "Discriminating literal key.",
					},
					{
						name: "medicalNotes",
						type: "string (optional)",
						description: "Critical allergies or medical conditions.",
					},
					{
						name: "pacerName",
						type: "string (optional)",
						description: "Registered pacer.",
					},
					{
						name: "tShirtSize",
						type: "string (optional)",
						description: "Swag apparel size.",
					},
				],
			},
			{
				name: "VehicleCrew",
				description: "Multi-person motorsport or rally crew schema.",
				fields: [
					{
						name: "kind",
						type: "'vehicle_crew'",
						description: "Discriminating literal key.",
					},
					{
						name: "driver",
						type: "{ name, licenseNumber, phone }",
						description: "Primary pilot.",
					},
					{
						name: "coDriver",
						type: "{ name, licenseNumber, phone } (optional)",
						description: "Navigator / co-driver.",
					},
					{
						name: "vehicle",
						type: "{ make, model, year, vehicleClass }",
						description: "Vehicle classification and specifications.",
					},
				],
			},
			{
				name: "RelayTeam",
				description:
					"Squad schema for Ekiden, multi-runner loops, and team relays.",
				fields: [
					{
						name: "kind",
						type: "'relay_team'",
						description: "Discriminating literal key.",
					},
					{
						name: "teamName",
						type: "string",
						description: "Official squad name.",
					},
					{
						name: "captainContact",
						type: "{ name, phone, email, address }",
						description: "Team captain contact.",
					},
					{
						name: "members",
						type: "Array<{ legNumber, name, phone }>",
						description: "Individual leg runners.",
					},
				],
			},
		],
		indexes: [
			{
				name: "entrants_event_competitor_idx",
				columns: ["eventId", "competitorNumber"],
				unique: true,
				rationale:
					"Prevents duplicate bib number assignments within the same race event.",
			},
			{
				name: "entrants_transponder_idx",
				columns: ["rfidCode"],
				rationale:
					"Accelerates high-frequency transponder antenna hit matching during chip read ingestion.",
			},
			{
				name: "entrants_status_idx",
				columns: ["eventId", "status"],
				rationale:
					"Optimizes dashboard filtering for active runners vs drops/finishers.",
			},
			{
				name: "entrants_emergency_contact_person_idx",
				columns: ["emergencyContactPersonId"],
				rationale:
					"Accelerates instant emergency lookups and contact resolution during medical incidents.",
			},
		],
	},
	{
		id: "personExternalProfiles",
		name: "Person External Profiles",
		tableName: "person_external_profiles",
		category: "Competitor History & Intelligence",
		badge: "External Platform Identity",
		shortDescription:
			"External platform accounts (UltraSignup, Strava, DUV, ITRA) linked to an individual person.",
		operationalPurpose:
			"Maintains authenticated or discovered external profiles across endurance and timing services. Tracks verification state (auto-matched vs organizer-confirmed), scraping status, match confidence percentage, and raw external API/DOM payloads.",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "people",
				foreignKey: "personId",
				description: "Internal person record owning this external profile.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "personRaceHistory",
				foreignKey: "externalProfileId",
				description:
					"Historical race performances imported from this external profile.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique external profile identifier.",
			},
			{
				name: "personId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> people.id", "ON DELETE CASCADE"],
				description: "Reference to the local person.",
			},
			{
				name: "platform",
				type: "externalPlatformEnum",
				nullable: false,
				constraints: ["Enum"],
				description:
					"Target platform service (ultrasignup, strava, duv, itra, athlinks, custom).",
			},
			{
				name: "externalIdentifier",
				type: "text",
				nullable: false,
				constraints: ["Unique with platform"],
				description:
					"Platform-specific identifier (e.g. UltraSignup athlete ID or Strava athlete numeric ID).",
			},
			{
				name: "profileUrl",
				type: "text",
				nullable: true,
				description: "Direct canonical HTTP URL to the athlete profile page.",
			},
			{
				name: "verificationStatus",
				type: "profileVerificationStatusEnum",
				nullable: false,
				defaultValue: "'unverified'",
				constraints: ["Enum"],
				description:
					"Verification state: unverified, candidate_matched, auto_verified, manual_verified, rejected, conflict.",
			},
			{
				name: "matchConfidence",
				type: "double precision",
				nullable: true,
				description:
					"Computed Multi-Factor Disambiguation Algorithm (MFDA) score (0.0 - 100.0).",
			},
			{
				name: "matchMetadata",
				type: "jsonb",
				nullable: true,
				description:
					"Sub-score breakdowns (name Levenshtein, age delta, geography, phonetic score).",
			},
			{
				name: "scrapeStatus",
				type: "scrapeStatusEnum",
				nullable: false,
				defaultValue: "'pending'",
				constraints: ["Enum"],
				description:
					"Queue worker lifecycle state: pending, queued, in_progress, succeeded, failed, rate_limited, stale.",
			},
			{
				name: "lastScrapedAt",
				type: "timestamp with time zone",
				nullable: true,
				description: "Timestamp of last successful crawl or API fetch.",
			},
			{
				name: "rawPayload",
				type: "jsonb",
				nullable: true,
				description:
					"Unmodified JSON response snapshot or parsed DOM tree for debugging.",
			},
			{
				name: "errorMessage",
				type: "text",
				nullable: true,
				description:
					"Last ingestion failure error message or HTTP status code.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Creation timestamp.",
			},
			{
				name: "updatedAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Last record update timestamp.",
			},
		],
		enums: [
			{
				name: "external_platform",
				values: [
					{
						value: "ultrasignup",
						label: "UltraSignup",
						description:
							"North American trail and ultramarathon registration and results database.",
					},
					{
						value: "strava",
						label: "Strava",
						description:
							"Social fitness telemetry, GPS elevation, and training load API.",
					},
					{
						value: "duv",
						label: "DUV Ultra Marathon",
						description:
							"Deutsche Ultramarathon-Vereinigung international ultra statistics.",
					},
					{
						value: "itra",
						label: "ITRA",
						description:
							"International Trail Running Association performance index and points.",
					},
					{
						value: "athlinks",
						label: "Athlinks",
						description: "Multi-sport mass-participation road race database.",
					},
					{
						value: "custom",
						label: "Custom / Manual",
						description: "Custom platform or organizer-supplied external link.",
					},
				],
			},
			{
				name: "profile_verification_status",
				values: [
					{
						value: "unverified",
						label: "Unverified",
						description: "Newly discovered profile awaiting disambiguation.",
					},
					{
						value: "candidate_matched",
						label: "Candidate Matched (60-84%)",
						description:
							"Probable match requiring organizer confirmation in Steward Admin.",
					},
					{
						value: "auto_verified",
						label: "Auto-Verified (>= 85%)",
						description:
							"High-confidence deterministic match verified by MFDA algorithm.",
					},
					{
						value: "manual_verified",
						label: "Manual Verified",
						description:
							"Explicitly confirmed or bound by race director / timing official.",
					},
					{
						value: "rejected",
						label: "Rejected / Blacklisted",
						description:
							"Excluded match candidate confirmed not to be this athlete.",
					},
					{
						value: "conflict",
						label: "Identity Conflict",
						description:
							"Multiple candidates or conflicting historical claims requiring manual resolution.",
					},
				],
			},
			{
				name: "scrape_status",
				values: [
					{
						value: "pending",
						label: "Pending",
						description: "Awaiting enqueue into worker fetch queue.",
					},
					{
						value: "queued",
						label: "Queued",
						description: "Enqueued in Redis BullMQ fetch queue.",
					},
					{
						value: "in_progress",
						label: "In Progress",
						description:
							"Currently being fetched by Railway background worker.",
					},
					{
						value: "succeeded",
						label: "Succeeded",
						description:
							"Payload successfully retrieved and race history records parsed.",
					},
					{
						value: "failed",
						label: "Failed",
						description: "Scrape attempt failed after retries.",
					},
					{
						value: "rate_limited",
						label: "Rate Limited (429)",
						description:
							"Worker received rate limit backoff signal; leased back with delay.",
					},
					{
						value: "stale",
						label: "Stale",
						description:
							"Profile has not been updated within freshness window.",
					},
				],
			},
		],
		indexes: [
			{
				name: "person_external_profiles_platform_identifier_idx",
				columns: ["platform", "externalIdentifier"],
				unique: true,
				rationale:
					"Guarantees external platform identities are unique across the tenant database.",
			},
			{
				name: "person_external_profiles_person_idx",
				columns: ["personId"],
				rationale:
					"Accelerates lookups of all external profiles for a given person.",
			},
			{
				name: "person_external_profiles_scrape_status_idx",
				columns: ["scrapeStatus"],
				rationale:
					"Optimizes background worker polling for pending and queued scraping tasks.",
			},
		],
	},
	{
		id: "personRaceHistory",
		name: "Person Race History",
		tableName: "person_race_history",
		category: "Competitor History & Intelligence",
		badge: "Athletic Provenance",
		shortDescription:
			"Individual past race results, finishes, and DNFs achieved by a person across platforms and years.",
		operationalPurpose:
			"Normalizes past race performances from UltraSignup, DUV, ITRA, and manual submissions. Powers career summary metrics, historic DNF rates, and predictive pacing calculations.",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "people",
				foreignKey: "personId",
				description: "Person who completed or participated in this past race.",
			},
			{
				kind: "belongsTo",
				targetCollectionId: "personExternalProfiles",
				foreignKey: "externalProfileId",
				description:
					"Source external profile from which this result was ingested.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique race history result identifier.",
			},
			{
				name: "personId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> people.id", "ON DELETE CASCADE"],
				description: "Competitor person record.",
			},
			{
				name: "externalProfileId",
				type: "uuid",
				nullable: true,
				constraints: [
					"FK -> person_external_profiles.id",
					"ON DELETE SET NULL",
				],
				description: "Provenance external profile reference.",
			},
			{
				name: "platform",
				type: "externalPlatformEnum",
				nullable: false,
				constraints: ["Enum"],
				description:
					"Source platform (ultrasignup, strava, duv, itra, athlinks, custom).",
			},
			{
				name: "raceName",
				type: "text",
				nullable: false,
				description: "Official name of the historical race event.",
			},
			{
				name: "raceDate",
				type: "text",
				nullable: false,
				description: "ISO date string (YYYY-MM-DD) when the race took place.",
			},
			{
				name: "distanceMeters",
				type: "double precision",
				nullable: true,
				description: "Official course distance in meters.",
			},
			{
				name: "distanceLabel",
				type: "text",
				nullable: true,
				description:
					'Standard distance category label (e.g. "50K", "100M", "Marathon").',
			},
			{
				name: "elevationGainMeters",
				type: "double precision",
				nullable: true,
				description: "Total positive vertical elevation gain in meters.",
			},
			{
				name: "elapsedSeconds",
				type: "integer",
				nullable: true,
				description: "Official net or gun elapsed finish duration in seconds.",
			},
			{
				name: "finishTimeFormatted",
				type: "text",
				nullable: true,
				description: 'Formatted time display string (e.g. "14:22:31").',
			},
			{
				name: "overallPlace",
				type: "integer",
				nullable: true,
				description: "Overall finisher position.",
			},
			{
				name: "genderPlace",
				type: "integer",
				nullable: true,
				description: "Gender division finisher position.",
			},
			{
				name: "categoryPlace",
				type: "integer",
				nullable: true,
				description: "Age-group or class division finisher position.",
			},
			{
				name: "totalFinishers",
				type: "integer",
				nullable: true,
				description:
					"Total number of official finishers in that event edition.",
			},
			{
				name: "status",
				type: "raceHistoryStatusEnum",
				nullable: false,
				defaultValue: "'finished'",
				constraints: ["Enum"],
				description:
					"Outcome status: finished, dnf, dns, dq, in_progress, unknown.",
			},
			{
				name: "sourceUrl",
				type: "text",
				nullable: true,
				description: "Direct URL to official published results page.",
			},
			{
				name: "metadata",
				type: "jsonb",
				nullable: true,
				description:
					"Platform-specific fields like age at race, rank percentage, or weather notes.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Record creation timestamp.",
			},
		],
		enums: [
			{
				name: "race_history_status",
				values: [
					{
						value: "finished",
						label: "Finished",
						description: "Official verified finisher.",
					},
					{
						value: "dnf",
						label: "Did Not Finish (DNF)",
						description: "Withdrew or cut off before official finish line.",
					},
					{
						value: "dns",
						label: "Did Not Start (DNS)",
						description: "Registered but did not start the event.",
					},
					{
						value: "dq",
						label: "Disqualified (DQ)",
						description: "Disqualified by race officials.",
					},
					{
						value: "in_progress",
						label: "In Progress",
						description: "Active race currently underway.",
					},
					{
						value: "unknown",
						label: "Unknown",
						description:
							"Status unrecorded or unparseable from external source.",
					},
				],
			},
		],
		indexes: [
			{
				name: "person_race_history_person_idx",
				columns: ["personId"],
				rationale: "Accelerates retrieval of career race history for a person.",
			},
			{
				name: "person_race_history_date_idx",
				columns: ["raceDate"],
				rationale:
					"Enables chronological ordering and recent activity windows.",
			},
			{
				name: "person_race_history_distance_idx",
				columns: ["distanceMeters"],
				rationale: "Optimizes querying comparable distance performances.",
			},
		],
	},
	{
		id: "personHistoricalSummaries",
		name: "Person Historical Summaries",
		tableName: "person_historical_summaries",
		category: "Competitor History & Intelligence",
		badge: "Intelligence Rollup",
		shortDescription:
			"Materialized 1:1 career intelligence rollup for a person, computing experience tier and DNF risk.",
		operationalPurpose:
			"Rolls up individual race history into career totals, DNF rates, max distances climbed, and external ranks (UltraSignup %, ITRA score). Classifies athletes into experience tiers (novice, intermediate, veteran, elite) and powers SAR triage alerts.",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "people",
				foreignKey: "personId",
				description: "Person record summarized by this rollup.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique historical summary identifier.",
			},
			{
				name: "personId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> people.id", "ON DELETE CASCADE", "UNIQUE"],
				description: "Reference to the person (strict 1:1 relationship).",
			},
			{
				name: "totalRaces",
				type: "integer",
				nullable: false,
				defaultValue: "0",
				description: "Total recorded career race starts.",
			},
			{
				name: "totalFinishes",
				type: "integer",
				nullable: false,
				defaultValue: "0",
				description: "Total verified career race finishes.",
			},
			{
				name: "totalDnfs",
				type: "integer",
				nullable: false,
				defaultValue: "0",
				description: "Total career Did Not Finish (DNF) results.",
			},
			{
				name: "dnfRate",
				type: "double precision",
				nullable: false,
				defaultValue: "0",
				description: "Computed career DNF ratio (0.0 to 1.0).",
			},
			{
				name: "maxDistanceMeters",
				type: "double precision",
				nullable: false,
				defaultValue: "0",
				description: "Longest single race distance completed in meters.",
			},
			{
				name: "maxElevationGainMeters",
				type: "double precision",
				nullable: false,
				defaultValue: "0",
				description: "Maximum positive vertical ascent completed in meters.",
			},
			{
				name: "avgPaceSecondsPerKm",
				type: "double precision",
				nullable: true,
				description: "Weighted career baseline pace in seconds per kilometer.",
			},
			{
				name: "experienceTier",
				type: "experienceTierEnum",
				nullable: false,
				defaultValue: "'novice'",
				constraints: ["Enum"],
				description:
					"Classified experience tier: novice, intermediate, veteran, elite.",
			},
			{
				name: "ultrasignupRank",
				type: "double precision",
				nullable: true,
				description: "Official UltraSignup score percentile (e.g. 88.42%).",
			},
			{
				name: "itraPerformanceIndex",
				type: "integer",
				nullable: true,
				description:
					"Official ITRA general performance index (0 - 1000 scale).",
			},
			{
				name: "lastRaceDate",
				type: "text",
				nullable: true,
				description: "ISO date string of most recently completed event.",
			},
			{
				name: "confidenceScore",
				type: "double precision",
				nullable: false,
				defaultValue: "1.0",
				description:
					"Data completeness and verification confidence weight (0.0 - 1.0).",
			},
			{
				name: "safetyTriageNotes",
				type: "text",
				nullable: true,
				description:
					"Automated medical or SAR warnings (e.g. High DNF risk, Low altitude origin).",
			},
			{
				name: "computedAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Timestamp when this intelligence rollup was computed.",
			},
		],
		enums: [
			{
				name: "experience_tier",
				values: [
					{
						value: "novice",
						label: "Novice",
						description: "0 to 2 career finishes; first-timer at distance.",
					},
					{
						value: "intermediate",
						label: "Intermediate",
						description: "3 to 7 career finishes with consistent pacing.",
					},
					{
						value: "veteran",
						label: "Veteran",
						description:
							"8+ career finishes; proven mountain ultra experience.",
					},
					{
						value: "elite",
						label: "Elite",
						description:
							"Top-tier competitor (UltraSignup >= 90%, ITRA >= 750).",
					},
				],
			},
		],
		indexes: [
			{
				name: "person_historical_summaries_person_idx",
				columns: ["personId"],
				unique: true,
				rationale: "Guarantees a strict 1:1 summary relation per person.",
			},
			{
				name: "person_historical_summaries_tier_idx",
				columns: ["experienceTier"],
				rationale: "Optimizes cohort filtering by athletic experience tier.",
			},
		],
	},
	{
		id: "entrantHistoricalProjections",
		name: "Entrant Historical Projections",
		tableName: "entrant_historical_projections",
		category: "Competitor History & Intelligence",
		badge: "Predictive Pacing & SAR",
		shortDescription:
			"Event-specific materialized pacing projections and volunteer safety badges for an entrant.",
		operationalPurpose:
			"Binds an athlete's historical performance capability to active course topography, elevation gain, and cutoff schedule. Calculates expected arrival windows (ETA ± sigma) for aid stations, flags cutoff risks, and provides Checkpoint Field Logger safety badges.",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "entrants",
				foreignKey: "entrantId",
				description:
					"Competitor entrant for whom this projection is calculated.",
			},
			{
				kind: "belongsTo",
				targetCollectionId: "people",
				foreignKey: "personId",
				description:
					"Underlying person whose athletic history generated this model.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique projection identifier.",
			},
			{
				name: "entrantId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> entrants.id", "ON DELETE CASCADE", "UNIQUE"],
				description: "Reference to the active entrant entry.",
			},
			{
				name: "personId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> people.id", "ON DELETE CASCADE"],
				description: "Reference to the competitor person.",
			},
			{
				name: "projectedFinishSeconds",
				type: "integer",
				nullable: true,
				description: "Predicted overall finish duration in seconds.",
			},
			{
				name: "projectedPaceSecondsPerKm",
				type: "double precision",
				nullable: true,
				description: "Expected average course pace in seconds per kilometer.",
			},
			{
				name: "projectedArrivalTimes",
				type: "jsonb",
				nullable: true,
				description:
					"Map of courseSplitId to expected arrival ETA timestamps and duration offsets.",
			},
			{
				name: "confidenceBandLowSeconds",
				type: "integer",
				nullable: true,
				description: "10th percentile aggressive arrival estimate duration.",
			},
			{
				name: "confidenceBandHighSeconds",
				type: "integer",
				nullable: true,
				description: "90th percentile conservative arrival estimate duration.",
			},
			{
				name: "expectedCutoffRisk",
				type: "boolean",
				nullable: false,
				defaultValue: "false",
				constraints: ["Indexed"],
				description:
					"True if projected arrival at any split falls within 20 minutes of official cutoff.",
			},
			{
				name: "volunteersSarSafetyBadge",
				type: "text",
				nullable: true,
				description:
					"Primary high-contrast field badge (e.g. CUTOFF_WATCH, FIRST_TIMER, ELEVATION_RISK).",
			},
			{
				name: "projectionMethod",
				type: "text",
				nullable: false,
				defaultValue: "'historical_pacing'",
				description:
					"Algorithm identifier used to generate the model (e.g. minetti_metabolic, historical_pacing).",
			},
			{
				name: "computedAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Timestamp when projection was materialized.",
			},
		],
		indexes: [
			{
				name: "entrant_historical_projections_entrant_idx",
				columns: ["entrantId"],
				unique: true,
				rationale: "Guarantees a 1:1 materialized projection per entrant.",
			},
			{
				name: "entrant_historical_projections_person_idx",
				columns: ["personId"],
				rationale:
					"Accelerates lookups of all historical projections for an athlete.",
			},
			{
				name: "entrant_historical_projections_cutoff_risk_idx",
				columns: ["expectedCutoffRisk"],
				rationale:
					"Optimizes Net Control queries for competitors at risk of missing hard cutoffs.",
			},
		],
	},
	{
		id: "rawTimingEvents",
		name: "Raw Timing Events",
		tableName: "raw_timing_events",
		category: "Write Plane (Audit Ledger)",
		badge: "Immutable Append-Only",
		shortDescription:
			"High-frequency ingestion ledger recording raw timing pulses in UTC with device telemetry.",
		operationalPurpose:
			"The Write Plane of ChekkPoint's CQRS architecture. Every hardware pulse, optical beam trip, manual volunteer entry, ham radio acoustic packet, or offline PWA sync is appended here with absolute UTC precision (millisecond resolution). Raw records are immutable: they are never updated or deleted. Reconciliation workers derive standings and mark status to 'matched', 'duplicate_subordinate', or 'rejected_invalid' without altering raw telemetry.",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "eventGroups",
				foreignKey: "eventGroupId",
				description: "Event group weekend where pulse was captured.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "scoredSplitTimes",
				foreignKey: "governingRawEventId",
				description: "Materialized scored splits governed by this raw pulse.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique raw timing event identifier.",
			},
			{
				name: "eventGroupId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> eventGroups.id"],
				description: "Weekend event group.",
			},
			{
				name: "competitorNumber",
				type: "text",
				nullable: false,
				description: "Bib / Plate / Car number passed into reader.",
			},
			{
				name: "timingPointCode",
				type: "text",
				nullable: false,
				description: 'Station code (e.g. "TWIN_LAKES").',
			},
			{
				name: "subSplitKind",
				type: "subSplitKindEnum",
				nullable: false,
				constraints: ["Enum"],
				description:
					"'in' (arrival), 'out' (departure), or 'point' (flying line).",
			},
			{
				name: "recordedTimeUtc",
				type: "timestamp(3) with time zone",
				nullable: false,
				description: "Precision 3 (millisecond) absolute UTC pulse timestamp.",
			},
			{
				name: "source",
				type: "timingSourceEnum",
				nullable: false,
				constraints: ["Enum"],
				description:
					"Hardware telemetry origin (rfid, optical, manual, mobile app, ham radio, webhook).",
			},
			{
				name: "sourceDeviceId",
				type: "text",
				nullable: true,
				description: 'Reading hardware identifier (e.g. "ipad-station-4").',
			},
			{
				name: "sourceOperator",
				type: "text",
				nullable: true,
				description: "Volunteer username or radio operator callsign.",
			},
			{
				name: "syncBatchId",
				type: "uuid",
				nullable: true,
				description: "Batch UUID for offline IndexedDB bulk sync sessions.",
			},
			{
				name: "withPacer",
				type: "boolean",
				nullable: false,
				defaultValue: "false",
				description: "Indicates runner was accompanied by a registered pacer.",
			},
			{
				name: "rawPayload",
				type: "jsonb",
				nullable: true,
				description:
					"Original hardware telemetry packet (RSSI, signal strength, antenna port).",
			},
			{
				name: "status",
				type: "rawTimingStatusEnum",
				nullable: false,
				defaultValue: "'unprocessed'",
				constraints: ["Enum"],
				description:
					"Pulse validation lifecycle: 'unprocessed', 'matched', 'duplicate_subordinate', 'rejected_invalid', 'flagged_discrepancy'.",
			},
			{
				name: "auditNote",
				type: "text",
				nullable: true,
				description: "Official explanation if marked invalid or flagged.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Ingestion timestamp.",
			},
		],
		enums: [
			{
				name: "sub_split_kind",
				values: [
					{
						value: "in",
						label: "In (Arrival)",
						description: "Checkpoint entry; aid station dwell start.",
					},
					{
						value: "out",
						label: "Out (Departure)",
						description: "Checkpoint exit; cutoff enforcement line.",
					},
					{
						value: "point",
						label: "Point (Flying Gate)",
						description: "Instantaneous single flying gate / intermediate mat.",
					},
				],
			},
			{
				name: "timing_source",
				values: [
					{
						value: "rfid_transponder",
						label: "RFID Transponder",
						description: "Automated chip mat (RaceResult, ChronoTrack).",
					},
					{
						value: "optical_photocell",
						label: "Optical Photocell",
						description: "Laser beam photocell gate (downhill MTB finish).",
					},
					{
						value: "manual_web_entry",
						label: "Manual Web Entry",
						description: "Volunteer checkpoint web console.",
					},
					{
						value: "mobile_offline_app",
						label: "Mobile Offline PWA",
						description: "Field volunteer tablet caching in IndexedDB.",
					},
					{
						value: "mt63_ham_radio",
						label: "MT63 Ham Radio",
						description:
							"Digital acoustic modem packet over VHF/UHF amateur radio.",
					},
					{
						value: "api_webhook",
						label: "API Webhook",
						description: "External timing service API integration.",
					},
				],
			},
			{
				name: "raw_timing_status",
				values: [
					{
						value: "unprocessed",
						label: "Unprocessed",
						description: "Ingested, awaiting background worker scoring.",
					},
					{
						value: "matched",
						label: "Matched",
						description: "Successfully bound to an entrant scored split.",
					},
					{
						value: "duplicate_subordinate",
						label: "Duplicate Subordinate",
						description: "Subordinate backup pulse within cluster window.",
					},
					{
						value: "rejected_invalid",
						label: "Rejected Invalid",
						description:
							"Steward invalidated entry (e.g. false trigger, typo).",
					},
					{
						value: "flagged_discrepancy",
						label: "Flagged Discrepancy",
						description: "Variance with primary hardware exceeds threshold.",
					},
				],
			},
		],
		indexes: [
			{
				name: "raw_events_eg_comp_idx",
				columns: ["eventGroupId", "competitorNumber"],
				rationale:
					"Accelerates chronological athlete pulse extraction for scoring reconciliation.",
			},
			{
				name: "raw_events_time_idx",
				columns: ["recordedTimeUtc"],
				rationale:
					"Optimizes time-window replay and telemetry streaming queries.",
			},
			{
				name: "raw_events_batch_idx",
				columns: ["syncBatchId"],
				rationale:
					"Enables fast audit tracking of offline batch sync sessions.",
			},
			{
				name: "raw_events_status_idx",
				columns: ["status"],
				rationale:
					"Allows worker queues to rapidly poll for 'unprocessed' records.",
			},
		],
	},
	{
		id: "scoredSplitTimes",
		name: "Scored Split Times",
		tableName: "scored_split_times",
		category: "Read Plane (Standings)",
		badge: "Materialized Projection",
		shortDescription:
			"Materialized leaderboard standings, cumulative elapsed times, dwell seconds, and regularity penalties.",
		operationalPurpose:
			"The Read Plane of ChekkPoint. Worker processes match raw pulses against race sequences to materialize scored split records. Contains millisecond-precision elapsed seconds, station dwell duration (IN to OUT), segment pace (sec/km), and TSD regularity deviations. Indexed heavily for instantaneous leaderboard rendering and live athlete tracking.",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "entrants",
				foreignKey: "entrantId",
				description: "Competitor who achieved this split.",
			},
			{
				kind: "belongsTo",
				targetCollectionId: "courseSplits",
				foreignKey: "courseSplitId",
				description: "Milestone where split was scored.",
			},
			{
				kind: "belongsTo",
				targetCollectionId: "rawTimingEvents",
				foreignKey: "governingRawEventId",
				description: "Raw pulse that verified this split.",
			},
			{
				kind: "hasMany",
				targetCollectionId: "splitTimeAudits",
				foreignKey: "splitTimeId",
				description: "Forensic modification log for any steward adjustments.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique scored split identifier.",
			},
			{
				name: "entrantId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> entrants.id"],
				description: "Competitor.",
			},
			{
				name: "courseSplitId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> courseSplits.id"],
				description: "Milestone checkpoint.",
			},
			{
				name: "lap",
				type: "integer",
				nullable: false,
				defaultValue: "1",
				description: "Lap number for multi-lap events.",
			},
			{
				name: "subSplitKind",
				type: "subSplitKindEnum",
				nullable: false,
				constraints: ["Enum"],
				description:
					"'in' (arrival), 'out' (departure), or 'point' (flying line).",
			},
			{
				name: "absoluteTimeUtc",
				type: "timestamp(3) with time zone",
				nullable: false,
				description: "Official UTC timestamp of checkpoint crossing.",
			},
			{
				name: "elapsedSeconds",
				type: "double precision",
				nullable: false,
				description: "Total elapsed time from start in seconds.",
			},
			{
				name: "dwellSeconds",
				type: "integer",
				nullable: true,
				description: "Time spent resting inside checkpoint between IN and OUT.",
			},
			{
				name: "segmentPaceSecondsPerKm",
				type: "double precision",
				nullable: true,
				description: "Calculated pace over the preceding course segment.",
			},
			{
				name: "tsdDeviationSeconds",
				type: "double precision",
				nullable: true,
				description:
					"Motorsport TSD regularity target variance (Actual - Ideal).",
			},
			{
				name: "penaltyPoints",
				type: "double precision",
				nullable: false,
				defaultValue: "0",
				description: "Accrued regularity or infraction penalty points.",
			},
			{
				name: "stoppedHere",
				type: "boolean",
				nullable: false,
				defaultValue: "false",
				description:
					"Indicates competitor terminated race effort at this station.",
			},
			{
				name: "dataStatus",
				type: "dataStatusEnum",
				nullable: false,
				defaultValue: "'valid'",
				constraints: ["Enum"],
				description:
					"Status: 'provisional', 'valid', 'questionable', 'bad', 'confirmed'.",
			},
			{
				name: "governingRawEventId",
				type: "uuid",
				nullable: true,
				constraints: ["FK -> rawTimingEvents.id"],
				description: "Raw telemetry pulse that verified this split.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Projection calculation timestamp.",
			},
			{
				name: "updatedAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Last adjustment timestamp.",
			},
		],
		enums: [
			{
				name: "data_status",
				values: [
					{
						value: "provisional",
						label: "Provisional",
						description: "Newly calculated, pending reconciliation.",
					},
					{
						value: "valid",
						label: "Valid",
						description: "Clean, chronological, plausible velocity.",
					},
					{
						value: "questionable",
						label: "Questionable",
						description: "Pace anomaly or skipped upstream split.",
					},
					{
						value: "bad",
						label: "Bad",
						description: "Mathematically impossible (negative duration).",
					},
					{
						value: "confirmed",
						label: "Confirmed",
						description: "Manually verified and locked by Timing Director.",
					},
				],
			},
		],
		indexes: [
			{
				name: "scored_split_unique_idx",
				columns: ["entrantId", "courseSplitId", "lap", "subSplitKind"],
				unique: true,
				rationale:
					"Guarantees that each entrant can only have one recorded split per milestone and lap.",
			},
			{
				name: "scored_split_elapsed_idx",
				columns: ["courseSplitId", "elapsedSeconds"],
				rationale:
					"High-speed index for generating instant milestone leaderboards.",
			},
			{
				name: "scored_split_entrant_idx",
				columns: ["entrantId"],
				rationale:
					"Speeds up athlete journey and split matrix loading on individual result pages.",
			},
		],
	},
	{
		id: "timeAllowances",
		name: "Time Allowances",
		tableName: "time_allowances",
		category: "Operations & Audits",
		badge: "Disaster Recovery",
		shortDescription:
			"Mandatory medical holds, safety stops, and hazard holds deducted from net elapsed time.",
		operationalPurpose:
			"Used during extreme weather, medical evaluations (e.g. mandatory 45-minute hydration hold in 100-mile ultras), or trail blockages (trains, mudslides, downed trees). The duration is automatically credited back to the competitor's adjusted net time and dynamically extends downstream aid station cutoffs so runners aren't penalized for safety holds.",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "entrants",
				foreignKey: "entrantId",
				description: "Competitor receiving credit.",
			},
			{
				kind: "belongsTo",
				targetCollectionId: "courseSplits",
				foreignKey: "splitId",
				description: "Aid station where hold occurred.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique time allowance identifier.",
			},
			{
				name: "entrantId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> entrants.id"],
				description: "Competitor.",
			},
			{
				name: "splitId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> courseSplits.id"],
				description: "Checkpoint location.",
			},
			{
				name: "startTime",
				type: "timestamp with time zone",
				nullable: false,
				description: "Hold start timestamp.",
			},
			{
				name: "endTime",
				type: "timestamp with time zone",
				nullable: false,
				description: "Hold release timestamp.",
			},
			{
				name: "durationSeconds",
				type: "integer",
				nullable: false,
				description: "Total credited seconds deducted from net elapsed time.",
			},
			{
				name: "reason",
				type: "text",
				nullable: false,
				description:
					"Hold reason: 'medical_hold', 'hazard_hold', 'gear_check'.",
			},
			{
				name: "authorizedBy",
				type: "text",
				nullable: false,
				description: "Authorizing medical officer or race steward.",
			},
			{
				name: "notes",
				type: "text",
				nullable: true,
				description: "Detailed medical or safety incident narrative.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Creation timestamp.",
			},
		],
		indexes: [
			{
				name: "time_allowances_entrant_idx",
				columns: ["entrantId"],
				rationale:
					"Accelerates retrieval of all active credits during net standings calculations.",
			},
		],
	},
	{
		id: "splitTimeAudits",
		name: "Split Time Audits",
		tableName: "split_time_audits",
		category: "Operations & Audits",
		badge: "Forensic Log",
		shortDescription:
			"Forensic audit log capturing every manual status change, timestamp edit, or steward recalculation.",
		operationalPurpose:
			"Ensures compliance with USATF, UCI, and FIA timing integrity rules. Whenever an official manually overrides a competitor's split time, validates a questionable time, or issues a disqualification, the previous and new states are captured as immutable JSON with author ID and mandatory change reason.",
		relationships: [
			{
				kind: "belongsTo",
				targetCollectionId: "scoredSplitTimes",
				foreignKey: "splitTimeId",
				description: "Scored split record being modified.",
			},
		],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				defaultValue: "gen_random_uuid()",
				constraints: ["PK"],
				description: "Unique audit record identifier.",
			},
			{
				name: "splitTimeId",
				type: "uuid",
				nullable: false,
				constraints: ["FK -> scoredSplitTimes.id"],
				description: "Modified scored split.",
			},
			{
				name: "action",
				type: "text",
				nullable: false,
				description:
					"Audit action: 'CREATED', 'UPDATED', 'DELETED', 'REBUILT', 'CONFIRMED'.",
			},
			{
				name: "previousState",
				type: "jsonb",
				nullable: true,
				description: "Snapshot of record state prior to modification.",
			},
			{
				name: "newState",
				type: "jsonb",
				nullable: true,
				description: "Snapshot of record state post modification.",
			},
			{
				name: "changedBy",
				type: "text",
				nullable: false,
				description: "Official user handle or steward ID.",
			},
			{
				name: "changeReason",
				type: "text",
				nullable: false,
				description: "Mandatory justification for regulatory compliance.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Audit log creation timestamp.",
			},
		],
		indexes: [
			{
				name: "split_time_audits_split_idx",
				columns: ["splitTimeId"],
				rationale:
					"Accelerates retrieval of modification history for a disputed competitor split.",
			},
		],
	},
	{
		id: "helloWorld",
		name: "Hello World",
		tableName: "hello_world",
		category: "System Demo",
		badge: "ElectricSQL Starter",
		shortDescription:
			"Starter demonstration table testing ElectricSQL sync, SQLite OPFS persistence, and live queries.",
		operationalPurpose:
			"Demonstrates TanStack Start integration with ElectricSQL, browser WASM SQLite OPFS persistence, and optimistic offline transactional updates.",
		relationships: [],
		fields: [
			{
				name: "id",
				type: "uuid",
				nullable: false,
				constraints: ["PK"],
				description: "Unique row identifier.",
			},
			{
				name: "message",
				type: "varchar(255)",
				nullable: false,
				description: "Greeting message payload.",
			},
			{
				name: "createdAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Row creation timestamp.",
			},
			{
				name: "updatedAt",
				type: "timestamp with time zone",
				nullable: false,
				defaultValue: "now()",
				description: "Row update timestamp ($onUpdate updated).",
			},
		],
		indexes: [],
	},
] as const;

export const COLLECTION_MAP: Record<CollectionKey, CollectionMetadata> =
	Object.fromEntries(COLLECTIONS.map((c) => [c.id, c])) as Record<
		CollectionKey,
		CollectionMetadata
	>;

export function getAllCollections(): readonly CollectionMetadata[] {
	return COLLECTIONS;
}

export function getCollectionById(id: string): CollectionMetadata | undefined {
	if (!isCollectionKey(id)) return undefined;
	return COLLECTION_MAP[id];
}

export function getCollectionsByCategory(): Record<
	CollectionCategory,
	CollectionMetadata[]
> {
	const result = {} as Record<CollectionCategory, CollectionMetadata[]>;
	for (const cat of COLLECTION_CATEGORIES) {
		result[cat] = [];
	}
	for (const col of COLLECTIONS) {
		result[col.category].push(col);
	}
	return result;
}
