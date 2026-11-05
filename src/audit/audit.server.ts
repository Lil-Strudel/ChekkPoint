import "@tanstack/solid-start/server-only";
import { notFound } from "@tanstack/solid-router";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import { ensurePersonForUser } from "../auth/people.server";
import {
	ForbiddenError,
	getEventGroupAccess,
	type EventGroupAccess,
} from "../auth/permissions.server";
import type { Viewer } from "../auth/session.server";
import { db } from "../db";
import {
	courseSplits,
	courses,
	entrantHistoricalProjections,
	entrants,
	eventGroups,
	events,
	organizations,
	people,
	personHistoricalSummaries,
	personRaceHistory,
	rawTimingEvents,
	scoredSplitTimes,
	splitTimeAudits,
	timeAllowances,
	timingPoints,
} from "../db/schema";
import {
	canAuditResults,
	formatElapsedHms,
	formatItraCsv,
	formatStandardCsv,
	formatUltraSignupCsv,
	type OfficialExportRunner,
	type certifyOfficialResultsInput,
	type confirmScoredSplitInput,
	type createTimeAllowanceInput,
	type deleteScoredSplitInput,
	type deleteTimeAllowanceInput,
	type editScoredSplitInput,
	type establishDropsInput,
	type exportResultsInput,
	type insertScoredSplitInput,
	type reassignRawTimingEventInput,
	type rebuildSplitsInput,
	type updateTimeAllowanceInput,
} from "./audit.shared";

// ============================================================================
// PERMISSION HELPERS
// ============================================================================

async function assertAuditPermission(
	viewer: Viewer,
	eventGroupId: string,
): Promise<EventGroupAccess | { organizationId: string; orgRoles: string[]; staffRoles: string[] }> {
	if (viewer.user.role === "admin") {
		return { organizationId: "admin", orgRoles: ["admin"], staffRoles: ["official"] };
	}

	const access = await getEventGroupAccess(viewer, eventGroupId);
	if (!access || !canAuditResults(access)) {
		throw new ForbiddenError("Insufficient permissions to audit race results");
	}
	return access;
}

// ============================================================================
// 1. QUERIES
// ============================================================================

/**
 * Returns complete data for the Sub-Event Tab 5 Forensic Workstation:
 * - Problem efforts queue (bad, questionable, discrepancy, unaccounted drops)
 * - Roster of entrants for quick bib inspection
 * - Selected competitor's ordered splits & underlying raw timing pulses
 * - Active time allowances & audit log history
 * - Post-race certification readiness metrics
 */
