import "@tanstack/solid-start/server-only";
import { notFound } from "@tanstack/solid-router";
import { and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { z } from "zod";
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
	personExternalProfiles,
	personHistoricalSummaries,
	personRaceHistory,
	scoredSplitTimes,
	timingPoints,
} from "../db/schema";
import {
	type athleteIdInput,
	type athletesDirectoryInput,
	type courseIdInput,
	type eventGroupSlugInput,
	type eventsDirectoryInput,
	formatDuration,
	formatPersonDisplayName,
	getEventGroupTemporalState,
	type omniboxSearchInput,
	type organizerSlugInput,
	type PublicDiscipline,
	type PublicExperienceTier,
	parseOrganizationMeta,
	type TemporalState,
} from "./public.shared";

function formatCityState(
	address:
		| {
				city?: string;
				state?: string;
				country?: string;
		  }
		| null
		| undefined,
): string {
	if (!address) return "Mountain West, US";
	const parts = [address.city, address.state].filter(Boolean);
	if (parts.length > 0) return parts.join(", ");
	return address.country || "US";
}

function computeTimeLimitHours(
	startDate: Date,
	endDate: Date,
	maxCutoffSeconds: number | null,
): number {
	if (maxCutoffSeconds && maxCutoffSeconds > 0) {
		return Math.round(maxCutoffSeconds / 3600);
	}
	const diffHours = Math.round(
		(endDate.getTime() - startDate.getTime()) / 3_600_000,
	);
	return Math.max(6, Math.min(72, diffHours));
}

export async function loadEnrichedEventGroups(
	now: Date,
	options?: { organizationId?: string },
) {
	const allGroups = await db
		.select()
		.from(eventGroups)
		.where(
			options?.organizationId
				? eq(eventGroups.organizationId, options.organizationId)
				: undefined,
		)
		.orderBy(asc(eventGroups.startDate));

	if (allGroups.length === 0) {
		return [];
	}

	const groupIds = allGroups.map((g) => g.id);
	const orgIds = Array.from(new Set(allGroups.map((g) => g.organizationId)));

	const [allOrgs, allEvents] = await Promise.all([
		db.select().from(organizations).where(inArray(organizations.id, orgIds)),
		db
			.select()
			.from(events)
			.where(inArray(events.eventGroupId, groupIds))
			.orderBy(asc(events.scheduledStart)),
	]);

	const courseIds = Array.from(new Set(allEvents.map((e) => e.courseId)));
	const eventIds = allEvents.map((e) => e.id);

	const [allCourses, allSplits, entrantCountRows] = await Promise.all([
		courseIds.length > 0
			? db.select().from(courses).where(inArray(courses.id, courseIds))
			: Promise.resolve([]),
		courseIds.length > 0
			? db
					.select({
						courseId: courseSplits.courseId,
						cutoffDurationSeconds: courseSplits.cutoffDurationSeconds,
					})
					.from(courseSplits)
					.where(
						and(
							inArray(courseSplits.courseId, courseIds),
							eq(courseSplits.isSecretCheckpoint, false),
						),
					)
			: Promise.resolve([]),
		eventIds.length > 0
			? db
					.select({
						eventId: entrants.eventId,
						status: entrants.status,
						count: count(),
					})
					.from(entrants)
					.where(inArray(entrants.eventId, eventIds))
					.groupBy(entrants.eventId, entrants.status)
			: Promise.resolve([]),
	]);

	const orgById = new Map(allOrgs.map((o) => [o.id, o]));
	const courseById = new Map(allCourses.map((c) => [c.id, c]));

	const maxCutoffByCourse = new Map<string, number>();
	for (const sp of allSplits) {
		if (sp.cutoffDurationSeconds) {
			const prevCut = maxCutoffByCourse.get(sp.courseId) ?? 0;
			if (sp.cutoffDurationSeconds > prevCut) {
				maxCutoffByCourse.set(sp.courseId, sp.cutoffDurationSeconds);
			}
		}
	}

	const countsByEventId = new Map<
		string,
		{ totalEntrants: number; onCourse: number; finished: number; dnf: number }
	>();
	for (const row of entrantCountRows) {
		const bucket = countsByEventId.get(row.eventId) ?? {
			totalEntrants: 0,
			onCourse: 0,
			finished: 0,
			dnf: 0,
		};
		const n = Number(row.count);
		bucket.totalEntrants += n;
		if (row.status === "in_progress") {
			bucket.onCourse += n;
		} else if (row.status === "finished") {
			bucket.finished += n;
		} else if (
			row.status === "dnf" ||
			row.status === "retired" ||
			row.status === "otl"
		) {
			bucket.dnf += n;
		}
		countsByEventId.set(row.eventId, bucket);
	}

	return allGroups.map((group) => {
		const org = orgById.get(group.organizationId);
		const orgMeta = parseOrganizationMeta(org?.metadata);
		const groupEvents = allEvents.filter((e) => e.eventGroupId === group.id);

		const subEvents = groupEvents.map((ev) => {
			const c = courseById.get(ev.courseId);
			return {
				id: ev.id,
				name: ev.name,
				courseId: ev.courseId,
				courseName: c?.name ?? ev.name,
				distanceMeters: (c?.distanceMeters ?? 0) * ev.lapsRequired,
				elevationGainMeters: (c?.elevationGainMeters ?? 0) * ev.lapsRequired,
				scheduledStart: ev.scheduledStart.toISOString(),
			};
		});

		const maxCutoff = groupEvents.reduce((acc, ev) => {
			const cut = maxCutoffByCourse.get(ev.courseId) ?? 0;
			return Math.max(acc, cut);
		}, 0);

		const counts = {
			totalEntrants: 0,
			onCourse: 0,
			finished: 0,
			dnf: 0,
		};
		for (const ev of groupEvents) {
			const evCounts = countsByEventId.get(ev.id);
			if (evCounts) {
				counts.totalEntrants += evCounts.totalEntrants;
				counts.onCourse += evCounts.onCourse;
				counts.finished += evCounts.finished;
				counts.dnf += evCounts.dnf;
			}
		}

		const temporalState: TemporalState = getEventGroupTemporalState(
			group.startDate,
			group.endDate,
			now,
		);

		const finisherRatePct =
			counts.totalEntrants > 0
				? Math.round((counts.finished / counts.totalEntrants) * 100)
				: 0;

		return {
			id: group.id,
			slug: group.slug,
			name: group.name,
			discipline: group.discipline,
			startDate: group.startDate.toISOString(),
			endDate: group.endDate.toISOString(),
			temporalState,
			timeLimitHours: computeTimeLimitHours(
				group.startDate,
				group.endDate,
				maxCutoff || null,
			),
			location: orgMeta.location,
			timeZone: orgMeta.timeZone,
			organizationId: group.organizationId,
			organizationName: org?.name ?? "ChekkPoint Organizer",
			organizationSlug: org?.slug ?? "organizer",
			subEvents,
			counts,
			finisherRatePct,
			podium: [] as Array<{
				place: number;
				competitorNumber: string;
				personId: string;
				displayName: string;
				elapsedFormatted: string;
				eventName: string;
			}>,
		};
	});
}

