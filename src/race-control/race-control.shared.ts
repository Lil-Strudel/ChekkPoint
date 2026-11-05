import { z } from "zod";

export const AddressSchema = z.object({
	street1: z.string().optional(),
	street2: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	postalCode: z.string().optional(),
	country: z.string().default("US"),
});

export const SoloCompetitorSchema = z.object({
	kind: z.literal("solo_competitor"),
	medicalNotes: z.string().optional(),
	pacerName: z.string().optional(),
	tShirtSize: z.string().optional(),
});

export const VehicleCrewSchema = z.object({
	kind: z.literal("vehicle_crew"),
	driver: z.object({
		name: z.string(),
		licenseNumber: z.string(),
		phone: z.string().optional(),
	}),
	coDriver: z
		.object({
			name: z.string(),
			licenseNumber: z.string(),
			phone: z.string().optional(),
		})
		.optional(),
	vehicle: z.object({
		make: z.string(),
		model: z.string(),
		year: z.number().int(),
		vehicleClass: z.string(),
	}),
});

export const RelayTeamSchema = z.object({
	kind: z.literal("relay_team"),
	teamName: z.string(),
	captainContact: z.object({
		name: z.string(),
		phone: z.string(),
		email: z.string().optional(),
		address: AddressSchema.optional(),
	}),
	members: z.array(
		z.object({
			legNumber: z.number().int(),
			name: z.string(),
			phone: z.string().optional(),
		}),
	),
});

export const ParticipantDataSchema = z.discriminatedUnion("kind", [
	SoloCompetitorSchema,
	VehicleCrewSchema,
	RelayTeamSchema,
]);

export type ParticipantData = z.infer<typeof ParticipantDataSchema>;

export const RulesConfigSchema = z.object({
	timeFormat: z
		.enum(["HH:MM:SS", "HH:MM:SS.sss", "MM:SS.sss"])
		.default("HH:MM:SS"),
	displayPrecisionDecimals: z.number().int().min(0).max(3).default(0),
	allowSelfCheckIn: z.boolean().default(false),
	requirePacerRegistration: z.boolean().default(false),
	earlyPenaltyFactor: z.number().default(2.0),
	latePenaltyFactor: z.number().default(1.0),
	gracePeriodSeconds: z.number().default(0.0),
	yardDistanceMiles: z.number().default(4.166667),
	yardTimeLimitSeconds: z.number().default(3600),
});

export type RulesConfig = z.infer<typeof RulesConfigSchema>;

// ============================================================================
// ROUTE PARAMS SCHEMAS
// ============================================================================

export const eventGroupSlugParams = z.object({
	slug: z.string().trim().min(1),
	eventGroupSlug: z.string().trim().min(1),
});

export const subEventParams = z.object({
	slug: z.string().trim().min(1),
	eventGroupSlug: z.string().trim().min(1),
	eventId: z.string().uuid(),
});

// ============================================================================
// RULES & CONFIG SCHEMAS
// ============================================================================

export const updateEventGroupRulesInput = z.object({
	eventGroupId: z.string().uuid(),
	rulesConfig: RulesConfigSchema,
});

export const partialRulesConfigInput = z.object({
	eventGroupId: z.string().uuid(),
	timeFormat: z.enum(["HH:MM:SS", "HH:MM:SS.sss", "MM:SS.sss"]).optional(),
	displayPrecisionDecimals: z.number().int().min(0).max(3).optional(),
	allowSelfCheckIn: z.boolean().optional(),
	requirePacerRegistration: z.boolean().optional(),
	earlyPenaltyFactor: z.number().nonnegative().optional(),
	latePenaltyFactor: z.number().nonnegative().optional(),
	gracePeriodSeconds: z.number().nonnegative().optional(),
	yardDistanceMiles: z.number().positive().optional(),
	yardTimeLimitSeconds: z.number().positive().optional(),
});

// ============================================================================
// STAFF & STATION MATRIX SCHEMAS
// ============================================================================

export const staffRoleEnumSchema = z.enum([
	"volunteer",
	"checkpoint_captain",
	"official",
	"medical",
]);

export const assignStaffTimingPointInput = z.object({
	eventGroupId: z.string().uuid(),
	staffId: z.string().uuid(),
	timingPointId: z.string().uuid(),
});

export const removeStaffTimingPointInput = z.object({
	eventGroupId: z.string().uuid(),
	staffId: z.string().uuid(),
	timingPointId: z.string().uuid(),
});