export async function getForensicWorkstationData(
	viewer: Viewer,
	slug: string,
	eventGroupSlug: string,
	eventId: string,
	selectedEntrantId?: string,
) {
	// 1. Load Event, EventGroup, and Organization
	const [eventRow] = await db
		.select()
		.from(events)
		.where(eq(events.id, eventId))
		.limit(1);

	if (!eventRow) throw notFound();

	const [groupRow] = await db
		.select()
		.from(eventGroups)
		.where(eq(eventGroups.id, eventRow.eventGroupId))
		.limit(1);

	if (!groupRow || groupRow.slug !== eventGroupSlug) throw notFound();

	const [orgRow] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.id, groupRow.organizationId))
		.limit(1);

	if (!orgRow || orgRow.slug !== slug) throw notFound();

	// 2. Permission check
	await assertAuditPermission(viewer, groupRow.id);

	// 3. Load Course & Course Splits with Timing Points
	const [courseRow] = await db
		.select()
		.from(courses)
		.where(eq(courses.id, eventRow.courseId))
		.limit(1);

	const splitsRows = await db
		.select({
			id: courseSplits.id,
			courseId: courseSplits.courseId,
			timingPointId: courseSplits.timingPointId,
			name: courseSplits.name,
			sequenceOrder: courseSplits.sequenceOrder,
			distanceFromStartMeters: courseSplits.distanceFromStartMeters,
			subSplitBitmap: courseSplits.subSplitBitmap,
			cutoffDurationSeconds: courseSplits.cutoffDurationSeconds,
			isSecretCheckpoint: courseSplits.isSecretCheckpoint,
			idealDurationSeconds: courseSplits.tsdIdealDurationSeconds,
			timingPointCode: timingPoints.code,
			timingPointName: timingPoints.name,
			elevationMeters: timingPoints.elevationMeters,
		})
		.from(courseSplits)
		.innerJoin(timingPoints, eq(timingPoints.id, courseSplits.timingPointId))
		.where(eq(courseSplits.courseId, eventRow.courseId))
		.orderBy(asc(courseSplits.sequenceOrder));

	const splitMap = new Map(splitsRows.map((s) => [s.id, s]));

	// 4. Load all Entrants with People in this sub-event
	const entrantsRows = await db
		.select({
			id: entrants.id,
			eventId: entrants.eventId,
			personId: entrants.personId,
			competitorNumber: entrants.competitorNumber,
			gender: entrants.gender,
			age: entrants.age,
			division: entrants.division,
			status: entrants.status,
			actualStartTime: entrants.actualStartTime,
			overallPlace: entrants.overallPlace,
			genderPlace: entrants.genderPlace,
			firstName: people.firstName,
			lastName: people.lastName,
		})
		.from(entrants)
		.innerJoin(people, eq(people.id, entrants.personId))
		.where(eq(entrants.eventId, eventId))
		.orderBy(asc(entrants.competitorNumber));

	const entrantIds = entrantsRows.map((e) => e.id);
	const entrantMap = new Map(entrantsRows.map((e) => [e.id, e]));
	const entrantByBib = new Map(entrantsRows.map((e) => [e.competitorNumber, e]));

	// 5. Load Scored Splits for all entrants in this event
	const allScoredSplits =
		entrantIds.length > 0
			? await db
					.select()
					.from(scoredSplitTimes)
					.where(inArray(scoredSplitTimes.entrantId, entrantIds))
					.orderBy(
						asc(scoredSplitTimes.lap),
						asc(scoredSplitTimes.elapsedSeconds),
					)
			: [];

	// 6. Load Raw Timing Events for this event group
	const rawEventsRows = await db
		.select()
		.from(rawTimingEvents)
		.where(eq(rawTimingEvents.eventGroupId, groupRow.id))
		.orderBy(asc(rawTimingEvents.recordedTimeUtc));

	// Group scored splits and raw events by entrant
	const splitsByEntrant = new Map<string, typeof allScoredSplits>();
	for (const s of allScoredSplits) {
		const list = splitsByEntrant.get(s.entrantId) ?? [];
		list.push(s);
		splitsByEntrant.set(s.entrantId, list);
	}

	const rawByBib = new Map<string, typeof rawEventsRows>();
	for (const r of rawEventsRows) {
		const list = rawByBib.get(r.competitorNumber) ?? [];
		list.push(r);
		rawByBib.set(r.competitorNumber, list);
	}

	// 7. Assemble Problem Efforts Queue
	interface ProblemItem {
		entrantId: string;
		bibNumber: string;
		athleteName: string;
		division: string;
		status: string;
		issues: Array<{
			kind: "bad_split" | "questionable_split" | "flagged_discrepancy" | "unaccounted_drop";
			label: string;
			details: string;
		}>;
		lastSplitName: string;
		lastElapsedFormatted: string;
	}

	const problemQueue: ProblemItem[] = [];

	for (const ent of entrantsRows) {
		const runnerSplits = splitsByEntrant.get(ent.id) ?? [];
		const runnerRaw = rawByBib.get(ent.competitorNumber) ?? [];
		const issues: ProblemItem["issues"] = [];

		// Check for bad splits (negative elapsed, dataStatus = 'bad')
		const bad = runnerSplits.filter(
			(s) => s.dataStatus === "bad" || s.elapsedSeconds < 0,
		);
		if (bad.length > 0) {
			issues.push({
				kind: "bad_split",
				label: "Bad Split",
				details: `${bad.length} split(s) marked bad or negative elapsed`,
			});
		}

		// Check for questionable splits (velocity anomaly, dataStatus = 'questionable')
		const questionable = runnerSplits.filter(
			(s) => s.dataStatus === "questionable",
		);
		if (questionable.length > 0) {
			issues.push({
				kind: "questionable_split",
				label: "Questionable Split",
				details: `${questionable.length} split(s) with velocity or gap anomaly`,
			});
		}

		// Check for raw timing discrepancies
		const discrepancies = runnerRaw.filter(
			(r) => r.status === "flagged_discrepancy",
		);
		if (discrepancies.length > 0) {
			issues.push({
				kind: "flagged_discrepancy",
				label: "Raw Discrepancy",
				details: `${discrepancies.length} raw pulse(s) flagged as discrepancy`,
			});
		}

		// Check for unaccounted drop (retired without a recorded drop point)
		if (ent.status === "retired") {
			const hasStopped = runnerSplits.some((s) => s.stoppedHere);
			if (!hasStopped) {
				issues.push({
					kind: "unaccounted_drop",
					label: "Unaccounted Drop",
					details: "Entrant is retired on course with no confirmed drop station",
				});
			}
		}

		if (issues.length > 0) {
			const lastSplit = runnerSplits[runnerSplits.length - 1];
			const lastCourseSplit = lastSplit ? splitMap.get(lastSplit.courseSplitId) : null;

			problemQueue.push({
				entrantId: ent.id,
				bibNumber: ent.competitorNumber,
				athleteName: `${ent.firstName} ${ent.lastName || ""}`.trim(),
				division: ent.division,
				status: ent.status,
				issues,
				lastSplitName: lastCourseSplit?.name ?? "Start",
				lastElapsedFormatted: lastSplit
					? formatElapsedHms(lastSplit.elapsedSeconds)
					: "—",
			});
		}
	}

	// 8. Determine Active Competitor for the Right Pane
	let activeEntrantId = selectedEntrantId;
	if (!activeEntrantId || !entrantMap.has(activeEntrantId)) {
		activeEntrantId =
			problemQueue[0]?.entrantId ?? entrantsRows[0]?.id ?? undefined;
	}

	const activeEntrant = activeEntrantId ? entrantMap.get(activeEntrantId) : null;
	const activeSplits = activeEntrantId ? splitsByEntrant.get(activeEntrantId) ?? [] : [];
	const activeRaw = activeEntrant ? rawByBib.get(activeEntrant.competitorNumber) ?? [] : [];

	// Load Time Allowances for active entrant
	const allowancesRows = activeEntrantId
		? await db
				.select({
					id: timeAllowances.id,
					entrantId: timeAllowances.entrantId,
					splitId: timeAllowances.splitId,
					startTime: timeAllowances.startTime,
					endTime: timeAllowances.endTime,
					durationSeconds: timeAllowances.durationSeconds,
					reason: timeAllowances.reason,
					authorizedByPersonId: timeAllowances.authorizedByPersonId,
					notes: timeAllowances.notes,
					createdAt: timeAllowances.createdAt,
					splitName: courseSplits.name,
					authorizerFirstName: people.firstName,
					authorizerLastName: people.lastName,
				})
				.from(timeAllowances)
				.innerJoin(courseSplits, eq(courseSplits.id, timeAllowances.splitId))
				.innerJoin(people, eq(people.id, timeAllowances.authorizedByPersonId))
				.where(eq(timeAllowances.entrantId, activeEntrantId))
				.orderBy(asc(timeAllowances.startTime))
		: [];

	// Load Split Time Audits for active entrant's splits
	const activeSplitIds = activeSplits.map((s) => s.id);
	const auditsRows =
		activeSplitIds.length > 0
			? await db
					.select({
						id: splitTimeAudits.id,
						splitTimeId: splitTimeAudits.splitTimeId,
						action: splitTimeAudits.action,
						previousState: splitTimeAudits.previousState,
						newState: splitTimeAudits.newState,
						changedByPersonId: splitTimeAudits.changedByPersonId,
						changeReason: splitTimeAudits.changeReason,
						createdAt: splitTimeAudits.createdAt,
						changerFirstName: people.firstName,
						changerLastName: people.lastName,
					})
					.from(splitTimeAudits)
					.innerJoin(people, eq(people.id, splitTimeAudits.changedByPersonId))
					.where(inArray(splitTimeAudits.splitTimeId, activeSplitIds))
					.orderBy(desc(splitTimeAudits.createdAt))
			: [];

	// Format active splits with course split metadata
	const formattedSplits = activeSplits.map((s) => {
		const cs = splitMap.get(s.courseSplitId);
		return {
			...s,
			splitName: cs?.name ?? "Unknown Split",
			sequenceOrder: cs?.sequenceOrder ?? 0,
			distanceFromStartMeters: cs?.distanceFromStartMeters ?? 0,
			elevationMeters: cs?.elevationMeters ?? null,
			elapsedFormatted: formatElapsedHms(s.elapsedSeconds),
			dwellFormatted: s.dwellSeconds ? `${Math.floor(s.dwellSeconds / 60)}m ${s.dwellSeconds % 60}s` : "—",
			paceFormatted: s.segmentPaceSecondsPerKm
				? `${Math.floor(s.segmentPaceSecondsPerKm / 60)}:${String(Math.floor(s.segmentPaceSecondsPerKm % 60)).padStart(2, "0")} /km`
				: "—",
			timeOfDayFormatted: s.absoluteTimeUtc.toISOString().substring(11, 19),
		};
	});

	// 9. Post-Race Certification Readiness Checklist
	const inProgressCount = entrantsRows.filter((e) => e.status === "in_progress").length;
	const unaccountedRetiredCount = entrantsRows.filter((e) => e.status === "retired").length;
	const badSplitsCount = allScoredSplits.filter((s) => s.dataStatus === "bad").length;
	const questionableSplitsCount = allScoredSplits.filter((s) => s.dataStatus === "questionable").length;
	const unconfirmedSplitsCount = allScoredSplits.filter((s) => s.dataStatus !== "confirmed").length;
	const finishersCount = entrantsRows.filter((e) => e.status === "finished").length;
	const dnfCount = entrantsRows.filter((e) => e.status === "dnf").length;
	const dnsCount = entrantsRows.filter((e) => e.status === "dns").length;

	const readyToCertify =
		inProgressCount === 0 && badSplitsCount === 0 && questionableSplitsCount === 0;

	return {
		subEvent: {
			id: eventRow.id,
			name: eventRow.name,
			scheduledStart: eventRow.scheduledStart.toISOString(),
			actualStartIso: eventRow.actualStartTime?.toISOString() ?? null,
		},
		eventGroup: {
			id: groupRow.id,
			name: groupRow.name,
			slug: groupRow.slug,
			discipline: groupRow.discipline,
			timeZone: groupRow.timeZone,
		},
		organization: {
			id: orgRow.id,
			name: orgRow.name,
			slug: orgRow.slug,
		},
		courseSplits: splitsRows,
		roster: entrantsRows.map((e) => ({
			id: e.id,
			bibNumber: e.competitorNumber,
			displayName: `${e.firstName} ${e.lastName || ""}`.trim(),
			status: e.status,
			division: e.division,
		})),
		problemQueue,
		selectedEntrant: activeEntrant
			? {
					id: activeEntrant.id,
					bibNumber: activeEntrant.competitorNumber,
					displayName: `${activeEntrant.firstName} ${activeEntrant.lastName || ""}`.trim(),
					status: activeEntrant.status,
					division: activeEntrant.division,
					gender: activeEntrant.gender,
					actualStartTime: activeEntrant.actualStartTime?.toISOString() ?? null,
				}
			: null,
		scoredSplits: formattedSplits,
		rawTimingEvents: activeRaw.map((r) => ({
			id: r.id,
			timingPointCode: r.timingPointCode,
			subSplitKind: r.subSplitKind,
			recordedTimeUtc: r.recordedTimeUtc.toISOString(),
			source: r.source,
			sourceDeviceId: r.sourceDeviceId,
			withPacer: r.withPacer,
			status: r.status,
			auditNote: r.auditNote,
			rawPayload: r.rawPayload,
		})),
		timeAllowances: allowancesRows.map((a) => ({
			id: a.id,
			splitId: a.splitId,
			splitName: a.splitName,
			startTime: a.startTime.toISOString(),
			endTime: a.endTime.toISOString(),
			durationSeconds: a.durationSeconds,
			reason: a.reason,
			notes: a.notes,
			authorizedByName: `${a.authorizerFirstName} ${a.authorizerLastName || ""}`.trim(),
			createdAt: a.createdAt.toISOString(),
		})),
		auditLog: auditsRows.map((au) => ({
			id: au.id,
			splitTimeId: au.splitTimeId,
			action: au.action,
			previousState: au.previousState,
			newState: au.newState,
			changeReason: au.changeReason,
			changedByName: `${au.changerFirstName} ${au.changerLastName || ""}`.trim(),
			createdAt: au.createdAt.toISOString(),
		})),
		readiness: {
			totalEntrants: entrantsRows.length,
			inProgressCount,
			unaccountedRetiredCount,
			badSplitsCount,
			questionableSplitsCount,
			problemSplitsCount: badSplitsCount + questionableSplitsCount,
			unconfirmedSplitsCount,
			finishersCount,
			dnfCount,
			dnsCount,
			readyToCertify,
		},
	};
}

