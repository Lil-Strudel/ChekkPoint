/**
 * ChekkPoint In-Memory CQRS, SAR & RBAC Test Harness
 *
 * Implements an in-memory transactional database store, CQRS projection engine,
 * deterministic split rebuild, SAR Stage 1 & Stage 2 query engine, and RBAC evaluator
 * that mirror Drizzle ORM schemas and server functions.
 */

import {
	calculateDwellSeconds,
	calculateSegmentPaceSecondsPerKm,
	calculateTsdPenalty,
	type SubSplitKind,
} from "./domain-algorithms.ts";

// ============================================================================
// 1. DATA TYPES (MIRRORING SCHEMA.TS)
// ============================================================================

export type Discipline =
	| "trail_ultra"
	| "road_marathon"
	| "backyard_ultra"
	| "fixed_time_loop"
	| "downhill_mtb"
	| "xco_cycling"
	| "tsd_regularity";

export type EntrantStatus =
	| "registered"
	| "checked_in"
	| "dns"
	| "in_progress"
	| "finished"
	| "dnf"
	| "retired"
	| "dq"
	| "otl";

export type DataStatus =
	| "provisional"
	| "valid"
	| "questionable"
	| "bad"
	| "confirmed";

export type RawTimingStatus =
	| "unprocessed"
	| "matched"
	| "duplicate_subordinate"
	| "rejected_invalid"
	| "flagged_discrepancy";

export type TimingSource =
	| "rfid_transponder"
	| "optical_photocell"
	| "manual_web_entry"
	| "mobile_offline_app"
	| "mt63_ham_radio"
	| "api_webhook";

export type StaffRole = "volunteer" | "checkpoint_captain" | "official" | "medical";

export type OrgRole = "owner" | "admin" | "director" | "steward" | "member";

export interface RawTimingEvent {
	id: string;
	eventGroupId: string;
	competitorNumber: string;
	timingPointCode: string;
	subSplitKind: SubSplitKind;
	recordedTimeUtc: Date;
	source: TimingSource;
	sourceDeviceId?: string | null;
	recordedByPersonId?: string | null;
	syncBatchId?: string | null;
	withPacer: boolean;
	rawPayload?: Record<string, unknown> | null;
	status: RawTimingStatus;
	auditNote?: string | null;
	createdAt: Date;
}