export const updateStaffRolesInput = z.object({
	eventGroupId: z.string().uuid(),
	staffId: z.string().uuid(),
	roles: z.array(staffRoleEnumSchema).min(1),
});

export const rosterStaffMemberInput = z.object({
	eventGroupId: z.string().uuid(),
	personId: z.string().uuid().optional(),
	email: z.string().email().optional(),
	firstName: z.string().trim().optional(),
	lastName: z.string().trim().optional(),
	roles: z.array(staffRoleEnumSchema).min(1),
	timingPointId: z.string().uuid().optional(),
});

export const removeStaffMemberInput = z.object({
	eventGroupId: z.string().uuid(),
	staffId: z.string().uuid(),
});

// ============================================================================
// GUN START & SUB-EVENT CONTROLS SCHEMAS
// ============================================================================

export const startEventGunInput = z.object({
	eventId: z.string().uuid(),
	actualStart: z.string().optional(),
});

export const resetEventGunInput = z.object({
	eventId: z.string().uuid(),
});

export const createSubEventInput = z.object({
	eventGroupId: z.string().uuid(),
	name: z.string().trim().min(1).max(80),
	courseId: z.string().uuid(),
	lapsRequired: z.number().int().positive().default(1),
	scheduledStart: z.string(),
});

// ============================================================================
// DISCIPLINE-SPECIFIC OPERATIONAL ACTION SCHEMAS
// ============================================================================

export const backyardCloseYardInput = z.object({
	eventId: z.string().uuid(),
	completedYardNumber: z.number().int().positive(),
	completedEntrantIds: z.array(z.string().uuid()).optional(),
});

export const tsdGenerateIntervalStartsInput = z.object({
	eventId: z.string().uuid(),
	baseStartTimeUtc: z.string(),
	intervalSeconds: z.number().positive().default(60),
});

export const tsdRevealSecretCheckpointsInput = z.object({
	eventId: z.string().uuid(),
	reveal: z.boolean(),
});

export const downhillGateReleaseInput = z.object({
	eventId: z.string().uuid(),
	entrantId: z.string().uuid(),
	actualStartTime: z.string(),
});

export const downhillRedFlagHoldInput = z.object({
	eventId: z.string().uuid(),
	holdNote: z.string().trim().min(1),
});

export const xcoCheckLappedPullInput = z.object({
	eventId: z.string().uuid(),
	leaderLap: z.number().int().positive(),
	leaderLapTimeSeconds: z.number().positive(),
});

export const fixedTimeRecordPartialLapInput = z.object({
	eventId: z.string().uuid(),
	entrantId: z.string().uuid(),
	partialDistanceMeters: z.number().nonnegative(),
});

// ============================================================================
// ENTRANT CRUD & CHECK-IN DESK SCHEMAS
// ============================================================================

export const checkInEntrantInput = z.object({
	entrantId: z.string().uuid(),
	status: z.enum([
		"registered",
		"checked_in",
		"dns",
		"in_progress",
		"finished",
		"dnf",
		"dq",
		"retired",
	]),
	competitorNumber: z.string().trim().optional(),
	rfidCode: z.string().trim().nullable().optional(),
	emergencyContactIsOnSite: z.boolean().optional(),
});

export const updateEntrantWorkspaceInput = z.object({
	entrantId: z.string().uuid(),
	targetEventId: z.string().uuid().optional(), // For sub-event distance transfer
	competitorNumber: z.string().trim().min(1),
	rfidCode: z.string().trim().nullable().optional(),
	division: z.string().trim().min(1),
	scheduledStartTime: z.string().nullable().optional(),
	actualStartTime: z.string().nullable().optional(),
	participantData: ParticipantDataSchema,
	emergencyContactPersonId: z.string().uuid().nullable().optional(),
	emergencyContactFirstName: z.string().trim().optional(),
	emergencyContactLastName: z.string().trim().optional(),
	emergencyContactPhone: z.string().trim().optional(),
	emergencyContactRelationship: z.string().trim().nullable().optional(),
	emergencyContactIsOnSite: z.boolean().optional(),
});

export const verifyExternalProfileInput = z.object({
	externalProfileId: z.string().uuid(),
	status: z.enum(["manual_verified", "rejected"]),
});

export const recalculateEntrantProjectionInput = z.object({
	entrantId: z.string().uuid(),
});

// ============================================================================
// HELPER TYPES
// ============================================================================

export type CombinedCustodyCounts = {
	registered: number;
	checkedIn: number;
	inProgress: number;
	finished: number;
	dnf: number;
	retired: number;
	dns: number;
	total: number;
};

