# Feature List

## OpenSplitTime

### Event Construction
- Organizations as the top-level admin container for events
- Event groups bundle multiple events (e.g., 100M + 50M) held together
- Events as distinct competitions, each with its own entrants
- Courses as reusable physical routes across years
- Splits (aid stations/checkpoints) with distance and location
- Required start and finish splits on every course
- Laps configuration (single, fixed multiple, or unlimited)
- Wave starts with different scheduled start times per event
- Short names to distinguish events within a group
- Manual split entry
- CSV import of splits, including sub-split kinds (in/out)
- GPX upload for course map display
- Event group duplication for recurring annual events
- Construction mode for pre-event setup, then switch to live mode
- Historical event time data import

### Entrant Management
- CSV import of entrant rosters
- RunSignup integration to pull registrations
- Rattlesnake Ramble registration integration
- Lottery integration to pull accepted entrants
- Entrant reconciliation with existing person records
- Per-entrant fields: name, gender, birthdate, age, city, state, email, phone
- Comments field for organizer notes
- Beacon URL field linking to an external GPS tracker
- Move entrants between events within a group
- Delete entrants

### Event Preparation
- Go public / take private to control event group visibility
- Enable / disable live entry for the event group
- Follow page to share tracking links with entrants and supporters
- Steward accounts for authorized timing crew
- Mock/test event groups for crew training
- Traffic prediction using historical course data
- Results page notice text for race condition alerts

### Race Start
- Check-in entrants from the roster page
- Track checked-in status to determine start eligibility
- Assign and modify scheduled start times
- Edit entrant info during check-in
- Bulk start entrants by scheduled start time
- Record actual start times that differ from scheduled
- Start individual entrants from their profile page
- Bulk modify start times via Manage Start Times view
- "Not Started" status until a split time is recorded

### Time Entry (Web Live Entry)
- Live Entry screen for manual time entry with real-time validation
- Keyboard-optimized entry workflow (Tab, Shift-Tab, Space, Enter)
- Aid station selector to route entries
- Bib validation indicators (invalid, unexpected)
- Time validation indicators (bad, questionable, duplicate)
- Shows entrant's existing times during entry for context
- Local data workspace to stage entries before submitting
- Edit or discard staged entries individually or all at once
- Submit individually or batch-submit only clean entries
- Force-submit flagged entries
- Pacer in/out toggles
- Dropped/stopped status marking
- Pull Times to review flagged entries in batches

### OST Remote (iOS App)
- Record times in and out of aid stations
- Offline recording with sync to the server
- Multiple devices timing in parallel at one station
- Name verification display when entering a bib
- Batch time capture without bibs for rapid arrivals, bibs assigned later
- Review and sync screen to edit entries after the fact
- Single- or dual-device station configurations
- Out-and-back course support
- Cross Check view showing entrant status at the station
- Physical backup logging guidance

### Time Editing & Data Quality
- Direct Edit screen for split times in multiple formats (time of day, elapsed, date+time)
- Direct editing of start times
- Rebuild Times to reconstruct multi-lap efforts from raw times
- Raw time review with station correction
- Lap reassignment for multi-lap events
- Confirm flagged split times to override system flags
- Delete split times
- Effort Audit screen with raw-time-to-split-time match/unmatch linking
- Governing raw time selection when multiple raw times map to one split
- Raw Times Record showing full entry history per entrant
- Problem Efforts list flagging inconsistent timing data
- Data hole identification for missing split times

### Race Monitoring
- Full results view with sorting and filtering
- Progress Report showing runners in progress and overdue entrants
- Past-due / possibly-lost runner alerts
- Aid Station Overview summarizing status across all stations
- Aid Station Detail views (Recorded, In Aid, Missed, Dropped, Expected)
- Predicted arrival times at upcoming stations from historical data
- Raw Times List with review and match status
- Raw Times Splits view grouped by bib at each station
- Finish Line view of recent and expected finishers
- Entrant search by bib with detailed status

### Crew Access
- Gating locations controlling crew access to aid stations
- Gate station + target station + travel buffer per event
- Live release board of per-runner crew release times
- Automatic release time calculation from runner progress and historical data
- Release estimates refine as runners pass intermediate stations
- Live-updating or fixed release times per gate
- Mark crews as released
- Filter/sort board by bib, release time, or search
- Hide departed or already-released runners
- Adjust travel buffer on the fly
- Public Crew Access tab on runner pages
- Status indicators: Now, Insufficient data, Stopped, Arrived, Departed

### Results & Spectator Views
- Full results with all splits
- Summary, finishers-only, finish history, and podium views
- Filter by gender (combined, female, male, nonbinary, watched)
- Time formats: elapsed, AM/PM, 24-hour, segment
- Sort by place, bib, name, category, or location
- Individual effort detail pages
- Effort analysis comparing segment times to expected performance
- All-time best efforts per course
- Cutoff analysis
- Traffic view of expected station traffic
- Follow page for an event group

### Watching & Notifications
- Star entrants to watch them (row highlighted)
- Filter results to watched entrants only
- Clear all watches for an event group at once
- Email and text (SMS) progress updates for followed entrants
- Auto-watch entrants you're subscribed to, synced across signed-in devices