export interface ScoredSplitTime {
	id: string;
	entrantId: string;
	courseSplitId: string;
	lap: number;
	subSplitKind: SubSplitKind;
	absoluteTimeUtc: Date;
	elapsedSeconds: number;
	dwellSeconds?: number | null;
	segmentPaceSecondsPerKm?: number | null;
	tsdDeviationSeconds?: number | null;
	penaltyPoints: number;
	stoppedHere: boolean;
	dataStatus: DataStatus;
	governingRawEventId?: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface TimeAllowance {
	id: string;
	entrantId: string;
	splitId: string;
	startTime: Date;
	endTime: Date;
	durationSeconds: number;
	reason: "medical_hold" | "hazard_hold" | "gear_check" | string;
	authorizedByPersonId: string;
	notes?: string | null;
	createdAt: Date;
}

export interface SplitTimeAudit {
	id: string;
	splitTimeId: string;
	action: "CREATED" | "UPDATED" | "DELETED" | "REBUILT" | "CONFIRMED";
	previousState?: Record<string, unknown> | null;
	newState?: Record<string, unknown> | null;
	changedByPersonId: string;
	changeReason: string;
	createdAt: Date;
}

export interface CourseSplit {
	id: string;
	courseId: string;
	timingPointId: string;
	name: string;
	sequenceOrder: number;
	distanceFromStartMeters: number;
	elevationMeters?: number | null;
	subSplitBitmap: number; // 1: in, 2: out, 3: in+out
	cutoffDurationSeconds?: number | null;
	isSecretCheckpoint?: boolean;
	idealDurationSeconds?: number | null; // For TSD regularity
}

export interface TimingPoint {
	id: string;
	organizationId: string;
	code: string;
	name: string;
	latitude: number;
	longitude: number;
	elevationMeters?: number | null;
}

export interface Entrant {
	id: string;
	eventId: string;
	personId: string;
	bibNumber: string;
	status: EntrantStatus;
	actualStartTime?: Date | null;
	withdrawnAt?: Date | null;
	withdrawnTimingPointId?: string | null;
	medicalNotes?: string | null;
	safetyTriageNotes?: string | null;
	projectedArrivals?: Record<
		string,
		{ projectedUtc: Date; earliestUtc: Date; latestUtc: Date }
	>;
}

export interface EventGroup {
	id: string;
	organizationId: string;
	name: string;
	slug: string;
	discipline: Discipline;
	rulesConfig?: {
		earlyPenaltyFactor?: number;
		latePenaltyFactor?: number;
		gracePeriodSeconds?: number;
		yardDistanceMiles?: number;
		yardTimeLimitSeconds?: number;
	};
}

export interface SubEvent {
	id: string;
	eventGroupId: string;
	courseId: string;
	name: string;
	gunStartTime?: Date | null;
}

export interface Person {
	id: string;
	firstName: string;
	lastName: string;
	email?: string | null;
	phone?: string | null;
	emergencyContactName?: string | null;
	emergencyContactPhone?: string | null;
	emergencyContactRelation?: string | null;
	emergencyContactIsOnSite?: boolean;
}

export interface EventGroupStaffAssignment {
	id: string;
	eventGroupId: string;
	personId: string;
	roles: StaffRole[];
	assignedTimingPointIds: string[];
}

export interface OrgMember {
	id: string;
	organizationId: string;
	userId: string;
	role: OrgRole;
}

export interface EventGroupAccess {
	organizationId: string;
	orgRoles: OrgRole[];
	staffRoles: StaffRole[];
	timingPointIds: string[];
}

// ============================================================================
// 2. IN-MEMORY TEST DATABASE & STORE
// ============================================================================

export class TestDatabase {
	rawTimingEvents: RawTimingEvent[] = [];
	scoredSplitTimes: ScoredSplitTime[] = [];
	timeAllowances: TimeAllowance[] = [];
	splitTimeAudits: SplitTimeAudit[] = [];
	courseSplits: CourseSplit[] = [];
	timingPoints: TimingPoint[] = [];
	entrants: Entrant[] = [];
	events: SubEvent[] = [];
	eventGroups: EventGroup[] = [];
	people: Person[] = [];
	staffAssignments: EventGroupStaffAssignment[] = [];
	orgMembers: OrgMember[] = [];

	private idCounter = 1;

	nextId(prefix = "id"): string {
		return `${prefix}-${this.idCounter++}`;
	}

	clear(): void {
		this.rawTimingEvents = [];
		this.scoredSplitTimes = [];
		this.timeAllowances = [];
		this.splitTimeAudits = [];
		this.courseSplits = [];
		this.timingPoints = [];
		this.entrants = [];
		this.events = [];
		this.eventGroups = [];
		this.people = [];
		this.staffAssignments = [];
		this.orgMembers = [];
		this.idCounter = 1;
	}

	// --------------------------------------------------------------------------
	// CQRS Write Plane -> Read Plane Pipeline
	// --------------------------------------------------------------------------

	/**
	 * Ingests a raw punch into the append-only write plane.
	 * Evaluates clustering/de-bouncing: if a punch for the same runner, station, and subSplitKind
	 * exists within 30 seconds, marks as duplicate_subordinate.
	 * Otherwise projects into scored_split_times.
	 */
	ingestRawTimingEvent(input: {
		eventGroupId: string;
		competitorNumber: string;
		timingPointCode: string;
		subSplitKind: SubSplitKind;
		recordedTimeUtc: Date;
		source: TimingSource;
		sourceDeviceId?: string;
		recordedByPersonId?: string;
		syncBatchId?: string;
		withPacer?: boolean;
	}): { rawEvent: RawTimingEvent; scoredSplit: ScoredSplitTime | null } {
		const timingPoint = this.timingPoints.find(
			(tp) => tp.code.toUpperCase() === input.timingPointCode.toUpperCase(),
		);

		// Cluster / Duplicate check: look for recent punch within 30 seconds
		const clusterWindowMs = 30 * 1000;
		const existingCluster = this.rawTimingEvents.find(
			(e) =>
				e.eventGroupId === input.eventGroupId &&
				e.competitorNumber === input.competitorNumber &&
				e.timingPointCode.toUpperCase() === input.timingPointCode.toUpperCase() &&
				e.subSplitKind === input.subSplitKind &&
				Math.abs(e.recordedTimeUtc.getTime() - input.recordedTimeUtc.getTime()) <=
					clusterWindowMs,
		);

		const isDuplicate = existingCluster !== undefined;
		const status: RawTimingStatus = isDuplicate
			? "duplicate_subordinate"
			: "matched";

		const rawEvent: RawTimingEvent = {
			id: this.nextId("raw"),
			eventGroupId: input.eventGroupId,
			competitorNumber: input.competitorNumber,
			timingPointCode: input.timingPointCode,
			subSplitKind: input.subSplitKind,
			recordedTimeUtc: input.recordedTimeUtc,
			source: input.source,
			sourceDeviceId: input.sourceDeviceId ?? null,
			recordedByPersonId: input.recordedByPersonId ?? null,
			syncBatchId: input.syncBatchId ?? null,
			withPacer: input.withPacer ?? false,
			status,
			auditNote: isDuplicate ? "Clustered with earlier raw pulse" : null,
			createdAt: new Date(),
		};

		this.rawTimingEvents.push(rawEvent);

		// If subordinate duplicate, read plane does not update
		if (isDuplicate) {
			return { rawEvent, scoredSplit: null };
		}

		// Project into read-plane scored_split_times
		const scoredSplit = this.projectRawToScored(rawEvent, timingPoint);
		return { rawEvent, scoredSplit };
	}