/**
 * Public Spectator Unified Split & Projection Timeline:
 * - Completed splits (Time of Day, Elapsed, Pace, Dwell, Place, Time Allowances, TSD)
 * - Shaded Earliest - Expected - Latest Projected Arrival Windows
 * - Topographic Elevation Profile coordinates
 * - Strict PII Redaction: NEVER exposes medical notes, allergies, phone, email, rfid, emergency contacts
 * - Suppresses secret checkpoints unless revealed
 */
export async function getPublicEntrantTelemetry(
	slug: string,
	entrantId: string,
) {
	// 1. Fetch entrant with joined person, event, eventGroup, and course
	const [entrantRow] = await db
		.select({
			id: entrants.id,
			eventId: entrants.eventId,
			personId: entrants.personId,
			competitorNumber: entrants.competitorNumber,
			gender: entrants.gender,
			age: entrants.age,
			division: entrants.division,
			status: entrants.status,
			actualStartTime: entrants.actualStartTime,
			overallPlace: entrants.overallPlace,
			genderPlace: entrants.genderPlace,
			divisionPlace: entrants.divisionPlace,
			city: entrants.city,
			state: entrants.state,
			country: entrants.country,
			firstName: people.firstName,
			lastName: people.lastName,
		})
		.from(entrants)
		.innerJoin(people, eq(people.id, entrants.personId))
		.where(eq(entrants.id, entrantId))
		.limit(1);

	if (!entrantRow) throw notFound();

	const [eventRow] = await db
		.select()
		.from(events)
		.where(eq(events.id, entrantRow.eventId))
		.limit(1);

	if (!eventRow) throw notFound();

	const [groupRow] = await db
		.select()
		.from(eventGroups)
		.where(eq(eventGroups.id, eventRow.eventGroupId))
		.limit(1);

	if (!groupRow || groupRow.slug !== slug) throw notFound();

	const [courseRow] = await db
		.select()
		.from(courses)
		.where(eq(courses.id, eventRow.courseId))
		.limit(1);

	// 2. Load Course Splits (and filter secret checkpoints if not revealed)
	const rulesConfig = (groupRow.rulesConfig ?? {}) as Record<string, unknown>;
	const revealSecret = Boolean(rulesConfig.revealSecretCheckpoints);

	const splitsRows = await db
		.select({
			id: courseSplits.id,
			courseId: courseSplits.courseId,
			name: courseSplits.name,
			sequenceOrder: courseSplits.sequenceOrder,
			distanceFromStartMeters: courseSplits.distanceFromStartMeters,
			subSplitBitmap: courseSplits.subSplitBitmap,
			cutoffDurationSeconds: courseSplits.cutoffDurationSeconds,
			isSecretCheckpoint: courseSplits.isSecretCheckpoint,
			elevationMeters: timingPoints.elevationMeters,
		})
		.from(courseSplits)
		.innerJoin(timingPoints, eq(timingPoints.id, courseSplits.timingPointId))
		.where(
			and(
				eq(courseSplits.courseId, eventRow.courseId),
				revealSecret ? undefined : eq(courseSplits.isSecretCheckpoint, false),
			),
		)
		.orderBy(asc(courseSplits.sequenceOrder));

	const splitIds = splitsRows.map((s) => s.id);

	// 3. Load Scored Splits for this Entrant
	const scoredRows =
		splitIds.length > 0
			? await db
					.select()
					.from(scoredSplitTimes)
					.where(
						and(
							eq(scoredSplitTimes.entrantId, entrantId),
							inArray(scoredSplitTimes.courseSplitId, splitIds),
						),
					)
					.orderBy(
						asc(scoredSplitTimes.lap),
						asc(scoredSplitTimes.elapsedSeconds),
					)
			: [];

	const scoredBySplitId = new Map(scoredRows.map((s) => [s.courseSplitId, s]));

	// 4. Load Time Allowances for this Entrant
	const allowances = await db
		.select()
		.from(timeAllowances)
		.where(eq(timeAllowances.entrantId, entrantId))
		.orderBy(asc(timeAllowances.startTime));

	const totalAllowanceSeconds = allowances.reduce(
		(sum, a) => sum + a.durationSeconds,
		0,
	);

	// 5. Load Materialized Pacing Projections
	const [projectionRow] = await db
		.select()
		.from(entrantHistoricalProjections)
		.where(eq(entrantHistoricalProjections.entrantId, entrantId))
		.limit(1);

	const projectedArrivals = (projectionRow?.projectedArrivalTimes ?? {}) as Record<
		string,
		{ secondsFromStart: number; projectedTimeUtc: string }
	>;

	// 6. Build the Unified Split & Projection Timeline
	const timeline = splitsRows.map((sp) => {
		const scored = scoredBySplitId.get(sp.id);

		if (scored) {
			// Credited allowance up to this split
			const splitAllowance = allowances
				.filter((a) => a.startTime <= scored.absoluteTimeUtc)
				.reduce((sum, a) => sum + a.durationSeconds, 0);

			const adjustedElapsedSeconds = Math.max(
				0,
				scored.elapsedSeconds - splitAllowance,
			);

			return {
				splitId: sp.id,
				splitName: sp.name,
				sequenceOrder: sp.sequenceOrder,
				distanceMeters: sp.distanceFromStartMeters,
				elevationMeters: sp.elevationMeters,
				cutoffDurationSeconds: sp.cutoffDurationSeconds,
				status: "completed" as const,
				subSplitKind: scored.subSplitKind,
				absoluteTimeUtc: scored.absoluteTimeUtc.toISOString(),
				timeOfDayFormatted: scored.absoluteTimeUtc.toISOString().substring(11, 19),
				elapsedSeconds: scored.elapsedSeconds,
				adjustedElapsedSeconds,
				elapsedFormatted: formatElapsedHms(scored.elapsedSeconds),
				adjustedElapsedFormatted: formatElapsedHms(adjustedElapsedSeconds),
				dwellSeconds: scored.dwellSeconds,
				dwellFormatted: scored.dwellSeconds
					? `${Math.floor(scored.dwellSeconds / 60)}m ${scored.dwellSeconds % 60}s`
					: "—",
				segmentPaceSecondsPerKm: scored.segmentPaceSecondsPerKm,
				paceFormatted: scored.segmentPaceSecondsPerKm
					? `${Math.floor(scored.segmentPaceSecondsPerKm / 60)}:${String(Math.floor(scored.segmentPaceSecondsPerKm % 60)).padStart(2, "0")} /km`
					: "—",
				timeAllowanceSeconds: splitAllowance > 0 ? splitAllowance : null,
				tsdDeviationSeconds: scored.tsdDeviationSeconds,
				dataStatus: scored.dataStatus,
				projectedArrivalSeconds: null,
				projectedArrivalFormatted: null,
				earliestArrivalSeconds: null,
				earliestArrivalFormatted: null,
				latestArrivalSeconds: null,
				latestArrivalFormatted: null,
				cutoffMarginSeconds: null,
				cutoffRisk: false,
			};
		}

		// Projected upcoming split
		const arrivalData = projectedArrivals[sp.id];
		const projectedSec = arrivalData?.secondsFromStart ?? null;

		let earliestSec: number | null = null;
		let latestSec: number | null = null;
		let cutoffMarginSeconds: number | null = null;
		let cutoffRisk = false;

		if (projectedSec !== null) {
			const bandLow = projectionRow?.confidenceBandLowSeconds ?? 900;
			const bandHigh = projectionRow?.confidenceBandHighSeconds ?? 1800;
			earliestSec = Math.max(0, projectedSec - bandLow);
			latestSec = projectedSec + bandHigh;

			if (sp.cutoffDurationSeconds) {
				cutoffMarginSeconds = sp.cutoffDurationSeconds - latestSec;
				cutoffRisk = cutoffMarginSeconds < 1800; // < 30m cutoff buffer
			}
		}

		return {
			splitId: sp.id,
			splitName: sp.name,
			sequenceOrder: sp.sequenceOrder,
			distanceMeters: sp.distanceFromStartMeters,
			elevationMeters: sp.elevationMeters,
			cutoffDurationSeconds: sp.cutoffDurationSeconds,
			status: "projected" as const,
			subSplitKind: null,
			absoluteTimeUtc: null,
			timeOfDayFormatted: null,
			elapsedSeconds: null,
			adjustedElapsedSeconds: null,
			elapsedFormatted: null,
			adjustedElapsedFormatted: null,
			dwellSeconds: null,
			dwellFormatted: null,
			segmentPaceSecondsPerKm: null,
			paceFormatted: null,
			timeAllowanceSeconds: null,
			tsdDeviationSeconds: null,
			dataStatus: null,
			projectedArrivalSeconds: projectedSec,
			projectedArrivalFormatted: formatElapsedHms(projectedSec),
			earliestArrivalSeconds: earliestSec,
			earliestArrivalFormatted: formatElapsedHms(earliestSec),
			latestArrivalSeconds: latestSec,
			latestArrivalFormatted: formatElapsedHms(latestSec),
			cutoffMarginSeconds,
			cutoffRisk,
		};
	});

	// 7. Generate Topographic Elevation Profile Points for SVG Chart
	const elevationProfile = splitsRows.map((sp, idx) => {
		const isCompleted = scoredBySplitId.has(sp.id);
		const isCurrent =
			isCompleted &&
			(idx === splitsRows.length - 1 || !scoredBySplitId.has(splitsRows[idx + 1].id));

		return {
			splitId: sp.id,
			splitName: sp.name,
			sequenceOrder: sp.sequenceOrder,
			distanceKm: Math.round((sp.distanceFromStartMeters / 1000) * 10) / 10,
			elevationMeters: sp.elevationMeters ?? 1500,
			isCompleted,
			isCurrent,
		};
	});

	// City / State string without exact street address
	const cityState = [entrantRow.city, entrantRow.state].filter(Boolean).join(", ") ||
		entrantRow.country ||
		"Mountain West, US";

	// Latest split info
	const lastCompleted = timeline.filter((t) => t.status === "completed").pop();

	return {
		entrant: {
			id: entrantRow.id,
			competitorNumber: entrantRow.competitorNumber,
			bibNumber: entrantRow.competitorNumber,
			displayName: `${entrantRow.firstName} ${entrantRow.lastName || ""}`.trim(),
			gender: entrantRow.gender,
			age: entrantRow.age,
			division: entrantRow.division,
			status: entrantRow.status,
			cityState,
			overallPlace: entrantRow.overallPlace,
			genderPlace: entrantRow.genderPlace,
			divisionPlace: entrantRow.divisionPlace,
			actualStartTime: entrantRow.actualStartTime?.toISOString() ?? null,
		},
		eventGroup: {
			name: groupRow.name,
			slug: groupRow.slug,
			discipline: groupRow.discipline,
			timeZone: groupRow.timeZone,
			location: groupRow.location,
		},
		event: {
			id: eventRow.id,
			name: eventRow.name,
			distanceLabel: eventRow.distanceLabel,
			scheduledStart: eventRow.scheduledStart.toISOString(),
		},
		course: {
			name: courseRow?.name ?? "Course",
			distanceMeters: courseRow?.distanceMeters ?? 0,
			elevationGainMeters: courseRow?.elevationGainMeters ?? 0,
			elevationLossMeters: courseRow?.elevationLossMeters ?? 0,
		},
		timeline,
		elevationProfile,
		summary: {
			totalElapsedSeconds: lastCompleted?.elapsedSeconds ?? null,
			totalElapsedFormatted: lastCompleted?.elapsedFormatted ?? "—",
			adjustedElapsedSeconds: lastCompleted?.adjustedElapsedSeconds ?? null,
			adjustedElapsedFormatted: lastCompleted?.adjustedElapsedFormatted ?? "—",
			totalAllowanceSeconds,
			overallPlace: entrantRow.overallPlace,
			status: entrantRow.status,
			projectedFinishFormatted: projectionRow?.projectedFinishSeconds
				? formatElapsedHms(projectionRow.projectedFinishSeconds)
				: null,
			safetyBadge: projectionRow?.volunteersSarSafetyBadge ?? null,
		},
	};
}