export async function loadPublicHomeData() {
	const now = new Date();
	const enriched = await loadEnrichedEventGroups(now);

	const liveGroups = enriched.filter((g) => g.temporalState === "live");
	const upcomingGroups = enriched
		.filter((g) => g.temporalState === "upcoming")
		.sort(
			(a, b) =>
				new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
		);

	return {
		nowIso: now.toISOString(),
		liveGroups,
		nextBroadcast: upcomingGroups[0] ?? null,
	};
}

export async function runOmniboxSearch(
	data: z.infer<typeof omniboxSearchInput>,
) {
	const q = data.query.trim();
	const now = new Date();
	const pattern = q ? `%${q}%` : "%";

	const [matchedGroups, matchedPeople, matchedCourses, matchedOrgs] =
		await Promise.all([
			db
				.select({
					id: eventGroups.id,
					slug: eventGroups.slug,
					name: eventGroups.name,
					discipline: eventGroups.discipline,
					startDate: eventGroups.startDate,
					endDate: eventGroups.endDate,
					organizationName: organizations.name,
					organizationMeta: organizations.metadata,
				})
				.from(eventGroups)
				.innerJoin(
					organizations,
					eq(organizations.id, eventGroups.organizationId),
				)
				.where(
					q
						? or(
								ilike(eventGroups.name, pattern),
								ilike(eventGroups.slug, pattern),
								ilike(organizations.name, pattern),
							)
						: undefined,
				)
				.orderBy(desc(eventGroups.startDate))
				.limit(5),
			db
				.select({
					id: people.id,
					firstName: people.firstName,
					lastName: people.lastName,
					address: people.address,
					experienceTier: personHistoricalSummaries.experienceTier,
					totalFinishes: personHistoricalSummaries.totalFinishes,
				})
				.from(people)
				.leftJoin(
					personHistoricalSummaries,
					eq(personHistoricalSummaries.personId, people.id),
				)
				.where(
					q
						? or(
								ilike(people.firstName, pattern),
								ilike(people.lastName, pattern),
							)
						: undefined,
				)
				.orderBy(asc(people.lastName), asc(people.firstName))
				.limit(5),
			db
				.select({
					id: courses.id,
					name: courses.name,
					distanceMeters: courses.distanceMeters,
					elevationGainMeters: courses.elevationGainMeters,
					organizationName: organizations.name,
				})
				.from(courses)
				.innerJoin(organizations, eq(organizations.id, courses.organizationId))
				.where(
					q
						? or(
								ilike(courses.name, pattern),
								ilike(organizations.name, pattern),
							)
						: undefined,
				)
				.orderBy(asc(courses.name))
				.limit(5),
			db
				.select({
					id: organizations.id,
					slug: organizations.slug,
					name: organizations.name,
					metadata: organizations.metadata,
				})
				.from(organizations)
				.where(
					q
						? or(
								ilike(organizations.name, pattern),
								ilike(organizations.slug, pattern),
							)
						: undefined,
				)
				.orderBy(asc(organizations.name))
				.limit(5),
		]);

	return {
		query: q,
		events: matchedGroups.map((g) => {
			const meta = parseOrganizationMeta(g.organizationMeta);
			return {
				id: g.id,
				slug: g.slug,
				name: g.name,
				discipline: g.discipline,
				temporalState: getEventGroupTemporalState(g.startDate, g.endDate, now),
				location: meta.location,
				organizationName: g.organizationName,
			};
		}),
		athletes: matchedPeople.map((p) => ({
			id: p.id,
			displayName: formatPersonDisplayName({
				firstName: p.firstName,
				lastName: p.lastName,
			}),
			cityState: formatCityState(p.address),
			experienceTier: p.experienceTier ?? "novice",
			totalFinishes: p.totalFinishes ?? 0,
		})),
		courses: matchedCourses.map((c) => ({
			id: c.id,
			name: c.name,
			distanceMeters: c.distanceMeters,
			elevationGainMeters: c.elevationGainMeters,
			organizationName: c.organizationName,
		})),
		organizers: matchedOrgs.map((o) => {
			const meta = parseOrganizationMeta(o.metadata);
			return {
				id: o.id,
				slug: o.slug,
				name: o.name,
				location: meta.location,
			};
		}),
	};
}

