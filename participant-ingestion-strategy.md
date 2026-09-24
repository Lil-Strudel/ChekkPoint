# ChekkPoint Participant History Ingestion & Pacing Strategy

**Document Status:** Production Architectural Specification  
**Version:** 1.0.0  
**Scope:** Background Ingestion, Multi-Factor Disambiguation Algorithm (MFDA), Predictive Pacing & Volunteer Safety Engine  
**Target Platform:** Railway Distributed Workers, Redis (BullMQ), PostgreSQL 16 (Drizzle ORM)  

---

## 1. Domain Separation & Entity Hierarchy

### 1.1 The Lifetime Biological Human vs. The Ephemeral Event Entry

A foundational architectural principle in ChekkPoint is the strict ontological separation between:
1. **The Biological Human (`people`):** A physical individual who persists across years, sports, geographical moves, and platform profiles. Lifetime athletic capability, historical race finishes, DNFs, training volume, and external platform accounts belong exclusively to `people`.
2. **The Event Competitor (`entrants`):** An ephemeral, event-scoped competitive entry binding a person to a specific course, event weekend, division, and physical bib number with event-specific rules, gear, and actual start waves.
3. **The Projected Performance (`entrant_historical_projections`):** An event-specific materialized calculation combining a person's historical capability with the specific topology, elevation, weather, and cutoffs of the active race course.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CHEKKPOINT ENTITY HIERARCHY                               │
└────────────────────────────────────────────────────────────────────────────────────────┘

                            ┌───────────────────────────────┐
                            │            people             │
                            │  (Lifetime Biological Human)  │
                            └───────────────┬───────────────┘
                                            │
        ┌───────────────────────────────────┼───────────────────────────────────┐
        │ 1                                 │ 1                                 │ 1
        ▼ *                                 ▼ *                                 ▼ 1
┌───────────────────────────────┐   ┌───────────────────────────────┐   ┌───────────────────────────────┐
│   person_external_profiles    │   │      person_race_history      │   │  person_historical_summaries  │
├───────────────────────────────┤   ├───────────────────────────────┤   ├───────────────────────────────┤
│ • platform (ultrasignup, etc) │   │ • race_name & race_date       │   │ • total_races / total_finishes│
│ • external_identifier / url   │   │ • distance_meters / elevation │   │ • dnf_rate (e.g. 0.08)        │
│ • verification_status         │   │ • elapsed_seconds             │   │ • max_distance / max_elev     │
│ • match_confidence (0-100)    │   │ • status (finished, dnf, ...) │   │ • experience_tier (veteran..) │
│ • raw_payload (JSONB)         │   │ • overall_place / gender_place│   │ • ultrasignup_rank / itra_idx │
└───────────────┬───────────────┘   └───────────────────────────────┘   └───────────────────────────────┘
                │ 1
                │ * (Provenance)
                ▼
        ┌───────────────────────────────┐
        │           entrants            │
        │   (Event-Scoped Entry)        │
        ├───────────────────────────────┤
        │ • event_id                    │
        │ • person_id                   │
        │ • competitor_number (bib)     │
        │ • emergency_contact_person_id │
        │ • actual_start_time           │
        └───────────────┬───────────────┘
                        │ 1
                        │ 1
                        ▼
        ┌───────────────────────────────────────────────────────────────┐
        │                 entrant_historical_projections                │
        │            (Materialized Event Pacing & SAR Model)            │
        ├───────────────────────────────────────────────────────────────┤
        │ • projected_finish_seconds                                    │
        │ • projected_pace_seconds_per_km                               │
        │ • projected_arrival_times (JSONB split arrival ETA schedule)   │
        │ • confidence_band_low_seconds / high_seconds                   │
        │ • expected_cutoff_risk (boolean)                              │
        │ • volunteers_sar_safety_badge (FIRST_TIMER, CUTOFF_WATCH, ...)│
        └───────────────────────────────────────────────────────────────┘