// ============================================================================
// 2. MUTATIONS
// ============================================================================

/**
 * Updates a scored split time and writes an immutable audit entry into `split_time_audits`.
 */
export async function editScoredSplit(
	viewer: Viewer,
	input: z.infer<typeof editScoredSplitInput>,
) {
	if (!input.changeReason || input.changeReason.trim().length < 3) {
		throw new Error("changeReason must be at least 3 characters");
	}

	const [existing] = await db
		.select()
		.from(scoredSplitTimes)
		.where(eq(scoredSplitTimes.id, input.splitTimeId))
		.limit(1);

	if (!existing) throw notFound();

	// Load entrant to find event group for permission check
	const [entrantRow] = await db
		.select({ eventId: entrants.eventId })
		.from(entrants)
		.where(eq(entrants.id, existing.entrantId))
		.limit(1);

	const [eventRow] = await db
		.select({ eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, entrantRow.eventId))
		.limit(1);

	await assertAuditPermission(viewer, eventRow.eventGroupId);
	const personId = viewer.person?.id ?? (await ensurePersonForUser(viewer.user));

	const updates: Partial<typeof scoredSplitTimes.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (input.elapsedSeconds !== undefined) {
		updates.elapsedSeconds = input.elapsedSeconds;
	}
	if (input.absoluteTimeUtc !== undefined) {
		updates.absoluteTimeUtc = new Date(input.absoluteTimeUtc);
	}
	if (input.dataStatus !== undefined) {
		updates.dataStatus = input.dataStatus;
	}

	const [updated] = await db
		.update(scoredSplitTimes)
		.set(updates)
		.where(eq(scoredSplitTimes.id, input.splitTimeId))
		.returning();

	// Write immutable audit log
	await db.insert(splitTimeAudits).values({
		splitTimeId: existing.id,
		action: "UPDATED",
		previousState: existing as unknown as Record<string, unknown>,
		newState: updated as unknown as Record<string, unknown>,
		changedByPersonId: personId,
		changeReason: input.changeReason.trim(),
	});

	return updated;
}