### Athletes & Planning
- People directory to search athletes
- Athlete history across events
- Personal best segments
- Find comparable athletes for peer comparison
- Plan My Effort tool with suggested aid station arrival times from a target finish

### Lotteries
- Run entry lotteries with ticket-weighted draws
- Divisions (e.g., by gender and experience such as Finishers/Nevers)
- Draws view showing selection results
- Entrants tab listing applicants by division
- Accepted, waitlisted, and withdrawn status tracking
- Ordered waitlist with positions
- Lottery statistics view
- Service requirement tracking for accepted/waitlisted entrants
- Downloadable blank service form (PDF)
- Upload completed service forms (PDF/JPEG/PNG, max 5 MB)
- Service form review with approve/reject and rejection feedback
- Service form deadline enforcement

### Post-Race
- Establish Drops tool to stop entrants at their last recorded split
- Disable live entry after the event
- Export full results to CSV
- Export summary finisher list to CSV
- Export results in ITRA format
- Export results in UltraSignup-compatible CSV

### Integrations & API
- RaceResult RFID chip timing via webhook exporters
- Multiple RFID timing points along a course
- RunSignup integration via API keys
- REST API (JSON:API) for organizations, courses, event groups, events, people
- Lookup by numeric ID or slug
- Raw times scoped to an event group
- Pagination, includes, filters, and sparse fieldsets
- Event spread query combining efforts and split times
- Time display style parameter (elapsed, absolute, segment)
- POST raw time imports to an event group
- Bearer token auth with user-managed API credentials and keys
- Webhooks via Amazon SNS with HTTP/HTTPS endpoint subscriptions
- Webhook subscription management with confirmation status

### Accounts & Privacy
- User accounts with log in / sign up
- Claim your person record
- Hide age on public pages (age group still shown)
- Show only initials on public pages
- Contact info, birthdate, and emergency contacts never shown publicly
- Race directors retain full access for event management

### Business Model
- Free and open source, donation supported
- Public documentation site

## TRacer (trackmyracer.live)

### Platform
- Runs in the web browser
- Native iOS app
- Native Android app
- Works on phones, tablets, and computers with no extra equipment
- Free to use, optional donations

### Event Setup
- Manual event creation in the app
- Manual station setup with number, optional name, and distance
- Import event data files in JSON or YAML
- Import auto-loads event name, stations, and participant list
- Built-in JSON Builder tool for creating event data files
- Downloadable example event file
- Multiple races within one event
- Per-race station display overrides (custom labels)
- Preload bibs and participant details
- Preload station timing entries
- Start and finish station designation
- Event start and end date/time
- Sync URL for publishing data to trackmyracer.live
- Switch between events or stations via dropdown
- Add new stations to an existing event
- Station verification warning before logging real data

### Participant Data
- Bib number
- First and last name
- Age or age range
- Gender
- Home location
- Team affiliation
- Race assignment
- Notes
- DNF reason, station, and timestamp

### Logging Times
- Log current time directly from the Records page
- Keypad sheet for entering specific times
- Auto Time In / Auto Time Out buttons for instant current-time logging
- Dialpad-style or 10-key keypad layout option
- Time-in-only station setting
- Time-out-only station setting
- Start station shows time out only, finish station shows time in only
- Edit existing entries from Records page or Keypad sheet
- Pre-filled time fields when editing
- Filter racers by All, DNF, Expecting, In Station, Not Transmitted, Recent, Transmitted
- Split-screen mode on wide screens with independent column filters

### DNS / DNF
- Mark participants DNS (did not start)
- Mark participants DNF with reason
- Built-in DNF reasons: Equipment, Medical, Personal, Time cutoff, Weather
- Custom DNF reasons
- Bulk mark multiple participants DNS or DNF
- DNF station tracking so race control records the correct location

### Radio Transmission (Sending)
- Send station data over ham/amateur radio as MT63 digital audio
- Works fully offline, no internet or cell service required
- Payload includes station number, bibs, time in/out, and DNF status/reason
- Preview untransmitted records before sending
- Lead-in tone before MT63 transmission for push-to-talk radios
- Progress indicator while audio plays
- Transmission history with collapsible entries
- 4-character hash ID per transmission
- Transmission split into header and numbered data blocks
- Selective retransmission of individual failed blocks

### Radio Reception (Receiving)
- Listen via device microphone and decode MT63 audio
- Live text view of raw decoder output
- Microphone status indicator and listening toggle
- Received transmission history keyed by hash
- Per-block status, green for received and red for failed
- Notification when a transmission is fully received
- Import received data into local records
- Auto-import setting for completed transmissions
- Relay received data onward to net control
- Header validation with recovery guidance for missing headers
- Request retransmission of missing blocks
- Audio quality guidance (speaker-to-mic distance, input reset)

### Race Control & Public Tracking
- Race control collects data from all stations
- Replaces voice radio relay and manual transcription
- Public friends-and-family event pages on trackmyracer.live
- Events directory to browse all public events

### Training & Support
- Training video
- Example training data file for practice
- Documentation for setup, event files, logging, transmitting, and receiving