```

### 1.2 Operational Benefits of Domain Separation
- **Tenant Isolation with Shared Human Intelligence:** When an athlete races an ultra hosted by Promoter A in Colorado and next month enters a gravel race hosted by Promoter B in Utah, their `people` record and historical summary persist seamlessly without duplicating or overwriting event-specific registration data.
- **Zero Ingestion Impact on Live Timing:** Ingesting 50 previous race finishes for 2,000 registered runners populates `person_race_history` completely decoupled from `scored_split_times` or `raw_timing_events`.
- **Surgical Emergency Contact Resolution:** Because emergency contacts are also first-class `people` records (holding the `'emergency_contact'` role), an entrant directly references their contact via `entrants.emergencyContactPersonId` with `onDelete: "set null"`. This eliminates join overhead on field tablets while maintaining complete identity normalization.

---

## 2. Distributed Queue Engine & Background Worker Architecture

Participant ingestion and historical scraping run on **Railway Background Workers** powered by **BullMQ on Redis**. Scraping external endurance databases requires strict concurrency bounds, respectful crawl pacing, and jittered exponential backoff to avoid IP blocking.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                DISTRIBUTED INGESTION PIPELINE                           │
└─────────────────────────────────────────────────────────────────────────────────────────┘

   [Roster Ingest / CSV / Webhook]
                 │
                 ▼
     ┌───────────────────────┐
     │   discovery-queue     │  ◄── Enqueues athlete name, age, city/state, platform hints
     └───────────┬───────────┘
                 │ Worker (Concurrency: 5, Polite Rate Limit: 1 req/sec per platform domain)
                 ▼
    [Multi-Factor Disambiguation]
                 │
      ┌──────────┴──────────┐
      │ Candidate Matched?  │
      ├─────────────────────┤
      │ ≥ 85%: Auto-Verified│ ──► [Save person_external_profiles]
      │ 60-84%: Candidate   │ ──► [Save as 'candidate_matched' for Steward Review]
      │ < 60%: Discard      │ ──► [Log audit record, abort]
      └──────────┬──────────┘
                 │ (If Auto-Verified or Manually Confirmed)
                 ▼
     ┌───────────────────────┐
     │      fetch-queue      │  ◄── Enqueues verified external profile ID & target URL
     └───────────┬───────────┘
                 │ Worker (Concurrency: 3, Jittered Backoff: 2s base + random [0..1000ms])
                 ▼
      [Platform Scrape/API]  ──► UltraSignup REST / Strava OAuth / DUV / ITRA
                 │
                 ▼
       [Save Raw History]    ──► Populates person_race_history rows (idempotent ON CONFLICT)
                 │
                 ▼
     ┌───────────────────────┐
     │    summarize-queue    │  ◄── Enqueues personId to recompute intelligence rollup
     └───────────┬───────────┘
                 │ Worker (Concurrency: 10, Pure CPU Math & DB Aggregation)
                 ▼
    [Historical Summary Calc]──► Computes career stats, DNF rate, experience_tier
                 │
                 ▼
    [Pacing Projection Calc] ──► Combines summary with course GPX & elevation profile
                                 Populates entrant_historical_projections
```

### 2.1 The Three Dedicated BullMQ Queues

| Queue Name | Responsibilities | Rate Limit & Concurrency | Retry / Failure Policy |
|---|---|---|---|
| **`discovery-queue`** | Queries external search endpoints using candidate name, state, and age tokens. Calculates initial candidate matches. | Concurrency: 5.<br>Strict 1.0 req/sec per target domain via Redis token bucket. | 3 retries, exponential backoff (initial delay: 5s). Failures marked as `failed` in profile record. |
| **`fetch-queue`** | Fetches detailed race result arrays, splits, and platform ranks from verified profile URLs. | Concurrency: 3.<br>Polite delay: 1,500ms between calls + random jitter $[0, 1000]\text{ms}$. | 5 retries with jittered backoff. HTTP 429 triggers `rate_limited` status and halts domain worker for 120s. |
| **`summarize-queue`** | Computes career aggregate metrics, assigns `experienceTier`, and runs the course GPX pacing projection model. | Concurrency: 10.<br>Pure database aggregation and numerical modeling. | Immediate retry on DB serialization conflict; idempotent execution. |

