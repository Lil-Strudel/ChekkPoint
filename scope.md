# ChekkPoint: Product Scope & Database Architecture Specification

**Document Version:** 1.2.0 (Refined Drizzle Models & Domain Harmonization)  
**Target Repository:** `Lil-Strudel/ChekkPoint` (Repo Root)  
**Tech Stack:** TanStack Start (SolidJS) + Railway (PostgreSQL, Background Workers) + Drizzle ORM  
**Target Release:** Core v1  

---

## 1. Executive Summary & Mission

ChekkPoint is a versatile, high-reliability race timing and tracking platform engineered for all major racing disciplines: endurance running, mountain biking/cycling, and precision motorsport rallies.

Existing race management systems break down at the physical checkpoint: volunteers battle cold hands, screen glare, dense packs of arriving competitors, and unreliable or nonexistent cellular service with fragile, form-based web tools. ChekkPoint solves this with:
1. **Zero-Latency Volunteer Ergonomics:** SolidJS fine-grained reactivity delivering 60fps responsive interfaces (10-key numeric keypads, dialpads, and keyboard shortcuts) on mobile and desktop.
2. **Local-First Offline Resilience:** Complete offline buffering via IndexedDB and a synchronous write-ahead log (WAL) in local storage, guaranteeing zero data loss during network outages.
3. **Decoupled FIFO Chutes ("Tap First, Identify Later"):** Capturing instant timestamps during pack arrivals and binding competitor numbers as athletes are identified.
4. **Real-Time Typo Defense:** Client-side Damerau-Levenshtein anomaly detection against an *Active Expected Pool*, catching transpositions (e.g. `124` vs `142`) before they corrupt the leaderboard.
5. **The Immutable Raw Ledger & Idempotent Rebuild Engine:** Raw timing events are append-only and never overwritten; scored split standings are derived projections that can be safely recalculated with mathematical idempotency.

---

## 2. Core v1 Scope: Supported Race Types

ChekkPoint Core v1 supports 8 primary race types across 3 sporting disciplines:

### 🏃 Foot & Trail Running
1. **Point-to-Point Road & Trail Races (5K to 100M+):** Continuous single-line courses with sequential checkpoints, aid station dwell tracking, cutoffs, and pacer management.
2. **Out-and-Back Mountain Ultras:** Topologies with recurring aid stations visited multiple times at different cumulative distances (e.g. Leadville 100).
3. **Multi-Lap Loops:** Repeated circuits with automatic lap counters and cumulative time/distance aggregation.
4. **Fixed-Time Races (6h, 12h, 24h, 48h):** Distance accumulation within a fixed clock duration.
5. **Backyard Ultras (Last Person Standing):** Competitors must run a 4.166667-mile yard every hour on the hour. Failure to start or finish within 60 minutes is an immediate DNF. The race ends only when one solo runner remains.

### 🚵 Cycling & Mountain Biking (The Big Stuff)
6. **Cross-Country MTB & Gravel Races (XCO / Marathon / Gravel):** Mass or wave starts, intermediate timing splits, and lap tracking.
7. **Downhill Mountain Biking (DH):** Staggered individual interval starts, flying finishes, intermediate sector splits, and millisecond precision ($0.001\text{s}$).

### 🏎️ Motorsport
8. **Time-Speed-Distance (TSD) / Regularity Rallies:** Precision navigation over open roads. Competitors must match exact prescribed speeds across secret checkpoints, with asymmetric early/late penalty point calculations.

*(Note: Multi-day stage runs, ekiden relays, enduro MTB, stage rally, and autocross are documented for future expansion in project reference archives).*

---

## 3. Core v1 Scope: Supported Scoring Engines

ChekkPoint decouples raw timing capture from result calculation using a **Pluggable Functional Scoring Strategy Pattern**. Core v1 supports 5 calculation engines:

| Engine ID | Scoring Engine | Winning Condition | Primary Mathematical Formula | Primary Applications |
|:---:|:---|:---|:---|:---|
| **E1** | **Net Elapsed Time (Chip Time)** | Lowest duration from personal start to finish | $T_{\text{net}} = T_{\text{finish}} - T_{\text{actual\_start}} + \text{Penalties}$ | Staggered waves, mass marathons, XC cycling, Downhill MTB |
| **E2** | **Gun Elapsed Time** | Lowest duration from official start gun | $T_{\text{gun}} = T_{\text{finish}} - T_{\text{event\_horn}} + \text{Penalties}$ | Official USATF/IAU podiums, course records |
| **E3** | **TSD Regularity Target Delta** | Lowest total penalty points (closest to 0.000 target deviation) | $\text{Points} = \sum \begin{cases} \|\Delta t\| \times K_{\text{early}} & (\Delta t < 0) \\ \Delta t \times K_{\text{late}} & (\Delta t > 0) \end{cases}$ | TSD Regularity Rallies (driving fast penalizes competitors!) |
| **E4** | **Fixed-Time Distance Max** | Greatest distance covered within fixed clock duration | $\text{Dist} = (N_{\text{laps}} \times D_{\text{lap}}) + D_{\text{partial}}$ | 6h, 12h, 24h, 48h Ultra events |
| **E5** | **Last Person Standing** | Highest completed yards; sole finisher of final solo lap | $\text{Score} = N_{\text{completed\_yards}}$ (Elimination if $\Delta t_{\text{yard}} > 60\text{m}$) | Backyard Ultras |

---

### 3.1 Domain Nuance: "Did Not Finish" (DNF) vs. "Retired on Course" (ROC)

While systematically identical (both terminate active tracking, award zero official finish time, and exclude the entrant from the podium), **DNF** and **Retired on Course** represent fundamentally different operational, safety, and cultural realities:

