# ChekkPoint Complete Interface Sitemap, Database-to-UI Matrix & 4-Wave Rollout Plan

**Canonical Reference Document** · **Design System:** [Paper & Topo (`style-guide.md`)](./style-guide.md) · **Component Standard:** `solid-ui` (Kobalte) First · **Performance Standard:** Zero `backdrop-blur` / Zero `transition-all` (`TODO-013`)

---

## 1. Executive Summary & Architectural Philosophy

ChekkPoint is a multi-discipline endurance & motorsport checkpoint timing platform uniting the public discovery and historical course-planning depth of **OpenSplitTime.org** with the resilient, sub-second field logging and Search & Rescue (SAR) custody accountability of **TRacer**.

Every screen in ChekkPoint obeys five non-negotiable architectural pillars locked in during the `/grill-me` UX & Navigation Architecture specification:

1. **Consolidated Organization & Event Group URL Hierarchy (`/_authed/orgs/$slug/*`):**
   - **Public Discovery & Canonical Entity Homes (`/`, `/events/*`, `/courses/$courseId`, `/athletes/*`, `/organizers/$slug`):** 100% public, non-auth-gated, fast-loading SSR + SQL-aggregated views.
   - **Unified Organization & Event Group Workspace (`/_authed/orgs/$slug/*`):** All Organization assets AND all Event Group race-weekend operations live under a single unified URL hierarchy (`/orgs/$slug/*` and `/orgs/$slug/event-groups/$eventGroupSlug/*`), retiring the standalone `/_authed/event-groups/$eventGroupId` route.
2. **Collapsible Left Sidebar (Org + Nested Event Groups) + Top Horizontal Sub-Event Bar:**
   - **Left Sidebar (`/orgs/$slug/route.tsx`):**
     - Organization switcher / header at top
     - **Organization Navigation:** `Overview` (`/orgs/$slug`), `Courses Library` (`/orgs/$slug/courses` & `/orgs/$slug/courses/$courseId`), `Timing Points` (`/orgs/$slug/timing-points`), `Members` (`/orgs/$slug/members`), `Settings` (`/orgs/$slug/settings`)
     - **Nested Event Groups Tree:** Expandable/nested list of the Organization's `Event Groups` (`/orgs/$slug/event-groups` + direct items for each `eventGroupSlug`, e.g., `2026 Cascade Crest`, `+ New Event Group`). *(Note: No separate Org-level "Events" tab in the left sidebar—sub-events live along the top bar when an Event Group is selected!)*
   - **Top Bar Inside an Event Group (`/orgs/$slug/event-groups/$eventGroupSlug/route.tsx`):**
     - Dedicated to the Event Group's **Sub-Events** plus the shared Weekend Hub:
       `[ All Events (Weekend Hub) ]` | `[ 100M ]` | `[ 50K ]` | `[ + Add Event ]` — plus a primary **"Launch Field Logger"** button on the right.
3. **Component Sourcing Rule (`solid-ui` First):**
   - Every UI control is built from accessible Kobalte-backed `solid-ui` primitives in `src/components/ui/*` using `@kobalte/core` data attributes (`data-[checked]:*`, `data-[expanded]:*`, `data-[closed]:*`). Custom raw `<button>`, `<input>`, `<select>`, `<dialog>`, or `<table>` markup is prohibited.
4. **"Paper & Topo" Visual & GPU Performance Discipline:**
   - Warm paper (`#f4f1ea`), deep pine ink (`#2b3a2f`), muted forest (`#4a6750`), sage (`#8fa88c`), clay (`#c1785b`), and sand (`#e3d8c3`).
   - EB Garamond display serif (`.font-display`, `.page-title`) paired with Manrope UI sans and `tabular-nums` on every split, bib, distance, elevation, and countdown.
   - **Zero GPU Blur Overhead (`TODO-013`):** Cards, dialogs, sheets, and tables use opaque/near-opaque warm paper tokens (`--card: rgba(250, 248, 243, 0.96)`, `--popover: #faf8f3`) with `transition-colors` / `transition-shadow` / `transition-opacity` — never `backdrop-blur-*` or `transition-all`.
5. **CQRS Write/Read Separation:**
   - Field devices and volunteers write exclusively to the append-only `raw_timing_events` ledger.
   - The scoring/rebuild engine materializes `scored_split_times`, `time_allowances`, and `split_time_audits`.

---

## 2. Locked-In Navigation & Workspace Architecture (`/grill-me` Specification)

