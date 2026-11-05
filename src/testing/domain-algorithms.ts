/**
 * ChekkPoint Pure Domain Algorithms & Mathematical Engines
 *
 * Implements pure, dependency-free reference logic for:
 * 1. Damerau-Levenshtein Typo-Defense HUD & Recommendation
 * 2. MT63 Digital Radio Text Block Parser
 * 3. TSD Regularity Rally Penalty Calculation (2.0x early, 1.0x late)
 * 4. Aid Station Dwell Time & Segment Pace Calculations
 * 5. UltraSignup, ITRA & Standard CSV Serialization
 * 6. Public PII & Medical Data Redaction
 * 7. 10-Key Keypad Input Buffer & Decoupled FIFO Chute Queue
 */

// ============================================================================
// 1. DAMERAU-LEVENSHTEIN TYPO-DEFENSE ENGINE
// ============================================================================

/**
 * Computes the true Damerau-Levenshtein distance between two strings,
 * supporting insertions, deletions, substitutions, and adjacent transpositions.
 */
export function damerauLevenshtein(source: string, target: string): number {
	const a = source.trim();
	const b = target.trim();

	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	const lenA = a.length;
	const lenB = b.length;

	// Distance matrix with bounds: (lenA + 2) x (lenB + 2)
	const maxDist = lenA + lenB;
	const H: number[][] = Array.from({ length: lenA + 2 }, () =>
		new Array(lenB + 2).fill(0),
	);

	H[0][0] = maxDist;
	for (let i = 0; i <= lenA; i++) {
		H[i + 1][0] = maxDist;
		H[i + 1][1] = i;
	}
	for (let j = 0; j <= lenB; j++) {
		H[0][j + 1] = maxDist;
		H[1][j + 1] = j;
	}

	const lastRow: Record<string, number> = {};

	for (let i = 1; i <= lenA; i++) {
		let lastMatchCol = 0;
		const charA = a[i - 1];

		for (let j = 1; j <= lenB; j++) {
			const charB = b[j - 1];
			const lastMatchRow = lastRow[charB] || 0;

			const cost = charA === charB ? 0 : 1;

			// Standard Levenshtein operations: deletion, insertion, substitution
			H[i + 1][j + 1] = Math.min(
				H[i][j + 1] + 1, // deletion
				H[i + 1][j] + 1, // insertion
				H[i][j] + cost, // substitution
			);

			// Damerau adjacent transposition
			if (lastMatchRow > 0 && lastMatchCol > 0) {
				const transCost =
					H[lastMatchRow][lastMatchCol] +
					(i - lastMatchRow - 1) +
					1 +
					(j - lastMatchCol - 1);
				H[i + 1][j + 1] = Math.min(H[i + 1][j + 1], transCost);
			}

			if (charA === charB) {
				lastMatchCol = j;
			}
		}

		lastRow[charA] = i;
	}

	return H[lenA + 1][lenB + 1];
}

export interface TypoRecommendation {
	enteredBib: string;
	recommendedBib: string;
	distance: number;
	confidence: "exact" | "high" | "moderate";
}

/**
 * Given an entered bib number and a pool of registered or expected bibs,
 * detects potential typos (e.g. transpositions like 142 vs 124) and suggests corrections.
 */
export function getTypoRecommendation(
	enteredBib: string,
	candidateBibs: string[],
	maxDistance = 1,
): TypoRecommendation | null {
	const clean = enteredBib.trim();
	if (!clean || candidateBibs.length === 0) return null;

	// If exact match exists, no typo recommendation needed
	if (candidateBibs.includes(clean)) {
		return {
			enteredBib: clean,
			recommendedBib: clean,
			distance: 0,
			confidence: "exact",
		};
	}

	let bestMatch: string | null = null;
	let lowestDistance = Number.POSITIVE_INFINITY;

	for (const candidate of candidateBibs) {
		const dist = damerauLevenshtein(clean, candidate);
		if (dist < lowestDistance) {
			lowestDistance = dist;
			bestMatch = candidate;
		}
	}

	if (bestMatch !== null && lowestDistance <= maxDistance) {
		return {
			enteredBib: clean,
			recommendedBib: bestMatch,
			distance: lowestDistance,
			confidence: lowestDistance === 1 ? "high" : "moderate",
		};
	}

	return null;
}

