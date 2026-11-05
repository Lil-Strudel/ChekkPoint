import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import {
	getFollowedBibs,
	openTelemetrySheet,
	toggleFollowBib,
} from "~/components/EntrantTelemetryView";
import FormSelect from "~/components/FormSelect";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import {
	DISCIPLINE_META,
	ENTRANT_STATUS_META,
	formatDistanceMiles,
} from "~/public/public.shared";

const parentRoute = getRouteApi("/events/$slug");

export const Route = createFileRoute("/events/$slug/results")({
	component: EventGroupResultsPage,
});

function EventGroupResultsPage() {
	const data = parentRoute.useLoaderData();

	const defaultSubEventId = () => data().subEvents[0]?.id ?? "";
	const [selectedEventId, setSelectedEventId] = createSignal(
		defaultSubEventId(),
	);
	const [divisionFilter, setDivisionFilter] = createSignal("all");
	const [followedBibs, setFollowedBibs] = createSignal<string[]>([]);

	const refreshFollowed = () => {
		setFollowedBibs(getFollowedBibs(data().eventGroup.slug));
	};

	onMount(() => {
		refreshFollowed();
		const handleWatchlistChange = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail?.slug === data().eventGroup.slug) {
				setFollowedBibs(detail.bibs || []);
			}
		};
		window.addEventListener("chekkpoint:watchlist-updated", handleWatchlistChange);
		onCleanup(() => {
			window.removeEventListener("chekkpoint:watchlist-updated", handleWatchlistChange);
		});
	});

	const isFollowed = (bib: string) => followedBibs().includes(bib);

	const activeSubEvent = () =>
		data().subEvents.find((e) => e.id === selectedEventId()) ??
		data().subEvents[0];

	const activeSplits = () => {
		const ev = activeSubEvent();
		if (!ev) return [];
		return data().splitsByCourse[ev.course.id] ?? [];
	};

	const availableDivisions = () => {
		const ev = activeSubEvent();
		if (!ev) return [];
		const set = new Set<string>();
		for (const ent of data().entrants) {
			if (ent.eventId === ev.id) set.add(ent.division);
		}
		return [
			{ value: "all", label: "All divisions" },
			...Array.from(set).map((d) => ({ value: d, label: d })),
		];
	};

	const leaderboardRows = () => {
		const ev = activeSubEvent();
		if (!ev) return [];
		const div = divisionFilter();

		return data()
			.entrants.filter((ent) => {
				if (ent.eventId !== ev.id) return false;
				if (div !== "all" && ent.division !== div) return false;
				return true;
			})
			.sort((a, b) => {
				if (a.overallPlace !== null && b.overallPlace !== null) {
					return a.overallPlace - b.overallPlace;
				}
				if (a.overallPlace !== null) return -1;
				if (b.overallPlace !== null) return 1;
				const seqDiff =
					(b.lastSplit?.sequenceOrder ?? 0) - (a.lastSplit?.sequenceOrder ?? 0);
				if (seqDiff !== 0) return seqDiff;
				return (
					(a.lastSplit?.elapsedSeconds ?? Number.MAX_SAFE_INTEGER) -
					(b.lastSplit?.elapsedSeconds ?? Number.MAX_SAFE_INTEGER)
				);
			});
	};

	const disc = () => DISCIPLINE_META[data().eventGroup.discipline];

	return (
		<div class="flex flex-col gap-6">
			<Card class="p-5 sm:p-6">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:max-w-lg">
					<FormSelect
						label="Sub-Event Distance"
						options={data().subEvents.map((e) => ({
							value: e.id,
							label: e.name,
						}))}
						value={activeSubEvent()?.id ?? ""}
						onChange={(v) => {
							setSelectedEventId(v);
							setDivisionFilter("all");
						}}
					/>

					<FormSelect
						label="Division"
						options={availableDivisions()}
						value={divisionFilter()}
						onChange={(v) => setDivisionFilter(v)}
					/>
				</div>
			</Card>

			<Show
				when={leaderboardRows().length > 0}
				fallback={
					<Card class="p-10 text-center text-sm text-muted-foreground">
						No entrants or scored splits recorded for this sub-event selection
						yet.
					</Card>
				}
			>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead class="w-8"></TableHead>
							<TableHead>Place</TableHead>
							<TableHead>{disc().competitorLabel}</TableHead>
							<TableHead>Athlete</TableHead>
							<TableHead>Division</TableHead>
							<TableHead>Status</TableHead>
							<For each={activeSplits()}>
								{(sp) => (
									<TableHead>
										<div>{sp.name}</div>
										<div class="font-normal text-[10px] text-muted-foreground">
											{formatDistanceMiles(sp.distanceFromStartMeters)}
										</div>
									</TableHead>
								)}
							</For>
							<TableHead class="text-right">Finish</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<For each={leaderboardRows()}>
							{(ent) => {
								const st = ENTRANT_STATUS_META[ent.status];
								return (
									<TableRow
										onClick={() => openTelemetrySheet(ent.id)}
										class="cursor-pointer hover:bg-forest/5"
									>
										<TableCell
											class="p-2 text-center"
											onClick={(e) => {
												e.stopPropagation();
												toggleFollowBib(
													data().eventGroup.slug,
													ent.competitorNumber,
												);
											}}
										>
											<button
												type="button"
												class={`cursor-pointer text-base leading-none ${
													isFollowed(ent.competitorNumber)
														? "text-forest font-bold"
														: "text-muted-foreground/60 hover:text-foreground"
												}`}
												title={
													isFollowed(ent.competitorNumber)
														? "Unfollow"
														: "Follow"
												}
											>
												{isFollowed(ent.competitorNumber) ? "★" : "☆"}
											</button>
										</TableCell>
										<TableCell class="font-bold tabular-nums">
											{ent.overallPlace ? `${ent.overallPlace}` : "—"}
										</TableCell>
										<TableCell class="font-bold tabular-nums text-forest">
											#{ent.competitorNumber}
										</TableCell>
										<TableCell class="font-semibold">
											<span class="text-foreground hover:text-forest">
												{ent.displayName}
											</span>
										</TableCell>
										<TableCell class="text-muted-foreground">
											{ent.division}
										</TableCell>
										<TableCell>
											<Badge variant={st.badgeVariant}>{st.label}</Badge>
										</TableCell>
										<For each={activeSplits()}>
											{(sp) => {
												const recorded = ent.splits.find(
													(s) => s.courseSplitId === sp.id,
												);
												return (
													<TableCell class="tabular-nums">
														{recorded ? recorded.elapsedFormatted : "—"}
													</TableCell>
												);
											}}
										</For>
										<TableCell class="text-right font-bold tabular-nums text-forest">
											{ent.finishElapsedFormatted ?? "—"}
										</TableCell>
									</TableRow>
								);
							}}
						</For>
					</TableBody>
				</Table>
			</Show>
		</div>
	);
}