/**
 * Inserts a manual split time and writes a `CREATED` entry to `split_time_audits`.
 */
export async function insertScoredSplit(
	viewer: Viewer,
	input: z.infer<typeof insertScoredSplitInput>,
) {
	if (!input.changeReason || input.changeReason.trim().length < 3) {
		throw new Error("changeReason must be at least 3 characters");
	}

	const [entrantRow] = await db
		.select({ eventId: entrants.eventId })
		.from(entrants)
		.where(eq(entrants.id, input.entrantId))
		.limit(1);

	if (!entrantRow) throw notFound();

	const [eventRow] = await db
		.select({ eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, entrantRow.eventId))
		.limit(1);

	await assertAuditPermission(viewer, eventRow.eventGroupId);
	const personId = viewer.person?.id ?? (await ensurePersonForUser(viewer.user));

	const [inserted] = await db
		.insert(scoredSplitTimes)
		.values({
			entrantId: input.entrantId,
			courseSplitId: input.courseSplitId,
			lap: input.lap,
			subSplitKind: input.subSplitKind,
			absoluteTimeUtc: new Date(input.absoluteTimeUtc),
			elapsedSeconds: input.elapsedSeconds,
			dataStatus: "confirmed",
		})
		.returning();

	await db.insert(splitTimeAudits).values({
		splitTimeId: inserted.id,
		action: "CREATED",
		previousState: null,
		newState: inserted as unknown as Record<string, unknown>,
		changedByPersonId: personId,
		changeReason: input.changeReason.trim(),
	});

	return inserted;
}

/**
 * Deletes a scored split time and writes a `DELETED` entry to `split_time_audits`.
 */
export async function deleteScoredSplit(
	viewer: Viewer,
	input: z.infer<typeof deleteScoredSplitInput>,
) {
	if (!input.changeReason || input.changeReason.trim().length < 3) {
		throw new Error("changeReason must be at least 3 characters");
	}

	const [existing] = await db
		.select()
		.from(scoredSplitTimes)
		.where(eq(scoredSplitTimes.id, input.splitTimeId))
		.limit(1);

	if (!existing) throw notFound();

	const [entrantRow] = await db
		.select({ eventId: entrants.eventId })
		.from(entrants)
		.where(eq(entrants.id, existing.entrantId))
		.limit(1);

	const [eventRow] = await db
		.select({ eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, entrantRow.eventId))
		.limit(1);

	await assertAuditPermission(viewer, eventRow.eventGroupId);
	const personId = viewer.person?.id ?? (await ensurePersonForUser(viewer.user));

	// Record audit entry before deletion
	await db.insert(splitTimeAudits).values({
		splitTimeId: existing.id,
		action: "DELETED",
		previousState: existing as unknown as Record<string, unknown>,
		newState: null,
		changedByPersonId: personId,
		changeReason: input.changeReason.trim(),
	});

	await db
		.delete(scoredSplitTimes)
		.where(eq(scoredSplitTimes.id, input.splitTimeId));

	return { success: true };
}

/**
 * Locks a split to confirmed status (`dataStatus = 'confirmed'`).
 */
export async function confirmScoredSplit(
	viewer: Viewer,
	input: z.infer<typeof confirmScoredSplitInput>,
) {
	return editScoredSplit(viewer, {
		splitTimeId: input.splitTimeId,
		dataStatus: "confirmed",
		changeReason: input.changeReason,
	});
}

/**
 * Reassigns raw timing event:
 * - Promotes alternate pulse to `matched` (demoting previous to `duplicate_subordinate`)
 * - Or reassigns competitor number or lap number
 */