// ============================================================================
// 2. MT63 DIGITAL HAM RADIO TEXT BLOCK PARSER
// ============================================================================

export type SubSplitKind = "in" | "out" | "point";

export interface ParsedMt63Punch {
	stationCode: string;
	competitorNumber: string;
	subSplitKind: SubSplitKind;
	timeOfDay: string;
	withPacer: boolean;
	rawLine: string;
	lineNumber: number;
}

export interface Mt63ParseResult {
	punches: ParsedMt63Punch[];
	errors: Array<{ line: string; lineNumber: number; reason: string }>;
	totalLines: number;
}

/**
 * Parses raw text blocks transcribed from acoustic MT63 ham radio bursts.
 * Standard format per line:
 * `<STATION_CODE> <BIB> <IN|OUT|POINT> <HH:MM:SS> [PACER]`
 *
 * Example:
 * `TWIN 142 IN 14:22:31 P`
 * `TWIN 142 OUT 14:35:10`
 * `TWIN 88 POINT 14:36:00`
 */
export function parseMt63Block(rawText: string): Mt63ParseResult {
	const lines = rawText.split(/\r?\n/);
	const punches: ParsedMt63Punch[] = [];
	const errors: Mt63ParseResult["errors"] = [];

	const TIME_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?$/;

	for (let i = 0; i < lines.length; i++) {
		const lineNumber = i + 1;
		const rawLine = lines[i].trim();

		// Skip empty lines and comment lines starting with # or //
		if (!rawLine || rawLine.startsWith("#") || rawLine.startsWith("//")) {
			continue;
		}

		const tokens = rawLine.split(/\s+/);
		if (tokens.length < 4) {
			errors.push({
				line: rawLine,
				lineNumber,
				reason: `Insufficient tokens: expected at least 4 (STATION BIB KIND TIME), got ${tokens.length}`,
			});
			continue;
		}

		const [stationCodeRaw, bibRaw, kindRaw, timeRaw, ...extraTokens] = tokens;
		const stationCode = stationCodeRaw.toUpperCase();
		const competitorNumber = bibRaw.replace(/^[#]/, "");

		const normalizedKind = kindRaw.toLowerCase();
		let subSplitKind: SubSplitKind;
		if (normalizedKind === "in") subSplitKind = "in";
		else if (normalizedKind === "out") subSplitKind = "out";
		else if (normalizedKind === "point" || normalizedKind === "pt")
			subSplitKind = "point";
		else {
			errors.push({
				line: rawLine,
				lineNumber,
				reason: `Invalid split kind '${kindRaw}': expected IN, OUT, or POINT`,
			});
			continue;
		}

		if (!TIME_REGEX.test(timeRaw)) {
			errors.push({
				line: rawLine,
				lineNumber,
				reason: `Malformed time of day '${timeRaw}': expected HH:MM:SS or HH:MM`,
			});
			continue;
		}

		// Normalize time to HH:MM:SS
		const parts = timeRaw.split(":");
		const hh = parts[0].padStart(2, "0");
		const mm = parts[1].padStart(2, "0");
		const ss = parts[2] ? parts[2].padStart(2, "0") : "00";
		const timeOfDay = `${hh}:${mm}:${ss}`;

		// Pacer flag detection
		const extra = extraTokens.join(" ").toUpperCase();
		const withPacer =
			extra.includes("P") ||
			extra.includes("PACER") ||
			extra.includes("+P") ||
			extra.includes("WITH_PACER");

		punches.push({
			stationCode,
			competitorNumber,
			subSplitKind,
			timeOfDay,
			withPacer,
			rawLine,
			lineNumber,
		});
	}

	return {
		punches,
		errors,
		totalLines: lines.length,
	};
}

// ============================================================================
// 3. TSD REGULARITY RALLY PENALTY SCORING ENGINE
// ============================================================================

export interface TsdPenaltyConfig {
	earlyPenaltyFactor?: number; // Default 2.0x (harsh penalty to discourage speeding)
	latePenaltyFactor?: number; // Default 1.0x
	gracePeriodSeconds?: number; // Default 0.0s
}

export interface TsdPenaltyResult {
	deviationSeconds: number; // Actual - Ideal (+ = late, - = early)
	penaltyPoints: number; // Accrued penalty score
	isEarly: boolean;
	isLate: boolean;
	isExact: boolean;
}

/**
 * Calculates penalty points for Time-Speed-Distance regularity motorsport.
 * Early arrivals past hidden checkpoints are penalized twice as harshly as late arrivals (2.0x vs 1.0x).
 */
export function calculateTsdPenalty(
	actualDurationSeconds: number,
	idealDurationSeconds: number,
	config?: TsdPenaltyConfig,
): TsdPenaltyResult {
	const earlyFactor = config?.earlyPenaltyFactor ?? 2.0;
	const lateFactor = config?.latePenaltyFactor ?? 1.0;
	const grace = Math.max(0, config?.gracePeriodSeconds ?? 0.0);

	const deviationSeconds = actualDurationSeconds - idealDurationSeconds;
	const absDeviation = Math.abs(deviationSeconds);

	if (absDeviation <= grace) {
		return {
			deviationSeconds,
			penaltyPoints: 0.0,
			isEarly: false,
			isLate: false,
			isExact: true,
		};
	}

	let penaltyPoints = 0.0;
	const isEarly = deviationSeconds < -grace;
	const isLate = deviationSeconds > grace;

	if (isEarly) {
		const penalizedSeconds = Math.abs(deviationSeconds) - grace;
		penaltyPoints = Math.round(penalizedSeconds * earlyFactor * 1000) / 1000;
	} else if (isLate) {
		const penalizedSeconds = deviationSeconds - grace;
		penaltyPoints = Math.round(penalizedSeconds * lateFactor * 1000) / 1000;
	}

	return {
		deviationSeconds,
		penaltyPoints,
		isEarly,
		isLate,
		isExact: false,
	};
}

// ============================================================================
// 4. AID STATION DWELL TIME & SEGMENT PACE CALCULATION
// ============================================================================

/**
 * Computes station dwell time in seconds from IN arrival to OUT departure.
 * Handles chronological inversions safely (returns null or 0).
 */
export function calculateDwellSeconds(
	inTime: Date | string | number | null | undefined,
	outTime: Date | string | number | null | undefined,
): number | null {
	if (!inTime || !outTime) return null;

	const inMs = new Date(inTime).getTime();
	const outMs = new Date(outTime).getTime();

	if (Number.isNaN(inMs) || Number.isNaN(outMs)) return null;

	const deltaSeconds = Math.round((outMs - inMs) / 1000);
	return Math.max(0, deltaSeconds);
}

/**
 * Computes segment pace in seconds per kilometer.
 * Handles zero or negative distances safely without division by zero.
 */
export function calculateSegmentPaceSecondsPerKm(
	segmentDistanceMeters: number,
	segmentDurationSeconds: number,
): number | null {
	if (segmentDistanceMeters <= 0 || segmentDurationSeconds <= 0) {
		return null;
	}

	const distanceKm = segmentDistanceMeters / 1000;
	return segmentDurationSeconds / distanceKm;
}

// ============================================================================
// 5. OFFICIAL CSV EXPORT SERIALIZATION (ULTRASIGNUP, ITRA & STANDARD)
// ============================================================================

export interface OfficialExportRunner {
	place: number | null;
	bib: string;
	firstName: string;
	lastName: string;
	age?: number | null;
	gender?: "M" | "F" | "X" | string | null;
	birthDate?: string | null;
	nationality?: string | null;
	city?: string | null;
	state?: string | null;
	totalElapsedSeconds: number | null;
	status: "finished" | "dnf" | "dns" | "dq" | "otl" | string;
	division?: string | null;
	penaltyPoints?: number | null;
}

function escapeCsvField(val: string | number | null | undefined): string {
	if (val === null || val === undefined) return "";
	const str = String(val);
	if (str.includes(",") || str.includes('"') || str.includes("\n")) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

function formatElapsedHms(seconds: number | null | undefined): string {
	if (seconds === null || seconds === undefined || seconds < 0) return "";
	const total = Math.floor(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Generates UltraSignup compliant CSV format:
 * Header: `Place,First Name,Last Name,Age,Gender,City,State,Bib,Time,Status`
 */
export function formatUltraSignupCsv(runners: OfficialExportRunner[]): string {
	const header =
		"Place,First Name,Last Name,Age,Gender,City,State,Bib,Time,Status";
	const rows = runners.map((r) => {
		const statusFormatted =
			r.status === "finished"
				? "Finished"
				: r.status === "dnf"
					? "DNF"
					: r.status === "dns"
						? "DNS"
						: r.status.toUpperCase();

		return [
			escapeCsvField(r.place ?? ""),
			escapeCsvField(r.firstName),
			escapeCsvField(r.lastName),
			escapeCsvField(r.age ?? ""),
			escapeCsvField(r.gender ?? ""),
			escapeCsvField(r.city ?? ""),
			escapeCsvField(r.state ?? ""),
			escapeCsvField(r.bib),
			escapeCsvField(formatElapsedHms(r.totalElapsedSeconds)),
			escapeCsvField(statusFormatted),
		].join(",");
	});

	return [header, ...rows].join("\n");
}

/**
 * Generates ITRA compliant CSV format:
 * Header: `Bib,First Name,Last Name,Gender,Birth Date,Nationality,Time,Rank,Category,Status`
 */
export function formatItraCsv(runners: OfficialExportRunner[]): string {
	const header =
		"Bib,First Name,Last Name,Gender,Birth Date,Nationality,Time,Rank,Category,Status";
	const rows = runners.map((r) => {
		const statusFormatted =
			r.status === "finished"
				? "FINISHER"
				: r.status === "dnf"
					? "DNF"
					: r.status === "dns"
						? "DNS"
						: r.status.toUpperCase();

		return [
			escapeCsvField(r.bib),
			escapeCsvField(r.firstName),
			escapeCsvField(r.lastName),
			escapeCsvField(r.gender ?? ""),
			escapeCsvField(r.birthDate ?? ""),
			escapeCsvField(r.nationality ?? "USA"),
			escapeCsvField(formatElapsedHms(r.totalElapsedSeconds)),
			escapeCsvField(r.place ?? ""),
			escapeCsvField(r.division ?? "Overall"),
			escapeCsvField(statusFormatted),
		].join(",");
	});

	return [header, ...rows].join("\n");
}

/**
 * Generates Standard ChekkPoint CSV format:
 * Header: `Place,Bib,Name,Gender,Age,Division,Status,TotalTime,PenaltyPoints`
 */
export function formatStandardCsv(runners: OfficialExportRunner[]): string {
	const header =
		"Place,Bib,Name,Gender,Age,Division,Status,TotalTime,PenaltyPoints";
	const rows = runners.map((r) => {
		return [
			escapeCsvField(r.place ?? ""),
			escapeCsvField(r.bib),
			escapeCsvField(`${r.firstName} ${r.lastName}`.trim()),
			escapeCsvField(r.gender ?? ""),
			escapeCsvField(r.age ?? ""),
			escapeCsvField(r.division ?? ""),
			escapeCsvField(r.status),
			escapeCsvField(formatElapsedHms(r.totalElapsedSeconds)),
			escapeCsvField(r.penaltyPoints ?? 0),
		].join(",");
	});

	return [header, ...rows].join("\n");
}

// ============================================================================
// 6. PUBLIC PII & MEDICAL DATA REDACTION FILTER
// ============================================================================

export interface EntrantWithPrivateData {
	id: string;
	bibNumber: string;
	firstName: string;
	lastName: string;
	status: string;
	medicalNotes?: string | null;
	safetyTriageNotes?: string | null;
	allergies?: string | null;
	medications?: string | null;
	phone?: string | null;
	email?: string | null;
	rfidCode?: string | null;
	address?: Record<string, unknown> | null;
	emergencyContactName?: string | null;
	emergencyContactPhone?: string | null;
	emergencyContactRelation?: string | null;
	emergencyContactIsOnSite?: boolean | null;
	splits?: Array<{
		splitId: string;
		splitName: string;
		isSecretCheckpoint?: boolean;
		elapsedSeconds?: number | null;
	}>;
	[key: string]: unknown;
}

/**
 * Strictly sanitizes entrant telemetry for public spectator access.
 * Strips all medical records, safety triage logs, direct phone numbers, email addresses,
 * transponder codes, and emergency contact identities.
 * Also suppresses secret checkpoints unless explicitly revealed.
 */
export function redactPublicEntrantData<T extends EntrantWithPrivateData>(
	entrant: T,
	options?: { revealSecretSplits?: boolean },
): Omit<
	T,
	| "medicalNotes"
	| "safetyTriageNotes"
	| "allergies"
	| "medications"
	| "phone"
	| "email"
	| "rfidCode"
	| "address"
	| "emergencyContactName"
	| "emergencyContactPhone"
	| "emergencyContactRelation"
	| "emergencyContactIsOnSite"
> & {
	hasEmergencyContactOnSite: boolean;
	splits?: Array<{
		splitId: string;
		splitName: string;
		elapsedSeconds?: number | null;
	}>;
} {
	const copy = { ...entrant };

	// Extract non-identifying boolean metadata before redaction
	const hasOnSiteContact = Boolean(copy.emergencyContactIsOnSite);

	// Strip private fields
	delete copy.medicalNotes;
	delete copy.safetyTriageNotes;
	delete copy.allergies;
	delete copy.medications;
	delete copy.phone;
	delete copy.email;
	delete copy.rfidCode;
	delete copy.address;
	delete copy.emergencyContactName;
	delete copy.emergencyContactPhone;
	delete copy.emergencyContactRelation;
	delete copy.emergencyContactIsOnSite;

	// Redact secret checkpoints if present in splits
	if (Array.isArray(copy.splits)) {
		copy.splits = copy.splits
			.filter((s) => options?.revealSecretSplits || !s.isSecretCheckpoint)
			.map((s) => {
				const sCopy = { ...s };
				delete sCopy.isSecretCheckpoint;
				return sCopy;
			});
	}

	return {
		...copy,
		hasEmergencyContactOnSite: hasOnSiteContact,
	};
}

// ============================================================================
// 7. 10-KEY KEYPAD BUFFER & DECOUPLED FIFO CHUTE QUEUE
// ============================================================================

export class KeypadInputBuffer {
	private buffer = "";

	get current(): string {
		return this.buffer;
	}

	pushDigit(digit: string): string {
		if (/^\d$/.test(digit)) {
			this.buffer += digit;
		}
		return this.buffer;
	}

	backspace(): string {
		this.buffer = this.buffer.slice(0, -1);
		return this.buffer;
	}

	clear(): void {
		this.buffer = "";
	}

	commit(): string {
		const val = this.buffer;
		this.buffer = "";
		return val;
	}
}

export interface ChutePunchTicket {
	ticketId: string;
	timestampUtc: Date;
	assignedBib: string | null;
	subSplitKind: SubSplitKind;
	withPacer: boolean;
}

export class DecoupledFifoChuteQueue {
	private queue: ChutePunchTicket[] = [];
	private nextId = 1;

	/**
	 * Immediately captures an atomic UTC timestamp when a runner breaks the plane,
	 * without requiring the volunteer to identify the bib number in that split second.
	 */
	recordTimestamp(options?: {
		timestamp?: Date;
		subSplitKind?: SubSplitKind;
		withPacer?: boolean;
	}): ChutePunchTicket {
		const ticket: ChutePunchTicket = {
			ticketId: `chute-${this.nextId++}`,
			timestampUtc: options?.timestamp ?? new Date(),
			assignedBib: null,
			subSplitKind: options?.subSplitKind ?? "point",
			withPacer: options?.withPacer ?? false,
		};
		this.queue.push(ticket);
		return ticket;
	}

	/**
	 * Binds an identified bib number to the oldest unassigned timestamp in the FIFO chute.
	 */
	assignNextBib(bib: string): ChutePunchTicket | null {
		const cleanBib = bib.trim();
		if (!cleanBib) return null;

		const ticket = this.queue.find((t) => t.assignedBib === null);
		if (!ticket) return null;

		ticket.assignedBib = cleanBib;
		return ticket;
	}

	getPendingCount(): number {
		return this.queue.filter((t) => t.assignedBib === null).length;
	}

	getAssignedCount(): number {
		return this.queue.filter((t) => t.assignedBib !== null).length;
	}

	getAllTickets(): readonly ChutePunchTicket[] {
		return [...this.queue];
	}

	clear(): void {
		this.queue = [];
		this.nextId = 1;
	}
}