### 2.1 Left Sidebar vs. Top Bar Hierarchy (`/orgs/$slug/*`)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ LEFT SIDEBAR (/orgs/$slug/route.tsx)    │ TOP BAR (/event-groups/$eventGroupSlug)      │
│ ─────────────────────────────────────── │ ──────────────────────────────────────────── │
│ [Org Switcher: Cascade Mountain Ultras] │ [All Events (Weekend Hub)] [100M] [50K] [+]  │
│                                         │                        [Launch Field Logger] │
│ ORGANIZATION                            ├──────────────────────────────────────────────┤
│  • Overview (/orgs/$slug)               │ CONTEXTUAL SUB-TABS                          │
│  • Courses Library (/orgs/$slug/courses)│  When [All Events (Weekend Hub)] is active:  │
│  • Timing Points (/orgs/$slug/timing-…) │   1. Weekend Overview & Readiness            │
│  • Members (/orgs/$slug/members)        │   2. Discipline Rules & Staff Matrix         │
│  • Settings (/orgs/$slug/settings)      │   3. Combined Aid Stations Cross-Check       │
│                                         │   4. Combined Net Control & SAR Triage       │
│ EVENT GROUPS (/orgs/$slug/event-groups) │   5. Raw Timing Stream                       │
│  ▾ 2026 Cascade Crest                   │                                              │
│  ▸ 2025 Cascade Crest                   │  When [100M] or [50K] is active:             │
│  + New Event Group                      │   1. Overview & Gun Start                    │
│                                         │   2. Course & Cutoffs                        │
│                                         │   3. Entrants & Check-In (Mode 1 & Mode 2)   │
│                                         │   4. Live Progress & SAR                     │
│                                         │   5. Results, Audit & Exports                │
└─────────────────────────────────────────┴──────────────────────────────────────────────┘
```

### 2.2 `[ All Events (Weekend Hub) ]` (`/orgs/$slug/event-groups/$eventGroupSlug`)
Holds shared weekend-wide operations across all distances via 5 sub-tabs/pills:
1. **`Weekend Overview & Readiness`** (`/orgs/$slug/event-groups/$eventGroupSlug/`): Combined KPIs across all distances (`Registered`, `Checked In`, `On Course`, `Finished`, `DNF`, `Retired`), multi-distance wave/gun clocks, and pre-race readiness checklist.
2. **`Discipline Rules & Staff Matrix`** (`/orgs/$slug/event-groups/$eventGroupSlug/rules-staff`): Interactive `event_groups.rulesConfig` editor for E1–E5 (`timeFormat`, `displayPrecisionDecimals`, `allowSelfCheckIn`, `requirePacerRegistration`, TSD Regularity penalty/grace factors, Backyard Ultra yard rules) plus assigning `event_group_staff` to physical `timing_points` via `event_group_staff_timing_points`.
3. **`Combined Aid Stations Cross-Check`** (`/orgs/$slug/event-groups/$eventGroupSlug/stations` & `/stations/$timingPointId`):
   - Interactive **Bib Number Grid** grouped into 4 custody zones: `Expected Next`, `In Station Now` (with live dwell timer), `Departed`, and `Stopped / DNF`.
   - Tapping any Bib card opens a quick action popover (`Record IN` / `Record OUT` / `Stopped Here`).
   - Includes a 1-click toggle to a **Sortable Table View** with full projection timestamps (`projectedArrivalTimes`) and SAR risk badges (`volunteersSarSafetyBadge`).
4. **`Combined Net Control & SAR Triage`** (`/orgs/$slug/event-groups/$eventGroupSlug/sar`):
   - **Course Segment Progress Funnel** on top visualizing runner counts across checkpoints.
   - **Stage 1 Overdue Between Checkpoints** & **Stage 2 Lingering Inside Aid Station / Retired on Course (`retired`)** alert cards.
   - Clicking any alert opens the **Slide-Over Emergency & Medical Triage Sheet** (`participantData` medical/vehicle/pacer info + normalized `people` Emergency Contact card with `emergencyContactIsOnSite` badge).
5. **`Raw Timing Stream`** (`/orgs/$slug/event-groups/$eventGroupSlug/raw-stream`): Live `raw_timing_events` ledger feed across all stations, hardware readers, and field loggers with status badges and source filters.

### 2.3 Specific Sub-Event Tabs (`[ 100M ]`, `[ 50K ]` → `/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/*`)
Clicking a specific Sub-Event in the top horizontal bar scopes operations to that distance across 5 sub-tabs:
1. **`Overview & Gun Start`** (`/events/$eventId/`): `scheduledStart`, `actualStart` **Gun Start** trigger (`"Start Race / Record Gun Time"`), `lapsRequired`, distance-specific custody KPIs, and **Discipline-Adaptive Operational Controls** (see Section 2.4).
2. **`Course & Cutoffs`** (`/events/$eventId/course`): Select an existing Org Course, Clone Course (`copiedFromCourseId`), or build/edit its `course_splits` directly in-place using the shared **Course Split Builder** component (`src/courses/*` + `src/components/CourseSplitBuilder.tsx` with inline `"+ Create New Timing Point"`, `"Generate Start + Finish Splits"` 1-click starter, Up/Down reorder, and discipline-adaptive TSD columns).
3. **`Entrants & Check-In`** (`/events/$eventId/entrants`): Features a prominent **Mode Switcher**:
   - **Mode 1: `Roster & CSV Import`** — Pre-race registration table, Bulk CSV Import (`src/lib/csv.ts`), Experience Tier, Projected Finish, and Risk Badge. Clicking any entrant opens the **Compact 3-Section Edit Entrant Modal Dialog (`<Dialog>`)**:
     1. `1. Competitor & Division` (`people` autocomplete, Sub-Event distance transfer dropdown, and auto-adapting fields for Solo Competitor / Vehicle Crew / Relay Team)
     2. `2. Safety & Emergency Contact` (normalized `people` emergency contact + `emergencyContactIsOnSite`)
     3. `3. External History & Pacing Projections` (where Stewards review & approve/reject `person_external_profiles` candidate matches right inside the modal and recompute `entrant_historical_projections`!)
   - **Mode 2: `Race-Morning Check-In Desk`** — High-speed Bib/Name search, 1-tap `Checked In` / `DNS` buttons, inline Bib/RFID tag swap, `Start Race / Record Gun Time`, and **Printable Check-In Sheet**.
4. **`Live Progress & SAR`** (`/events/$eventId/sar`): Distance-specific course segment funnel + Stage 1 & Stage 2 SAR alerts + Slide-Over Emergency & Medical Triage Sheet (protected by `canViewMedicalData`).
5. **`Results, Audit & Exports`** (`/events/$eventId/audit`):
   - **Split-Pane Forensic Workstation:**
     - **Left Pane:** `Problem Efforts & Discrepancies Queue` (`questionable`, `bad`, `flagged_discrepancy`, unaccounted drops).
     - **Right Pane:** Selected runner's **Split Timeline & Raw Event Inspector** to Confirm, Edit/Insert splits with mandatory `changeReason` logged to `split_time_audits`, Select Governing Raw Event, Reassign Lap, Grant `Time Allowances` (`time_allowances`), or trigger `Rebuild Splits`.
   - **Sub-View Toggle:** Switches cleanly to **`Post-Race Establish Drops & Official Exports`** (certify official results, append `person_race_history`, and export UltraSignup / ITRA / Standard CSV & JSON).

### 2.4 UX & Operational Gap Audit Mandates (Cross-Cutting Across Waves 1–4)
1. **Role-Adaptive Left Sidebar & Event-Group-Only Volunteer Access (`/orgs/$slug/route.tsx`):**
   - `getOrganizationOverview` and `/orgs/$slug/route.tsx` allow access if the viewer is either an `organization_member` OR holds an `event_group_staff` assignment within that organization.
   - For Event-Group-only staff (`volunteer`, `checkpoint_captain`, `radio_operator`, `medical_sar_lead`, `official`), the Left Sidebar shows their **Assigned Event Groups & Assigned Stations** while hiding/disabling Org-admin tabs (`Settings`, `Members`, `Courses Library`, `Timing Points`).
2. **Discipline-Adaptive Operational Controls (`Overview & Gun Start` & `Field Logger`):**
   - **E1 Backyard Ultra (`backyard_ultra`):** Live Yard Counter (`Yard #14`),Countdown to Next Yard (`XX:XX` remaining in the 60-minute window with 3-2-1 whistle cues), In-Corral vs. Out-on-Loop Tally, and 1-Click `"Close Yard & Mark Non-Finishers OTL (DNF)"`.
   - **E5 TSD Regularity Rally (`tsd_regularity`):** Car-by-Car Out-Time Generator (`actualStartTime = baseStart + index * intervalSeconds`), sub-second `MM:SS.d` / `MM:SS.dd` precision (`rulesConfig.displayPrecisionDecimals`), and Post-Event `"Reveal Secret Checkpoints on Public Leaderboard"` toggle.
   - **E4 Downhill MTB / Enduro (`downhill_mtb`):** Individual Rider Gate Release / Staggered Start logger (`actualStartTime` per rider) + Red Flag / Course Hold Quick-Allowance trigger.
   - **E3 Lap-Based XCO (`xco_circuit`):** Leader Lap Progress & 80% Lapped-Rider Pull Indicator.
   - **E2 Fixed-Time Loop (`fixed_time_loop`):** Live Countdown to Horn (`6h / 12h / 24h`) + Partial Final Lap Distance/Credit entry.
3. **1-Tap Aid Station Volunteer Onboarding (`?station=CODE`):**
   - `rules-staff.tsx` generates copyable Station Logger Links (`/orgs/$slug/event-groups/$eventGroupSlug/logger?station=TWIN_LAKES`) that pre-select the station in the Field Logger with a persistent verification banner.
4. **Athlete Self Check-In (`rulesConfig.allowSelfCheckIn`) & Bidirectional Public $\leftrightarrow$ Admin Bridge:**
   - When `rulesConfig.allowSelfCheckIn === true`, `/account` Tab 2 (`My Races & Volunteer Shifts`) shows a `"Self Check-In & Confirm Emergency Contact"` action on the athlete's upcoming registration card.
   - Public `/events/$slug` shows a contextual `"Open Race Control →"` / `"Launch My Aid Station Logger →"` banner for authenticated staff; Race Control shows a `"View Public Page ↗"` link in the top header.

---

## 3. Complete Application Sitemap (39 Routes)

### 3.1 Public Discovery, Marketing & Canonical Entity Routes (18 Routes)

| Route Path | File Location | Status | Purpose & Key Capabilities |
|---|---|---|---|
| `/` | `src/routes/index.tsx` | ✅ Built (`TODO-010`/`012`) | Root Discovery Portal: Omnibox Search Hero, Discipline Filter Bar, Live Now Radar (`<LiveEventCard />` with inline bib lookup), Platform Persona strip. |
| `/events` | `src/routes/events/index.tsx` | ✅ Built (`TODO-010`/`012`) | Public Events & Results Directory: Upcoming Events & Recent Official Results feed + `<Tabs>` (`All`, `Live Now`, `Upcoming`, `Past Results`), search & discipline filters. |
| `/events/$slug` (Layout) | `src/routes/events/$slug/route.tsx` | 🔄 Enhance in **Wave 4 (`TODO-017`)** | Canonical Public Event Group Shell: Breadcrumbs, temporal badge, distance filter pills (`?event=`), `.nav-link` sub-nav, plus pinned **`"Following (N)"` Watchlist Ribbon** at the top in **Wave 4**. |
| `/events/$slug/` | `src/routes/events/$slug/index.tsx` | ✅ Built (`TODO-010`) | Event Group Overview: Field status counters (`On Course`, `Finished`, `DNF`), sub-event course cards, cutoff highlights, leaderboard snapshot. |
| `/events/$slug/entrants` | `src/routes/events/$slug/entrants.tsx` | 🔄 Enhance in **Wave 4 (`TODO-017`)** | Public Start List & Entrants: Searchable/filterable roster; **Wave 4** upgrades rows to open the **Slide-Over Telemetry Sheet** + `"Following (N)"` star toggle. |
| `/events/$slug/results` | `src/routes/events/$slug/results.tsx` | 🔄 Enhance in **Wave 4 (`TODO-017`)** | Official Leaderboard & Split Matrix: Place, Bib/Plate/Car #, Athlete link, ordered checkpoint splits, finish metric; **Wave 4** adds **Slide-Over Telemetry Sheet** + watchlist filter. |
| `/events/$slug/entrants/$entrantId` | `src/routes/events/$slug/entrants/$entrantId.tsx` | 📋 Planned in **Wave 4 (`TODO-017`)** | **Canonical Shareable Individual Entrant Live Effort Page**: Deep-linkable runner/crew telemetry view with **Unified Split & Projection Timeline** (actual Time of Day, Elapsed, Segment Pace, Dwell, and Place transitioning seamlessly into shaded **Projected Arrival Windows `Earliest – Expected – Latest`** with Cutoff Margin badges), SVG elevation profile, and `time_allowances` credits. |
| `/events/$slug/course` | `src/routes/events/$slug/course.tsx` | ✅ Built (`TODO-010`) | Event Course & Cutoffs Table: Ordered public `course_splits` (`isSecretCheckpoint = false`), distances, elevations, `IN`/`OUT` bitmaps, cutoff limits, CTA to `/courses/$courseId`. |
| `/events/$slug/crew` | `src/routes/events/$slug/crew.tsx` | ✅ Built (`TODO-010`) | Crew Access Gating Board: Upstream gating checkpoints and live runner clearance status for support crews. |
| `/courses/$courseId` | `src/routes/courses/$courseId.tsx` | ✅ Built (`TODO-010`) | Canonical Public Course Home + Exclusive **"Plan My Effort" Pace Calculator**: Course metadata, provenance link, interactive target finish / start time / strategy calculator, topographic split table, and events held on course. |
| `/athletes` | `src/routes/athletes/index.tsx` | ✅ Built (`TODO-010`) | Public Athlete Directory: Search & filter `people` by name, experience tier (`novice`, `intermediate`, `veteran`, `elite`), and discipline. |
| `/athletes/$personId` | `src/routes/athletes/$personId.tsx` | ✅ Built (`TODO-010`) | Public Athlete Dossier: Career summary tiles (`person_historical_summaries`), verified external profiles (`UltraSignup`, `ITRA`, `Strava`, `DUV`), active race callout, and lifetime `person_race_history` + `entrants` table. |
| `/organizers/$slug` | `src/routes/organizers/$slug.tsx` | ✅ Built (`TODO-010`) | Public Organization Storefront: Summary counters, Live & Upcoming Event Groups, Historical Race Archive, and Published Courses. |
| `/for-organizers` | `src/routes/for-organizers.tsx` | ✅ Built (`TODO-010`) | Persona landing page for Race Directors & Timing Stewards. |
| `/for-volunteers` | `src/routes/for-volunteers.tsx` | ✅ Built (`TODO-010`) | Persona landing page for Field Volunteers, Checkpoint Captains & Ham Radio Operators. |
| `/for-athletes` | `src/routes/for-athletes.tsx` | ✅ Built (`TODO-010`) | Persona landing page for Endurance Athletes, Pacers & Support Crews. |
| `/about` | `src/routes/about.tsx` | ✅ Built (`TODO-009`/`010`) | Platform Mission, OpenSplitTime + TRacer Heritage & Paper & Topo Design Philosophy. |

### 3.2 Authentication & 3-Tab Personal Account Routes (6 Routes)

| Route Path | File Location | Status | Purpose & Key Capabilities |
|---|---|---|---|
| `/sign-in` | `src/routes/sign-in.tsx` | ✅ Built | Email/password, Magic Link, Passkey, and Social OAuth (`Google`, `Strava`) sign-in. |
| `/sign-up` | `src/routes/sign-up.tsx` | ✅ Built | Account creation with automatic `ensurePersonForUser` email-based identity linking. |
| `/forgot-password` | `src/routes/forgot-password.tsx` | ✅ Built | Password reset request flow. |
| `/reset-password` | `src/routes/reset-password.tsx` | ✅ Built | Password reset completion flow. |
| `/accept-invitation/$invitationId` | `src/routes/_authed/accept-invitation/$invitationId.tsx` | ✅ Built | Organization invitation acceptance screen. |
| `/account` | `src/routes/_authed/account.tsx` | 🔄 Complete in **Wave 1 (`TODO-014`)** | **3-Tab Athlete & Volunteer Account Hub**: Tab 1: `My Athlete Profile & External Links` (`people` demographics, public `/athletes/$personId` preview card, self-service UltraSignup/ITRA/Strava/DUV/Athlinks profile linking); Tab 2: `My Races & Volunteer Shifts` (upcoming/past entrant registrations + assigned aid station volunteer shifts with 1-click launch into Field Logger / Station Cross-Check); Tab 3: `Security & Connected Accounts` (Passkeys, Google/Strava OAuth, Active Sessions). |

### 3.3 Unified Organization & Event Group Workspace Routes (`/_authed/orgs/$slug/*` — 20 Routes)

| Route Path | File Location | Status | Purpose & Key Capabilities |
|---|---|---|---|
| `/orgs` | `src/routes/_authed/orgs/index.tsx` | ✅ Built | User's Organization Memberships & Event Group Staffing assignments hub. |
| `/orgs/new` | `src/routes/_authed/orgs/new.tsx` | ✅ Built | Create new organization with live slug generation and collision checks. |
| `/orgs/$slug` (Layout) | `src/routes/_authed/orgs/$slug/route.tsx` | 🔄 Upgrade in **Wave 1 (`TODO-014`)** | **Collapsible Left Sidebar Shell**: Organization switcher/header, Org navigation (`Overview`, `Courses Library`, `Timing Points`, `Members`, `Settings`), and expandable **Nested Event Groups Tree** (`/orgs/$slug/event-groups/$eventGroupSlug` + `+ New Event Group`). |
| `/orgs/$slug/` | `src/routes/_authed/orgs/$slug/index.tsx` | ✅ Built | Organization Overview: Quick counts, upcoming event groups, recent courses, and staffing summary. |
| `/orgs/$slug/courses` | `src/routes/_authed/orgs/$slug/courses/index.tsx` | 🔄 Complete in **Wave 1 (`TODO-014`)** | **Courses Library**: Create Course, **Clone / Copy Course (`copiedFromCourseId`)** with deep copy of `course_splits`, delete course (with FK guard), and links to `/orgs/$slug/courses/$courseId` and public `/courses/$courseId`. |
| `/orgs/$slug/courses/$courseId` | `src/routes/_authed/orgs/$slug/courses/$courseId.tsx` | 📋 Planned in **Wave 1 (`TODO-014`)** | **Course Detail & Shared Course Split Builder**: Edit course metadata (`name`, `distanceMeters`, `elevationGainMeters`, `gpxRouteUrl`), 1-click `"Generate Start + Finish Splits"` starter on empty courses, inline `"+ Create New Timing Point"` modal saving directly to the Org library, Up/Down split reorder, and discipline-adaptive TSD columns. |
| `/orgs/$slug/timing-points` | `src/routes/_authed/orgs/$slug/timing-points.tsx` | 🔄 Complete in **Wave 1 (`TODO-014`)** | **Physical Timing Points Library**: Full GPS (`latitude`, `longitude`) and `elevationMeters` inputs on create, inline row editing (`updateTimingPoint`), and safe deletion (`deleteTimingPoint` checking `course_splits` usage). |
| `/orgs/$slug/event-groups` | `src/routes/_authed/orgs/$slug/event-groups/index.tsx` | 🔄 Complete in **Wave 1 (`TODO-014`)** | **Event Groups Directory & Creator**: List, create, inline edit (`name`, `slug`, `discipline`, `startDate`, `endDate`), delete (with FK guard), link to public `/events/$slug`, and open `/orgs/$slug/event-groups/$eventGroupSlug`. |
| `/orgs/$slug/members` | `src/routes/_authed/orgs/$slug/members.tsx` | ✅ Built | Organization Members & Pending Invitations manager (invite, role assignment, revoke/remove). |
| `/orgs/$slug/settings` | `src/routes/_authed/orgs/$slug/settings.tsx` | 🔄 Complete in **Wave 1 (`TODO-014`)** | **Organization Settings**: Edits `name`, `slug`, `logo` URL, and JSON-safe `metadata` (`description`, `location`, `timeZone`, `website`, `establishedYear` via `parseOrganizationMeta`) surfaced on `/organizers/$slug`. |
| `/orgs/$slug/event-groups/$eventGroupSlug` (Layout) | `src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/route.tsx` | 📋 Planned in **Wave 2 (`TODO-015`)** | **Event Group Top Bar Shell**: Renders the horizontal Sub-Event Bar (`[ All Events (Weekend Hub) ]` \| `[ 100M ]` \| `[ 50K ]` \| `[ + Add Event ]`) + primary **"Launch Field Logger"** button on the right, plus contextual sub-tabs below. |
| `/orgs/$slug/event-groups/$eventGroupSlug/` | `src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/index.tsx` | 📋 Planned in **Wave 2 (`TODO-015`)** | **Weekend Hub Tab 1 — `Weekend Overview & Readiness`**: Combined KPIs across all distances, wave/gun clocks, sub-event cards, and pre-race readiness checklist. |
| `/orgs/$slug/event-groups/$eventGroupSlug/rules-staff` | `src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/rules-staff.tsx` | 📋 Planned in **Wave 2 (`TODO-015`)** | **Weekend Hub Tab 2 — `Discipline Rules & Staff Matrix`**: Interactive `event_groups.rulesConfig` editor (E1–E5, pacer/allowance rules) + assigning `event_group_staff` to `timing_points` (`event_group_staff_timing_points`). |
| `/orgs/$slug/event-groups/$eventGroupSlug/stations` | `src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/stations/index.tsx` | 📋 Planned in **Wave 3 (`TODO-016`)** | **Weekend Hub Tab 3 — `Combined Aid Stations Cross-Check` (Overview)**: Station custody matrix across all distances with per-station counts (`Expected Next`, `In Station Now`, `Departed`, `Stopped / DNF`). |
| `/orgs/$slug/event-groups/$eventGroupSlug/stations/$timingPointId` | `src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/stations/$timingPointId.tsx` | 📋 Planned in **Wave 3 (`TODO-016`)** | **Weekend Hub Tab 3 (Station Detail) — `Interactive Bib Number Grid & Sortable Table`**: Grouped into `Expected Next`, `In Station Now` (w/ live dwell timer), `Departed`, and `Stopped / DNF`; tapping any Bib card opens a quick action popover (`Record IN` / `Record OUT` / `Stopped Here`), plus 1-click toggle to a Sortable Table with projection timestamps & SAR risk badges. |
| `/orgs/$slug/event-groups/$eventGroupSlug/sar` | `src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/sar.tsx` | 📋 Planned in **Wave 3 (`TODO-016`)** | **Weekend Hub Tab 4 — `Combined Net Control & SAR Triage`**: Course Segment Progress funnel on top + Stage 1 Overdue Between Checkpoints & Stage 2 Lingering Inside Aid Station / Retired alert cards + **Slide-Over Emergency & Medical Triage Sheet**. |
| `/orgs/$slug/event-groups/$eventGroupSlug/raw-stream` | `src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/raw-stream.tsx` | 📋 Planned in **Wave 3 (`TODO-016`)** | **Weekend Hub Tab 5 — `Raw Timing Stream`**: Live `raw_timing_events` feed across all stations/sources with status filter and hardware/manual inspection. |
| `/orgs/$slug/event-groups/$eventGroupSlug/logger` | `src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/logger.tsx` | 📋 Planned in **Wave 3 (`TODO-016`)** | **Dedicated Full-Screen Field Volunteer Logger**: Kiosk layout (`100dvh`) with `"← Back to Race Control"` exit button. **Responsive Split Layout**: Phone shows 10-Key Keypad + Live Typo-Defense HUD on main screen with bottom sheet/pill for `Recent Punches & Unassigned FIFO Placeholders` + top header icon for `Outbox / MT63 Radio Sync`; Tablet/Desktop shows Keypad on left and Recent Punches & FIFO Chute queue side-by-side on right. |
| `/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId` (Layout & Sub-Tabs) | `src/routes/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/*` | 📋 Planned in **Waves 2–4 (`TODO-015`–`017`)** | **Specific Sub-Event Workspace (`[ 100M ]`, `[ 50K ]`)**: 5 sub-tabs scoped to that distance: `1. Overview & Gun Start` (`index.tsx`), `2. Course & Cutoffs` (`course.tsx` with shared Course Split Builder), `3. Entrants & Check-In` (`entrants.tsx` with Mode 1 Roster/CSV + 3-Section Edit Entrant Modal & Mode 2 Check-In Desk), `4. Live Progress & SAR` (`sar.tsx`), and `5. Results, Audit & Exports` (`audit.tsx` Split-Pane Forensic Workstation + Post-Race Exports). |

### 3.4 System & Developer Diagnostic Routes (3 Routes)

| Route Path | File Location | Status | Purpose & Key Capabilities |
|---|---|---|---|
| `/manage-db` | `src/routes/manage-db.tsx` | ✅ Built (`TODO-001`–`006`) | Interactive 25-table schema dictionary & live database explorer. |
| `/hello` | `src/routes/hello.tsx` | ✅ Built | ElectricSQL local-first sync diagnostic page. |
| `/redis` | `src/routes/redis.tsx` | ✅ Built (`TODO-009`) | Redis connectivity & latency diagnostic page. |

---

## 4. Complete 25-Table Database-to-UI Coverage Matrix

Every table in `src/db/schema.ts` and `src/db/auth-schema.ts` is mapped below to its Public Read UI, Authenticated Read/Write UI, and target completion Wave:

| # | Database Table | Domain | Current UI Coverage | Gap Completed In | Target Route(s) for Full Lifecycle |
|---|---|---|---|---|---|
| 1 | `users` | Auth | `/sign-in`, `/sign-up`, `/account` | ✅ Complete | `/account` (Tab 3), `/orgs/$slug/members` |
| 2 | `sessions` | Auth | `/account` (list & revoke sessions) | ✅ Complete | `/account` (Tab 3: `Security & Connected Accounts`) |
| 3 | `accounts` | Auth | `/account` (link/unlink Google & Strava) | ✅ Complete | `/account` (Tab 3: `Security & Connected Accounts`) |
| 4 | `verifications` | Auth | `/forgot-password`, `/reset-password` | ✅ Complete | Auth flows |
| 5 | `passkeys` | Auth | `/account` (add/remove WebAuthn passkeys) | ✅ Complete | `/account` (Tab 3), `/sign-in` |
| 6 | `organizations` | Org Core | `/organizers/$slug` (public), `/orgs`, `/orgs/new`, `/orgs/$slug/settings` | **Wave 1 (`TODO-014`)** | Add `logo` & JSON-safe `metadata` (`parseOrganizationMeta`) editing in `/orgs/$slug/settings` |
| 7 | `organization_members` | Org Core | `/orgs/$slug/members` | ✅ Complete | `/orgs/$slug/members` |
| 8 | `organization_invitations` | Org Core | `/orgs/$slug/members`, `/accept-invitation/$invitationId` | ✅ Complete | `/orgs/$slug/members` |
| 9 | `timing_points` | Org Assets | `/events/$slug/course` (public), `/orgs/$slug/timing-points` (basic create) | **Wave 1 (`TODO-014`)** | Full GPS (`latitude`, `longitude`), `elevationMeters`, inline edit, safe delete (FK check), plus **inline quick-create inside the Course Split Builder** |
| 10 | `courses` | Org Assets | `/courses/$courseId` (public), `/orgs/$slug/courses` (read-only list) | **Wave 1 (`TODO-014`)** & **Wave 2 (`TODO-015`)** | Create, edit, delete (FK check), and **Clone (`copiedFromCourseId`)** in `/orgs/$slug/courses`, `/orgs/$slug/courses/$courseId`, and Sub-Event `Course & Cutoffs` |
| 11 | `course_splits` | Org Assets | `/courses/$courseId`, `/events/$slug/course`, `/events/$slug/crew` | **Wave 1 (`TODO-014`)** & **Wave 2 (`TODO-015`)** | Shared **Course Split Builder** (`Generate Start + Finish Splits`, inline Timing Point create, negative-offset transactional reorder, discipline-adaptive TSD columns) in `/orgs/$slug/courses/$courseId` and Sub-Event `Course & Cutoffs` |
| 12 | `event_groups` | Race Core | `/`, `/events`, `/events/$slug/*`, `/orgs/$slug/event-groups` | **Wave 1 (`TODO-014`)** & **Wave 2 (`TODO-015`)** | Wave 1: Left sidebar nested tree + CRUD in `/orgs/$slug/event-groups`; Wave 2: `rulesConfig` editor in `/orgs/$slug/event-groups/$eventGroupSlug/rules-staff` |
| 13 | `events` | Race Core | `/events/$slug/*` | **Wave 1 (`TODO-014`)** & **Wave 2 (`TODO-015`)** | Wave 1: Server CRUD functions; Wave 2: Top Horizontal Sub-Event Bar (`[100M]`, `[50K]`, `[+ Add Event]`) & `Overview & Gun Start` (`actualStart`) |
| 14 | `people` | Identity | `/athletes`, `/athletes/$personId`, `/account` (name only) | **Wave 1 (`TODO-014`)** & **Wave 2 (`TODO-015`)** | Wave 1: Tab 1 `My Athlete Profile & External Links` in `/account`; Wave 2: Entrant & Emergency Contact sections in the 3-Section Edit Entrant Modal |
| 15 | `event_group_staff` | Staffing | `/account` (Tab 2), `/orgs` | **Wave 1 (`TODO-014`)** & **Wave 2 (`TODO-015`)** | Wave 1: `/account` Tab 2 `My Races & Volunteer Shifts`; Wave 2: `Discipline Rules & Staff Matrix` (`/rules-staff`) |
| 16 | `event_group_staff_timing_points` | Staffing | `/account` (Tab 2) | **Wave 1 (`TODO-014`)** & **Wave 2 (`TODO-015`)** | Wave 1: 1-click shift launch in `/account` Tab 2; Wave 2: Station assignment matrix in `/rules-staff` |
| 17 | `entrants` | Race Ops | `/events/$slug/entrants`, `/events/$slug/results` | **Wave 2 (`TODO-015`)**, **Wave 3 (`TODO-016`)**, **Wave 4 (`TODO-017`)** | Wave 2: Sub-Event `Entrants & Check-In` (Mode 1 Roster/CSV + 3-Section Modal, Mode 2 Check-In Desk); Wave 3: Station/Logger drops (`dnf`, `retired`); Wave 4: Public `/events/$slug/entrants/$entrantId` |
| 18 | `raw_timing_events` | Write Plane | Weekend Hub & Logger | **Wave 3 (`TODO-016`)** & **Wave 4 (`TODO-017`)** | Wave 3: Full-screen Field Logger (`/logger`), Station Cross-Check quick actions, and Weekend Hub `Raw Timing Stream`; Wave 4: Split-Pane Forensic Workstation Raw Event Inspector |
| 19 | `scored_split_times` | Read Plane | `/events/$slug/results`, `/events/$slug/index` | **Wave 3 (`TODO-016`)** & **Wave 4 (`TODO-017`)** | Wave 3: Live scoring projection + Station Cross-Check Bib Grid (`Expected Next`, `In Station Now`, `Departed`, `Stopped / DNF`); Wave 4: Split-Pane Forensic Workstation & Public Unified Split/Projection Timeline |
| 20 | `time_allowances` | Race Ops | `/manage-db` only | **Wave 4 (`TODO-017`)** | Grant/edit/revoke time allowances inside the Sub-Event `Results, Audit & Exports` Split-Pane Workstation + display credit on Public Entrant Effort view |
| 21 | `split_time_audits` | Audit | `/manage-db` only | **Wave 4 (`TODO-017`)** | Immutable forensic audit log written with mandatory `changeReason` on every split Confirm/Edit/Insert/Rebuild in the Split-Pane Workstation |
| 22 | `person_external_profiles` | History | `/athletes/$personId` (read-only verified badges) | **Wave 1 (`TODO-014`)** & **Wave 2 (`TODO-015`)** | Wave 1: Athlete self-linking in `/account` Tab 1 (with unique index collision handling); Wave 2: Steward approval/rejection inside Section 3 (`External History & Pacing Projections`) of the 3-Section Edit Entrant Modal |
| 23 | `person_race_history` | History | `/athletes/$personId` (read-only career table) | **Wave 2 (`TODO-015`)** & **Wave 4 (`TODO-017`)** | Wave 2: Inspect inside Section 3 of Edit Entrant Modal; Wave 4: Auto-append official finishes on post-race certification |
| 24 | `person_historical_summaries` | History | `/athletes`, `/athletes/$personId` | **Wave 2 (`TODO-015`)** & **Wave 3 (`TODO-016`)** | Wave 2: Inspect & recompute in Edit Entrant Modal; Wave 3: Surface `dnfRate`, `experienceTier`, and `safetyTriageNotes` in SAR Slide-Over Triage Sheet |
| 25 | `entrant_historical_projections` | History / SAR | `/events/$slug/entrants` (`projectedFinishSeconds`) | **Wave 2 (`TODO-015`)**, **Wave 3 (`TODO-016`)**, **Wave 4 (`TODO-017`)** | Wave 2: Recompute in Edit Entrant Modal + Roster table; Wave 3: Station Cross-Check Table & SAR Stage 1 Overdue alerts; Wave 4: Public **Unified Split & Projection Timeline** (`Earliest – Expected – Latest`) |

---

## 5. `solid-ui` Component Inventory & Planned Primitives

### 5.1 Existing `solid-ui` Components (`src/components/ui/*`)
All 16 existing components are built on `@kobalte/core` and styled with Paper & Topo semantic tokens (zero `backdrop-blur`, zero `transition-all`):
- `Alert`, `AlertTitle`, `AlertDescription` (`ui/alert.tsx`)
- `Badge` (`ui/badge.tsx` — `default`, `secondary`, `destructive`, `outline`, `forest`, `sage`, `clay`, `sand`, `chip`)
- `Button` (`ui/button.tsx` — `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `pill`)
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction` (`ui/card.tsx`)
- `Checkbox` (`ui/checkbox.tsx`)
- `DropdownMenu` suite (`ui/dropdown-menu.tsx`)
- `Input` (`ui/input.tsx`)
- `NavigationMenu` suite (`ui/navigation-menu.tsx`)
- `Progress`, `ProgressLabel`, `ProgressValueLabel` (`ui/progress.tsx`)
- `Select` suite (`ui/select.tsx`) + `FormSelect` (`components/FormSelect.tsx`)
- `Separator` (`ui/separator.tsx`)
- `Table` suite (`ui/table.tsx`)
- `Tabs` suite (`ui/tabs.tsx`)
- `TextField` suite (`ui/text-field.tsx`)
- `Textarea` (`ui/textarea.tsx`)

### 5.2 Planned Additional `solid-ui` Components Across Waves 1–4
To maintain 100% adherence to the **`solid-ui` First Rule**, new interactive overlays and controls will be added as genuine Kobalte-backed `solid-ui` components in `src/components/ui/` using Kobalte's `data-[checked]:*`, `data-[expanded]:*`, and `data-[closed]:*` selectors (never unconfigured `ui-*` prefixes) and zero `backdrop-blur` / zero `transition-all`:
- **Wave 1 (`TODO-014`):**
  - `Dialog` (`src/components/ui/dialog.tsx` on `@kobalte/core/dialog`) for Course Clone, Inline Timing Point Creation (`"+ Create New Timing Point"`), Delete confirmations, and Wave 2's Compact 3-Section Edit Entrant Modal.
  - `Switch` (`src/components/ui/switch.tsx` on `@kobalte/core/switch`) for boolean toggles (`isSecretCheckpoint`, `allowSelfCheckIn`, `requirePacerRegistration`).
- **Wave 2 (`TODO-015`):**
  - `Collapsible` (`src/components/ui/collapsible.tsx` on `@kobalte/core/collapsible`) for the Left Sidebar's expandable Event Groups tree and CSV import preview panels.
- **Wave 3 & 4 (`TODO-016` / `TODO-017`):**
  - `Popover` (`src/components/ui/popover.tsx` on `@kobalte/core/popover`) for the Aid Station Cross-Check Bib card quick-action popover (`Record IN` / `Record OUT` / `Stopped Here`).
  - `Sheet` / Slide-Over Drawer (`src/components/ui/sheet.tsx` on `@kobalte/core/dialog` with slide-over positioning) for the **Slide-Over Emergency & Medical Triage Sheet** in SAR Triage, the mobile bottom sheet in the Field Logger, and the **Public Individual Entrant Slide-Over Telemetry Sheet** on `/events/$slug/results` and `/events/$slug/entrants`.

---

## 6. 4-Wave Sequential Full-Stack Rollout Strategy

| Wave | TODO ID | Scope Summary | Primary Routes Created / Completed |
|---|---|---|---|
| **Wave 1** | [`TODO-014`](../../todos/pending/TODO-014.md) | **Collapsible Left Sidebar, Shared Course & Split Builder (with Inline Timing Point Creation) & 3-Tab Athlete Account Hub** | `/orgs/$slug/route.tsx`, `/orgs/$slug/courses`, `/orgs/$slug/courses/$courseId`, `/orgs/$slug/timing-points`, `/orgs/$slug/event-groups`, `/orgs/$slug/settings`, `/account` |
| **Wave 2** | [`TODO-015`](../../todos/pending/TODO-015.md) | **Event Group Top Sub-Event Bar, Weekend Hub (`Overview`, `Discipline Rules & Staff Matrix`) & Sub-Event Pre-Race Workspace (`Gun Start`, `Course & Cutoffs`, `Entrants & Check-In` with 2-Mode Switcher & 3-Section Entrant Modal)** | `/orgs/$slug/event-groups/$eventGroupSlug/route.tsx`, `index.tsx`, `rules-staff.tsx`, and `/events/$eventId/route.tsx`, `index.tsx`, `course.tsx`, `entrants.tsx` |
| **Wave 3** | [`TODO-016`](../../todos/pending/TODO-016.md) | **Field Operations — Interactive Bib Grid & Table Aid Station Cross-Check, Responsive Full-Screen Field Volunteer Logger & Funnel + Two-Stage SAR Triage** | `/orgs/$slug/event-groups/$eventGroupSlug/stations/*`, `/sar`, `/raw-stream`, `/logger`, and `/events/$eventId/sar` |
| **Wave 4** | [`TODO-017`](../../todos/pending/TODO-017.md) | **Split-Pane Forensic Audit Workstation, Time Allowances, Post-Race Certification/Exports & Public Unified Split/Projection Timeline + Watchlist Ribbon** | `/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/audit`, `/events/$slug/entrants/$entrantId`, plus Slide-Over Telemetry Sheet & `"Following (N)"` Watchlist Ribbon on `/events/$slug/*` |
