import { z } from "zod";

// ============================================================================
// 1. ZOD VALIDATION SCHEMAS
// ============================================================================

export const problemQueueFilterInput = z.object({
	eventId: z.string().uuid(),
	filterKind: z
		.enum([
			"all",
			"questionable",
			"bad",
			"flagged_discrepancy",
			"unaccounted_drop",
		])
		.optional()
		.default("all"),
	searchBib: z.string().optional(),
});

export const subEventAuditParams = z.object({
	slug: z.string().min(1),
	eventGroupSlug: z.string().min(1),
	eventId: z.string().uuid(),
	selectedEntrantId: z.string().uuid().optional(),
});

export const publicEntrantTelemetryInput = z.object({
	slug: z.string().min(1),
	entrantId: z.string().uuid(),
});

export const reassignRawTimingEventInput = z.object({
	eventId: z.string().uuid(),
	rawEventId: z.string().uuid(),
	newCompetitorNumber: z.string().optional(),
	newLapNumber: z.number().int().optional(),
	promoteToMatched: z.boolean().optional(),
	changeReason: z.string().min(3, "Change reason must be at least 3 characters"),
});

export const editScoredSplitInput = z.object({
	splitTimeId: z.string().uuid(),
	elapsedSeconds: z.number().optional(),
	absoluteTimeUtc: z.string().optional(),
	dataStatus: z
		.enum(["provisional", "valid", "questionable", "bad", "confirmed"])
		.optional(),
	changeReason: z.string().min(3, "Change reason must be at least 3 characters"),
});

export const insertScoredSplitInput = z.object({
	entrantId: z.string().uuid(),
	courseSplitId: z.string().uuid(),
	lap: z.number().int().default(1),
	subSplitKind: z.enum(["in", "out", "point"]),
	absoluteTimeUtc: z.string(),
	elapsedSeconds: z.number().min(0, "Elapsed seconds must be positive"),
	changeReason: z.string().min(3, "Change reason must be at least 3 characters"),
});

export const deleteScoredSplitInput = z.object({
	splitTimeId: z.string().uuid(),
	changeReason: z.string().min(3, "Change reason must be at least 3 characters"),
});

export const confirmScoredSplitInput = z.object({
	splitTimeId: z.string().uuid(),
	changeReason: z
		.string()
		.min(3, "Change reason must be at least 3 characters")
		.default("Confirmed by timing steward"),
});

export const createTimeAllowanceInput = z.object({
	entrantId: z.string().uuid(),
	splitId: z.string().uuid(),
	startTime: z.string(),
	endTime: z.string(),
	durationSeconds: z.number().int().positive("Duration must be greater than zero"),
	reason: z.string().min(1, "Reason is required"),
	notes: z.string().optional(),
});

export const updateTimeAllowanceInput = z.object({
	allowanceId: z.string().uuid(),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	durationSeconds: z.number().int().positive("Duration must be greater than zero").optional(),
	reason: z.string().optional(),
	notes: z.string().optional(),
});

export const deleteTimeAllowanceInput = z.object({
	allowanceId: z.string().uuid(),
});

export const rebuildSplitsInput = z.object({
	eventId: z.string().uuid(),
	entrantId: z.string().uuid().optional(),
	changeReason: z.string().min(3, "Change reason must be at least 3 characters"),
});

export const establishDropsInput = z.object({
	eventId: z.string().uuid(),
	defaultStatus: z.enum(["dnf", "dns"]).default("dnf"),
});

export const certifyOfficialResultsInput = z.object({
	eventId: z.string().uuid(),
});

export const exportResultsInput = z.object({
	eventId: z.string().uuid(),
	format: z.enum(["ultrasignup", "itra", "standard"]),
});

// ============================================================================
// 2. PERMISSION CHECKS
// ============================================================================

export interface EventGroupAccessCheck {
	organizationId?: string;
	orgRoles: string[];
	staffRoles: string[];
	timingPointIds?: string[];
}

export function canAuditResults(access: EventGroupAccessCheck): boolean {
	const privilegedOrgRoles = ["owner", "admin", "director", "steward"];
	if (access.orgRoles.some((r) => privilegedOrgRoles.includes(r))) return true;
	return (
		access.staffRoles.includes("official") ||
		access.staffRoles.includes("checkpoint_captain")
	);
}

export function canManageRaceControl(access: EventGroupAccessCheck): boolean {
	const privilegedOrgRoles = ["owner", "admin", "director", "steward"];
	if (access.orgRoles.some((r) => privilegedOrgRoles.includes(r))) return true;
	return (
		access.staffRoles.includes("official") ||
		access.staffRoles.includes("checkpoint_captain")
	);
}

// ============================================================================
// 3. RFC 4180 CSV EXPORT BUILDERS
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

export function escapeCsvField(val: string | number | null | undefined): string {
	if (val === null || val === undefined) return "";
	const str = String(val);
	if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export function formatElapsedHms(seconds: number | null | undefined): string {
	if (seconds === null || seconds === undefined || seconds < 0) return "";
	const total = Math.floor(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * UltraSignup RFC 4180 format:
 * Header: `Place,First Name,Last Name,Age,Gender,City,State,Bib,Time,Status`
 */
export function formatUltraSignupCsv(runners: OfficialExportRunner[]): string {
	const header = "Place,First Name,Last Name,Age,Gender,City,State,Bib,Time,Status";
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
 * ITRA RFC 4180 format:
 * Header: `Bib,First Name,Last Name,Gender,Birth Date,Nationality,Time,Rank,Category,Status`
 */
export function formatItraCsv(runners: OfficialExportRunner[]): string {
	const header = "Bib,First Name,Last Name,Gender,Birth Date,Nationality,Time,Rank,Category,Status";
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
 * Standard ChekkPoint RFC 4180 format:
 * Header: `Place,Bib,Name,Gender,Age,Division,Status,TotalTime,PenaltyPoints`
 */
export function formatStandardCsv(runners: OfficialExportRunner[]): string {
	const header = "Place,Bib,Name,Gender,Age,Division,Status,TotalTime,PenaltyPoints";
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