export async function reassignRawTimingEvent(
	viewer: Viewer,
	input: z.infer<typeof reassignRawTimingEventInput>,
) {
	if (!input.changeReason || input.changeReason.trim().length < 3) {
		throw new Error("changeReason must be at least 3 characters");
	}

	const [rawEvent] = await db
		.select()
		.from(rawTimingEvents)
		.where(eq(rawTimingEvents.id, input.rawEventId))
		.limit(1);

	if (!rawEvent) throw notFound();

	await assertAuditPermission(viewer, rawEvent.eventGroupId);

	if (input.promoteToMatched) {
		// Demote existing matched events for this competitor & timing point to duplicate_subordinate
		await db
			.update(rawTimingEvents)
			.set({ status: "duplicate_subordinate" })
			.where(
				and(
					eq(rawTimingEvents.eventGroupId, rawEvent.eventGroupId),
					eq(rawTimingEvents.competitorNumber, rawEvent.competitorNumber),
					eq(rawTimingEvents.timingPointCode, rawEvent.timingPointCode),
					eq(rawTimingEvents.subSplitKind, rawEvent.subSplitKind),
					eq(rawTimingEvents.status, "matched"),
				),
			);
	}

	const updates: Partial<typeof rawTimingEvents.$inferInsert> = {
		auditNote: `${rawEvent.auditNote ? `${rawEvent.auditNote}; ` : ""}${input.changeReason.trim()}`,
	};

	if (input.promoteToMatched) {
		updates.status = "matched";
	}
	if (input.newCompetitorNumber) {
		updates.competitorNumber = input.newCompetitorNumber;
	}

	const [updated] = await db
		.update(rawTimingEvents)
		.set(updates)
		.where(eq(rawTimingEvents.id, input.rawEventId))
		.returning();

	return updated;
}

// ----------------------------------------------------------------------------
// TIME ALLOWANCES CRUD
// ----------------------------------------------------------------------------

export async function createTimeAllowance(
	viewer: Viewer,
	input: z.infer<typeof createTimeAllowanceInput>,
) {
	if (input.durationSeconds <= 0) {
		throw new Error("Duration must be greater than zero");
	}

	const [entrantRow] = await db
		.select({ eventId: entrants.eventId })
		.from(entrants)
		.where(eq(entrants.id, input.entrantId))
		.limit(1);

	if (!entrantRow) throw notFound();

	const [eventRow] = await db
		.select({ eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, entrantRow.eventId))
		.limit(1);

	await assertAuditPermission(viewer, eventRow.eventGroupId);
	const personId = viewer.person?.id ?? (await ensurePersonForUser(viewer.user));

	const [created] = await db
		.insert(timeAllowances)
		.values({
			entrantId: input.entrantId,
			splitId: input.splitId,
			startTime: new Date(input.startTime),
			endTime: new Date(input.endTime),
			durationSeconds: input.durationSeconds,
			reason: input.reason,
			authorizedByPersonId: personId,
			notes: input.notes ?? null,
		})
		.returning();

	return created;
}

export async function updateTimeAllowance(
	viewer: Viewer,
	input: z.infer<typeof updateTimeAllowanceInput>,
) {
	const [existing] = await db
		.select()
		.from(timeAllowances)
		.where(eq(timeAllowances.id, input.allowanceId))
		.limit(1);

	if (!existing) throw notFound();

	const [entrantRow] = await db
		.select({ eventId: entrants.eventId })
		.from(entrants)
		.where(eq(entrants.id, existing.entrantId))
		.limit(1);

	const [eventRow] = await db
		.select({ eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, entrantRow.eventId))
		.limit(1);

	await assertAuditPermission(viewer, eventRow.eventGroupId);

	const updates: Partial<typeof timeAllowances.$inferInsert> = {};
	if (input.startTime) updates.startTime = new Date(input.startTime);
	if (input.endTime) updates.endTime = new Date(input.endTime);
	if (input.durationSeconds !== undefined) {
		if (input.durationSeconds <= 0) {
			throw new Error("Duration must be greater than zero");
		}
		updates.durationSeconds = input.durationSeconds;
	}
	if (input.reason) updates.reason = input.reason;
	if (input.notes !== undefined) updates.notes = input.notes;

	const [updated] = await db
		.update(timeAllowances)
		.set(updates)
		.where(eq(timeAllowances.id, input.allowanceId))
		.returning();

	return updated;
}

export async function deleteTimeAllowance(
	viewer: Viewer,
	input: z.infer<typeof deleteTimeAllowanceInput>,
) {
	const [existing] = await db
		.select()
		.from(timeAllowances)
		.where(eq(timeAllowances.id, input.allowanceId))
		.limit(1);

	if (!existing) throw notFound();

	const [entrantRow] = await db
		.select({ eventId: entrants.eventId })
		.from(entrants)
		.where(eq(entrants.id, existing.entrantId))
		.limit(1);

	const [eventRow] = await db
		.select({ eventGroupId: events.eventGroupId })
		.from(events)
		.where(eq(events.id, entrantRow.eventId))
		.limit(1);

	await assertAuditPermission(viewer, eventRow.eventGroupId);

	await db.delete(timeAllowances).where(eq(timeAllowances.id, input.allowanceId));
	return { success: true };
}

// ----------------------------------------------------------------------------
// CQRS REBUILD ENGINE
// ----------------------------------------------------------------------------

/**
 * Deterministic CQRS replay engine:
 * Replays `raw_timing_events` chronologically to derive `scored_split_times`.
 */