### 2.2 Polite Crawler Hygiene & Rate Limiting
- **Global Domain Mutex:** Redis keys (`ratelimit:ultrasignup`, `ratelimit:duv`) track domain token buckets. A worker must acquire a lease before initiating any outbound HTTP request.
- **User-Agent Standard:** Outbound requests identify as:  
  `User-Agent: ChekkPoint-Intelligence/1.0 (+https://chekkpoint.live/bot-info; safety-ingest@chekkpoint.live)`
- **Header Caching (`ETag` / `If-Modified-Since`):** External profiles store HTTP `ETag` and `lastScrapedAt`. Repeat fetches skip unchanged payloads.
- **Fail-Safe Circuit Breaker:** If 3 consecutive HTTP 429 (Too Many Requests) responses occur on any platform adapter, that platform's queue enters a 10-minute circuit breaker pause, alerting Net Control.

---

## 3. Multi-Factor Disambiguation Algorithm (MFDA)

A catastrophic failure mode in endurance timing is the **Identity Collision False Positive**—attributing a sub-20-hour 100-mile performance belonging to an elite athlete to an inexperienced hobbyist with the same name, or vice versa. This leads to invalid cutoff predictions, missing medical warnings, or erroneous typo-detection overrides.

The ChekkPoint **Multi-Factor Disambiguation Algorithm (MFDA)** scores candidate profiles on a deterministic scale $[0.00, 100.00]$.

### 3.1 Mathematical Formulation

$$\text{Score}_{\text{MFDA}} = \Phi(\text{Gender}) \times \left[ w_{\text{last}} S_{\text{last}} + w_{\text{first}} S_{\text{first}} + w_{\text{age}} S_{\text{age}} + w_{\text{geo}} S_{\text{geo}} \right]$$

Where:
- $\Phi(\text{Gender}) \in \{0.00, 1.00\}$ is the **Strict Gender Invariant Gate (Hard Veto)**.
- $w_{\text{last}} = 0.35$ (Surname Exact / Levenshtein Similarity)
- $w_{\text{first}} = 0.25$ (Given Name Phonetic Metaphone & Jaro-Winkler)
- $w_{\text{age}} = 0.25$ (Year of Birth / Age Delta Scoring)
- $w_{\text{geo}} = 0.15$ (State / Province / Country Geocoding)

$$\sum w_i = 0.35 + 0.25 + 0.25 + 0.15 = 1.00$$

---

### 3.2 Dimension Scoring Functions

#### 1. Strict Gender Invariant Gate ($\Phi$)
If both the entrant registration and the external profile specify biological or competitive gender, they must agree:
$$\Phi(\text{Gender}) = \begin{cases} 
1.00 & \text{if } G_{\text{local}} = G_{\text{ext}} \lor G_{\text{local}} = \text{'unspecified'} \lor G_{\text{ext}} = \text{'unspecified'} \\
0.00 & \text{if } G_{\text{local}} \neq G_{\text{ext}} \quad \text{(HARD VETO — Immediate Rejection)}
\end{cases}$$

#### 2. Surname Similarity ($S_{\text{last}}$)
Computed via normalized Levenshtein Distance ($LD$):
$$S_{\text{last}} = \max\left(0, 1 - \frac{LD(L_{\text{local}}, L_{\text{ext}})}{\max(|L_{\text{local}}|, |L_{\text{ext}}|)}\right) \times 100$$

#### 3. Given Name Phonetic & String Match ($S_{\text{first}}$)
Nicknames and phonetic variants (e.g. "Mike" vs. "Michael", "Bob" vs. "Robert", "Cate" vs. "Katherine") are resolved using a two-stage evaluation:
- Stage A (Phonetic): Double Metaphone primary and secondary keys. If $\text{DM}(F_{\text{local}}) = \text{DM}(F_{\text{ext}})$, base score = $90.0$.
- Stage B (Jaro-Winkler): $S_{\text{JW}} = \text{JaroWinkler}(F_{\text{local}}, F_{\text{ext}}) \times 100$.
- Stage C (Known Nickname Dictionary): Curated alias lookup table (e.g. "Bill" $\leftrightarrow$ "William" yields $95.0$).