| Dimension | Did Not Finish (DNF / Dropped) | Retired on Course (ROC / Withdrawn in Transit) |
|---|---|---|
| **Physical Custody** | Competitor reached an official checkpoint / aid tent and voluntarily stopped or was pulled by medical/cutoffs. **Physically accounted for in race staff custody.** | Competitor stopped **between checkpoints on active trail/road** (e.g. injured on trail, stepped into spectator car, or mechanical vehicle breakdown on transit). |
| **Safety & Search (SAR)** | Routine logistics status (eating soup, waiting for evacuation van). No safety alarm. | **Active Safety Condition.** Competitor is unaccounted for until sweep marshals or SAR confirm their physical welfare and extraction. |
| **Sporting Tradition** | Universal standard in American trail ultras and marathons (*"Runner dropped at Mile 40"*). | Universal standard in Motorsport, European cycling (*"Abandon"*), and Sailing (*"Retired on Stage 2"*). |
| **Systemic Treatment** | Shunts downstream reads to quarantine buffer; halts expected arrival downstream windows. | Identical scoring treatment, but flags entrant with a high-visibility **Unverified In-Transit** badge on the Net Control safety dashboard. |

---

## 4. Proposed Database Model (Refined for Drizzle ORM)

The database architecture employs a **CQRS / Event-Sourced** separation between the **Write Plane** (immutable raw ingestion) and the **Read Plane** (scored materialized standings), with polymorphic JSONB extensions for discipline rules and participant models.

```
                              CHEKKPOINT CQRS ARCHITECTURE

 [RFID Transponder]   [Mobile PWA]   [Web Live Entry]   [Acoustic MT63 Decoder]
        │                   │                │                    │
        └───────────────────┴────────┬───────┴────────────────────┘
                                     │
                     ┌───────────────▼──────────────┐
                     │ Active Bib & Expected Pool   │
                     │ Cache (Redis 8 - Sub-ms Typo)│
                     └───────────────┬──────────────┘
                                     │
                                     ▼
                      POST /api/v1/timing/ingest-batch
                                     │
                                     ▼
                +─────────────────────────────────────────+
                |     WRITE PLANE: raw_timing_events      |
                |  (Immutable Append-Only Ledger, JSONB)  |
                +─────────────────────────────────────────+
                                     │
                                     ▼ (Asynchronous Projection Worker)
                +─────────────────────────────────────────+
                |       PROJECTION & SCORING PIPELINE     |
                |  1. Ingestion Validation & Deduplication|
                |  2. Trajectory & Split Resolution       |
                |  3. Governing Raw Event Selection       |
                |  4. Discipline Scorer (E1 - E5)         |
                +─────────────────────────────────────────+
                                     │
                   ┌─────────────────┴─────────────────┐
                   ▼                                   ▼
+─────────────────────────────────────+   +───────────────────────────────────+
| READ PLANE: Scored Materialized     |   | REDIS PUB/SUB & REAL-TIME CACHE   |
| - scored_split_times (Millisecond)  |   | - Live Split Event Broadcasts     |
| - event_standings (Live Leaderboard)|   | - SSE / WebSocket Feeds to Clients|
| - Forensic Audit Revisions          |   | - Low-latency Active Bib Cache    |
+─────────────────────────────────────+   +───────────────────────────────────+
```

---

### 4.1 Production Drizzle Schema (`src/db/schema.ts`)

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import { z } from "zod";

// ============================================================================
// 1. DOMAIN ENUMS
// ============================================================================

export const disciplineEnum = pgEnum("discipline", [
  "trail_ultra",      // Marathons & Ultras (point-to-point, out-and-back, loops)
  "road_marathon",    // Road distance events (waves, net/gun time)
  "backyard_ultra",   // Last Person Standing hourly elimination
  "fixed_time_loop",  // 6h, 12h, 24h, 48h distance maximization
  "downhill_mtb",     // Staggered flying finish, millisecond precision
  "xco_cycling",      // Cross-country & gravel mass/wave races
  "tsd_regularity",   // Motorsport precision target time delta scoring
]);

export const entrantStatusEnum = pgEnum("entrant_status", [
  "registered",     // Signed up, bib/plate assigned
  "checked_in",     // Verified at venue, gear inspected
  "dns",            // Did Not Start (withdrew before start)
  "in_progress",    // Currently active on course
  "finished",       // Completed all required splits legally
  "dnf",            // Did Not Finish: Dropped at an official checkpoint (in custody)
  "retired",        // Retired on Course: Withdrew between checkpoints (unaccounted / SAR alert)
  "dq",             // Disqualified by stewards for infractions
  "otl",            // Over Time Limit: Cut off by station departure threshold
]);

export const subSplitKindEnum = pgEnum("sub_split_kind", [
  "in",             // Arrival / Aid Station Dwell Start
  "out",            // Departure / Cutoff Enforcement Line
  "point",          // Instantaneous Single Flying Gate / Sector (Downhill MTB, 10K road mat)
]);

export const timingSourceEnum = pgEnum("timing_source", [
  "rfid_transponder",  // Automated chip mat (RaceResult, ChronoTrack)
  "optical_photocell", // Laser/optical gate (Downhill MTB)
  "manual_web_entry",  // Checkpoint worker Live Entry app
  "mobile_offline_app",// PWA running offline in IndexedDB
  "mt63_ham_radio",    // Digital acoustic modem packet over VHF/UHF
  "api_webhook",       // External provider ingestion
]);

export const dataStatusEnum = pgEnum("data_status", [
  "provisional",    // Newly calculated, pending confirmation
  "valid",          // Clean, chronological, plausible velocity
  "questionable",   // Pace anomaly or skipped upstream split (flagged for triage)
  "bad",            // Mathematically impossible (time before start, negative duration)
  "confirmed",      // Manually verified and locked by Timing Director
]);