export async function rebuildSplits(
	viewer: Viewer,
	input: z.infer<typeof rebuildSplitsInput>,
) {
	if (!input.changeReason || input.changeReason.trim().length < 3) {
		throw new Error("changeReason is mandatory for rebuildSplits");
	}

	const [eventRow] = await db
		.select()
		.from(events)
		.where(eq(events.id, input.eventId))
		.limit(1);

	if (!eventRow) throw notFound();

	await assertAuditPermission(viewer, eventRow.eventGroupId);
	const personId = viewer.person?.id ?? (await ensurePersonForUser(viewer.user));

	// Load course splits with timing point codes
	const splitsRows = await db
		.select({
			id: courseSplits.id,
			courseId: courseSplits.courseId,
			timingPointId: courseSplits.timingPointId,
			name: courseSplits.name,
			sequenceOrder: courseSplits.sequenceOrder,
			distanceFromStartMeters: courseSplits.distanceFromStartMeters,
			timingPointCode: timingPoints.code,
		})
		.from(courseSplits)
		.innerJoin(timingPoints, eq(timingPoints.id, courseSplits.timingPointId))
		.where(eq(courseSplits.courseId, eventRow.courseId))
		.orderBy(asc(courseSplits.sequenceOrder));

	const splitByCode = new Map(
		splitsRows.map((s) => [s.timingPointCode.toUpperCase(), s]),
	);

	// Load target entrants
	const targetEntrants = await db
		.select()
		.from(entrants)
		.where(
			and(
				eq(entrants.eventId, input.eventId),
				input.entrantId ? eq(entrants.id, input.entrantId) : undefined,
			),
		);

	let totalRebuiltSplits = 0;

	for (const ent of targetEntrants) {
		// Snapshot previous state
		const previousSplits = await db
			.select()
			.from(scoredSplitTimes)
			.where(eq(scoredSplitTimes.entrantId, ent.id));

		// Remove existing read-plane records
		if (previousSplits.length > 0) {
			await db
				.delete(scoredSplitTimes)
				.where(eq(scoredSplitTimes.entrantId, ent.id));
		}

		// Replay chronological raw events
		const rawEvents = await db
			.select()
			.from(rawTimingEvents)
			.where(
				and(
					eq(rawTimingEvents.eventGroupId, eventRow.eventGroupId),
					eq(rawTimingEvents.competitorNumber, ent.competitorNumber),
					sql`${rawTimingEvents.status} != 'rejected_invalid'`,
				),
			)
			.orderBy(asc(rawTimingEvents.recordedTimeUtc));

		const startTime = ent.actualStartTime ?? eventRow.gunStartTime ?? eventRow.scheduledStart;
		const newlyInserted: Array<typeof scoredSplitTimes.$inferSelect> = [];

		let lastDistance = 0;
		let lastElapsed = 0;

		for (const raw of rawEvents) {
			const cs = splitByCode.get(raw.timingPointCode.toUpperCase());
			if (!cs) continue;

			const elapsedSeconds =
				(raw.recordedTimeUtc.getTime() - startTime.getTime()) / 1000;
			const dataStatus = elapsedSeconds < 0 ? "bad" : "valid";

			let dwellSeconds: number | null = null;
			if (raw.subSplitKind === "out") {
				const inSplit = newlyInserted.find(
					(s) => s.courseSplitId === cs.id && s.subSplitKind === "in",
				);
				if (inSplit) {
					dwellSeconds = Math.max(
						0,
						Math.round(
							(raw.recordedTimeUtc.getTime() - inSplit.absoluteTimeUtc.getTime()) /
								1000,
						),
					);
				}
			}

			let segmentPaceSecondsPerKm: number | null = null;
			if (cs.distanceFromStartMeters > lastDistance && elapsedSeconds > lastElapsed) {
				const deltaDistKm = (cs.distanceFromStartMeters - lastDistance) / 1000;
				const deltaSec = elapsedSeconds - lastElapsed;
				if (deltaDistKm > 0 && deltaSec > 0) {
					segmentPaceSecondsPerKm = deltaSec / deltaDistKm;
				}
			}

			lastDistance = cs.distanceFromStartMeters;
			lastElapsed = elapsedSeconds;

			const [inserted] = await db
				.insert(scoredSplitTimes)
				.values({
					entrantId: ent.id,
					courseSplitId: cs.id,
					lap: 1,
					subSplitKind: raw.subSplitKind,
					absoluteTimeUtc: raw.recordedTimeUtc,
					elapsedSeconds,
					dwellSeconds,
					segmentPaceSecondsPerKm,
					dataStatus,
					governingRawEventId: raw.id,
				})
				.returning();

			newlyInserted.push(inserted);
			totalRebuiltSplits++;
		}

		// Write audit trail
		if (newlyInserted.length > 0) {
			await db.insert(splitTimeAudits).values({
				splitTimeId: newlyInserted[0].id,
				action: "REBUILT",
				previousState: { count: previousSplits.length },
				newState: { count: newlyInserted.length },
				changedByPersonId: personId,
				changeReason: input.changeReason.trim(),
			});
		}
	}

	return {
		rebuiltEntrantsCount: targetEntrants.length,
		rebuiltSplitsCount: totalRebuiltSplits,
	};
}

// ----------------------------------------------------------------------------
// POST-RACE CLOSEOUT & EXPORTS
// ----------------------------------------------------------------------------

/**
 * Sweeps all remaining `in_progress` or unaccounted `retired` entrants to `dnf` or `dns`.
 */
export async function establishDrops(
	viewer: Viewer,
	input: z.infer<typeof establishDropsInput>,
) {
	const [eventRow] = await db
		.select()
		.from(events)
		.where(eq(events.id, input.eventId))
		.limit(1);

	if (!eventRow) throw notFound();

	await assertAuditPermission(viewer, eventRow.eventGroupId);

	// Find active or retired entrants to sweep
	const candidates = await db
		.select({ id: entrants.id, status: entrants.status })
		.from(entrants)
		.where(
			and(
				eq(entrants.eventId, input.eventId),
				sql`${entrants.status} IN ('in_progress', 'retired')`,
			),
		);

	if (candidates.length === 0) {
		return { sweptCount: 0 };
	}

	const candidateIds = candidates.map((c) => c.id);
	await db
		.update(entrants)
		.set({ status: input.defaultStatus, updatedAt: new Date() })
		.where(inArray(entrants.id, candidateIds));

	return { sweptCount: candidateIds.length };
}

/**
 * 1-Click "Certify Official Results":
 * - Locks all splits to `confirmed`
 * - Writes `split_time_audits`
 * - Writes completed finishes/DNFs to `person_race_history`
 * - Refreshes `person_historical_summaries`
 */