// ============================================================================
// DOMAIN CALCULATIONS & UTILITIES
// ============================================================================

export function calculateBackyardWhistleAlert(
	elapsedSecondsInYard: number,
	yardDurationMinutes = 60,
): string | null {
	const remainingSeconds = yardDurationMinutes * 60 - elapsedSecondsInYard;
	if (remainingSeconds <= 0) return "TIME EXPIRED";
	if (remainingSeconds === 60) return "1 WHISTLE - 1 MINUTE TO BELL";
	if (remainingSeconds === 120) return "2 WHISTLES - 2 MINUTES TO BELL";
	if (remainingSeconds === 180) return "3 WHISTLES - 3 MINUTES TO BELL";
	return null;
}

export function calculateTsdScore(
	actualSeconds: number,
	targetSeconds = 3600,
	earlyMultiplier = 2.0,
	lateMultiplier = 1.0,
	maxEarlyPenalty = 600,
): {
	deltaSeconds: number;
	penaltyPoints: number;
	direction: "early" | "late" | "on_time";
} {
	const delta = actualSeconds - targetSeconds;
	if (delta === 0) {
		return { deltaSeconds: 0, penaltyPoints: 0, direction: "on_time" };
	}
	if (delta < 0) {
		const rawPenalty = Math.abs(delta) * earlyMultiplier;
		const penaltyPoints = Math.min(rawPenalty, maxEarlyPenalty);
		return { deltaSeconds: delta, penaltyPoints, direction: "early" };
	}
	const penaltyPoints = delta * lateMultiplier;
	return { deltaSeconds: delta, penaltyPoints, direction: "late" };
}

export function isSubjectTo80PercentPull(
	leaderLapTimeSeconds: number,
	entrantLapTimeSeconds: number,
	cutoffRatio = 0.8,
): {
	gapSeconds: number;
	gapPercentage: number;
	isPulled: boolean;
} {
	const gapSeconds = entrantLapTimeSeconds - leaderLapTimeSeconds;
	const gapPercentage = (gapSeconds / leaderLapTimeSeconds) * 100;
	const isPulled = gapSeconds >= leaderLapTimeSeconds * cutoffRatio;
	return { gapSeconds, gapPercentage, isPulled };
}

export function evaluateSarBadge(overdueMinutes: number): {
	level: "normal" | "overdue" | "critical";
	badgeColor: string;
} {
	if (overdueMinutes >= 30) {
		return { level: "critical", badgeColor: "bg-red-900/20 text-red-700" };
	}
	if (overdueMinutes >= 15) {
		return { level: "overdue", badgeColor: "bg-amber-900/20 text-amber-700" };
	}
	return { level: "normal", badgeColor: "bg-emerald-900/20 text-emerald-700" };
}

export function calculatePacingProjection(
	elapsedSeconds: number,
	completedMeters: number,
	totalCourseMeters: number,
): {
	projectedFinishSeconds: number;
	projectedHours: string;
} {
	if (completedMeters <= 0) {
		return { projectedFinishSeconds: 0, projectedHours: "0.00" };
	}
	const avgPaceSecPerMeter = elapsedSeconds / completedMeters;
	const projectedFinishSeconds = Math.round(avgPaceSecPerMeter * totalCourseMeters);
	const projectedHours = (projectedFinishSeconds / 3600).toFixed(2);
	return { projectedFinishSeconds, projectedHours };
}

export function computeCombinedCustody(statuses: string[]): CombinedCustodyCounts {
	return {
		registered: statuses.filter((s) => s === "registered").length,
		checkedIn: statuses.filter((s) => s === "checked_in").length,
		inProgress: statuses.filter((s) => s === "in_progress").length,
		finished: statuses.filter((s) => s === "finished").length,
		dnf: statuses.filter((s) => s === "dnf").length,
		retired: statuses.filter((s) => s === "retired").length,
		dns: statuses.filter((s) => s === "dns").length,
		total: statuses.length,
	};
}

export function naturalCompareCompetitorNumbers(a: string, b: string): number {
	return a.localeCompare(b, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

export type EventGroupAccessCheck = {
	organizationId?: string;
	orgRoles: string[];
	staffRoles: string[];
	timingPointIds?: string[];
};

export function canViewMedicalData(access: EventGroupAccessCheck): boolean {
	const privilegedOrgRoles = ["owner", "admin", "director"];
	if (access.orgRoles.some((r) => privilegedOrgRoles.includes(r))) return true;
	return (
		access.staffRoles.includes("medical") ||
		access.staffRoles.includes("official")
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