// Single source of truth for raw pulse ingestion state.
// Replaces redundant boolean flags (like isDisassociated).
export const rawTimingStatusEnum = pgEnum("raw_timing_status", [
  "unprocessed",           // Ingested, awaiting worker processing
  "matched",               // Successfully bound to an entrant's scored split
  "duplicate_subordinate", // Subordinate hit within the cluster window (e.g. backup device)
  "rejected_invalid",      // Flagged as invalid by timer (e.g. false trigger, typo)
  "flagged_discrepancy",   // Variance with another hardware source exceeding threshold
]);

export const externalPlatformEnum = pgEnum("external_platform", [
  "ultrasignup",
  "strava",
  "duv",
  "itra",
  "athlinks",
  "custom",
]);

export const profileVerificationStatusEnum = pgEnum("profile_verification_status", [
  "unverified",
  "candidate_matched",
  "auto_verified",
  "manual_verified",
  "rejected",
  "conflict",
]);

export const scrapeStatusEnum = pgEnum("scrape_status", [
  "pending",
  "queued",
  "in_progress",
  "succeeded",
  "failed",
  "rate_limited",
  "stale",
]);

export const raceHistoryStatusEnum = pgEnum("race_history_status", [
  "finished",
  "dnf",
  "dns",
  "dq",
  "in_progress",
  "unknown",
]);

export const experienceTierEnum = pgEnum("experience_tier", [
  "novice",
  "intermediate",
  "veteran",
  "elite",
]);

// ============================================================================
// 2. POLYMORPHIC JSONB TYPES & ZOD SCHEMAS
// ============================================================================

/**
 * Common Address Schema used across people and organizations.
 */
export const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default("US"),
});

/**
 * 1. Solo Competitor (Foot running, solo cycling, solo track sprint)
 * Emergency contacts are modeled via direct reference on the entrants table.
 */
export const SoloCompetitorSchema = z.object({
  kind: z.literal("solo_competitor"),
  medicalNotes: z.string().optional(),
  pacerName: z.string().optional(),
  tShirtSize: z.string().optional(),
});

/**
 * 2. Vehicle Crew (Motorsport TSD Regularity, Rally, Two-person MTB)
 * Emergency contacts are modeled via direct reference on the entrants table.
 */
export const VehicleCrewSchema = z.object({
  kind: z.literal("vehicle_crew"),
  driver: z.object({
    name: z.string(),
    licenseNumber: z.string(),
    phone: z.string().optional(),
  }),
  coDriver: z.object({
    name: z.string(),
    licenseNumber: z.string(),
    phone: z.string().optional(),
  }).optional(),
  vehicle: z.object({
    make: z.string(),
    model: z.string(),
    year: z.number().int(),
    vehicleClass: z.string(), // e.g. "Historic", "Modern AWD", "SOP"
  }),
});

/**
 * 3. Relay Team (Ekiden, 24-Hour team loops, Multi-runner squads)
 */
export const RelayTeamSchema = z.object({
  kind: z.literal("relay_team"),
  teamName: z.string(),
  captainContact: z.object({
    name: z.string(),
    phone: z.string(),
    email: z.string().optional(),
    address: AddressSchema.optional(),
  }),
  members: z.array(z.object({
    legNumber: z.number().int(),
    name: z.string(),
    phone: z.string().optional(),
  })),
});

export const ParticipantDataSchema = z.discriminatedUnion("kind", [
  SoloCompetitorSchema,
  VehicleCrewSchema,
  RelayTeamSchema,
]);

export type ParticipantData = z.infer<typeof ParticipantDataSchema>;

/**
 * Event-level rules configuration.
 * Note: Odometer calibration is intentionally omitted because ChekkPoint is a checkpoint
 * timing platform, not an in-cockpit rally computer.
 */
export const RulesConfigSchema = z.object({
  timeFormat: z.enum(["HH:MM:SS", "HH:MM:SS.sss", "MM:SS.sss"]).default("HH:MM:SS"),
  displayPrecisionDecimals: z.number().int().min(0).max(3).default(0),
  allowSelfCheckIn: z.boolean().default(false),
  requirePacerRegistration: z.boolean().default(false),
  
  // TSD Regularity Rally Penalties
  // Early arrival is penalized twice as harshly as late arrival to discourage speeding on public roads.
  earlyPenaltyFactor: z.number().default(2.0),
  latePenaltyFactor: z.number().default(1.0),
  gracePeriodSeconds: z.number().default(0.0), // Window of deviation before penalties accrue

  // Backyard Ultra Specifics
  yardDistanceMiles: z.number().default(4.166667),
  yardTimeLimitSeconds: z.number().default(3600), // 60 minutes
});

export type RulesConfig = z.infer<typeof RulesConfigSchema>;

// ============================================================================
// 3. TABLE DEFINITIONS
// ============================================================================

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

/**
 * EventGroup: The fundamental operational boundary.
 * Races occurring on the same day/weekend that share physical infrastructure (volunteers,
 * timing points, and bib space) belong to one EventGroup (e.g. 100M, 50M, 20M).
 * Raw times are ingested at the EventGroup level so field volunteers do not have to guess
 * which specific race distance a passing bib belongs to.
 */
export const eventGroups = pgTable("event_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), // e.g. "Wasatch 100 Weekend 2026"
  slug: text("slug").notNull(),
  discipline: disciplineEnum("discipline").notNull(),
  rulesConfig: jsonb("rules_config").$type<RulesConfig>().notNull(),
  startDate: timestamp("start_date", { withTimezone: true, mode: "date" }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("event_groups_org_idx").on(t.organizationId),
  index("event_groups_slug_idx").on(t.slug),
]);

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  distanceMeters: doublePrecision("distance_meters").notNull(),
  elevationGainMeters: integer("elevation_gain_meters"),
  gpxRouteUrl: text("gpx_route_url"),
  copiedFromCourseId: uuid("copied_from_course_id").references((): AnyPgColumn => courses.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("courses_org_idx").on(t.organizationId),
  index("courses_copied_from_idx").on(t.copiedFromCourseId),
]);

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventGroupId: uuid("event_group_id").references(() => eventGroups.id, { onDelete: "cascade" }).notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "restrict" }).notNull(),
  name: text("name").notNull(), // e.g. "100 Mile Championship", "Open Class"
  lapsRequired: integer("laps_required").default(1).notNull(),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true, mode: "date" }).notNull(),
  actualStart: timestamp("actual_start", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("events_group_idx").on(t.eventGroupId),
  index("events_course_idx").on(t.courseId),
]);

