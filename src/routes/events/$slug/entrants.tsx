import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { createSignal, For, onCleanup, onMount } from "solid-js";
import {
	getFollowedBibs,
	openTelemetrySheet,
	toggleFollowBib,
} from "~/components/EntrantTelemetryView";
import FormSelect from "~/components/FormSelect";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { DISCIPLINE_META, ENTRANT_STATUS_META } from "~/public/public.shared";

const parentRoute = getRouteApi("/events/$slug");

export const Route = createFileRoute("/events/$slug/entrants")({
	component: EventGroupEntrantsPage,
});

function EventGroupEntrantsPage() {
	const data = parentRoute.useLoaderData();

	const [searchQuery, setSearchQuery] = createSignal("");
	const [subEventFilter, setSubEventFilter] = createSignal("all");
	const [statusFilter, setStatusFilter] = createSignal("all");
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

	const disc = () => DISCIPLINE_META[data().eventGroup.discipline];

	const subEventOptions = () => [
		{ value: "all", label: "All sub-events" },
		...data().subEvents.map((e) => ({ value: e.id, label: e.name })),
	];

	const statusOptions = [
		{ value: "all", label: "All statuses" },
		{ value: "in_progress", label: "On course" },
		{ value: "finished", label: "Finished" },
		{ value: "registered", label: "Registered / Checked in" },
		{ value: "dnf", label: "DNF / Drop" },
	];

	const filteredEntrants = () => {
		const q = searchQuery().trim().toLowerCase();
		const evId = subEventFilter();
		const st = statusFilter();

		return data().entrants.filter((ent) => {
			if (evId !== "all" && ent.eventId !== evId) return false;
			if (st !== "all") {
				if (st === "registered") {
					if (ent.status !== "registered" && ent.status !== "checked_in") {
						return false;
					}
				} else if (st === "dnf") {
					if (
						ent.status !== "dnf" &&
						ent.status !== "retired" &&
						ent.status !== "otl"
					) {
						return false;
					}
				} else if (ent.status !== st) {
					return false;
				}
			}
			if (q) {
				const hay =
					`${ent.competitorNumber} ${ent.displayName} ${ent.cityState} ${ent.division}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			return true;
		});
	};

	return (
		<div class="flex flex-col gap-6">
			<Card class="p-5 sm:p-6">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px] md:items-end">
					<div class="grid gap-2">
						<label
							for="entrant-filter-input"
							class="text-sm font-medium text-foreground"
						>
							Search by {disc().competitorLabel}, athlete name, or city
						</label>
						<Input
							id="entrant-filter-input"
							type="search"
							value={searchQuery()}
							onInput={(e) => setSearchQuery(e.currentTarget.value)}
							placeholder={`Filter by ${disc().competitorLabel} (e.g. 101) or athlete name…`}
						/>
					</div>

					<FormSelect
						label="Sub-Event"
						options={subEventOptions()}
						value={subEventFilter()}
						onChange={(v) => setSubEventFilter(v)}
					/>

					<FormSelect
						label="Status"
						options={statusOptions}
						value={statusFilter()}
						onChange={(v) => setStatusFilter(v)}
					/>
				</div>
			</Card>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead class="w-8"></TableHead>
						<TableHead>{disc().competitorLabel}</TableHead>
						<TableHead>Athlete</TableHead>
						<TableHead>Division</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Latest Split</TableHead>
						<TableHead class="text-right">Projected Finish</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<For each={filteredEntrants()}>
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
									<TableCell class="tabular-nums text-muted-foreground">
										{ent.lastSplit
											? `${ent.lastSplit.splitName} (${ent.lastSplit.elapsedFormatted})`
											: "Awaiting Start"}
									</TableCell>
									<TableCell class="text-right font-medium tabular-nums">
										{ent.projectedFinishFormatted}
									</TableCell>
								</TableRow>
							);
						}}
					</For>
				</TableBody>
			</Table>
		</div>
	);
}