	private projectRawToScored(
		rawEvent: RawTimingEvent,
		timingPoint?: TimingPoint,
	): ScoredSplitTime | null {
		const entrant = this.entrants.find(
			(e) => e.bibNumber === rawEvent.competitorNumber,
		);
		if (!entrant) return null;

		const subEvent = this.events.find((ev) => ev.id === entrant.eventId);
		if (!subEvent) return null;

		const group = this.eventGroups.find((g) => g.id === rawEvent.eventGroupId);

		// Find corresponding course split
		const split = this.courseSplits.find(
			(cs) =>
				cs.courseId === subEvent.courseId &&
				timingPoint &&
				cs.timingPointId === timingPoint.id,
		);
		if (!split) return null;

		const startTime = entrant.actualStartTime ?? subEvent.gunStartTime;
		let elapsedSeconds = 0;
		let dataStatus: DataStatus = "valid";

		if (startTime) {
			elapsedSeconds =
				(rawEvent.recordedTimeUtc.getTime() - startTime.getTime()) / 1000;
			// Negative duration edge case
			if (elapsedSeconds < 0) {
				dataStatus = "bad";
			}
		}

		// Calculate in-station dwell time if OUT punch
		let dwellSeconds: number | null = null;
		if (rawEvent.subSplitKind === "out") {
			const inSplit = this.scoredSplitTimes.find(
				(s) =>
					s.entrantId === entrant.id &&
					s.courseSplitId === split.id &&
					s.subSplitKind === "in",
			);
			if (inSplit) {
				dwellSeconds = calculateDwellSeconds(
					inSplit.absoluteTimeUtc,
					rawEvent.recordedTimeUtc,
				);
			}
		}

		// Calculate segment pace from previous split
		let segmentPaceSecondsPerKm: number | null = null;
		const prevSplits = this.scoredSplitTimes
			.filter((s) => s.entrantId === entrant.id)
			.map((s) => ({
				splitTime: s,
				courseSplit: this.courseSplits.find((cs) => cs.id === s.courseSplitId)!,
			}))
			.filter((x) => x.courseSplit && x.courseSplit.sequenceOrder < split.sequenceOrder)
			.sort((a, b) => b.courseSplit.sequenceOrder - a.courseSplit.sequenceOrder);

		if (prevSplits.length > 0) {
			const prev = prevSplits[0];
			const deltaDist =
				split.distanceFromStartMeters - prev.courseSplit.distanceFromStartMeters;
			const deltaSec = elapsedSeconds - prev.splitTime.elapsedSeconds;
			segmentPaceSecondsPerKm = calculateSegmentPaceSecondsPerKm(
				deltaDist,
				deltaSec,
			);
		}

		// TSD Regularity penalties
		let tsdDeviationSeconds: number | null = null;
		let penaltyPoints = 0;
		if (group?.discipline === "tsd_regularity" && split.idealDurationSeconds) {
			const penalty = calculateTsdPenalty(
				elapsedSeconds,
				split.idealDurationSeconds,
				group.rulesConfig,
			);
			tsdDeviationSeconds = penalty.deviationSeconds;
			penaltyPoints = penalty.penaltyPoints;
		}

		// Upsert or insert scored split time (unique on entrantId, courseSplitId, lap, subSplitKind)
		const existingIndex = this.scoredSplitTimes.findIndex(
			(s) =>
				s.entrantId === entrant.id &&
				s.courseSplitId === split.id &&
				s.lap === 1 &&
				s.subSplitKind === rawEvent.subSplitKind,
		);

		const scored: ScoredSplitTime = {
			id:
				existingIndex >= 0
					? this.scoredSplitTimes[existingIndex].id
					: this.nextId("split"),
			entrantId: entrant.id,
			courseSplitId: split.id,
			lap: 1,
			subSplitKind: rawEvent.subSplitKind,
			absoluteTimeUtc: rawEvent.recordedTimeUtc,
			elapsedSeconds,
			dwellSeconds,
			segmentPaceSecondsPerKm,
			tsdDeviationSeconds,
			penaltyPoints,
			stoppedHere: false,
			dataStatus,
			governingRawEventId: rawEvent.id,
			createdAt:
				existingIndex >= 0
					? this.scoredSplitTimes[existingIndex].createdAt
					: new Date(),
			updatedAt: new Date(),
		};

		if (existingIndex >= 0) {
			this.scoredSplitTimes[existingIndex] = scored;
		} else {
			this.scoredSplitTimes.push(scored);
		}

		return scored;
	}