/**
 * TimingPoint: Physical location on Earth (e.g. "Twin Lakes Aid Station Tent" at GPS 39.08, -106.38).
 * Distinct from CourseSplit: Volunteers sit at one physical TimingPoint; runners may pass it
 * multiple times on out-and-back or looped courses.
 */
export const timingPoints = pgTable("timing_points", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(), // Short identifier transmitted by hardware, e.g. "TWIN_LAKES"
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  elevationMeters: integer("elevation_meters"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("timing_points_org_code_idx").on(t.organizationId, t.code),
]);

/**
 * CourseSplit: Logical milestone along a course at a cumulative distance.
 * On an out-and-back course, two different courseSplits (e.g. "Mile 39.5 Outbound" and "Mile 60.5 Inbound")
 * point to the same physical timingPoint ("TWIN_LAKES").
 */
export const courseSplits = pgTable("course_splits", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  timingPointId: uuid("timing_point_id").references(() => timingPoints.id, { onDelete: "restrict" }).notNull(),
  name: text("name").notNull(), // e.g. "Twin Lakes Inbound"
  sequenceOrder: integer("sequence_order").notNull(), // 1, 2, 3...
  distanceFromStartMeters: doublePrecision("distance_from_start_meters").notNull(),
  subSplitBitmap: integer("sub_split_bitmap").default(1).notNull(), // Bitmask: 1=IN, 2=OUT, 3=IN+OUT
  cutoffDurationSeconds: integer("cutoff_duration_seconds"), // Departure cutoff duration from race start
  
  // TSD Regularity Target
  tsdIdealDurationSeconds: doublePrecision("tsd_ideal_duration_seconds"),
  isSecretCheckpoint: boolean("is_secret_checkpoint").default(false).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("course_splits_order_idx").on(t.courseId, t.sequenceOrder),
  index("course_splits_course_dist_idx").on(t.courseId, t.distanceFromStartMeters),
]);

export type PersonRole =
  | "racer"
  | "volunteer"
  | "pacer"
  | "crew"
  | "official"
  | "emergency_contact";

/**
 * People: Global human identity.
 * Roles array: Automatically maintained array of roles this person holds across organizations and events
 * (e.g. ['racer', 'volunteer', 'pacer', 'emergency_contact']). Having roles stored directly on the person avoids expensive
 * multi-table joins when filtering volunteer directories or checking portal access.
 */
export const people = pgTable("people", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  gender: text("gender"),
  birthdate: text("birthdate"),
  email: text("email"),
  phone: text("phone"),
  address: jsonb("address").$type<z.infer<typeof AddressSchema>>(),
  roles: jsonb("roles").$type<PersonRole[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("people_email_idx").on(t.email),
  index("people_name_idx").on(t.lastName, t.firstName),
]);

/**
 * Entrants: The scored competitive unit.
 * 'competitorNumber' is abstracted: rendered dynamically as "Bib #" (running),
 * "Plate #" (cycling), or "Car #" (motorsport).
 */
export const entrants = pgTable("entrants", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  personId: uuid("person_id").references(() => people.id, { onDelete: "restrict" }).notNull(),
  competitorNumber: text("competitor_number").notNull(), // Bib #, Plate #, or Car #
  rfidCode: text("rfid_code"),
  status: entrantStatusEnum("status").default("registered").notNull(),
  division: text("division").notNull(), // e.g. "Open M", "F40-49", "Pro Men DH"
  participantData: jsonb("participant_data").$type<ParticipantData>().notNull(),
  
  // Direct Emergency Contact Reference (Normalized 1:1 relation to people)
  emergencyContactPersonId: uuid("emergency_contact_person_id").references(() => people.id, { onDelete: "set null" }),
  emergencyContactRelationship: text("emergency_contact_relationship"),
  emergencyContactIsOnSite: boolean("emergency_contact_is_on_site").default(false).notNull(),

  // Staggered / Wave Start Offsets
  scheduledStartTime: timestamp("scheduled_start_time", { withTimezone: true, mode: "date" }),
  actualStartTime: timestamp("actual_start_time", { withTimezone: true, mode: "date" }),

  // DNF / Drop Details
  droppedSplitId: uuid("dropped_split_id").references(() => courseSplits.id, { onDelete: "set null" }),
  dropReason: text("drop_reason"), // 'voluntary', 'medical', 'mechanical', 'missed_cutoff'
  dropLocationDescription: text("drop_location_description"), // Narrative if retired between stations
  comments: text("comments"),

  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("entrants_event_competitor_idx").on(t.eventId, t.competitorNumber),
  index("entrants_transponder_idx").on(t.rfidCode),
  index("entrants_status_idx").on(t.eventId, t.status),
  index("entrants_emergency_contact_person_idx").on(t.emergencyContactPersonId),
]);

/**
 * 4. WRITE PLANE: THE IMMUTABLE AUDIT LEDGER (RAW INGESTION)
 * Raw timing pulses are append-only and never updated or deleted.
 * 'timingPointCode' matches the physical timingPoint (e.g. "TWIN_LAKES") where the device is located.
 * Clock drift is intentionally omitted: timestamps are recorded in true UTC.
 */