$$S_{\text{first}} = \max\left(S_{\text{phonetic}}, S_{\text{JW}}, S_{\text{alias}}\right)$$

#### 4. Age & Year-of-Birth Proximity ($S_{\text{age}}$)
Let $\Delta_{\text{age}} = |\text{Age}_{\text{local}} - \text{Age}_{\text{ext}}|$ (or $|\text{YOB}_{\text{local}} - \text{YOB}_{\text{ext}}|$ when birth years are present):
$$S_{\text{age}} = \begin{cases}
100.0 & \text{if } \Delta_{\text{age}} = 0 \\
90.0 & \text{if } \Delta_{\text{age}} = 1 \quad \text{(Crossing calendar/birthday threshold during season)} \\
45.0 & \text{if } \Delta_{\text{age}} = 2 \\
0.0 & \text{if } \Delta_{\text{age}} \ge 3 \lor \Delta_{\text{YOB}} \ge 2
\end{cases}$$

#### 5. Geographic Alignment ($S_{\text{geo}}$)
$$S_{\text{geo}} = \begin{cases}
100.0 & \text{if State/Province and Country match} \\
80.0 & \text{if City matches but State is unlisted} \\
60.0 & \text{if Country matches and athlete has race history within 250 km} \\
20.0 & \text{if Country matches but State differs (athlete relocated)} \\
0.0 & \text{if Countries conflict}
\end{cases}$$

---

### 3.3 Confidence Tiers & Decision Rules

| Score Range ($\text{Score}_{\text{MFDA}}$) | Verification Status | Operational Action |
|---|---|---|
| **$\ge 85.00$** | `auto_verified` | Automatically linked to `person_external_profiles`. Enqueued immediately into `fetch-queue`. Summaries and projections generated automatically. |
| **$60.00 - 84.99$** | `candidate_matched` | Staged in database with `matchMetadata` recording sub-scores. Flagged in Steward Admin Console for one-click organizer review. |
| **$< 60.00$** | `rejected` / Discarded | Profile candidate discarded. Audit log entry retained in Redis for debugging. |

---

## 4. Platform Adapters

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          PLATFORM ADAPTER SPECIFICATIONS                        │
├───────────────┬───────────────────────────────┬──────────────────┬──────────────┤
│ Platform      │ Ingestion Mechanism           │ Rate Limit       │ Core Data    │
├───────────────┼───────────────────────────────┼──────────────────┼──────────────┤
│ UltraSignup   │ REST API + HTML Fallback      │ 1.0 req/sec      │ Rank %, DNFs │
│ Strava        │ OAuth 2.0 API v3 + Public     │ 100 req / 15 min │ Elevation, HR│
│ DUV           │ Clean Scrape / REST Proxy     │ 0.5 req/sec      │ Ultra Records│
│ ITRA          │ Public Index Lookup / Partner │ 1.0 req/sec      │ Perf Index   │
└───────────────┴───────────────────────────────┴──────────────────┴──────────────┘
```

### 4.1 UltraSignup Adapter
- **Protocol:** JSON endpoint `https://ultrasignup.com/service/events/runners/` with Cheerio HTML scraper fallback for legacy athlete profile pages (`/runners/runnerprofile.aspx?id=...`).
- **Data Extracted:**
  - `runner_rank`: Overall percentile ranking (e.g. `87.42%`).
  - `age`, `gender`, `city`, `state`.
  - Historical race results: `event_name`, `event_date`, `distance`, `finish_time`, `place`, `gender_place`, and explicit `status` (`finished`, `dnf`, `dns`).
- **Resilience:** If JSON API responds with 403/Cloudflare challenge, worker switches to Cheerio DOM parser executing against the mobile-optimized print view.