	/**
	 * Deterministic CQRS rebuild idempotency engine (`rebuildSplits`).
	 * Re-evaluates raw append-only ledger chronologically to re-derive the read plane identically.
	 */
	rebuildSplits(
		entrantId: string,
		changedByPersonId: string,
		changeReason: string,
	): ScoredSplitTime[] {
		if (!changeReason || changeReason.trim() === "") {
			throw new Error("changeReason is mandatory for rebuildSplits");
		}

		const entrant = this.entrants.find((e) => e.id === entrantId);
		if (!entrant) throw new Error(`Entrant ${entrantId} not found`);

		// Snapshot previous state
		const previousState = this.scoredSplitTimes.filter(
			(s) => s.entrantId === entrantId,
		);

		// Remove existing read plane records
		this.scoredSplitTimes = this.scoredSplitTimes.filter(
			(s) => s.entrantId !== entrantId,
		);

		// Replay all raw events chronologically
		const rawEvents = this.rawTimingEvents
			.filter(
				(r) =>
					r.competitorNumber === entrant.bibNumber &&
					r.status !== "rejected_invalid",
			)
			.sort((a, b) => a.recordedTimeUtc.getTime() - b.recordedTimeUtc.getTime());

		for (const raw of rawEvents) {
			const tp = this.timingPoints.find(
				(p) => p.code.toUpperCase() === raw.timingPointCode.toUpperCase(),
			);
			this.projectRawToScored(raw, tp);
		}

		const rebuilt = this.scoredSplitTimes.filter(
			(s) => s.entrantId === entrantId,
		);

		// Log rebuild in audit trail
		this.splitTimeAudits.push({
			id: this.nextId("audit"),
			splitTimeId: rebuilt[0]?.id ?? "all",
			action: "REBUILT",
			previousState: { count: previousState.length, splits: previousState },
			newState: { count: rebuilt.length, splits: rebuilt },
			changedByPersonId,
			changeReason,
			createdAt: new Date(),
		});

		return rebuilt;
	}

	// --------------------------------------------------------------------------
	// Time Allowances & Cutoff Extensions
	// --------------------------------------------------------------------------

	grantTimeAllowance(input: {
		entrantId: string;
		splitId: string;
		startTime: Date;
		endTime: Date;
		durationSeconds: number;
		reason: "medical_hold" | "hazard_hold" | "gear_check" | string;
		authorizedByPersonId: string;
		notes?: string;
	}): TimeAllowance {
		if (input.durationSeconds <= 0) {
			throw new Error("Time allowance duration must be greater than zero");
		}

		const allowance: TimeAllowance = {
			id: this.nextId("allowance"),
			entrantId: input.entrantId,
			splitId: input.splitId,
			startTime: input.startTime,
			endTime: input.endTime,
			durationSeconds: input.durationSeconds,
			reason: input.reason,
			authorizedByPersonId: input.authorizedByPersonId,
			notes: input.notes ?? null,
			createdAt: new Date(),
		};

		this.timeAllowances.push(allowance);
		return allowance;
	}