export const rawTimingEvents = pgTable("raw_timing_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventGroupId: uuid("event_group_id").references(() => eventGroups.id, { onDelete: "cascade" }).notNull(),
  competitorNumber: text("competitor_number").notNull(),
  timingPointCode: text("timing_point_code").notNull(), // Code of the physical timing point
  subSplitKind: subSplitKindEnum("sub_split_kind").notNull(),

  recordedTimeUtc: timestamp("recorded_time_utc", { withTimezone: true, precision: 3, mode: "date" }).notNull(),

  // Source Telemetry & Audit Trail
  source: timingSourceEnum("source").notNull(),
  sourceDeviceId: text("source_device_id"),   // e.g. "ipad-station-4"
  sourceOperator: text("source_operator"),     // Volunteer username or radio operator handle
  syncBatchId: uuid("sync_batch_id"),         // Identifies batch import operations from offline caches
  
  withPacer: boolean("with_pacer").default(false).notNull(),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),

  // Single validation status: Replaces redundant boolean flags like isDisassociated.
  // If an official marks an entry invalid, status becomes 'rejected_invalid' with an audit note.
  status: rawTimingStatusEnum("status").default("unprocessed").notNull(),
  auditNote: text("audit_note"),

  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("raw_events_eg_comp_idx").on(t.eventGroupId, t.competitorNumber),
  index("raw_events_time_idx").on(t.recordedTimeUtc),
  index("raw_events_batch_idx").on(t.syncBatchId),
  index("raw_events_status_idx").on(t.status),
]);

/**
 * 5. READ PLANE: SCORED STANDINGS (MATERIALIZED PROJECTIONS)
 * Scored splits are derived projections calculated from rawTimingEvents.
 * 'stoppedHere' indicates that this is the exact aid station where the competitor terminated their race.
 */
export const scoredSplitTimes = pgTable("scored_split_times", {
  id: uuid("id").defaultRandom().primaryKey(),
  entrantId: uuid("entrant_id").references(() => entrants.id, { onDelete: "cascade" }).notNull(),
  courseSplitId: uuid("course_split_id").references(() => courseSplits.id, { onDelete: "cascade" }).notNull(),
  lap: integer("lap").default(1).notNull(),
  subSplitKind: subSplitKindEnum("sub_split_kind").notNull(),

  // High Precision Metrics (Millisecond Precision)
  absoluteTimeUtc: timestamp("absolute_time_utc", { withTimezone: true, precision: 3, mode: "date" }).notNull(),
  elapsedSeconds: doublePrecision("elapsed_seconds").notNull(),
  dwellSeconds: integer("dwell_seconds"), // Time between IN and OUT at this checkpoint
  segmentPaceSecondsPerKm: doublePrecision("segment_pace_seconds_per_km"),

  // Motorsport / TSD Regularity Metrics
  tsdDeviationSeconds: doublePrecision("tsd_deviation_seconds"), // Actual - Target
  penaltyPoints: doublePrecision("penalty_points").default(0).notNull(),

  // Checkpoint Drop Indicator: Competitor terminated their effort here
  stoppedHere: boolean("stopped_here").default(false).notNull(),

  // Data Provenance & Verification
  dataStatus: dataStatusEnum("data_status").default("valid").notNull(),
  governingRawEventId: uuid("governing_raw_event_id").references(() => rawTimingEvents.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("scored_split_unique_idx").on(t.entrantId, t.courseSplitId, t.lap, t.subSplitKind),
  index("scored_split_elapsed_idx").on(t.courseSplitId, t.elapsedSeconds),
  index("scored_split_entrant_idx").on(t.entrantId),
]);

/**
 * 6. DISASTER RECOVERY & TIME ALLOWANCES
 * Models mandatory medical holds (e.g. 45-min hydration hold) or weather holds.
 * Deducted from adjusted net time and automatically extends downstream aid station cutoffs.
 */
export const timeAllowances = pgTable("time_allowances", {
  id: uuid("id").defaultRandom().primaryKey(),
  entrantId: uuid("entrant_id").references(() => entrants.id, { onDelete: "cascade" }).notNull(),
  splitId: uuid("split_id").references(() => courseSplits.id, { onDelete: "cascade" }).notNull(),
  startTime: timestamp("start_time", { withTimezone: true, mode: "date" }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true, mode: "date" }).notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  reason: text("reason").notNull(), // 'medical_hold', 'hazard_hold', 'gear_check'
  authorizedBy: text("authorized_by").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("time_allowances_entrant_idx").on(t.entrantId),
]);

/**
 * Forensic Audit Trail: Captures every status change or timestamp modification.
 */
export const splitTimeAudits = pgTable("split_time_audits", {
  id: uuid("id").defaultRandom().primaryKey(),
  splitTimeId: uuid("split_time_id").references(() => scoredSplitTimes.id, { onDelete: "cascade" }).notNull(),
  action: text("action").notNull(), // 'CREATED', 'UPDATED', 'DELETED', 'REBUILT', 'CONFIRMED'
  previousState: jsonb("previous_state").$type<Record<string, unknown>>(),
  newState: jsonb("new_state").$type<Record<string, unknown>>(),
  changedBy: text("changed_by").notNull(),
  changeReason: text("change_reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("split_time_audits_split_idx").on(t.splitTimeId),
]);

// ============================================================================
// 7. COMPETITOR HISTORY & PROJECTIONS
// ============================================================================

/**
 * External platform profiles linked to an individual person (e.g. UltraSignup, Strava, DUV, ITRA).
 */
export const personExternalProfiles = pgTable("person_external_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  personId: uuid("person_id").references(() => people.id, { onDelete: "cascade" }).notNull(),
  platform: externalPlatformEnum("platform").notNull(),
  externalIdentifier: text("external_identifier").notNull(),
  profileUrl: text("profile_url"),
  verificationStatus: profileVerificationStatusEnum("verification_status").default("unverified").notNull(),
  matchConfidence: doublePrecision("match_confidence"),
  matchMetadata: jsonb("match_metadata"),
  scrapeStatus: scrapeStatusEnum("scrape_status").default("pending").notNull(),
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true, mode: "date" }),
  rawPayload: jsonb("raw_payload"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("person_external_profiles_platform_identifier_idx").on(t.platform, t.externalIdentifier),
  index("person_external_profiles_person_idx").on(t.personId),
  index("person_external_profiles_scrape_status_idx").on(t.scrapeStatus),
]);