### 4.2 Strava Adapter
- **Protocol:**
  - **Authenticated (OAuth 2.0 v3):** If competitor connects Strava account during online check-in, ChekkPoint accesses `/api/v3/athlete/activities` with `read,activity:read_all` scopes. Ingests precise elevation gain, heart rate profiles, and long training runs over the preceding 12 weeks.
  - **Public Profile Fallback:** If unlinked, queries public athlete profile slug to verify profile photo and city/state corroboration.

### 4.3 DUV Ultra Marathon Statistics Adapter
- **Protocol:** Queries DUV international database (`https://statistik.d-u-v.org/`).
- **Data Extracted:** Worldwide IAU/trail race results across Europe, Asia, and North America. Essential for international runners whose domestic races are absent from North American platforms like UltraSignup.

### 4.4 ITRA (International Trail Running Association) Adapter
- **Protocol:** ITRA performance index lookup (`itra.run`).
- **Data Extracted:** ITRA General Performance Index (0–1000 scale) and Category Indexes (e.g., Trail Ultra Medium [M], Trail Ultra Long [L], Trail Ultra Extra Long [XL]).

---

## 5. Volunteer Safety & SAR Overdue Alerts

Aid station volunteers operate under extreme physical strain, cold, and sleep deprivation. Net Control radio dispatchers track hundreds of competitors across 100 miles of wilderness. Predictive intelligence transforms raw historical data into instant, actionable life-safety indicators.

### 5.1 Real-Time Checkpoint Field Logger Triage Badges

When a volunteer types a bib number or scans an RFID tag at a remote aid station, the tablet display immediately renders high-contrast visual badges:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ BIB 248  •  MARCUS VANCE  •  M40-49  •  Leadville 100                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ [ ⚠️ CUTOFF WATCH ]   [ ⛰️ ELEVATION RISK ]   [ FIRST 100M ]                 │
│                                                                             │
│ • Projected Station Dwell: 14 mins  (Historical average: 18 mins)           │
│ • Projected Next Station ETA: 02:44 AM (Cutoff: 03:00 AM — Margin: 16m)    │
│ • Emergency Contact: Sarah Vance (Wife) • ON-SITE (Twin Lakes Crew Area)   │
│   Phone: (303) 555-0192                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### The 5 Primary Safety Triage Badges:
1. `[ 🚨 HIGH DNF RISK ]` (Red): Historical DNF rate $\ge 35\%$ across similar distances or dropped at this specific event in past editions.
2. `[ ⚠️ CUTOFF WATCH ]` (Amber): Projected arrival at the next mandatory timing point is within $\le 20\text{ minutes}$ of the official hard cutoff.
3. `[ ⛰️ ELEVATION RISK ]` (Purple): Competitor resides at sea level ($< 500\text{m}$) and is entering high-altitude passes ($> 3,000\text{m}$).
4. `[ 🏅 VETERAN FINISHER ]` (Green): Competitor has $\ge 3$ verified career finishes at or above this distance.
5. `[ 🔰 FIRST TIMER ]` (Blue): Competitor has never recorded a finish at this distance; flagged for medical visual scan at aid station entry.

---

### 5.2 Dynamic GPX Pacing & Arrival Calculation Formula

Expected arrival times are computed per split segment $k$ by mapping the runner's baseline pace against the specific segment's elevation gain and descent using an adapted Minetti metabolic cost formula:

$$\text{Pace}_{\text{seg}, k} = \text{Pace}_{\text{baseline}} \times \left( 1 + \alpha \cdot \max(0, \Delta h_k) - \beta \cdot \max(0, -\Delta h_k) \right) \times \gamma_{\text{fatigue}}(D_k)$$

Where:
- $\text{Pace}_{\text{baseline}}$ is derived from `person_historical_summaries.avgPaceSecondsPerKm`.
- $\Delta h_k$ is the grade gradient (meters climbed/descended per km) from course GPX telemetry.
- $\alpha = 0.035$ (climb cost factor), $\beta = 0.015$ (descent efficiency factor).
- $\gamma_{\text{fatigue}}(D_k) = 1 + 0.0025 \times \max(0, D_k - 30)$ accounts for cumulative distance fatigue beyond 30 km.