export async function loadPublicEventsDirectory(
	data: z.infer<typeof eventsDirectoryInput>,
) {
	const now = new Date();
	const all = await loadEnrichedEventGroups(now);
	const q = (data.query ?? "").trim().toLowerCase();

	const upcomingGroups = all
		.filter((g) => g.temporalState === "upcoming")
		.sort(
			(a, b) =>
				new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
		);
	const recentCompletedGroups = all
		.filter((g) => g.temporalState === "past")
		.sort(
			(a, b) =>
				new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
		);

	const filtered = all.filter((g) => {
		if (data.discipline && g.discipline !== data.discipline) {
			return false;
		}
		if (data.tab && data.tab !== "all" && g.temporalState !== data.tab) {
			return false;
		}
		if (q) {
			const hay =
				`${g.name} ${g.slug} ${g.location} ${g.organizationName} ${g.subEvents.map((s) => s.name).join(" ")}`.toLowerCase();
			if (!hay.includes(q)) return false;
		}
		return true;
	});

	return {
		nowIso: now.toISOString(),
		groups: filtered,
		upcomingGroups,
		recentCompletedGroups,
		countsByTab: {
			all: all.length,
			live: all.filter((g) => g.temporalState === "live").length,
			upcoming: upcomingGroups.length,
			past: recentCompletedGroups.length,
		},
	};
}