/**
 * Historical race performances achieved by a person across platforms and years.
 */
export const personRaceHistory = pgTable("person_race_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  personId: uuid("person_id").references(() => people.id, { onDelete: "cascade" }).notNull(),
  externalProfileId: uuid("external_profile_id").references(() => personExternalProfiles.id, { onDelete: "set null" }),
  platform: externalPlatformEnum("platform").notNull(),
  raceName: text("race_name").notNull(),
  raceDate: text("race_date").notNull(), // ISO Date string YYYY-MM-DD
  distanceMeters: doublePrecision("distance_meters"),
  distanceLabel: text("distance_label"), // e.g. "50K", "100M", "Marathon"
  elevationGainMeters: doublePrecision("elevation_gain_meters"),
  elapsedSeconds: integer("elapsed_seconds"),
  finishTimeFormatted: text("finish_time_formatted"), // e.g. "14:22:31"
  overallPlace: integer("overall_place"),
  genderPlace: integer("gender_place"),
  categoryPlace: integer("category_place"),
  totalFinishers: integer("total_finishers"),
  status: raceHistoryStatusEnum("status").default("finished").notNull(),
  sourceUrl: text("source_url"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("person_race_history_person_idx").on(t.personId),
  index("person_race_history_date_idx").on(t.raceDate),
  index("person_race_history_distance_idx").on(t.distanceMeters),
]);

/**
 * Materialized 1:1 career intelligence rollup for a person.
 */
export const personHistoricalSummaries = pgTable("person_historical_summaries", {
  id: uuid("id").defaultRandom().primaryKey(),
  personId: uuid("person_id").references(() => people.id, { onDelete: "cascade" }).notNull(),
  totalRaces: integer("total_races").default(0).notNull(),
  totalFinishes: integer("total_finishes").default(0).notNull(),
  totalDnfs: integer("total_dnfs").default(0).notNull(),
  dnfRate: doublePrecision("dnf_rate").default(0).notNull(), // 0.0 to 1.0
  maxDistanceMeters: doublePrecision("max_distance_meters").default(0).notNull(),
  maxElevationGainMeters: doublePrecision("max_elevation_gain_meters").default(0).notNull(),
  avgPaceSecondsPerKm: doublePrecision("avg_pace_seconds_per_km"),
  experienceTier: experienceTierEnum("experience_tier").default("novice").notNull(),
  ultrasignupRank: doublePrecision("ultrasignup_rank"), // e.g. 88.42%
  itraPerformanceIndex: integer("itra_performance_index"), // e.g. 640
  lastRaceDate: text("last_race_date"),
  confidenceScore: doublePrecision("confidence_score").default(1.0).notNull(),
  safetyTriageNotes: text("safety_triage_notes"),
  computedAt: timestamp("computed_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("person_historical_summaries_person_idx").on(t.personId),
  index("person_historical_summaries_tier_idx").on(t.experienceTier),
]);

/**
 * Event-specific materialized pacing projection and safety triage model for an entrant.
 */
export const entrantHistoricalProjections = pgTable("entrant_historical_projections", {
  id: uuid("id").defaultRandom().primaryKey(),
  entrantId: uuid("entrant_id").references(() => entrants.id, { onDelete: "cascade" }).notNull(),
  personId: uuid("person_id").references(() => people.id, { onDelete: "cascade" }).notNull(),
  projectedFinishSeconds: integer("projected_finish_seconds"),
  projectedPaceSecondsPerKm: doublePrecision("projected_pace_seconds_per_km"),
  projectedArrivalTimes: jsonb("projected_arrival_times").$type<Record<string, { secondsFromStart: number; projectedTimeUtc: string }>>(),
  confidenceBandLowSeconds: integer("confidence_band_low_seconds"),
  confidenceBandHighSeconds: integer("confidence_band_high_seconds"),
  expectedCutoffRisk: boolean("expected_cutoff_risk").default(false).notNull(),
  volunteersSarSafetyBadge: text("volunteers_sar_safety_badge"),
  projectionMethod: text("projection_method").default("historical_pacing").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("entrant_historical_projections_entrant_idx").on(t.entrantId),
  index("entrant_historical_projections_person_idx").on(t.personId),
  index("entrant_historical_projections_cutoff_risk_idx").on(t.expectedCutoffRisk),
]);

// ============================================================================
// 4. DRIZZLE RELATIONS (FOR RELATIONAL QUERY API)
// ============================================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  eventGroups: many(eventGroups),
  courses: many(courses),
  timingPoints: many(timingPoints),
}));

export const eventGroupsRelations = relations(eventGroups, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [eventGroups.organizationId],
    references: [organizations.id],
  }),
  events: many(events),
  rawTimingEvents: many(rawTimingEvents),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [courses.organizationId],
    references: [organizations.id],
  }),
  copiedFromCourse: one(courses, {
    fields: [courses.copiedFromCourseId],
    references: [courses.id],
    relationName: "courseCopies",
  }),
  derivedCourses: many(courses, {
    relationName: "courseCopies",
  }),
  events: many(events),
  courseSplits: many(courseSplits),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  eventGroup: one(eventGroups, {
    fields: [events.eventGroupId],
    references: [eventGroups.id],
  }),
  course: one(courses, {
    fields: [events.courseId],
    references: [courses.id],
  }),
  entrants: many(entrants),
}));