export async function certifyOfficialResults(
	viewer: Viewer,
	input: z.infer<typeof certifyOfficialResultsInput>,
) {
	const [eventRow] = await db
		.select()
		.from(events)
		.where(eq(events.id, input.eventId))
		.limit(1);

	if (!eventRow) throw notFound();

	const [groupRow] = await db
		.select()
		.from(eventGroups)
		.where(eq(eventGroups.id, eventRow.eventGroupId))
		.limit(1);

	const [courseRow] = await db
		.select()
		.from(courses)
		.where(eq(courses.id, eventRow.courseId))
		.limit(1);

	await assertAuditPermission(viewer, eventRow.eventGroupId);
	const personId = viewer.person?.id ?? (await ensurePersonForUser(viewer.user));

	// Load all entrants in event
	const entrantsRows = await db
		.select()
		.from(entrants)
		.where(eq(entrants.eventId, input.eventId));

	const entrantIds = entrantsRows.map((e) => e.id);

	if (entrantIds.length > 0) {
		// 1. Lock all splits to confirmed
		await db
			.update(scoredSplitTimes)
			.set({ dataStatus: "confirmed", updatedAt: new Date() })
			.where(inArray(scoredSplitTimes.entrantId, entrantIds));

		// 2. Load latest scored split per entrant for finish times
		const allSplits = await db
			.select()
			.from(scoredSplitTimes)
			.where(inArray(scoredSplitTimes.entrantId, entrantIds))
			.orderBy(asc(scoredSplitTimes.elapsedSeconds));

		const splitByEntrant = new Map<string, typeof allSplits>();
		for (const s of allSplits) {
			const list = splitByEntrant.get(s.entrantId) ?? [];
			list.push(s);
			splitByEntrant.set(s.entrantId, list);
		}

		// Write audit trail for first split
		if (allSplits.length > 0) {
			await db.insert(splitTimeAudits).values({
				splitTimeId: allSplits[0].id,
				action: "CONFIRMED",
				previousState: { totalConfirmed: allSplits.length },
				newState: { dataStatus: "confirmed" },
				changedByPersonId: personId,
				changeReason: "Official race results certified by timing steward",
			});
		}

		// 3. Write finishes and DNFs into person_race_history & refresh historical summaries
		const raceName = `${groupRow.name} - ${eventRow.name}`;
		const raceDate = groupRow.startDate.toISOString().substring(0, 10);

		for (const ent of entrantsRows) {
			const runnerSplits = splitByEntrant.get(ent.id) ?? [];
			const lastSplit = runnerSplits[runnerSplits.length - 1];
			const elapsedSec = lastSplit?.elapsedSeconds ?? null;

			const raceStatus =
				ent.status === "finished"
					? ("finished" as const)
					: ent.status === "dnf"
						? ("dnf" as const)
						: ("unknown" as const);

			if (raceStatus === "finished" || raceStatus === "dnf") {
				// Check for existing history entry
				const [existingHist] = await db
					.select({ id: personRaceHistory.id })
					.from(personRaceHistory)
					.where(
						and(
							eq(personRaceHistory.personId, ent.personId),
							eq(personRaceHistory.raceName, raceName),
							eq(personRaceHistory.raceDate, raceDate),
						),
					)
					.limit(1);

				if (!existingHist) {
					await db.insert(personRaceHistory).values({
						personId: ent.personId,
						platform: "custom",
						raceName,
						raceDate,
						distanceMeters: courseRow?.distanceMeters ?? null,
						distanceLabel: eventRow.distanceLabel ?? null,
						elevationGainMeters: courseRow?.elevationGainMeters ?? null,
						elapsedSeconds: elapsedSec ? Math.floor(elapsedSec) : null,
						finishTimeFormatted: formatElapsedHms(elapsedSec),
						overallPlace: ent.overallPlace,
						genderPlace: ent.genderPlace,
						divisionPlace: ent.divisionPlace,
						status: raceStatus,
					});
				}

				// Refresh person_historical_summaries
				const allHist = await db
					.select()
					.from(personRaceHistory)
					.where(eq(personRaceHistory.personId, ent.personId));

				const totalRaces = allHist.length;
				const totalFinishes = allHist.filter((h) => h.status === "finished").length;
				const totalDnfs = allHist.filter((h) => h.status === "dnf").length;
				const dnfRate = totalRaces > 0 ? totalDnfs / totalRaces : 0;
				const maxDist = Math.max(...allHist.map((h) => h.distanceMeters ?? 0), 0);
				const maxElev = Math.max(...allHist.map((h) => h.elevationGainMeters ?? 0), 0);

				const [existingSummary] = await db
					.select({ id: personHistoricalSummaries.id })
					.from(personHistoricalSummaries)
					.where(eq(personHistoricalSummaries.personId, ent.personId))
					.limit(1);

				if (existingSummary) {
					await db
						.update(personHistoricalSummaries)
						.set({
							totalRaces,
							totalFinishes,
							totalDnfs,
							dnfRate,
							maxDistanceMeters: maxDist,
							maxElevationGainMeters: maxElev,
						})
						.where(eq(personHistoricalSummaries.id, existingSummary.id));
				} else {
					await db.insert(personHistoricalSummaries).values({
						personId: ent.personId,
						totalRaces,
						totalFinishes,
						totalDnfs,
						dnfRate,
						maxDistanceMeters: maxDist,
						maxElevationGainMeters: maxElev,
					});
				}
			}
		}
	}

	return {
		success: true,
		certifiedEntrantsCount: entrantsRows.length,
	};
}

/**
 * Serializes race results into UltraSignup, ITRA, or Standard ChekkPoint CSV format.
 */
export async function exportResultsData(
	viewer: Viewer,
	input: z.infer<typeof exportResultsInput>,
) {
	const [eventRow] = await db
		.select()
		.from(events)
		.where(eq(events.id, input.eventId))
		.limit(1);

	if (!eventRow) throw notFound();

	const [groupRow] = await db
		.select()
		.from(eventGroups)
		.where(eq(eventGroups.id, eventRow.eventGroupId))
		.limit(1);

	await assertAuditPermission(viewer, eventRow.eventGroupId);

	// Load entrants with people
	const entrantsRows = await db
		.select({
			id: entrants.id,
			competitorNumber: entrants.competitorNumber,
			gender: entrants.gender,
			age: entrants.age,
			division: entrants.division,
			status: entrants.status,
			overallPlace: entrants.overallPlace,
			city: entrants.city,
			state: entrants.state,
			country: entrants.country,
			firstName: people.firstName,
			lastName: people.lastName,
			birthDate: people.birthDate,
		})
		.from(entrants)
		.innerJoin(people, eq(people.id, entrants.personId))
		.where(eq(entrants.eventId, input.eventId))
		.orderBy(asc(entrants.overallPlace), asc(entrants.competitorNumber));

	const entrantIds = entrantsRows.map((e) => e.id);

	// Load latest scored split per entrant for total time & penalties
	const splits =
		entrantIds.length > 0
			? await db
					.select()
					.from(scoredSplitTimes)
					.where(inArray(scoredSplitTimes.entrantId, entrantIds))
					.orderBy(asc(scoredSplitTimes.elapsedSeconds))
			: [];

	const splitsByEntrant = new Map<string, typeof splits>();
	for (const s of splits) {
		const list = splitsByEntrant.get(s.entrantId) ?? [];
		list.push(s);
		splitsByEntrant.set(s.entrantId, list);
	}

	const exportRunners: OfficialExportRunner[] = entrantsRows.map((ent) => {
		const runnerSplits = splitsByEntrant.get(ent.id) ?? [];
		const lastSplit = runnerSplits[runnerSplits.length - 1];
		const penaltyPoints = runnerSplits.reduce((sum, s) => sum + s.penaltyPoints, 0);

		return {
			place: ent.overallPlace,
			bib: ent.competitorNumber,
			firstName: ent.firstName,
			lastName: ent.lastName ?? "",
			age: ent.age,
			gender: ent.gender,
			birthDate: ent.birthDate ? ent.birthDate.toISOString().substring(0, 10) : null,
			nationality: ent.country || "USA",
			city: ent.city,
			state: ent.state,
			totalElapsedSeconds: lastSplit?.elapsedSeconds ?? null,
			status: ent.status,
			division: ent.division,
			penaltyPoints: penaltyPoints > 0 ? penaltyPoints : null,
		};
	});

	let csvString = "";
	if (input.format === "ultrasignup") {
		csvString = formatUltraSignupCsv(exportRunners);
	} else if (input.format === "itra") {
		csvString = formatItraCsv(exportRunners);
	} else {
		csvString = formatStandardCsv(exportRunners);
	}

	const filename = `${groupRow.slug}-${eventRow.name.toLowerCase().replace(/\s+/g, "-")}-${input.format}.csv`;

	return {
		csv: csvString,
		filename,
		rowCount: exportRunners.length,
	};
}
