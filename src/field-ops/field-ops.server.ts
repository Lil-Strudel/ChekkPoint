import "@tanstack/solid-start/server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { orgRolesCan, parseOrgRoles, type OrgRole } from "../auth/access";
import {
	ForbiddenError,
	getEventGroupAccess,
	requireOrgPermission,
	type EventGroupAccess,
} from "../auth/permissions.server";
import type { Viewer } from "../auth/session.server";
import { db } from "../db";
import {
	courseSplits,
	courses,
	entrantHistoricalProjections,
	entrants,
	eventGroupStaff,
	eventGroupStaffTimingPoints,
	eventGroups,
	events,
	organizationMembers,
	organizations,
	people,
	personHistoricalSummaries,
	rawTimingEvents,
	scoredSplitTimes,
	timingPoints,
	type EntrantStatus,
	type RawTimingEvent,
	type RawTimingStatus,
	type ScoredSplitTime,
	type SubSplitKind,
	type TimingSource,
} from "../db/schema";
import {
	calculateDwellSeconds,
	calculateSegmentPaceSecondsPerKm,
	calculateTsdPenalty,
	canViewMedicalData,
	canManageRaceControl,
	type EventGroupAccessCheck,
} from "../race-control/race-control.shared";
import {
	parseMt63Block,
	type BatchIngestSplitsInput,
	type CourseSegmentFunnel,
	type EmergencyDossierInput,
	type EntrantEmergencyDossier,
	type EventGroupSlugParams,
	type FieldLoggerData,
	type IngestMt63RadioBlockInput,
	type NetControlSarData,
	type QuickActionSplitInput,
	type RawStreamParams,
	type RecordStationSplitInput,
	type ReportRunnerDropInput,
	type SarParams,
	type SarStage1Alert,
	type SarStage2Alert,
	type SimulateTestPulseInput,
	type StationCrossCheckData,
	type StationCustodyOverview,
	type StationEntrantCard,
	type StationParams,
} from "./field-ops.shared";

const emergencyContacts = alias(people, "emergency_contacts");

// ============================================================================
// RESOLUTION HELPERS
// ============================================================================