	getAdjustedNetElapsedSeconds(
		entrantId: string,
		rawElapsedSeconds: number,
	): number {
		const allowances = this.timeAllowances.filter((a) => a.entrantId === entrantId);
		const totalAllowance = allowances.reduce(
			(acc, a) => acc + a.durationSeconds,
			0,
		);
		return Math.max(0, rawElapsedSeconds - totalAllowance);
	}

	getAdjustedCutoffSeconds(
		entrantId: string,
		baseCutoffSeconds: number,
	): number {
		const allowances = this.timeAllowances.filter((a) => a.entrantId === entrantId);
		const totalAllowance = allowances.reduce(
			(acc, a) => acc + a.durationSeconds,
			0,
		);
		return baseCutoffSeconds + totalAllowance;
	}

	// --------------------------------------------------------------------------
	// Forensic Audit Trail Logging
	// --------------------------------------------------------------------------

	recordSplitAudit(input: {
		splitTimeId: string;
		action: "CREATED" | "UPDATED" | "DELETED" | "REBUILT" | "CONFIRMED";
		previousState?: Record<string, unknown> | null;
		newState?: Record<string, unknown> | null;
		changedByPersonId: string;
		changeReason: string;
	}): SplitTimeAudit {
		if (!input.changeReason || input.changeReason.trim() === "") {
			throw new Error("Forensic audit log requires a non-empty changeReason");
		}

		const audit: SplitTimeAudit = {
			id: this.nextId("audit"),
			splitTimeId: input.splitTimeId,
			action: input.action,
			previousState: input.previousState ?? null,
			newState: input.newState ?? null,
			changedByPersonId: input.changedByPersonId,
			changeReason: input.changeReason.trim(),
			createdAt: new Date(),
		};

		this.splitTimeAudits.push(audit);
		return audit;
	}

	// --------------------------------------------------------------------------
	// SAR Stage 1 & Stage 2 Queries
	// --------------------------------------------------------------------------

	/**
	 * Stage 1 (Overdue Between Checkpoints):
	 * Entrants who have passed checkpoint N, have not reached checkpoint N+1,
	 * and asOfTime exceeds the projected arrival upper bound.
	 */
	queryStage1Overdue(
		eventGroupId: string,
		asOfTime: Date,
	): Array<{ entrant: Entrant; lastSplit: ScoredSplitTime; overdueSeconds: number }> {
		const overdueList: Array<{
			entrant: Entrant;
			lastSplit: ScoredSplitTime;
			overdueSeconds: number;
		}> = [];

		const activeEntrants = this.entrants.filter(
			(e) => e.status === "in_progress" || e.status === "checked_in",
		);

		for (const entrant of activeEntrants) {
			const splits = this.scoredSplitTimes
				.filter((s) => s.entrantId === entrant.id)
				.sort((a, b) => {
					const csa = this.courseSplits.find((cs) => cs.id === a.courseSplitId)!;
					const csb = this.courseSplits.find((cs) => cs.id === b.courseSplitId)!;
					return (csa?.sequenceOrder ?? 0) - (csb?.sequenceOrder ?? 0);
				});

			if (splits.length === 0) continue;
			const lastSplit = splits[splits.length - 1];

			// Find next course split
			const lastCourseSplit = this.courseSplits.find(
				(cs) => cs.id === lastSplit.courseSplitId,
			);
			if (!lastCourseSplit) continue;

			const nextCourseSplit = this.courseSplits.find(
				(cs) =>
					cs.courseId === lastCourseSplit.courseId &&
					cs.sequenceOrder === lastCourseSplit.sequenceOrder + 1,
			);
			if (!nextCourseSplit) continue; // At finish line

			// Check projected arrival window
			const projection = entrant.projectedArrivals?.[nextCourseSplit.id];
			if (projection && asOfTime > projection.latestUtc) {
				const overdueSeconds = Math.round(
					(asOfTime.getTime() - projection.latestUtc.getTime()) / 1000,
				);
				overdueList.push({ entrant, lastSplit, overdueSeconds });
			}
		}

		return overdueList;
	}