export const timingPointsRelations = relations(timingPoints, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [timingPoints.organizationId],
    references: [organizations.id],
  }),
  courseSplits: many(courseSplits),
}));

export const courseSplitsRelations = relations(courseSplits, ({ one, many }) => ({
  course: one(courses, {
    fields: [courseSplits.courseId],
    references: [courses.id],
  }),
  timingPoint: one(timingPoints, {
    fields: [courseSplits.timingPointId],
    references: [timingPoints.id],
  }),
  scoredSplitTimes: many(scoredSplitTimes),
  timeAllowances: many(timeAllowances),
}));

export const peopleRelations = relations(people, ({ many, one }) => ({
  entrants: many(entrants, { relationName: "entrant" }),
  emergencyContactForEntrants: many(entrants, { relationName: "emergencyContact" }),
  externalProfiles: many(personExternalProfiles),
  raceHistory: many(personRaceHistory),
  historicalSummary: one(personHistoricalSummaries),
  projections: many(entrantHistoricalProjections),
}));

export const entrantsRelations = relations(entrants, ({ one, many }) => ({
  event: one(events, {
    fields: [entrants.eventId],
    references: [events.id],
  }),
  person: one(people, {
    fields: [entrants.personId],
    references: [people.id],
    relationName: "entrant",
  }),
  emergencyContactPerson: one(people, {
    fields: [entrants.emergencyContactPersonId],
    references: [people.id],
    relationName: "emergencyContact",
  }),
  droppedSplit: one(courseSplits, {
    fields: [entrants.droppedSplitId],
    references: [courseSplits.id],
  }),
  scoredSplitTimes: many(scoredSplitTimes),
  timeAllowances: many(timeAllowances),
  historicalProjection: one(entrantHistoricalProjections),
}));

export const personExternalProfilesRelations = relations(personExternalProfiles, ({ one, many }) => ({
  person: one(people, {
    fields: [personExternalProfiles.personId],
    references: [people.id],
  }),
  raceHistory: many(personRaceHistory),
}));

export const personRaceHistoryRelations = relations(personRaceHistory, ({ one }) => ({
  person: one(people, {
    fields: [personRaceHistory.personId],
    references: [people.id],
  }),
  externalProfile: one(personExternalProfiles, {
    fields: [personRaceHistory.externalProfileId],
    references: [personExternalProfiles.id],
  }),
}));

export const personHistoricalSummariesRelations = relations(personHistoricalSummaries, ({ one }) => ({
  person: one(people, {
    fields: [personHistoricalSummaries.personId],
    references: [people.id],
  }),
}));

export const entrantHistoricalProjectionsRelations = relations(entrantHistoricalProjections, ({ one }) => ({
  entrant: one(entrants, {
    fields: [entrantHistoricalProjections.entrantId],
    references: [entrants.id],
  }),
  person: one(people, {
    fields: [entrantHistoricalProjections.personId],
    references: [people.id],
  }),
}));

export const rawTimingEventsRelations = relations(rawTimingEvents, ({ one, many }) => ({
  eventGroup: one(eventGroups, {
    fields: [rawTimingEvents.eventGroupId],
    references: [eventGroups.id],
  }),
  governedSplitTimes: many(scoredSplitTimes),
}));

export const scoredSplitTimesRelations = relations(scoredSplitTimes, ({ one, many }) => ({
  entrant: one(entrants, {
    fields: [scoredSplitTimes.entrantId],
    references: [entrants.id],
  }),
  courseSplit: one(courseSplits, {
    fields: [scoredSplitTimes.courseSplitId],
    references: [courseSplits.id],
  }),
  governingRawEvent: one(rawTimingEvents, {
    fields: [scoredSplitTimes.governingRawEventId],
    references: [rawTimingEvents.id],
  }),
  audits: many(splitTimeAudits),
}));

export const timeAllowancesRelations = relations(timeAllowances, ({ one }) => ({
  entrant: one(entrants, {
    fields: [timeAllowances.entrantId],
    references: [entrants.id],
  }),
  split: one(courseSplits, {
    fields: [timeAllowances.splitId],
    references: [courseSplits.id],
  }),
}));

export const splitTimeAuditsRelations = relations(splitTimeAudits, ({ one }) => ({
  splitTime: one(scoredSplitTimes, {
    fields: [splitTimeAudits.splitTimeId],
    references: [scoredSplitTimes.id],
  }),
}));

// ============================================================================
// 5. INFERRED TYPES
// ============================================================================

export type Organization = InferSelectModel<typeof organizations>;
export type NewOrganization = InferInsertModel<typeof organizations>;

export type EventGroup = InferSelectModel<typeof eventGroups>;
export type NewEventGroup = InferInsertModel<typeof eventGroups>;

export type Course = InferSelectModel<typeof courses>;
export type NewCourse = InferInsertModel<typeof courses>;

export type Event = InferSelectModel<typeof events>;
export type NewEvent = InferInsertModel<typeof events>;

export type TimingPoint = InferSelectModel<typeof timingPoints>;
export type NewTimingPoint = InferInsertModel<typeof timingPoints>;

export type CourseSplit = InferSelectModel<typeof courseSplits>;
export type NewCourseSplit = InferInsertModel<typeof courseSplits>;

export type Person = InferSelectModel<typeof people>;
export type NewPerson = InferInsertModel<typeof people>;

export type Entrant = InferSelectModel<typeof entrants>;
export type NewEntrant = InferInsertModel<typeof entrants>;

export type PersonExternalProfile = InferSelectModel<typeof personExternalProfiles>;
export type NewPersonExternalProfile = InferInsertModel<typeof personExternalProfiles>;

export type PersonRaceHistory = InferSelectModel<typeof personRaceHistory>;
export type NewPersonRaceHistory = InferInsertModel<typeof personRaceHistory>;