export async function loadPublicEventGroupBySlug(
	data: z.infer<typeof eventGroupSlugInput>,
) {
	const now = new Date();

	const [groupRow] = await db
		.select()
		.from(eventGroups)
		.where(eq(eventGroups.slug, data.slug))
		.limit(1);

	if (!groupRow) {
		throw notFound();
	}

	const [orgRow] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.id, groupRow.organizationId))
		.limit(1);

	const orgMeta = parseOrganizationMeta(orgRow?.metadata);

	const groupEvents = await db
		.select()
		.from(events)
		.where(eq(events.eventGroupId, groupRow.id))
		.orderBy(asc(events.scheduledStart));

	const courseIds = Array.from(new Set(groupEvents.map((e) => e.courseId)));

	const groupCourses =
		courseIds.length > 0
			? await db.select().from(courses).where(inArray(courses.id, courseIds))
			: [];
	const courseById = new Map(groupCourses.map((c) => [c.id, c]));

	const publicSplitsRows =
		courseIds.length > 0
			? await db
					.select({
						id: courseSplits.id,
						courseId: courseSplits.courseId,
						timingPointId: courseSplits.timingPointId,
						name: courseSplits.name,
						sequenceOrder: courseSplits.sequenceOrder,
						distanceFromStartMeters: courseSplits.distanceFromStartMeters,
						subSplitBitmap: courseSplits.subSplitBitmap,
						cutoffDurationSeconds: courseSplits.cutoffDurationSeconds,
						tsdIdealDurationSeconds: courseSplits.tsdIdealDurationSeconds,
						timingPointCode: timingPoints.code,
						timingPointName: timingPoints.name,
						elevationMeters: timingPoints.elevationMeters,
						latitude: timingPoints.latitude,
						longitude: timingPoints.longitude,
					})
					.from(courseSplits)
					.innerJoin(
						timingPoints,
						eq(timingPoints.id, courseSplits.timingPointId),
					)
					.where(
						and(
							inArray(courseSplits.courseId, courseIds),
							eq(courseSplits.isSecretCheckpoint, false),
						),
					)
					.orderBy(asc(courseSplits.sequenceOrder))
			: [];

	const splitsByCourse: Record<
		string,
		Array<(typeof publicSplitsRows)[number]>
	> = {};
	for (const sp of publicSplitsRows) {
		const list = splitsByCourse[sp.courseId] ?? [];
		list.push(sp);
		splitsByCourse[sp.courseId] = list;
	}

	const eventIds = groupEvents.map((e) => e.id);
	const eventById = new Map(groupEvents.map((e) => [e.id, e]));

	const groupEntrantRows =
		eventIds.length > 0
			? await db
					.select({
						id: entrants.id,
						eventId: entrants.eventId,
						personId: entrants.personId,
						competitorNumber: entrants.competitorNumber,
						status: entrants.status,
						division: entrants.division,
						participantData: entrants.participantData,
						firstName: people.firstName,
						lastName: people.lastName,
						gender: people.gender,
						address: people.address,
						projectedFinishSeconds:
							entrantHistoricalProjections.projectedFinishSeconds,
						expectedCutoffRisk: entrantHistoricalProjections.expectedCutoffRisk,
					})
					.from(entrants)
					.innerJoin(people, eq(people.id, entrants.personId))
					.leftJoin(
						entrantHistoricalProjections,
						eq(entrantHistoricalProjections.entrantId, entrants.id),
					)
					.where(inArray(entrants.eventId, eventIds))
					.orderBy(asc(entrants.competitorNumber))
			: [];

	const entrantIds = groupEntrantRows.map((e) => e.id);

	const splitTimeRows =
		entrantIds.length > 0
			? await db
					.select({
						id: scoredSplitTimes.id,
						entrantId: scoredSplitTimes.entrantId,
						courseSplitId: scoredSplitTimes.courseSplitId,
						lap: scoredSplitTimes.lap,
						subSplitKind: scoredSplitTimes.subSplitKind,
						absoluteTimeUtc: scoredSplitTimes.absoluteTimeUtc,
						elapsedSeconds: scoredSplitTimes.elapsedSeconds,
						dwellSeconds: scoredSplitTimes.dwellSeconds,
						segmentPaceSecondsPerKm: scoredSplitTimes.segmentPaceSecondsPerKm,
						penaltyPoints: scoredSplitTimes.penaltyPoints,
						stoppedHere: scoredSplitTimes.stoppedHere,
						dataStatus: scoredSplitTimes.dataStatus,
						splitName: courseSplits.name,
						sequenceOrder: courseSplits.sequenceOrder,
						distanceFromStartMeters: courseSplits.distanceFromStartMeters,
						isSecretCheckpoint: courseSplits.isSecretCheckpoint,
					})
					.from(scoredSplitTimes)
					.innerJoin(
						courseSplits,
						eq(courseSplits.id, scoredSplitTimes.courseSplitId),
					)
					.where(
						and(
							inArray(scoredSplitTimes.entrantId, entrantIds),
							eq(courseSplits.isSecretCheckpoint, false),
						),
					)
					.orderBy(
						asc(courseSplits.sequenceOrder),
						asc(scoredSplitTimes.elapsedSeconds),
					)
			: [];

	const splitsByEntrant = new Map<
		string,
		Array<(typeof splitTimeRows)[number]>
	>();
	for (const row of splitTimeRows) {
		const list = splitsByEntrant.get(row.entrantId) ?? [];
		list.push(row);
		splitsByEntrant.set(row.entrantId, list);
	}

	const enrichedEntrants = groupEntrantRows.map((ent) => {
		const ev = eventById.get(ent.eventId);
		const entSplits = splitsByEntrant.get(ent.id) ?? [];
		const lastSplit =
			entSplits.length > 0 ? entSplits[entSplits.length - 1] : null;
		const finishElapsedSeconds =
			ent.status === "finished" && lastSplit ? lastSplit.elapsedSeconds : null;

		const totalPenaltyPoints = entSplits.reduce(
			(acc, s) => acc + (s.penaltyPoints ?? 0),
			0,
		);

		return {
			id: ent.id,
			eventId: ent.eventId,
			eventName: ev?.name ?? "Event",
			courseId: ev?.courseId ?? "",
			competitorNumber: ent.competitorNumber,
			personId: ent.personId,
			displayName: formatPersonDisplayName({
				firstName: ent.firstName,
				lastName: ent.lastName,
			}),
			cityState: formatCityState(ent.address),
			gender: ent.gender ?? "—",
			division: ent.division,
			status: ent.status,
			participantKind: ent.participantData?.kind ?? "solo_competitor",
			projectedFinishSeconds: ent.projectedFinishSeconds ?? null,
			projectedFinishFormatted: ent.projectedFinishSeconds
				? formatDuration(ent.projectedFinishSeconds)
				: "—",
			expectedCutoffRisk: ent.expectedCutoffRisk ?? false,
			splits: entSplits.map((s) => ({
				courseSplitId: s.courseSplitId,
				splitName: s.splitName,
				sequenceOrder: s.sequenceOrder,
				distanceFromStartMeters: s.distanceFromStartMeters,
				subSplitKind: s.subSplitKind,
				elapsedSeconds: s.elapsedSeconds,
				elapsedFormatted: formatDuration(s.elapsedSeconds, {
					showMillis: groupRow.discipline === "downhill_mtb",
				}),
				dwellSeconds: s.dwellSeconds,
				absoluteTimeUtc: s.absoluteTimeUtc.toISOString(),
				segmentPaceSecondsPerKm: s.segmentPaceSecondsPerKm,
				penaltyPoints: s.penaltyPoints,
				stoppedHere: s.stoppedHere,
				dataStatus: s.dataStatus,
			})),
			lastSplit: lastSplit
				? {
						courseSplitId: lastSplit.courseSplitId,
						splitName: lastSplit.splitName,
						sequenceOrder: lastSplit.sequenceOrder,
						distanceFromStartMeters: lastSplit.distanceFromStartMeters,
						elapsedSeconds: lastSplit.elapsedSeconds,
						elapsedFormatted: formatDuration(lastSplit.elapsedSeconds, {
							showMillis: groupRow.discipline === "downhill_mtb",
						}),
						absoluteTimeUtc: lastSplit.absoluteTimeUtc.toISOString(),
					}
				: null,
			finishElapsedSeconds,
			finishElapsedFormatted:
				finishElapsedSeconds !== null
					? formatDuration(finishElapsedSeconds, {
							showMillis: groupRow.discipline === "downhill_mtb",
						})
					: null,
			totalPenaltyPoints,
			overallPlace: null as number | null,
			divisionPlace: null as number | null,
		};
	});

	for (const ev of groupEvents) {
		const finishers = enrichedEntrants
			.filter(
				(e) =>
					e.eventId === ev.id &&
					e.status === "finished" &&
					e.finishElapsedSeconds !== null,
			)
			.sort((a, b) => {
				if (groupRow.discipline === "tsd_regularity") {
					return a.totalPenaltyPoints - b.totalPenaltyPoints;
				}
				return (
					(a.finishElapsedSeconds ?? Number.MAX_SAFE_INTEGER) -
					(b.finishElapsedSeconds ?? Number.MAX_SAFE_INTEGER)
				);
			});

		const divCounters = new Map<string, number>();
		finishers.forEach((f, idx) => {
			f.overallPlace = idx + 1;
			const nextDiv = (divCounters.get(f.division) ?? 0) + 1;
			divCounters.set(f.division, nextDiv);
			f.divisionPlace = nextDiv;
		});
	}

	const crewStations = publicSplitsRows
		.filter((sp) => sp.subSplitBitmap === 3 || sp.sequenceOrder > 1)
		.map((sp) => {
			const courseSplitsList = splitsByCourse[sp.courseId] ?? [];
			const idx = courseSplitsList.findIndex((s) => s.id === sp.id);
			const upstreamSplit = idx > 0 ? courseSplitsList[idx - 1] : null;
			const course = courseById.get(sp.courseId);

			const courseEntrants = enrichedEntrants.filter(
				(e) =>
					e.courseId === sp.courseId &&
					(e.status === "in_progress" || e.status === "finished"),
			);

			const minSeqForClearance = upstreamSplit
				? upstreamSplit.sequenceOrder
				: 1;

			const clearedRunners = courseEntrants
				.filter(
					(e) =>
						(e.lastSplit?.sequenceOrder ?? 0) >= minSeqForClearance &&
						(e.lastSplit?.sequenceOrder ?? 0) <= sp.sequenceOrder,
				)
				.map((e) => ({
					competitorNumber: e.competitorNumber,
					personId: e.personId,
					displayName: e.displayName,
					eventName: e.eventName,
					status: e.status,
					clearedAtSplitName: e.lastSplit?.splitName ?? "Start",
					clearedElapsedFormatted: e.lastSplit?.elapsedFormatted ?? "—",
					arrivedAtStation: e.lastSplit?.sequenceOrder === sp.sequenceOrder,
				}));

			const approachingRunners = courseEntrants
				.filter((e) => (e.lastSplit?.sequenceOrder ?? 0) < minSeqForClearance)
				.map((e) => ({
					competitorNumber: e.competitorNumber,
					personId: e.personId,
					displayName: e.displayName,
					eventName: e.eventName,
					lastSplitName: e.lastSplit?.splitName ?? "Start Line",
				}));

			return {
				splitId: sp.id,
				courseId: sp.courseId,
				courseName: course?.name ?? "Course",
				stationName: sp.name,
				timingPointCode: sp.timingPointCode,
				sequenceOrder: sp.sequenceOrder,
				distanceFromStartMeters: sp.distanceFromStartMeters,
				elevationMeters: sp.elevationMeters,
				subSplitBitmap: sp.subSplitBitmap,
				cutoffDurationSeconds: sp.cutoffDurationSeconds,
				upstreamGateSplitId: upstreamSplit?.id ?? null,
				upstreamGateName: upstreamSplit?.name ?? "Start Line Release",
				upstreamGateDistanceMeters: upstreamSplit?.distanceFromStartMeters ?? 0,
				clearedRunners,
				approachingRunners,
			};
		});

	const maxCutoff = publicSplitsRows.reduce(
		(acc, sp) => Math.max(acc, sp.cutoffDurationSeconds ?? 0),
		0,
	);

	const counts = {
		totalEntrants: enrichedEntrants.length,
		registered: enrichedEntrants.filter((e) => e.status === "registered")
			.length,
		checkedIn: enrichedEntrants.filter((e) => e.status === "checked_in").length,
		onCourse: enrichedEntrants.filter((e) => e.status === "in_progress").length,
		finished: enrichedEntrants.filter((e) => e.status === "finished").length,
		dnf: enrichedEntrants.filter((e) => e.status === "dnf").length,
		retired: enrichedEntrants.filter((e) => e.status === "retired").length,
		otl: enrichedEntrants.filter((e) => e.status === "otl").length,
	};

	return {
		nowIso: now.toISOString(),
		eventGroup: {
			id: groupRow.id,
			name: groupRow.name,
			slug: groupRow.slug,
			discipline: groupRow.discipline,
			rulesConfig: groupRow.rulesConfig,
			startDate: groupRow.startDate.toISOString(),
			endDate: groupRow.endDate.toISOString(),
			temporalState: getEventGroupTemporalState(
				groupRow.startDate,
				groupRow.endDate,
				now,
			),
			timeLimitHours: computeTimeLimitHours(
				groupRow.startDate,
				groupRow.endDate,
				maxCutoff || null,
			),
			location: orgMeta.location,
			timeZone: orgMeta.timeZone,
			organization: {
				id: orgRow?.id ?? groupRow.organizationId,
				name: orgRow?.name ?? "ChekkPoint Organizer",
				slug: orgRow?.slug ?? "organizer",
				description: orgMeta.description,
				location: orgMeta.location,
			},
		},
		counts,
		subEvents: groupEvents.map((ev) => {
			const c = courseById.get(ev.courseId);
			return {
				id: ev.id,
				name: ev.name,
				lapsRequired: ev.lapsRequired,
				scheduledStart: ev.scheduledStart.toISOString(),
				actualStart: ev.actualStart ? ev.actualStart.toISOString() : null,
				course: {
					id: c?.id ?? ev.courseId,
					name: c?.name ?? ev.name,
					distanceMeters: c?.distanceMeters ?? 0,
					elevationGainMeters: c?.elevationGainMeters ?? null,
					gpxRouteUrl: c?.gpxRouteUrl ?? null,
				},
			};
		}),
		splitsByCourse,
		entrants: enrichedEntrants,
		crewStations,
	};
}