export async function resolveEventGroupBySlugs(
	orgSlug: string,
	eventGroupSlug: string,
) {
	const [row] = await db
		.select({
			eventGroup: eventGroups,
			organization: organizations,
		})
		.from(eventGroups)
		.innerJoin(
			organizations,
			eq(eventGroups.organizationId, organizations.id),
		)
		.where(
			and(
				eq(organizations.slug, orgSlug),
				eq(eventGroups.slug, eventGroupSlug),
			),
		);

	if (!row) {
		throw new Error(
			`Event group ${eventGroupSlug} in organization ${orgSlug} not found`,
		);
	}

	return row;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * 1. All-stations custody overview table:
 * Matrix across every physical timing point used in this event group,
 * showing counts for Expected Next, In Station Now, Departed, Stopped / DNF.
 */
export async function getAllStationsCustodyData(
	slug: string,
	eventGroupSlug: string,
): Promise<StationCustodyOverview[]> {
	const { eventGroup } = await resolveEventGroupBySlugs(slug, eventGroupSlug);

	// Get all sub-events in this event group
	const subEvents = await db
		.select({
			id: events.id,
			courseId: events.courseId,
		})
		.from(events)
		.where(eq(events.eventGroupId, eventGroup.id));

	if (subEvents.length === 0) return [];

	const courseIds = subEvents.map((e) => e.courseId);

	// Get all splits for these courses
	const splits = await db
		.select({
			split: courseSplits,
			timingPoint: timingPoints,
		})
		.from(courseSplits)
		.innerJoin(
			timingPoints,
			eq(courseSplits.timingPointId, timingPoints.id),
		)
		.where(inArray(courseSplits.courseId, courseIds))
		.orderBy(asc(courseSplits.distanceFromStartMeters));

	// Unique timing points preserving physical course order
	const seenTimingPointIds = new Set<string>();
	const uniqueStations: Array<{
		timingPoint: typeof timingPoints.$inferSelect;
		distanceKm: number;
	}> = [];

	for (const s of splits) {
		if (!seenTimingPointIds.has(s.timingPoint.id)) {
			seenTimingPointIds.add(s.timingPoint.id);
			uniqueStations.push({
				timingPoint: s.timingPoint,
				distanceKm: Math.round((s.split.distanceFromStartMeters / 1000) * 10) / 10,
			});
		}
	}

	// Fetch all entrants in this event group
	const eventEntrants = await db
		.select({
			id: entrants.id,
			status: entrants.status,
			droppedSplitId: entrants.droppedSplitId,
		})
		.from(entrants)
		.where(inArray(entrants.eventId, subEvents.map((e) => e.id)));

	const entrantIds = eventEntrants.map((e) => e.id);
	if (entrantIds.length === 0) {
		return uniqueStations.map((st) => ({
			timingPoint: {
				id: st.timingPoint.id,
				code: st.timingPoint.code,
				name: st.timingPoint.name,
				elevationMeters: st.timingPoint.elevationMeters,
				latitude: st.timingPoint.latitude,
				longitude: st.timingPoint.longitude,
			},
			counts: {
				expectedNext: 0,
				inStationNow: 0,
				departed: 0,
				stoppedDnf: 0,
				total: 0,
			},
			distanceKm: st.distanceKm,
		}));
	}

	// Fetch scored splits for all entrants in this group
	const splitsData = await db
		.select({
			splitTime: scoredSplitTimes,
			timingPointId: courseSplits.timingPointId,
			sequenceOrder: courseSplits.sequenceOrder,
		})
		.from(scoredSplitTimes)
		.innerJoin(
			courseSplits,
			eq(scoredSplitTimes.courseSplitId, courseSplits.id),
		)
		.where(inArray(scoredSplitTimes.entrantId, entrantIds));

	// Group scored splits by entrant
	const splitsByEntrant = new Map<string, typeof splitsData>();
	for (const row of splitsData) {
		const existing = splitsByEntrant.get(row.splitTime.entrantId) ?? [];
		existing.push(row);
		splitsByEntrant.set(row.splitTime.entrantId, existing);
	}

	return uniqueStations.map((st) => {
		let expectedNext = 0;
		let inStationNow = 0;
		let departed = 0;
		let stoppedDnf = 0;

		for (const ent of eventEntrants) {
			const entSplits = splitsByEntrant.get(ent.id) ?? [];
			const stationSplits = entSplits.filter(
				(s) => s.timingPointId === st.timingPoint.id,
			);

			const inSplit = stationSplits.find((s) => s.splitTime.subSplitKind === "in");
			const outSplit = stationSplits.find(
				(s) => s.splitTime.subSplitKind === "out" || s.splitTime.subSplitKind === "point",
			);
			const stopped = stationSplits.some((s) => s.splitTime.stoppedHere) ||
				(ent.status === "dnf" && stationSplits.some((s) => s.splitTime.courseSplitId === ent.droppedSplitId));

			if (stopped) {
				stoppedDnf++;
			} else if (outSplit) {
				departed++;
			} else if (inSplit) {
				inStationNow++;
			} else if (
				ent.status === "in_progress" ||
				ent.status === "checked_in"
			) {
				// Expected if haven't arrived at this station yet
				expectedNext++;
			}
		}

		return {
			timingPoint: {
				id: st.timingPoint.id,
				code: st.timingPoint.code,
				name: st.timingPoint.name,
				elevationMeters: st.timingPoint.elevationMeters,
				latitude: st.timingPoint.latitude,
				longitude: st.timingPoint.longitude,
			},
			counts: {
				expectedNext,
				inStationNow,
				departed,
				stoppedDnf,
				total: expectedNext + inStationNow + departed + stoppedDnf,
			},
			distanceKm: st.distanceKm,
		};
	});
}

/**
 * Field Logger Workstation Data:
 * Provides genuine eventGroupId, all timing stations custody overviews,
 * candidate bib numbers for real Damerau-Levenshtein typo defense,
 * and entrant profiles for live entrant lookup and drop reporting.
 */
export async function getFieldLoggerData(
	slug: string,
	eventGroupSlug: string,
): Promise<FieldLoggerData> {
	const { eventGroup } = await resolveEventGroupBySlugs(slug, eventGroupSlug);
	const stations = await getAllStationsCustodyData(slug, eventGroupSlug);

	// Fetch all sub-events in this event group
	const subEvents = await db
		.select({
			id: events.id,
			name: events.name,
		})
		.from(events)
		.where(eq(events.eventGroupId, eventGroup.id));

	const subEventMap = new Map(subEvents.map((se) => [se.id, se.name]));
	const subEventIds = subEvents.map((se) => se.id);

	let candidateEntrants: FieldLoggerData["entrants"] = [];
	if (subEventIds.length > 0) {
		const rows = await db
			.select({
				id: entrants.id,
				bibNumber: entrants.bibNumber,
				status: entrants.status,
				eventId: entrants.eventId,
				firstName: people.firstName,
				lastName: people.lastName,
			})
			.from(entrants)
			.innerJoin(people, eq(entrants.personId, people.id))
			.where(inArray(entrants.eventId, subEventIds));

		candidateEntrants = rows.map((r) => ({
			id: r.id,
			bibNumber: r.bibNumber,
			firstName: r.firstName,
			lastName: r.lastName,
			status: r.status,
			subEventName: subEventMap.get(r.eventId) || "Sub-Event",
		}));
	}

	const candidateBibs = Array.from(
		new Set(candidateEntrants.map((e) => e.bibNumber).filter(Boolean)),
	);

	return {
		eventGroupId: eventGroup.id,
		eventGroupName: eventGroup.name,
		stations,
		candidateBibs,
		entrants: candidateEntrants,
	};
}

/**
 * 2. Station Cross-Check Data for a single station:
 * Primary 4-zone custody grid (Expected Next, In Station Now w/ live dwell timer, Departed, Stopped / DNF)
 * plus all candidate bibs for Damerau-Levenshtein typo defense.
 */
export async function getStationCrossCheckData(
	slug: string,
	eventGroupSlug: string,
	timingPointId: string,
): Promise<StationCrossCheckData> {
	const { eventGroup } = await resolveEventGroupBySlugs(slug, eventGroupSlug);

	const [st] = await db
		.select()
		.from(timingPoints)
		.where(eq(timingPoints.id, timingPointId));

	if (!st) {
		throw new Error(`Timing point ${timingPointId} not found`);
	}

	// Sub-events
	const subEvents = await db
		.select({
			id: events.id,
			name: events.name,
			courseId: events.courseId,
		})
		.from(events)
		.where(eq(events.eventGroupId, eventGroup.id));

	if (subEvents.length === 0) {
		return {
			station: {
				id: st.id,
				code: st.code,
				name: st.name,
				elevationMeters: st.elevationMeters,
				latitude: st.latitude,
				longitude: st.longitude,
			},
			eventGroup: {
				id: eventGroup.id,
				name: eventGroup.name,
				slug: eventGroup.slug,
				discipline: eventGroup.discipline,
			},
			zones: {
				expectedNext: [],
				inStationNow: [],
				departed: [],
				stoppedDnf: [],
			},
			allCandidateBibs: [],
		};
	}

	// Entrants in this event group
	const allEntrants = await db
		.select({
			entrant: entrants,
			person: people,
			subEventName: events.name,
			projection: entrantHistoricalProjections,
		})
		.from(entrants)
		.innerJoin(people, eq(entrants.personId, people.id))
		.innerJoin(events, eq(entrants.eventId, events.id))
		.leftJoin(
			entrantHistoricalProjections,
			eq(entrants.id, entrantHistoricalProjections.entrantId),
		)
		.where(inArray(entrants.eventId, subEvents.map((e) => e.id)))
		.orderBy(asc(entrants.competitorNumber));

	const allCandidateBibs = allEntrants.map((e) => e.entrant.competitorNumber);
	const entrantIds = allEntrants.map((e) => e.entrant.id);

	// Scored splits
	const allSplits = entrantIds.length > 0
		? await db
				.select({
					splitTime: scoredSplitTimes,
					courseSplit: courseSplits,
				})
				.from(scoredSplitTimes)
				.innerJoin(
					courseSplits,
					eq(scoredSplitTimes.courseSplitId, courseSplits.id),
				)
				.where(inArray(scoredSplitTimes.entrantId, entrantIds))
				.orderBy(asc(courseSplits.sequenceOrder))
		: [];

	// Map splits by entrant
	const splitsByEntrant = new Map<string, typeof allSplits>();
	for (const s of allSplits) {
		const existing = splitsByEntrant.get(s.splitTime.entrantId) ?? [];
		existing.push(s);
		splitsByEntrant.set(s.splitTime.entrantId, existing);
	}

	const expectedNext: StationEntrantCard[] = [];
	const inStationNow: StationEntrantCard[] = [];
	const departed: StationEntrantCard[] = [];
	const stoppedDnf: StationEntrantCard[] = [];

	const nowMs = Date.now();

	for (const row of allEntrants) {
		const ent = row.entrant;
		const per = row.person;
		const proj = row.projection;
		const entSplits = splitsByEntrant.get(ent.id) ?? [];

		// Check splits at this timing point
		const atStation = entSplits.filter(
			(s) => s.courseSplit.timingPointId === timingPointId,
		);

		const inSplit = atStation.find((s) => s.splitTime.subSplitKind === "in");
		const outSplit = atStation.find(
			(s) => s.splitTime.subSplitKind === "out" || s.splitTime.subSplitKind === "point",
		);

		const isStoppedHere =
			atStation.some((s) => s.splitTime.stoppedHere) ||
			(ent.status === "dnf" && atStation.some((s) => s.splitTime.courseSplitId === ent.droppedSplitId)) ||
			(ent.status === "dnf" && ent.droppedSplitId && atStation.length > 0);

		// Extract pacer info from participantData
		const pData = ent.participantData as Record<string, unknown> | null;
		const pacerName = (pData?.pacerName as string) || null;
		const withPacer = Boolean(pData?.pacerName || (inSplit?.splitTime.governingRawEventId));

		// Find last known split overall
		const lastKnown = entSplits.length > 0 ? entSplits[entSplits.length - 1] : null;

		// Extract projected arrival at this station
		let projectedArrivalUtc: string | null = null;
		if (proj?.projectedArrivalTimes) {
			const stationCourseSplits = atStation.map((s) => s.courseSplit.id);
			for (const csId of stationCourseSplits) {
				const p = proj.projectedArrivalTimes[csId];
				if (p?.projectedTimeUtc) {
					projectedArrivalUtc = p.projectedTimeUtc;
					break;
				}
			}
		}

		const card: StationEntrantCard = {
			entrantId: ent.id,
			bibNumber: ent.competitorNumber,
			firstName: per.firstName,
			lastName: per.lastName,
			division: ent.division,
			subEventName: row.subEventName,
			status: ent.status,
			withPacer,
			pacerName,
			inTime: inSplit?.splitTime.absoluteTimeUtc ?? null,
			outTime: outSplit?.splitTime.absoluteTimeUtc ?? null,
			dwellSeconds: inSplit && !outSplit
				? Math.max(0, Math.round((nowMs - inSplit.splitTime.absoluteTimeUtc.getTime()) / 1000))
				: outSplit?.splitTime.dwellSeconds ?? (inSplit && outSplit ? calculateDwellSeconds(inSplit.splitTime.absoluteTimeUtc, outSplit.splitTime.absoluteTimeUtc) : null),
			segmentPaceSecondsPerKm: outSplit?.splitTime.segmentPaceSecondsPerKm ?? inSplit?.splitTime.segmentPaceSecondsPerKm ?? null,
			projectedArrivalUtc,
			expectedCutoffRisk: proj?.expectedCutoffRisk ?? false,
			sarBadge: proj?.volunteersSarSafetyBadge ?? null,
			lastKnownSplitName: lastKnown?.courseSplit.name ?? null,
			lastKnownSplitTime: lastKnown?.splitTime.absoluteTimeUtc ?? null,
			stoppedHere: isStoppedHere,
			dropReason: ent.dropReason,
			dropLocationDescription: ent.dropLocationDescription,
		};

		if (isStoppedHere) {
			stoppedDnf.push(card);
		} else if (outSplit) {
			departed.push(card);
		} else if (inSplit) {
			inStationNow.push(card);
		} else if (
			ent.status === "in_progress" ||
			ent.status === "checked_in" ||
			ent.status === "registered"
		) {
			expectedNext.push(card);
		}
	}

	// Sort expectedNext by projected arrival or bib
	expectedNext.sort((a, b) => {
		if (a.projectedArrivalUtc && b.projectedArrivalUtc) {
			return new Date(a.projectedArrivalUtc).getTime() - new Date(b.projectedArrivalUtc).getTime();
		}
		if (a.projectedArrivalUtc) return -1;
		if (b.projectedArrivalUtc) return 1;
		return a.bibNumber.localeCompare(b.bibNumber, undefined, { numeric: true });
	});

	// Sort inStationNow by inTime asc (oldest dwellers first)
	inStationNow.sort((a, b) => {
		const aTime = a.inTime ? new Date(a.inTime).getTime() : 0;
		const bTime = b.inTime ? new Date(b.inTime).getTime() : 0;
		return aTime - bTime;
	});

	// Sort departed by outTime desc (most recent departures first)
	departed.sort((a, b) => {
		const aTime = a.outTime ? new Date(a.outTime).getTime() : 0;
		const bTime = b.outTime ? new Date(b.outTime).getTime() : 0;
		return bTime - aTime;
	});

	return {
		station: {
			id: st.id,
			code: st.code,
			name: st.name,
			elevationMeters: st.elevationMeters,
			latitude: st.latitude,
			longitude: st.longitude,
		},
		eventGroup: {
			id: eventGroup.id,
			name: eventGroup.name,
			slug: eventGroup.slug,
			discipline: eventGroup.discipline,
		},
		zones: {
			expectedNext,
			inStationNow,
			departed,
			stoppedDnf,
		},
		allCandidateBibs,
	};
}

/**
 * 3. Net Control & SAR Triage Data:
 * Course Segment Progress Funnel, Stage 1 Overdue, and Stage 2 Lingering & Retired.
 */
export async function getNetControlSarData(
	slug: string,
	eventGroupSlug: string,
	selectedEventId?: string,
): Promise<NetControlSarData> {
	const { eventGroup } = await resolveEventGroupBySlugs(slug, eventGroupSlug);

	// Find sub-events
	const subEventsQuery = db
		.select({
			id: events.id,
			name: events.name,
			courseId: events.courseId,
		})
		.from(events)
		.where(
			selectedEventId
				? and(eq(events.eventGroupId, eventGroup.id), eq(events.id, selectedEventId))
				: eq(events.eventGroupId, eventGroup.id),
		);

	const subEvents = await subEventsQuery;
	if (subEvents.length === 0) {
		return {
			eventGroup: {
				id: eventGroup.id,
				name: eventGroup.name,
				slug: eventGroup.slug,
				discipline: eventGroup.discipline,
			},
			selectedEventId,
			funnel: [],
			stage1Overdue: [],
			stage2Lingering: [],
			totalActiveEntrants: 0,
			totalOverdueCount: 0,
			totalLingeringOrRetiredCount: 0,
		};
	}

	const courseIds = subEvents.map((e) => e.courseId);

	// Get ordered course splits
	const allCourseSplits = await db
		.select({
			split: courseSplits,
			timingPoint: timingPoints,
		})
		.from(courseSplits)
		.innerJoin(timingPoints, eq(courseSplits.timingPointId, timingPoints.id))
		.where(inArray(courseSplits.courseId, courseIds))
		.orderBy(asc(courseSplits.sequenceOrder));

	// Group unique checkpoint sequence
	const orderedCheckpoints: Array<{
		id: string;
		name: string;
		sequenceOrder: number;
	}> = [];
	const seenSplits = new Set<string>();

	for (const s of allCourseSplits) {
		if (!seenSplits.has(s.split.name)) {
			seenSplits.add(s.split.name);
			orderedCheckpoints.push({
				id: s.split.id,
				name: s.split.name,
				sequenceOrder: s.split.sequenceOrder,
			});
		}
	}

	// Fetch entrants
	const allEntrants = await db
		.select({
			entrant: entrants,
			person: people,
			subEventName: events.name,
			projection: entrantHistoricalProjections,
		})
		.from(entrants)
		.innerJoin(people, eq(entrants.personId, people.id))
		.innerJoin(events, eq(entrants.eventId, events.id))
		.leftJoin(
			entrantHistoricalProjections,
			eq(entrants.id, entrantHistoricalProjections.entrantId),
		)
		.where(inArray(entrants.eventId, subEvents.map((e) => e.id)));

	const entrantIds = allEntrants.map((e) => e.entrant.id);

	// Scored splits
	const allSplits = entrantIds.length > 0
		? await db
				.select({
					splitTime: scoredSplitTimes,
					courseSplit: courseSplits,
				})
				.from(scoredSplitTimes)
				.innerJoin(
					courseSplits,
					eq(scoredSplitTimes.courseSplitId, courseSplits.id),
				)
				.where(inArray(scoredSplitTimes.entrantId, entrantIds))
				.orderBy(asc(courseSplits.sequenceOrder))
		: [];

	const splitsByEntrant = new Map<string, typeof allSplits>();
	for (const s of allSplits) {
		const existing = splitsByEntrant.get(s.splitTime.entrantId) ?? [];
		existing.push(s);
		splitsByEntrant.set(s.splitTime.entrantId, existing);
	}

	const nowMs = Date.now();
	const MAX_SAFE_DWELL_SECONDS = 45 * 60; // 45 minutes

	const stage1Overdue: SarStage1Alert[] = [];
	const stage2Lingering: SarStage2Alert[] = [];

	let totalActiveEntrants = 0;

	for (const row of allEntrants) {
		const ent = row.entrant;
		const per = row.person;
		const proj = row.projection;
		const entSplits = splitsByEntrant.get(ent.id) ?? [];

		if (ent.status === "in_progress") {
			totalActiveEntrants++;
		}

		// Stage 2: Retired on Course
		if (ent.status === "retired") {
			stage2Lingering.push({
				entrantId: ent.id,
				bibNumber: ent.competitorNumber,
				fullName: `${per.firstName} ${per.lastName}`,
				subEventName: row.subEventName,
				alertType: "retired_on_course",
				locationName: ent.dropLocationDescription || "On Course (Between Stations)",
				details: ent.dropReason
					? `Withdrew: ${ent.dropReason} - ${ent.dropLocationDescription || "No details provided"}`
					: `Withdrew on course: ${ent.dropLocationDescription || "No details provided"}`,
				dropReason: ent.dropReason,
				dropLocationDescription: ent.dropLocationDescription,
				emergencyContactOnSite: ent.emergencyContactIsOnSite,
				withdrawnAt: ent.actualStartTime,
			});
		}

		// Stage 2: Lingering in Aid Station
		if (ent.status === "in_progress" && entSplits.length > 0) {
			const lastSplit = entSplits[entSplits.length - 1];
			if (lastSplit.splitTime.subSplitKind === "in") {
				const dwellSec = Math.round(
					(nowMs - lastSplit.splitTime.absoluteTimeUtc.getTime()) / 1000,
				);
				if (dwellSec > MAX_SAFE_DWELL_SECONDS) {
					stage2Lingering.push({
						entrantId: ent.id,
						bibNumber: ent.competitorNumber,
						fullName: `${per.firstName} ${per.lastName}`,
						subEventName: row.subEventName,
						alertType: "lingering_in_station",
						locationName: lastSplit.courseSplit.name,
						dwellSeconds: dwellSec,
						details: `Dwelling for ${Math.round(dwellSec / 60)} minutes (exceeds ${Math.round(MAX_SAFE_DWELL_SECONDS / 60)}m safety threshold)`,
						emergencyContactOnSite: ent.emergencyContactIsOnSite,
					});
				}
			}
		}

		// Stage 1: Overdue Between Checkpoints
		if (ent.status === "in_progress" && entSplits.length > 0) {
			const lastSplit = entSplits[entSplits.length - 1];
			// If runner is departed from last split (or point punch), they are between stations
			if (
				lastSplit.splitTime.subSplitKind === "out" ||
				lastSplit.splitTime.subSplitKind === "point"
			) {
				// Find next expected split on course
				const nextSplit = allCourseSplits.find(
					(s) =>
						s.split.courseId === lastSplit.courseSplit.courseId &&
						s.split.sequenceOrder === lastSplit.courseSplit.sequenceOrder + 1,
				);

				if (nextSplit && proj?.projectedArrivalTimes) {
					const projection = proj.projectedArrivalTimes[nextSplit.split.id];
					if (projection?.projectedTimeUtc) {
						const projectedTimeMs = new Date(projection.projectedTimeUtc).getTime();
						const overdueSec = Math.round((nowMs - projectedTimeMs) / 1000);

						if (overdueSec > 0 || proj.expectedCutoffRisk) {
							stage1Overdue.push({
								entrantId: ent.id,
								bibNumber: ent.competitorNumber,
								fullName: `${per.firstName} ${per.lastName}`,
								subEventName: row.subEventName,
								lastSplitName: lastSplit.courseSplit.name,
								lastSplitTimeUtc: lastSplit.splitTime.absoluteTimeUtc,
								expectedSplitName: nextSplit.split.name,
								projectedArrivalUtc: projection.projectedTimeUtc,
								overdueSeconds: Math.max(0, overdueSec),
								expectedCutoffRisk: proj.expectedCutoffRisk,
								sarBadge: proj.volunteersSarSafetyBadge,
								emergencyContactOnSite: ent.emergencyContactIsOnSite,
							});
						}
					}
				}
			}
		}
	}

	// Sort Stage 1 alerts by overdueSeconds desc (most overdue first)
	stage1Overdue.sort((a, b) => b.overdueSeconds - a.overdueSeconds);

	// Compute Course Segment Funnel
	const funnel: CourseSegmentFunnel[] = [];
	for (let i = 0; i < orderedCheckpoints.length - 1; i++) {
		const fromCp = orderedCheckpoints[i];
		const toCp = orderedCheckpoints[i + 1];

		let entrantsBetweenCount = 0;
		let entrantsInDestinationStationCount = 0;

		for (const row of allEntrants) {
			const ent = row.entrant;
			if (ent.status !== "in_progress") continue;

			const entSplits = splitsByEntrant.get(ent.id) ?? [];
			const reachedFrom = entSplits.some(
				(s) => s.courseSplit.name === fromCp.name && s.splitTime.subSplitKind !== "in",
			);
			const reachedToIn = entSplits.some(
				(s) => s.courseSplit.name === toCp.name && s.splitTime.subSplitKind === "in",
			);
			const reachedToOut = entSplits.some(
				(s) => s.courseSplit.name === toCp.name && s.splitTime.subSplitKind !== "in",
			);

			if (reachedToIn && !reachedToOut) {
				entrantsInDestinationStationCount++;
			} else if (reachedFrom && !reachedToIn && !reachedToOut) {
				entrantsBetweenCount++;
			}
		}

		funnel.push({
			segmentIndex: i + 1,
			fromCheckpointName: fromCp.name,
			toCheckpointName: toCp.name,
			entrantsBetweenCount,
			entrantsInDestinationStationCount,
		});
	}

	return {
		eventGroup: {
			id: eventGroup.id,
			name: eventGroup.name,
			slug: eventGroup.slug,
			discipline: eventGroup.discipline,
		},
		selectedEventId,
		funnel,
		stage1Overdue,
		stage2Lingering,
		totalActiveEntrants,
		totalOverdueCount: stage1Overdue.length,
		totalLingeringOrRetiredCount: stage2Lingering.length,
	};
}

/**
 * 4. Slide-Over Emergency & Medical Dossier:
 * Gated by canViewMedicalData(access).
 * If unauthorized, medicalNotes and safetyTriageNotes are masked.
 */
export async function getEntrantEmergencyDossier(
	viewer: Viewer,
	eventGroupId: string,
	entrantId: string,
): Promise<EntrantEmergencyDossier> {
	const access = await getEventGroupAccess(viewer, eventGroupId);
	if (!access) {
		throw new ForbiddenError("You do not have access to this event group");
	}

	const isPrivileged = canViewMedicalData(access);

	// Fetch entrant and joined records
	const [row] = await db
		.select({
			entrant: entrants,
			person: people,
			emergencyContact: emergencyContacts,
			projection: entrantHistoricalProjections,
			historicalSummary: personHistoricalSummaries,
		})
		.from(entrants)
		.innerJoin(people, eq(entrants.personId, people.id))
		.leftJoin(
			emergencyContacts,
			eq(entrants.emergencyContactPersonId, emergencyContacts.id),
		)
		.leftJoin(
			entrantHistoricalProjections,
			eq(entrants.id, entrantHistoricalProjections.entrantId),
		)
		.leftJoin(
			personHistoricalSummaries,
			eq(entrants.personId, personHistoricalSummaries.personId),
		)
		.where(eq(entrants.id, entrantId));

	if (!row) {
		throw new Error(`Entrant ${entrantId} not found`);
	}

	// Last known split
	const [lastSplit] = await db
		.select({
			splitTime: scoredSplitTimes,
			courseSplit: courseSplits,
			timingPoint: timingPoints,
		})
		.from(scoredSplitTimes)
		.innerJoin(
			courseSplits,
			eq(scoredSplitTimes.courseSplitId, courseSplits.id),
		)
		.innerJoin(
			timingPoints,
			eq(courseSplits.timingPointId, timingPoints.id),
		)
		.where(eq(scoredSplitTimes.entrantId, entrantId))
		.orderBy(desc(scoredSplitTimes.absoluteTimeUtc))
		.limit(1);

	// Parse polymorphic participant data
	const rawPData = row.entrant.participantData as Record<string, unknown> | null;
	const kind = (rawPData?.kind as string) || "solo_competitor";
	const rawMedicalNotes = (rawPData?.medicalNotes as string) || null;
	const pacerName = (rawPData?.pacerName as string) || null;
	const tShirtSize = (rawPData?.tShirtSize as string) || null;
	const vehicle = (rawPData?.vehicle as {
		make: string;
		model: string;
		year: number;
		vehicleClass: string;
	}) || null;
	const driver = (rawPData?.driver as {
		name: string;
		licenseNumber: string;
		phone?: string;
	}) || null;

	const medicalNotes = isPrivileged ? rawMedicalNotes : null;
	const rawSafetyNotes = row.historicalSummary?.safetyTriageNotes || null;
	const safetyTriageNotes = isPrivileged ? rawSafetyNotes : null;

	return {
		entrant: {
			id: row.entrant.id,
			bibNumber: row.entrant.competitorNumber,
			status: row.entrant.status,
			division: row.entrant.division,
			actualStartTime: row.entrant.actualStartTime,
			dropReason: row.entrant.dropReason,
			dropLocationDescription: row.entrant.dropLocationDescription,
			comments: row.entrant.comments,
		},
		person: {
			id: row.person.id,
			firstName: row.person.firstName,
			lastName: row.person.lastName,
			email: row.person.email,
			phone: row.person.phone,
		},
		participantData: {
			kind,
			medicalNotes,
			pacerName,
			tShirtSize,
			vehicle,
			driver,
		},
		emergencyContact: {
			id: row.emergencyContact?.id ?? null,
			name: row.emergencyContact ? `${row.emergencyContact.firstName} ${row.emergencyContact.lastName}` : null,
			phone: row.emergencyContact?.phone ?? null,
			relation: row.entrant.emergencyContactRelationship ?? null,
			isOnSite: row.entrant.emergencyContactIsOnSite,
		},
		historicalSummary: row.historicalSummary
			? {
					experienceTier: row.historicalSummary.experienceTier,
					dnfRate: row.historicalSummary.dnfRate,
					totalRaces: row.historicalSummary.totalRaces,
					safetyTriageNotes,
				}
			: null,
		projection: row.projection
			? {
					projectedFinishSeconds: row.projection.projectedFinishSeconds,
					projectedPaceSecondsPerKm: row.projection.projectedPaceSecondsPerKm,
					expectedCutoffRisk: row.projection.expectedCutoffRisk,
					volunteersSarSafetyBadge: row.projection.volunteersSarSafetyBadge,
				}
			: null,
		lastKnownSplit: lastSplit
			? {
					splitName: lastSplit.courseSplit.name,
					stationCode: lastSplit.timingPoint.code,
					timeUtc: lastSplit.splitTime.absoluteTimeUtc,
					elapsedSeconds: lastSplit.splitTime.elapsedSeconds,
					subSplitKind: lastSplit.splitTime.subSplitKind,
				}
			: null,
		isMedicalDataMasked: !isPrivileged,
	};
}

/**
 * 5. Raw Timing Stream Data:
 * Append-only raw_timing_events feed with live filter badges and pagination.
 */
export async function getRawTimingStreamData(
	slug: string,
	eventGroupSlug: string,
	params?: {
		status?: string;
		limit?: number;
		offset?: number;
	},
) {
	const { eventGroup } = await resolveEventGroupBySlugs(slug, eventGroupSlug);

	const limit = params?.limit ?? 50;
	const offset = params?.offset ?? 0;
	const filterStatus = params?.status && params.status !== "all" ? params.status : null;

	const baseFilter = filterStatus
		? and(
				eq(rawTimingEvents.eventGroupId, eventGroup.id),
				eq(rawTimingEvents.status, filterStatus as RawTimingStatus),
			)
		: eq(rawTimingEvents.eventGroupId, eventGroup.id);

	const items = await db
		.select({
			rawEvent: rawTimingEvents,
			recordedBy: people,
		})
		.from(rawTimingEvents)
		.leftJoin(people, eq(rawTimingEvents.recordedByPersonId, people.id))
		.where(baseFilter)
		.orderBy(desc(rawTimingEvents.recordedTimeUtc))
		.limit(limit)
		.offset(offset);

	// Count per status
	const allEvents = await db
		.select({ status: rawTimingEvents.status })
		.from(rawTimingEvents)
		.where(eq(rawTimingEvents.eventGroupId, eventGroup.id));

	const counts = {
		all: allEvents.length,
		unprocessed: allEvents.filter((e) => e.status === "unprocessed").length,
		matched: allEvents.filter((e) => e.status === "matched").length,
		duplicate_subordinate: allEvents.filter((e) => e.status === "duplicate_subordinate").length,
		rejected_invalid: allEvents.filter((e) => e.status === "rejected_invalid").length,
		flagged_discrepancy: allEvents.filter((e) => e.status === "flagged_discrepancy").length,
	};

	return {
		eventGroup: {
			id: eventGroup.id,
			name: eventGroup.name,
			slug: eventGroup.slug,
		},
		items: items.map((r) => ({
			...r.rawEvent,
			recordedByPersonName: r.recordedBy
				? `${r.recordedBy.firstName} ${r.recordedBy.lastName}`
				: null,
		})),
		counts,
	};
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Record a raw punch and project into scored_split_times:
 * Handles 30-second cluster deduplication, dwell time, segment pace, and TSD regularity penalties.
 */
export async function recordStationSplit(
	viewer: Viewer,
	input: RecordStationSplitInput,
) {
	// Access check
	const access = await getEventGroupAccess(viewer, input.eventGroupId);
	if (!access) {
		throw new ForbiddenError("You do not have access to this event group");
	}

	const [group] = await db
		.select()
		.from(eventGroups)
		.where(eq(eventGroups.id, input.eventGroupId));

	if (!group) throw new Error("Event group not found");

	const recordedTime = input.recordedTimeUtc;
	const clusterWindowMs = 30 * 1000;

	// Check for cluster duplicate
	const [clusterMatch] = await db
		.select()
		.from(rawTimingEvents)
		.where(
			and(
				eq(rawTimingEvents.eventGroupId, input.eventGroupId),
				eq(rawTimingEvents.competitorNumber, input.competitorNumber),
				eq(rawTimingEvents.timingPointCode, input.timingPointCode.toUpperCase()),
				eq(rawTimingEvents.subSplitKind, input.subSplitKind),
				sql`ABS(EXTRACT(EPOCH FROM (${rawTimingEvents.recordedTimeUtc} - ${recordedTime}::timestamptz))) <= 30`,
			),
		)
		.limit(1);

	const isDuplicate = clusterMatch !== undefined;
	const initialStatus: RawTimingStatus = isDuplicate
		? "duplicate_subordinate"
		: "matched";

	// Insert into raw_timing_events
	const [rawEvent] = await db
		.insert(rawTimingEvents)
		.values({
			eventGroupId: input.eventGroupId,
			competitorNumber: input.competitorNumber,
			timingPointCode: input.timingPointCode.toUpperCase(),
			subSplitKind: input.subSplitKind,
			recordedTimeUtc: recordedTime,
			source: input.source as TimingSource,
			sourceDeviceId: input.sourceDeviceId ?? null,
			recordedByPersonId: viewer.person?.id ?? input.recordedByPersonId ?? null,
			syncBatchId: input.syncBatchId ?? null,
			withPacer: input.withPacer,
			status: initialStatus,
			auditNote: isDuplicate ? "Clustered with earlier raw pulse" : null,
		})
		.returning();

	if (isDuplicate) {
		return { rawEventId: rawEvent.id, scoredSplitId: null, status: initialStatus };
	}

	// Match competitorNumber to an entrant in this event group
	const subEvents = await db
		.select({ id: events.id, courseId: events.courseId, gunStartTime: events.gunStartTime })
		.from(events)
		.where(eq(events.eventGroupId, input.eventGroupId));

	if (subEvents.length === 0) {
		return { rawEventId: rawEvent.id, scoredSplitId: null, status: "matched" };
	}

	const [entrant] = await db
		.select()
		.from(entrants)
		.where(
			and(
				inArray(entrants.eventId, subEvents.map((e) => e.id)),
				eq(entrants.competitorNumber, input.competitorNumber),
			),
		);

	if (!entrant) {
		// No matching entrant found - leave as raw punch
		return { rawEventId: rawEvent.id, scoredSplitId: null, status: "unprocessed" };
	}

	const subEvent = subEvents.find((e) => e.id === entrant.eventId);
	if (!subEvent) {
		return { rawEventId: rawEvent.id, scoredSplitId: null, status: "matched" };
	}

	// Find timing point
	const [tp] = await db
		.select()
		.from(timingPoints)
		.where(
			and(
				eq(timingPoints.organizationId, group.organizationId),
				eq(timingPoints.code, input.timingPointCode.toUpperCase()),
			),
		);

	if (!tp) {
		return { rawEventId: rawEvent.id, scoredSplitId: null, status: "matched" };
	}

	// Find matching courseSplit for this subEvent course
	const [split] = await db
		.select()
		.from(courseSplits)
		.where(
			and(
				eq(courseSplits.courseId, subEvent.courseId),
				eq(courseSplits.timingPointId, tp.id),
			),
		)
		.orderBy(asc(courseSplits.sequenceOrder))
		.limit(1);

	if (!split) {
		return { rawEventId: rawEvent.id, scoredSplitId: null, status: "matched" };
	}

	// Calculate elapsedSeconds
	const startTime = entrant.actualStartTime ?? subEvent.gunStartTime;
	let elapsedSeconds = 0;
	if (startTime) {
		elapsedSeconds = Math.max(
			0,
			(recordedTime.getTime() - startTime.getTime()) / 1000,
		);
	}

	// Calculate dwellSeconds if OUT
	let dwellSeconds: number | null = null;
	if (input.subSplitKind === "out") {
		const [inSplit] = await db
			.select()
			.from(scoredSplitTimes)
			.where(
				and(
					eq(scoredSplitTimes.entrantId, entrant.id),
					eq(scoredSplitTimes.courseSplitId, split.id),
					eq(scoredSplitTimes.subSplitKind, "in"),
				),
			);
		if (inSplit) {
			dwellSeconds = calculateDwellSeconds(
				inSplit.absoluteTimeUtc,
				recordedTime,
			);
		}
	}

	// Calculate segment pace from preceding split
	let segmentPaceSecondsPerKm: number | null = null;
	const precedingSplits = await db
		.select({
			splitTime: scoredSplitTimes,
			courseSplit: courseSplits,
		})
		.from(scoredSplitTimes)
		.innerJoin(
			courseSplits,
			eq(scoredSplitTimes.courseSplitId, courseSplits.id),
		)
		.where(eq(scoredSplitTimes.entrantId, entrant.id))
		.orderBy(desc(courseSplits.sequenceOrder));

	const prev = precedingSplits.find(
		(s) => s.courseSplit.sequenceOrder < split.sequenceOrder,
	);
	if (prev) {
		const deltaDist =
			split.distanceFromStartMeters - prev.courseSplit.distanceFromStartMeters;
		const deltaSec = elapsedSeconds - prev.splitTime.elapsedSeconds;
		segmentPaceSecondsPerKm = calculateSegmentPaceSecondsPerKm(deltaDist, deltaSec);
	}

	// TSD Regularity penalties
	let tsdDeviationSeconds: number | null = null;
	let penaltyPoints = 0;
	if (
		group.discipline === "tsd_regularity" &&
		split.tsdIdealDurationSeconds
	) {
		const penalty = calculateTsdPenalty(
			elapsedSeconds,
			split.tsdIdealDurationSeconds,
			group.rulesConfig as any,
		);
		tsdDeviationSeconds = penalty.deviationSeconds;
		penaltyPoints = penalty.penaltyPoints;
	}

	// Upsert into scored_split_times
	const [existingSplit] = await db
		.select()
		.from(scoredSplitTimes)
		.where(
			and(
				eq(scoredSplitTimes.entrantId, entrant.id),
				eq(scoredSplitTimes.courseSplitId, split.id),
				eq(scoredSplitTimes.lap, 1),
				eq(scoredSplitTimes.subSplitKind, input.subSplitKind),
			),
		);

	let scoredId: string;
	if (existingSplit) {
		scoredId = existingSplit.id;
		await db
			.update(scoredSplitTimes)
			.set({
				absoluteTimeUtc: recordedTime,
				elapsedSeconds,
				dwellSeconds,
				segmentPaceSecondsPerKm,
				tsdDeviationSeconds,
				penaltyPoints,
				governingRawEventId: rawEvent.id,
				dataStatus: "valid",
				updatedAt: new Date(),
			})
			.where(eq(scoredSplitTimes.id, existingSplit.id));
	} else {
		const [inserted] = await db
			.insert(scoredSplitTimes)
			.values({
				entrantId: entrant.id,
				courseSplitId: split.id,
				lap: 1,
				subSplitKind: input.subSplitKind,
				absoluteTimeUtc: recordedTime,
				elapsedSeconds,
				dwellSeconds,
				segmentPaceSecondsPerKm,
				tsdDeviationSeconds,
				penaltyPoints,
				stoppedHere: false,
				dataStatus: "valid",
				governingRawEventId: rawEvent.id,
			})
			.returning();
		scoredId = inserted.id;
	}

	// If entrant was registered or checked_in, advance to in_progress
	if (entrant.status === "registered" || entrant.status === "checked_in") {
		await db
			.update(entrants)
			.set({ status: "in_progress" })
			.where(eq(entrants.id, entrant.id));
	}

	return {
		rawEventId: rawEvent.id,
		scoredSplitId: scoredId,
		status: "matched",
	};
}

/**
 * 1-tap quick action from Bib Popover:
 * "record_in", "record_out", or "stopped_here"
 */
export async function recordQuickStationAction(
	viewer: Viewer,
	input: QuickActionSplitInput,
) {
	const [tp] = await db
		.select()
		.from(timingPoints)
		.where(eq(timingPoints.id, input.timingPointId));

	if (!tp) throw new Error("Timing point not found");

	const [ent] = await db
		.select()
		.from(entrants)
		.where(eq(entrants.id, input.entrantId));

	if (!ent) throw new Error("Entrant not found");

	if (input.action === "record_in") {
		return recordStationSplit(viewer, {
			eventGroupId: input.eventGroupId,
			competitorNumber: ent.competitorNumber,
			timingPointCode: tp.code,
			subSplitKind: "in",
			recordedTimeUtc: input.recordedTimeUtc,
			source: "manual_web_entry",
			withPacer: false,
		});
	}

	if (input.action === "record_out") {
		return recordStationSplit(viewer, {
			eventGroupId: input.eventGroupId,
			competitorNumber: ent.competitorNumber,
			timingPointCode: tp.code,
			subSplitKind: "out",
			recordedTimeUtc: input.recordedTimeUtc,
			source: "manual_web_entry",
			withPacer: false,
		});
	}

	if (input.action === "stopped_here") {
		return reportRunnerDrop(viewer, {
			eventGroupId: input.eventGroupId,
			entrantId: input.entrantId,
			timingPointId: input.timingPointId,
			dropKind: "dnf",
			dropReason: "voluntary",
			recordedTimeUtc: input.recordedTimeUtc,
		});
	}

	throw new Error(`Unknown quick action: ${input.action}`);
}

/**
 * Report a runner drop:
 * Distinguishes 'dnf' (stopped safely at station custody) vs 'retired' (on course between checkpoints).
 */
export async function reportRunnerDrop(
	viewer: Viewer,
	input: ReportRunnerDropInput,
) {
	const access = await getEventGroupAccess(viewer, input.eventGroupId);
	if (!access) {
		throw new ForbiddenError("You do not have access to this event group");
	}

	let targetEntrantId = input.entrantId;
	if (!targetEntrantId && input.competitorNumber) {
		const subEvents = await db
			.select({ id: events.id })
			.from(events)
			.where(eq(events.eventGroupId, input.eventGroupId));
		const subEventIds = subEvents.map((e) => e.id);
		if (subEventIds.length > 0) {
			const [match] = await db
				.select({ id: entrants.id })
				.from(entrants)
				.where(
					and(
						inArray(entrants.eventId, subEventIds),
						eq(entrants.bibNumber, input.competitorNumber),
					),
				)
				.limit(1);
			if (match) {
				targetEntrantId = match.id;
			}
		}
	}

	if (!targetEntrantId) throw new Error("Entrant not found");

	const [ent] = await db
		.select()
		.from(entrants)
		.where(eq(entrants.id, targetEntrantId));

	if (!ent) throw new Error("Entrant not found");

	let courseSplitId: string | null = null;
	if (input.timingPointId) {
		const [subEvent] = await db
			.select()
			.from(events)
			.where(eq(events.id, ent.eventId));

		if (subEvent) {
			const [cs] = await db
				.select()
				.from(courseSplits)
				.where(
					and(
						eq(courseSplits.courseId, subEvent.courseId),
						eq(courseSplits.timingPointId, input.timingPointId),
					),
				)
				.limit(1);
			if (cs) {
				courseSplitId = cs.id;
			}
		}
	}

	if (input.dropKind === "dnf") {
		// Stopped safely at station custody
		await db
			.update(entrants)
			.set({
				status: "dnf",
				droppedSplitId: courseSplitId ?? ent.droppedSplitId,
				dropReason: input.dropReason,
			})
			.where(eq(entrants.id, targetEntrantId));

		// If courseSplitId is known, mark scored_split_times stoppedHere = true
		if (courseSplitId) {
			await db
				.update(scoredSplitTimes)
				.set({ stoppedHere: true, updatedAt: new Date() })
				.where(
					and(
						eq(scoredSplitTimes.entrantId, targetEntrantId),
						eq(scoredSplitTimes.courseSplitId, courseSplitId),
					),
				);
		}

		return { success: true, status: "dnf", dropKind: "dnf" };
	}

	if (input.dropKind === "retired") {
		// Retired on course between checkpoints
		await db
			.update(entrants)
			.set({
				status: "retired",
				dropLocationDescription: input.dropLocationDescription || "Withdrew on course between checkpoints",
				dropReason: input.dropReason,
			})
			.where(eq(entrants.id, targetEntrantId));

		return { success: true, status: "retired", dropKind: "retired" };
	}

	throw new Error(`Invalid drop kind: ${input.dropKind}`);
}

/**
 * Ingest MT63 digital ham radio text block:
 * Parses standard lines (<STATION> <BIB> <IN|OUT|POINT> <HH:MM:SS> [PACER])
 * and inserts raw timing events and scored splits.
 */
export async function ingestMt63RadioBlock(
	viewer: Viewer,
	input: IngestMt63RadioBlockInput,
) {
	const parsed = parseMt63Block(input.rawText);

	let importedCount = 0;
	const errors = [...parsed.errors];

	for (const punch of parsed.punches) {
		try {
			const stationCode = punch.stationCode || input.fallbackStationCode;
			if (!stationCode) {
				errors.push({
					line: punch.rawLine,
					lineNumber: punch.lineNumber,
					reason: "Missing station code",
				});
				continue;
			}

			// Parse timeOfDay into Date (using today's UTC date)
			const [h, m, s] = punch.timeOfDay.split(":").map(Number);
			const now = new Date();
			const punchDate = new Date(Date.UTC(
				now.getUTCFullYear(),
				now.getUTCMonth(),
				now.getUTCDate(),
				h,
				m,
				s,
			));

			await recordStationSplit(viewer, {
				eventGroupId: input.eventGroupId,
				competitorNumber: punch.competitorNumber,
				timingPointCode: stationCode,
				subSplitKind: punch.subSplitKind,
				recordedTimeUtc: punchDate,
				source: "mt63_ham_radio",
				withPacer: punch.withPacer,
			});

			importedCount++;
		} catch (err: any) {
			errors.push({
				line: punch.rawLine,
				lineNumber: punch.lineNumber,
				reason: err.message || "Failed to record split",
			});
		}
	}

	return {
		importedCount,
		errorCount: errors.length,
		errors,
	};
}

/**
 * Simulate hardware or webhook test pulse:
 * Generates instant test pulse through CQRS ingestion.
 */
export async function simulateHardwarePulse(
	viewer: Viewer,
	input: SimulateTestPulseInput,
) {
	return recordStationSplit(viewer, {
		eventGroupId: input.eventGroupId,
		competitorNumber: input.competitorNumber,
		timingPointCode: input.timingPointCode,
		subSplitKind: input.subSplitKind,
		recordedTimeUtc: input.recordedTimeUtc,
		source: input.source as TimingSource,
		withPacer: false,
	});
}