export type PersonHistoricalSummary = InferSelectModel<typeof personHistoricalSummaries>;
export type NewPersonHistoricalSummary = InferInsertModel<typeof personHistoricalSummaries>;

export type EntrantHistoricalProjection = InferSelectModel<typeof entrantHistoricalProjections>;
export type NewEntrantHistoricalProjection = InferInsertModel<typeof entrantHistoricalProjections>;

export type RawTimingEvent = InferSelectModel<typeof rawTimingEvents>;
export type NewRawTimingEvent = InferInsertModel<typeof rawTimingEvents>;

export type ScoredSplitTime = InferSelectModel<typeof scoredSplitTimes>;
export type NewScoredSplitTime = InferInsertModel<typeof scoredSplitTimes>;

export type TimeAllowance = InferSelectModel<typeof timeAllowances>;
export type NewTimeAllowance = InferInsertModel<typeof timeAllowances>;

export type SplitTimeAudit = InferSelectModel<typeof splitTimeAudits>;
export type NewSplitTimeAudit = InferInsertModel<typeof splitTimeAudits>;
```

---

### 4.2 Drizzle Configuration (`drizzle.config.ts`)

Configured for PostgreSQL migrations via Drizzle Kit, outputting directly to `./drizzle`:

```typescript
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Vite, so read process.env directly rather than src/env.ts
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (add it to .env)");

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url },
});
```

---

### 4.3 Database Connection Setup (`src/db/index.ts`)

Configured for **Railway + PostgreSQL + PgBouncer** compatibility using `node-postgres` (`pg.Pool`):

```typescript
import "@tanstack/solid-start/server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10, // Pool size tuned for Railway container / serverless concurrency
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
});

export const db = drizzle({ client: pool, schema });
export type Database = typeof db;
```

#### Operational Notes on Connection Pooling & PgBouncer:
- **Server Chunk Isolation:** Guarded by `import "@tanstack/solid-start/server-only"` to guarantee that server connection pools, drivers, and database credentials are never bundled into client browser bundles.
- **Environment Validation:** Uses validated `env.DATABASE_URL` via `@t3-oss/env-core` and Zod (`src/env.ts`).
- **Pool Sizing (`max: 10`):** Limits concurrent connections per container replica to prevent PostgreSQL connection exhaustion when multiple instances scale out under spectator traffic surges.
- **PgBouncer Compatibility:** In Railway environments using PgBouncer in transaction pooling mode, `node-postgres` executes unnamed queries by default, avoiding prepared statement cache starvation. For DDL migrations or lock-intensive operations, use the direct/unpooled connection URL (`DATABASE_UNPOOLED_URL`).

---

### 4.4 Automated Migration Runner (`src/db/migrate.ts`)

Migrations are generated into `./drizzle` via `pnpm db:generate` (`drizzle-kit generate`) and applied via `pnpm db:migrate` (`drizzle-kit migrate`) or programmatically via a migration runner:

```typescript
import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

async function runMigrations() {
  const connectionString = process.env.DATABASE_UNPOOLED_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  // Use a dedicated single-connection pool for DDL migrations
  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle({ client: pool });

  console.log("Running pending migrations from ./drizzle...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied successfully.");

  await pool.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
```

---

### 4.5 Real-Time Cache & Event Bus Setup (`src/redis/index.ts`)

Configured for **Redis 8 Alpine** (local via Docker Compose `compose.yaml`, production via Railway Redis service):

```typescript
import "@tanstack/solid-start/server-only";
import { createClient } from "redis";
import { env } from "../env";

const client = createClient({ url: env.REDIS_URL }).on("error", (err) =>
  console.error("Redis Client Error", err),
);

let connecting: Promise<typeof client> | undefined;

// Connect once on first use and reuse the client for every request after that.
export function getRedis() {
  connecting ??= client.connect().catch((err) => {
    connecting = undefined;
    throw err;
  });
  return connecting;
}
```

#### Key Architectural Roles for Redis:
1. **Real-Time Pub/Sub Event Bus:** Broadcasts verified split times (`scored_split_times`) and event milestones across distributed server instances and Railway background workers.
2. **Live Split Broadcasts (SSE / WebSockets):** Feeds spectator live leaderboards by streaming instant split notifications to connected clients without repeated SQL query polling.
3. **Active Bib & Expected Runner Caching:** Maintains an in-memory cache of the active entrant roster and station-specific expected runner pools (`station:{id}:expected_bibs`), enabling sub-millisecond typo detection (Damerau-Levenshtein) during field chute bib entry.
4. **Ingestion Burst Buffering:** Absorbs rapid offline sync bursts and RFID transponder bursts prior to batch database ingestion.

---

## 5. Summary of Architecture Guarantees & Drizzle Benefits

1. **Relational Query API (`db.query`):** With all `relations()` defined, fetching complex nested objects (e.g. an entrant with their person profile, course, splits, and verified scored times) is clean, fully type-safe, and avoids manual SQL JOIN boilerplate:
   ```typescript
   const effort = await db.query.entrants.findFirst({
     where: eq(entrants.competitorNumber, "142"),
     with: {
       person: true,
       event: { with: { course: { with: { courseSplits: true } } } },
       scoredSplitTimes: true,
     },
   });
   ```
2. **Strict Compile-Time Types:** Inferred models (`$inferSelect` and `$inferInsert`) paired with Zod schemas guarantee zero runtime type coercion surprises.
3. **Railway & PgBouncer Safety:** Pre-configured with `node-postgres` connection pooling (`pg.Pool`) and unpooled direct migration execution to ensure bulletproof pooling performance under heavy spectator finish-line loads.
4. **Idempotent Recalculation:** The Rebuild Times engine can wipe `scored_split_times` and re-evaluate the entire event cleanly without data loss.
