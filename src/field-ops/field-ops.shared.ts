import { z } from "zod";
import {
	calculateDwellSeconds,
	calculateSegmentPaceSecondsPerKm,
	calculateTsdPenalty,
	damerauLevenshtein,
	getTypoRecommendation,
	parseMt63Block,
	type Mt63ParseResult,
	type ParsedMt63Punch,
	type SubSplitKind,
	type TypoRecommendation,
} from "../testing/domain-algorithms.ts";

export {
	calculateDwellSeconds,
	calculateSegmentPaceSecondsPerKm,
	calculateTsdPenalty,
	damerauLevenshtein,
	getTypoRecommendation,
	parseMt63Block,
	type Mt63ParseResult,
	type ParsedMt63Punch,
	type SubSplitKind,
	type TypoRecommendation,
};

// ============================================================================
// ZOD SCHEMAS & INPUT VALIDATORS
// ============================================================================

export const subSplitKindSchema = z.enum(["in", "out", "point"]);

export const timingSourceSchema = z.enum([
	"rfid_transponder",
	"optical_photocell",
	"manual_web_entry",
	"mobile_offline_app",
	"mt63_ham_radio",
	"api_webhook",
]);

export const rawTimingStatusSchema = z.enum([
	"unprocessed",
	"matched",
	"duplicate_subordinate",
	"rejected_invalid",
	"flagged_discrepancy",
]);

export const recordStationSplitInput = z.object({
	eventGroupId: z.string().uuid(),
	competitorNumber: z.string().min(1),
	timingPointCode: z.string().min(1),
	subSplitKind: subSplitKindSchema,
	recordedTimeUtc: z.union([z.string(), z.date()]).transform((val) =>
		typeof val === "string" ? new Date(val) : val,
	),
	source: timingSourceSchema.default("manual_web_entry"),
	sourceDeviceId: z.string().optional(),
	recordedByPersonId: z.string().uuid().optional(),
	syncBatchId: z.string().uuid().optional(),
	withPacer: z.boolean().default(false),
	displayPrecisionDecimals: z.number().int().min(0).max(3).optional(),
});
export type RecordStationSplitInput = z.infer<typeof recordStationSplitInput>;

export const quickActionSplitInput = z.object({
	eventGroupId: z.string().uuid(),
	timingPointId: z.string().uuid(),
	entrantId: z.string().uuid(),
	action: z.enum(["record_in", "record_out", "stopped_here"]),
	recordedTimeUtc: z
		.union([z.string(), z.date()])
		.optional()
		.transform((val) => (val ? (typeof val === "string" ? new Date(val) : val) : new Date())),
});
export type QuickActionSplitInput = z.infer<typeof quickActionSplitInput>;

export const batchIngestSplitsInput = z.object({
	eventGroupId: z.string().uuid(),
	syncBatchId: z.string().uuid().optional(),
	punches: z.array(
		z.object({
			competitorNumber: z.string().min(1),
			timingPointCode: z.string().min(1),
			subSplitKind: subSplitKindSchema,
			recordedTimeUtc: z.union([z.string(), z.date()]).transform((val) =>
				typeof val === "string" ? new Date(val) : val,
			),
			source: timingSourceSchema.default("manual_web_entry"),
			withPacer: z.boolean().default(false),
		}),
	),
});
export type BatchIngestSplitsInput = z.infer<typeof batchIngestSplitsInput>;

export const reportRunnerDropInput = z
	.object({
		eventGroupId: z.string().uuid(),
		entrantId: z.string().uuid().optional(),
		competitorNumber: z.string().optional(),
		timingPointId: z.string().uuid().optional(),
		dropKind: z.enum(["dnf", "retired"]),
		dropLocationDescription: z.string().optional(),
		dropReason: z.string().default("voluntary"),
		recordedTimeUtc: z
			.union([z.string(), z.date()])
			.optional()
			.transform((val) => (val ? (typeof val === "string" ? new Date(val) : val) : new Date())),
	})
	.refine(
		(data) => Boolean(data.entrantId || data.competitorNumber),
		{ message: "Either entrantId or competitorNumber must be provided" },
	);
export type ReportRunnerDropInput = z.infer<typeof reportRunnerDropInput>;

export const ingestMt63RadioBlockInput = z.object({
	eventGroupId: z.string().uuid(),
	rawText: z.string().min(1),
	fallbackStationCode: z.string().optional(),
});
export type IngestMt63RadioBlockInput = z.infer<typeof ingestMt63RadioBlockInput>;

export const simulateTestPulseInput = z.object({
	eventGroupId: z.string().uuid(),
	timingPointCode: z.string().min(1),
	competitorNumber: z.string().min(1),
	subSplitKind: subSplitKindSchema.default("point"),
	source: timingSourceSchema.default("optical_photocell"),
	recordedTimeUtc: z
		.union([z.string(), z.date()])
		.optional()
		.transform((val) => (val ? (typeof val === "string" ? new Date(val) : val) : new Date())),
});
export type SimulateTestPulseInput = z.infer<typeof simulateTestPulseInput>;

export const eventGroupSlugParams = z.object({
	slug: z.string().min(1),
	eventGroupSlug: z.string().min(1),
});
export type EventGroupSlugParams = z.infer<typeof eventGroupSlugParams>;

export const stationParams = z.object({
	slug: z.string().min(1),
	eventGroupSlug: z.string().min(1),
	timingPointId: z.string().uuid(),
});
export type StationParams = z.infer<typeof stationParams>;

export const sarParams = z.object({
	slug: z.string().min(1),
	eventGroupSlug: z.string().min(1),
	eventId: z.string().uuid().optional(),
});
export type SarParams = z.infer<typeof sarParams>;