export async function loadPublicAthletesDirectory(
	data: z.infer<typeof athletesDirectoryInput>,
) {
	const [allPeople, allSummaries, allProfiles, allEntrantDisciplines] =
		await Promise.all([
			db
				.select({
					id: people.id,
					userId: people.userId,
					firstName: people.firstName,
					lastName: people.lastName,
					gender: people.gender,
					address: people.address,
				})
				.from(people)
				.orderBy(asc(people.lastName), asc(people.firstName)),
			db.select().from(personHistoricalSummaries),
			db.select().from(personExternalProfiles),
			db
				.select({
					personId: entrants.personId,
					discipline: eventGroups.discipline,
				})
				.from(entrants)
				.innerJoin(events, eq(events.id, entrants.eventId))
				.innerJoin(eventGroups, eq(eventGroups.id, events.eventGroupId)),
		]);

	const summaryByPerson = new Map(allSummaries.map((s) => [s.personId, s]));
	const profilesByPerson = new Map<
		string,
		Array<(typeof allProfiles)[number]>
	>();
	for (const pr of allProfiles) {
		const list = profilesByPerson.get(pr.personId) ?? [];
		list.push(pr);
		profilesByPerson.set(pr.personId, list);
	}

	const disciplinesByPerson = new Map<string, Set<PublicDiscipline>>();
	for (const row of allEntrantDisciplines) {
		const set =
			disciplinesByPerson.get(row.personId) ?? new Set<PublicDiscipline>();
		set.add(row.discipline);
		disciplinesByPerson.set(row.personId, set);
	}

	const q = (data.query ?? "").trim().toLowerCase();

	const athletes = allPeople
		.map((p) => {
			const sum = summaryByPerson.get(p.id);
			const profs = profilesByPerson.get(p.id) ?? [];
			const discs = Array.from(disciplinesByPerson.get(p.id) ?? []);
			const displayName = formatPersonDisplayName({
				firstName: p.firstName,
				lastName: p.lastName,
			});
			const cityState = formatCityState(p.address);
			const experienceTier: PublicExperienceTier =
				sum?.experienceTier ?? "novice";

			return {
				id: p.id,
				displayName,
				cityState,
				gender: p.gender ?? "—",
				claimed: p.userId !== null,
				experienceTier,
				totalRaces: sum?.totalRaces ?? discs.length,
				totalFinishes: sum?.totalFinishes ?? 0,
				totalDnfs: sum?.totalDnfs ?? 0,
				dnfRate: sum?.dnfRate ?? 0,
				maxDistanceMeters: sum?.maxDistanceMeters ?? 0,
				maxElevationGainMeters: sum?.maxElevationGainMeters ?? 0,
				ultrasignupRank: sum?.ultrasignupRank ?? null,
				itraPerformanceIndex: sum?.itraPerformanceIndex ?? null,
				lastRaceDate: sum?.lastRaceDate ?? null,
				platforms: profs.map((pr) => pr.platform),
				disciplines:
					discs.length > 0 ? discs : (["trail_ultra"] as PublicDiscipline[]),
			};
		})
		.filter((a) => {
			if (data.tier && a.experienceTier !== data.tier) return false;
			if (data.discipline && !a.disciplines.includes(data.discipline)) {
				return false;
			}
			if (q) {
				const hay = `${a.displayName} ${a.cityState}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			return true;
		});

	return {
		athletes,
		totalCount: allPeople.length,
	};
}

export async function loadPublicAthleteById(
	data: z.infer<typeof athleteIdInput>,
) {
	const now = new Date();

	let personRow:
		| {
				id: string;
				userId: string | null;
				firstName: string;
				lastName: string;
				gender: string | null;
				address: {
					city?: string;
					state?: string;
					country?: string;
				} | null;
		  }
		| undefined;

	try {
		const [found] = await db
			.select({
				id: people.id,
				userId: people.userId,
				firstName: people.firstName,
				lastName: people.lastName,
				gender: people.gender,
				address: people.address,
			})
			.from(people)
			.where(eq(people.id, data.personId))
			.limit(1);
		personRow = found;
	} catch {
		throw notFound();
	}

	if (!personRow) {
		throw notFound();
	}

	const [summaryRows, profileRows, historyRows, entrantRows] =
		await Promise.all([
			db
				.select()
				.from(personHistoricalSummaries)
				.where(eq(personHistoricalSummaries.personId, personRow.id))
				.limit(1),
			db
				.select()
				.from(personExternalProfiles)
				.where(eq(personExternalProfiles.personId, personRow.id))
				.orderBy(asc(personExternalProfiles.platform)),
			db
				.select()
				.from(personRaceHistory)
				.where(eq(personRaceHistory.personId, personRow.id))
				.orderBy(desc(personRaceHistory.raceDate)),
			db
				.select({
					entrantId: entrants.id,
					competitorNumber: entrants.competitorNumber,
					status: entrants.status,
					division: entrants.division,
					eventId: events.id,
					eventName: events.name,
					scheduledStart: events.scheduledStart,
					lapsRequired: events.lapsRequired,
					courseId: courses.id,
					courseName: courses.name,
					distanceMeters: courses.distanceMeters,
					elevationGainMeters: courses.elevationGainMeters,
					eventGroupId: eventGroups.id,
					eventGroupName: eventGroups.name,
					eventGroupSlug: eventGroups.slug,
					discipline: eventGroups.discipline,
					startDate: eventGroups.startDate,
					endDate: eventGroups.endDate,
					projectedFinishSeconds:
						entrantHistoricalProjections.projectedFinishSeconds,
				})
				.from(entrants)
				.innerJoin(events, eq(events.id, entrants.eventId))
				.innerJoin(courses, eq(courses.id, events.courseId))
				.innerJoin(eventGroups, eq(eventGroups.id, events.eventGroupId))
				.leftJoin(
					entrantHistoricalProjections,
					eq(entrantHistoricalProjections.entrantId, entrants.id),
				)
				.where(eq(entrants.personId, personRow.id))
				.orderBy(desc(eventGroups.startDate)),
		]);

	const entrantIds = entrantRows.map((e) => e.entrantId);
	const personSplitRows =
		entrantIds.length > 0
			? await db
					.select({
						entrantId: scoredSplitTimes.entrantId,
						elapsedSeconds: scoredSplitTimes.elapsedSeconds,
						splitName: courseSplits.name,
						sequenceOrder: courseSplits.sequenceOrder,
					})
					.from(scoredSplitTimes)
					.innerJoin(
						courseSplits,
						eq(courseSplits.id, scoredSplitTimes.courseSplitId),
					)
					.where(
						and(
							inArray(scoredSplitTimes.entrantId, entrantIds),
							eq(courseSplits.isSecretCheckpoint, false),
						),
					)
					.orderBy(
						desc(courseSplits.sequenceOrder),
						asc(scoredSplitTimes.elapsedSeconds),
					)
			: [];

	const latestSplitByEntrant = new Map<
		string,
		(typeof personSplitRows)[number]
	>();
	for (const sp of personSplitRows) {
		if (!latestSplitByEntrant.has(sp.entrantId)) {
			latestSplitByEntrant.set(sp.entrantId, sp);
		}
	}

	const enrichedEntrants = entrantRows.map((e) => {
		const temporalState = getEventGroupTemporalState(
			e.startDate,
			e.endDate,
			now,
		);
		const latest = latestSplitByEntrant.get(e.entrantId);
		return {
			entrantId: e.entrantId,
			competitorNumber: e.competitorNumber,
			status: e.status,
			division: e.division,
			eventId: e.eventId,
			eventName: e.eventName,
			courseId: e.courseId,
			courseName: e.courseName,
			distanceMeters: e.distanceMeters * e.lapsRequired,
			elevationGainMeters:
				e.elevationGainMeters !== null
					? e.elevationGainMeters * e.lapsRequired
					: null,
			eventGroupId: e.eventGroupId,
			eventGroupName: e.eventGroupName,
			eventGroupSlug: e.eventGroupSlug,
			discipline: e.discipline,
			startDate: e.startDate.toISOString(),
			endDate: e.endDate.toISOString(),
			temporalState,
			projectedFinishFormatted: e.projectedFinishSeconds
				? formatDuration(e.projectedFinishSeconds)
				: "—",
			lastSplitName: latest?.splitName ?? "Start Line",
			lastElapsedFormatted: latest
				? formatDuration(latest.elapsedSeconds)
				: "—",
		};
	});

	const sum = summaryRows[0];
	const displayName = formatPersonDisplayName({
		firstName: personRow.firstName,
		lastName: personRow.lastName,
	});

	return {
		nowIso: now.toISOString(),
		person: {
			id: personRow.id,
			displayName,
			cityState: formatCityState(personRow.address),
			gender: personRow.gender ?? "—",
			claimed: personRow.userId !== null,
		},
		summary: {
			experienceTier: (sum?.experienceTier ?? "novice") as PublicExperienceTier,
			totalRaces: sum?.totalRaces ?? historyRows.length + entrantRows.length,
			totalFinishes: sum?.totalFinishes ?? 0,
			totalDnfs: sum?.totalDnfs ?? 0,
			dnfRate: sum?.dnfRate ?? 0,
			maxDistanceMeters: sum?.maxDistanceMeters ?? 0,
			maxElevationGainMeters: sum?.maxElevationGainMeters ?? 0,
			avgPaceSecondsPerKm: sum?.avgPaceSecondsPerKm ?? null,
			ultrasignupRank: sum?.ultrasignupRank ?? null,
			itraPerformanceIndex: sum?.itraPerformanceIndex ?? null,
			lastRaceDate: sum?.lastRaceDate ?? null,
		},
		externalProfiles: profileRows.map((pr) => ({
			id: pr.id,
			platform: pr.platform,
			externalIdentifier: pr.externalIdentifier,
			profileUrl: pr.profileUrl,
			verificationStatus: pr.verificationStatus,
			matchConfidence: pr.matchConfidence,
		})),
		activeOrUpcomingEntrants: enrichedEntrants.filter(
			(e) => e.temporalState === "live" || e.temporalState === "upcoming",
		),
		chekkpointResults: enrichedEntrants,
		historicalResults: historyRows.map((h) => ({
			id: h.id,
			platform: h.platform,
			raceName: h.raceName,
			raceDate: h.raceDate,
			distanceMeters: h.distanceMeters,
			distanceLabel: h.distanceLabel ?? "Ultra",
			elevationGainMeters: h.elevationGainMeters,
			elapsedSeconds: h.elapsedSeconds,
			finishTimeFormatted:
				h.finishTimeFormatted ?? formatDuration(h.elapsedSeconds),
			overallPlace: h.overallPlace,
			genderPlace: h.genderPlace,
			totalFinishers: h.totalFinishers,
			status: h.status,
		})),
	};
}

export async function loadPublicCourseById(
	data: z.infer<typeof courseIdInput>,
) {
	const now = new Date();

	let courseRow: typeof courses.$inferSelect | undefined;
	try {
		const [found] = await db
			.select()
			.from(courses)
			.where(eq(courses.id, data.courseId))
			.limit(1);
		courseRow = found;
	} catch {
		throw notFound();
	}

	if (!courseRow) {
		throw notFound();
	}

	const [orgRow, copiedFromRow, splitRows, eventRows] = await Promise.all([
		db
			.select()
			.from(organizations)
			.where(eq(organizations.id, courseRow.organizationId))
			.limit(1),
		courseRow.copiedFromCourseId
			? db
					.select({ id: courses.id, name: courses.name })
					.from(courses)
					.where(eq(courses.id, courseRow.copiedFromCourseId))
					.limit(1)
			: Promise.resolve([]),
		db
			.select({
				id: courseSplits.id,
				name: courseSplits.name,
				sequenceOrder: courseSplits.sequenceOrder,
				distanceFromStartMeters: courseSplits.distanceFromStartMeters,
				subSplitBitmap: courseSplits.subSplitBitmap,
				cutoffDurationSeconds: courseSplits.cutoffDurationSeconds,
				tsdIdealDurationSeconds: courseSplits.tsdIdealDurationSeconds,
				timingPointId: timingPoints.id,
				timingPointName: timingPoints.name,
				timingPointCode: timingPoints.code,
				elevationMeters: timingPoints.elevationMeters,
				latitude: timingPoints.latitude,
				longitude: timingPoints.longitude,
			})
			.from(courseSplits)
			.innerJoin(timingPoints, eq(timingPoints.id, courseSplits.timingPointId))
			.where(
				and(
					eq(courseSplits.courseId, courseRow.id),
					eq(courseSplits.isSecretCheckpoint, false),
				),
			)
			.orderBy(asc(courseSplits.sequenceOrder)),
		db
			.select({
				eventId: events.id,
				eventName: events.name,
				lapsRequired: events.lapsRequired,
				scheduledStart: events.scheduledStart,
				eventGroupId: eventGroups.id,
				eventGroupName: eventGroups.name,
				eventGroupSlug: eventGroups.slug,
				discipline: eventGroups.discipline,
				startDate: eventGroups.startDate,
				endDate: eventGroups.endDate,
			})
			.from(events)
			.innerJoin(eventGroups, eq(eventGroups.id, events.eventGroupId))
			.where(eq(events.courseId, courseRow.id))
			.orderBy(desc(events.scheduledStart)),
	]);

	const org = orgRow[0];
	const orgMeta = parseOrganizationMeta(org?.metadata);

	const eventIds = eventRows.map((e) => e.eventId);
	const courseEntrants =
		eventIds.length > 0
			? await db
					.select({
						entrantId: entrants.id,
						eventId: entrants.eventId,
						competitorNumber: entrants.competitorNumber,
						status: entrants.status,
						personId: people.id,
						firstName: people.firstName,
						lastName: people.lastName,
					})
					.from(entrants)
					.innerJoin(people, eq(people.id, entrants.personId))
					.where(inArray(entrants.eventId, eventIds))
			: [];

	const finalSplit =
		splitRows.length > 0 ? splitRows[splitRows.length - 1] : null;
	const finishTimes =
		finalSplit && courseEntrants.length > 0
			? await db
					.select({
						entrantId: scoredSplitTimes.entrantId,
						elapsedSeconds: scoredSplitTimes.elapsedSeconds,
					})
					.from(scoredSplitTimes)
					.where(
						and(
							eq(scoredSplitTimes.courseSplitId, finalSplit.id),
							inArray(
								scoredSplitTimes.entrantId,
								courseEntrants.map((e) => e.entrantId),
							),
						),
					)
					.orderBy(asc(scoredSplitTimes.elapsedSeconds))
			: [];

	const finishByEntrant = new Map(
		finishTimes.map((f) => [f.entrantId, f.elapsedSeconds]),
	);

	const eventsHeld = eventRows.map((ev) => {
		const evEntrants = courseEntrants.filter((e) => e.eventId === ev.eventId);
		const finishers = evEntrants
			.filter((e) => e.status === "finished")
			.map((e) => ({
				...e,
				elapsedSeconds: finishByEntrant.get(e.entrantId) ?? null,
			}))
			.filter((e) => e.elapsedSeconds !== null)
			.sort(
				(a, b) =>
					(a.elapsedSeconds ?? Number.MAX_SAFE_INTEGER) -
					(b.elapsedSeconds ?? Number.MAX_SAFE_INTEGER),
			);

		const fastest = finishers[0];

		return {
			eventId: ev.eventId,
			eventName: ev.eventName,
			lapsRequired: ev.lapsRequired,
			scheduledStart: ev.scheduledStart.toISOString(),
			eventGroupId: ev.eventGroupId,
			eventGroupName: ev.eventGroupName,
			eventGroupSlug: ev.eventGroupSlug,
			discipline: ev.discipline,
			temporalState: getEventGroupTemporalState(ev.startDate, ev.endDate, now),
			totalEntrants: evEntrants.length,
			finisherCount: finishers.length,
			courseRecord: fastest
				? {
						displayName: formatPersonDisplayName({
							firstName: fastest.firstName,
							lastName: fastest.lastName,
						}),
						personId: fastest.personId,
						competitorNumber: fastest.competitorNumber,
						elapsedFormatted: formatDuration(fastest.elapsedSeconds),
					}
				: null,
		};
	});

	return {
		course: {
			id: courseRow.id,
			name: courseRow.name,
			distanceMeters: courseRow.distanceMeters,
			elevationGainMeters: courseRow.elevationGainMeters,
			gpxRouteUrl: courseRow.gpxRouteUrl,
			copiedFromCourseId: courseRow.copiedFromCourseId,
			copiedFromCourseName: copiedFromRow[0]?.name ?? null,
			organization: {
				id: org?.id ?? courseRow.organizationId,
				name: org?.name ?? "ChekkPoint Organizer",
				slug: org?.slug ?? "organizer",
				location: orgMeta.location,
			},
		},
		splits: splitRows,
		eventsHeld,
	};
}

export async function loadPublicOrganizerBySlug(
	data: z.infer<typeof organizerSlugInput>,
) {
	const now = new Date();

	const [orgRow] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.slug, data.slug))
		.limit(1);

	if (!orgRow) {
		throw notFound();
	}

	const orgMeta = parseOrganizationMeta(orgRow.metadata);

	const [orgGroups, orgCourses, orgTimingPoints, orgSplits, orgEvents] =
		await Promise.all([
			loadEnrichedEventGroups(now, { organizationId: orgRow.id }),
			db
				.select()
				.from(courses)
				.where(eq(courses.organizationId, orgRow.id))
				.orderBy(asc(courses.name)),
			db
				.select()
				.from(timingPoints)
				.where(eq(timingPoints.organizationId, orgRow.id))
				.orderBy(asc(timingPoints.code)),
			db
				.select({
					id: courseSplits.id,
					courseId: courseSplits.courseId,
				})
				.from(courseSplits)
				.innerJoin(courses, eq(courses.id, courseSplits.courseId))
				.where(
					and(
						eq(courses.organizationId, orgRow.id),
						eq(courseSplits.isSecretCheckpoint, false),
					),
				),
			db
				.select({
					id: events.id,
					courseId: events.courseId,
				})
				.from(events)
				.innerJoin(courses, eq(courses.id, events.courseId))
				.where(eq(courses.organizationId, orgRow.id)),
		]);

	const totalEntrantsTimed = orgGroups.reduce(
		(acc, g) => acc + g.counts.totalEntrants,
		0,
	);

	return {
		organization: {
			id: orgRow.id,
			name: orgRow.name,
			slug: orgRow.slug,
			logo: orgRow.logo,
			location: orgMeta.location,
			timeZone: orgMeta.timeZone,
			description: orgMeta.description,
			website: orgMeta.website ?? null,
			establishedYear: orgMeta.establishedYear ?? null,
		},
		counters: {
			eventGroupsCount: orgGroups.length,
			coursesCount: orgCourses.length,
			timingPointsCount: orgTimingPoints.length,
			totalEntrantsTimed,
		},
		liveAndUpcomingGroups: orgGroups.filter(
			(g) => g.temporalState === "live" || g.temporalState === "upcoming",
		),
		pastGroups: orgGroups.filter((g) => g.temporalState === "past"),
		courses: orgCourses.map((c) => ({
			id: c.id,
			name: c.name,
			distanceMeters: c.distanceMeters,
			elevationGainMeters: c.elevationGainMeters,
			splitCount: orgSplits.filter((s) => s.courseId === c.id).length,
			eventsCount: orgEvents.filter((e) => e.courseId === c.id).length,
		})),
	};
}