#### Arrival Time Window ($\text{ETA} \pm \sigma$):
$$\text{ETA}_k = T_{\text{actual}, k-1} + \left( \text{Distance}_k \times \text{Pace}_{\text{seg}, k} \right)$$
$$\sigma_k = \sqrt{\sum_{i=1}^k \sigma_{\text{base}}^2} \times \left(1 + \text{DNF\_Risk}\right)$$

The expected arrival window presented to checkpoint staff and the Damerau-Levenshtein bib typo pool is:
$$\left[ \text{ETA}_k - 1.5\sigma_k, \quad \text{ETA}_k + 2.0\sigma_k \right]$$

---

### 5.3 Stage 1 Late vs. Stage 2 SAR Alarms

In the Checkpoint Field Logger and Net Control dashboard:

```
                  ETA Window Passed (+1.5σ)
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│               STAGE 1 ALARM: OVERDUE / LATE WARNING                    │
├────────────────────────────────────────────────────────────────────────┤
│ Visual: Amber flashing pulse on aid station arrival queue.             │
│ Operational Trigger: Athlete is 20 minutes past Upper Confidence Bound.│
│ Action:                                                                │
│ 1. Prior Station verifies departure timestamp and physical state.      │
│ 2. Ham radio net checks if bib dropped between stations.               │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                        30 Minutes Past Hard Cutoff
                        OR 60 Minutes Past Upper ETA
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 STAGE 2 ALARM: ACTIVE SAR INCIDENT                     │
├────────────────────────────────────────────────────────────────────────┤
│ Visual: High-contrast red siren banner across Net Control consoles.    │
│ Audio: Audible tone on Race Director master terminal.                  │
│ Operational Trigger: Missing in transit; unaccounted for.             │
│ Automatic Data Hydration:                                              │
│ • Emergency Contact highlighted (Name, relationship, on-site status).  │
│ • Last verified physical sighting (Station ID, sub-split, operator).   │
│ • Expected trail segment coordinates exported for Sweep / SAR team.    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Steward Admin Overrides & Manual Disambiguation UI

Automated algorithms never override human authority on race day. The **Steward Admin Console** provides instantaneous controls:

1. **One-Click Candidate Verification (`[VERIFY]`):**
   - In the `/manage-db` or `/admin/competitors` console, candidate matches ($60.00 \le S < 85.00$) display side-by-side with match criteria.
   - Clicking `[VERIFY]` promotes status from `candidate_matched` to `manual_verified`, immediately enqueuing the fetch and summary jobs.
2. **Rejection & Blacklist (`[REJECT & BLACKLIST]`):**
   - Permanently rejects an external profile for this person, storing the external identifier in a blacklist hash to prevent future automated candidate re-matches.
3. **Manual URL Binding (`[BIND URL]`):**
   - Allows an organizer to paste a direct profile URL (e.g. `https://ultrasignup.com/runners/runnerprofile.aspx?id=123456`).
   - Bypasses MFDA search, assigns `verificationStatus: 'manual_verified'`, and schedules an immediate crawl.
4. **Emergency Contact Quick-Edit:**
   - Single-click lookup and inline reassignment of `entrants.emergencyContactPersonId` directly from the competitor drawer.

---

## 7. PostgreSQL & Drizzle Data Specification Cross-Reference

This strategy document is implemented by the following core tables in `ChekkPoint/src/db/schema.ts`:

- `personExternalProfiles` (`person_external_profiles`)
- `personRaceHistory` (`person_race_history`)
- `personHistoricalSummaries` (`person_historical_summaries`)
- `entrantHistoricalProjections` (`entrant_historical_projections`)
- Direct FK on `entrants`: `emergencyContactPersonId`, `emergencyContactRelationship`, `emergencyContactIsOnSite`

*End of Specification.*