export const rawStreamParams = z.object({
	slug: z.string().min(1),
	eventGroupSlug: z.string().min(1),
	status: z.string().optional(),
	limit: z.number().int().min(1).max(200).default(50).optional(),
	offset: z.number().int().min(0).default(0).optional(),
});
export type RawStreamParams = z.infer<typeof rawStreamParams>;

export const emergencyDossierInput = z.object({
	eventGroupId: z.string().uuid(),
	entrantId: z.string().uuid(),
});
export type EmergencyDossierInput = z.infer<typeof emergencyDossierInput>;

// ============================================================================
// VIEW MODEL TYPES
// ============================================================================

export interface StationCustodyOverview {
	timingPoint: {
		id: string;
		code: string;
		name: string;
		elevationMeters: number | null;
		latitude: number;
		longitude: number;
	};
	counts: {
		expectedNext: number;
		inStationNow: number;
		departed: number;
		stoppedDnf: number;
		total: number;
	};
	distanceKm?: number | null;
}

export interface StationEntrantCard {
	entrantId: string;
	bibNumber: string;
	firstName: string;
	lastName: string;
	division: string;
	subEventName: string;
	status: string;
	withPacer: boolean;
	pacerName?: string | null;
	inTime?: Date | string | null;
	outTime?: Date | string | null;
	dwellSeconds?: number | null;
	segmentPaceSecondsPerKm?: number | null;
	projectedArrivalUtc?: Date | string | null;
	expectedCutoffRisk?: boolean;
	sarBadge?: string | null;
	lastKnownSplitName?: string | null;
	lastKnownSplitTime?: Date | string | null;
	stoppedHere?: boolean;
	dropReason?: string | null;
	dropLocationDescription?: string | null;
}

export interface StationCrossCheckData {
	station: {
		id: string;
		code: string;
		name: string;
		elevationMeters: number | null;
		latitude: number;
		longitude: number;
	};
	eventGroup: {
		id: string;
		name: string;
		slug: string;
		discipline: string;
	};
	zones: {
		expectedNext: StationEntrantCard[];
		inStationNow: StationEntrantCard[];
		departed: StationEntrantCard[];
		stoppedDnf: StationEntrantCard[];
	};
	allCandidateBibs: string[];
}

export interface CourseSegmentFunnel {
	segmentIndex: number;
	fromCheckpointName: string;
	toCheckpointName: string;
	entrantsBetweenCount: number;
	entrantsInDestinationStationCount: number;
}

export interface SarStage1Alert {
	entrantId: string;
	bibNumber: string;
	fullName: string;
	subEventName: string;
	lastSplitName: string;
	lastSplitTimeUtc: Date | string;
	expectedSplitName: string;
	projectedArrivalUtc?: Date | string | null;
	overdueSeconds: number;
	expectedCutoffRisk: boolean;
	sarBadge?: string | null;
	emergencyContactOnSite: boolean;
}

export interface SarStage2Alert {
	entrantId: string;
	bibNumber: string;
	fullName: string;
	subEventName: string;
	alertType: "lingering_in_station" | "retired_on_course";
	locationName: string;
	dwellSeconds?: number | null;
	details: string;
	dropReason?: string | null;
	dropLocationDescription?: string | null;
	emergencyContactOnSite: boolean;
	withdrawnAt?: Date | string | null;
}

export interface NetControlSarData {
	eventGroup: {
		id: string;
		name: string;
		slug: string;
		discipline: string;
	};
	selectedEventId?: string;
	funnel: CourseSegmentFunnel[];
	stage1Overdue: SarStage1Alert[];
	stage2Lingering: SarStage2Alert[];
	totalActiveEntrants: number;
	totalOverdueCount: number;
	totalLingeringOrRetiredCount: number;
}

export interface EntrantEmergencyDossier {
	entrant: {
		id: string;
		bibNumber: string;
		status: string;
		division: string;
		actualStartTime?: Date | string | null;
		dropReason?: string | null;
		dropLocationDescription?: string | null;
		comments?: string | null;
	};
	person: {
		id: string;
		firstName: string;
		lastName: string;
		email?: string | null;
		phone?: string | null;
	};
	participantData: {
		kind: string;
		medicalNotes: string | null; // Masked if unauthorized
		pacerName?: string | null;
		tShirtSize?: string | null;
		vehicle?: {
			make: string;
			model: string;
			year: number;
			vehicleClass: string;
		} | null;
		driver?: {
			name: string;
			licenseNumber: string;
			phone?: string | null;
		} | null;
	};
	emergencyContact: {
		id?: string | null;
		name?: string | null;
		phone?: string | null;
		relation?: string | null;
		isOnSite: boolean;
	};
	historicalSummary?: {
		experienceTier: string;
		dnfRate: number;
		totalRaces: number;
		safetyTriageNotes: string | null; // Masked if unauthorized
	} | null;
	projection?: {
		projectedFinishSeconds?: number | null;
		projectedPaceSecondsPerKm?: number | null;
		expectedCutoffRisk: boolean;
		volunteersSarSafetyBadge?: string | null;
	} | null;
	lastKnownSplit?: {
		splitName: string;
		stationCode: string;
		timeUtc: Date | string;
		elapsedSeconds: number;
		subSplitKind: string;
	} | null;
	isMedicalDataMasked: boolean;
}

export interface FieldLoggerData {
	eventGroupId: string;
	eventGroupName: string;
	stations: StationCustodyOverview[];
	candidateBibs: string[];
	entrants: Array<{
		id: string;
		bibNumber: string;
		firstName: string;
		lastName: string;
		status: string;
		subEventName: string;
	}>;
}