	/**
	 * Stage 2 (Lingering Inside Aid Station & Retired on Course):
	 * 1. Entrants currently IN station whose dwell time exceeds maxSafeDwellSeconds (e.g. 45 min).
	 * 2. Entrants whose status is 'retired' (withdrew between checkpoints).
	 */
	queryStage2LingeringOrRetired(
		eventGroupId: string,
		asOfTime: Date,
		maxSafeDwellSeconds = 45 * 60, // 45 minutes
	): Array<{
		entrant: Entrant;
		type: "lingering_in_station" | "retired_on_course";
		timingPointName?: string;
		dwellSeconds?: number;
		details: string;
	}> {
		const alerts: Array<{
			entrant: Entrant;
			type: "lingering_in_station" | "retired_on_course";
			timingPointName?: string;
			dwellSeconds?: number;
			details: string;
		}> = [];

		// 1. Retired on course
		const retiredEntrants = this.entrants.filter((e) => e.status === "retired");
		for (const r of retiredEntrants) {
			alerts.push({
				entrant: r,
				type: "retired_on_course",
				details: `Runner withdrew between checkpoints at ${r.withdrawnAt?.toISOString() ?? "unknown time"}`,
			});
		}

		// 2. Lingering inside station (checked IN without matching OUT)
		for (const entrant of this.entrants.filter(
			(e) => e.status === "in_progress",
		)) {
			const inSplits = this.scoredSplitTimes.filter(
				(s) => s.entrantId === entrant.id && s.subSplitKind === "in",
			);
			for (const inSplit of inSplits) {
				const outSplit = this.scoredSplitTimes.find(
					(s) =>
						s.entrantId === entrant.id &&
						s.courseSplitId === inSplit.courseSplitId &&
						s.subSplitKind === "out",
				);
				if (!outSplit) {
					// Currently dwelling
					const currentDwellSeconds = Math.round(
						(asOfTime.getTime() - inSplit.absoluteTimeUtc.getTime()) / 1000,
					);
					if (currentDwellSeconds > maxSafeDwellSeconds) {
						const cs = this.courseSplits.find(
							(c) => c.id === inSplit.courseSplitId,
						);
						const tp = this.timingPoints.find(
							(p) => p.id === cs?.timingPointId,
						);
						alerts.push({
							entrant,
							type: "lingering_in_station",
							timingPointName: tp?.name ?? cs?.name ?? "Unknown Station",
							dwellSeconds: currentDwellSeconds,
							details: `Dwelling for ${Math.round(currentDwellSeconds / 60)}m (exceeds ${Math.round(maxSafeDwellSeconds / 60)}m threshold)`,
						});
					}
				}
			}
		}

		return alerts;
	}

	// --------------------------------------------------------------------------
	// RBAC & Permissions Evaluator
	// --------------------------------------------------------------------------

	/**
	 * Medical data gating: requires org entrant.update (owner, admin, director)
	 * OR staff role 'medical' or 'official'.
	 */
	canViewMedicalData(access: EventGroupAccess): boolean {
		const privilegedOrgRoles: OrgRole[] = ["owner", "admin", "director"];
		const hasPrivilegedOrgRole = access.orgRoles.some((r) =>
			privilegedOrgRoles.includes(r),
		);
		if (hasPrivilegedOrgRole) return true;

		return (
			access.staffRoles.includes("medical") ||
			access.staffRoles.includes("official")
		);
	}

	/**
	 * Role-Adaptive Layout Query:
	 * Allows event_group_staff (volunteers, captains) without org membership
	 * to access assigned event groups without 404, while guarding org admin tabs.
	 */
	getOrganizationOverviewRoleAdaptive(
		userId: string,
		personId: string | null,
		orgSlug: string,
	): {
		canAccessOrgWorkspace: boolean;
		isStaffOnly: boolean;
		assignedEventGroups: EventGroup[];
		canAccessAdminSettings: boolean;
	} {
		const orgMember = this.orgMembers.find((m) => m.userId === userId);
		const orgRoles: OrgRole[] = orgMember ? [orgMember.role] : [];

		let assignedEventGroups: EventGroup[] = [];
		if (personId) {
			const assignments = this.staffAssignments.filter(
				(sa) => sa.personId === personId,
			);
			const assignedGroupIds = assignments.map((a) => a.eventGroupId);
			assignedEventGroups = this.eventGroups.filter((g) =>
				assignedGroupIds.includes(g.id),
			);
		}

		const isStaffOnly = orgRoles.length === 0 && assignedEventGroups.length > 0;
		const canAccessOrgWorkspace = orgRoles.length > 0 || isStaffOnly;
		const canAccessAdminSettings =
			orgRoles.includes("owner") || orgRoles.includes("admin");

		return {
			canAccessOrgWorkspace,
			isStaffOnly,
			assignedEventGroups,
			canAccessAdminSettings,
		};
	}
}
