import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { For } from "solid-js";
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
	formatElevationFeet,
} from "~/public/public.shared";

const parentRoute = getRouteApi("/events/$slug");

export const Route = createFileRoute("/events/$slug/")({
	component: EventGroupOverviewPage,
});

function EventGroupOverviewPage() {
	const data = parentRoute.useLoaderData();
	const params = parentRoute.useParams();

	const group = () => data().eventGroup;
	const disc = () => DISCIPLINE_META[group().discipline];

	const featuredEntrants = () => {
		const list = [...data().entrants];
		return list
			.sort((a, b) => {
				if (a.overallPlace && b.overallPlace) {
					return a.overallPlace - b.overallPlace;
				}
				if (a.overallPlace) return -1;
				if (b.overallPlace) return 1;
				return (
					(b.lastSplit?.sequenceOrder ?? 0) - (a.lastSplit?.sequenceOrder ?? 0)
				);
			})
			.slice(0, 6);
	};

	return (
		<div class="flex flex-col gap-12">
			{/* 1. Field Status Counter Tiles */}
			<section aria-label="Field status summary">
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<Card class="p-5">
						<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
							Entrants
						</p>
						<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-foreground">
							{data().counts.totalEntrants}
						</p>
					</Card>

					<Card class="p-5">
						<p class="m-0 text-xs font-bold uppercase tracking-widest text-clay">
							On Course
						</p>
						<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-clay">
							{data().counts.onCourse}
						</p>
					</Card>

					<Card class="p-5">
						<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
							Finished
						</p>
						<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-forest">
							{data().counts.finished}
						</p>
					</Card>

					<Card class="p-5">
						<p class="m-0 text-xs font-bold uppercase tracking-widest text-muted-foreground">
							DNF / Cutoffs
						</p>
						<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-foreground">
							{data().counts.dnf + data().counts.retired + data().counts.otl}
						</p>
					</Card>
				</div>
			</section>

			{/* 2. Sub-Events & Courses */}
			<section>
				<div class="mb-4 flex flex-wrap items-end justify-between gap-2">
					<h2 class="font-display text-scrim m-0 text-2xl font-normal text-foreground">
						Sub-Events &amp; Courses
					</h2>
					<Link
						to="/events/$slug/course"
						params={{ slug: params().slug }}
						class="text-scrim text-sm font-semibold text-forest no-underline hover:underline"
					>
						Checkpoints &amp; cutoffs &rarr;
					</Link>
				</div>

				<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
					<For each={data().subEvents}>
						{(ev) => {
							const splits = data().splitsByCourse[ev.course.id] ?? [];
							return (
								<Card class="flex flex-col justify-between gap-3 p-6">
									<div>
										<h3 class="font-display m-0 text-2xl font-normal text-foreground">
											<Link
												to="/courses/$courseId"
												params={{ courseId: ev.course.id }}
												class="text-foreground no-underline hover:text-forest"
											>
												{ev.name}
											</Link>
										</h3>
										<p class="m-0 mt-1 text-sm tabular-nums text-muted-foreground">
											{formatDistanceMiles(
												ev.course.distanceMeters * ev.lapsRequired,
											)}{" "}
											·{" "}
											{formatElevationFeet(
												ev.course.elevationGainMeters !== null
													? ev.course.elevationGainMeters * ev.lapsRequired
													: null,
											)}{" "}
											gain · {splits.length} checkpoints
										</p>
									</div>

									<Link
										to="/courses/$courseId"
										params={{ courseId: ev.course.id }}
										class="text-sm font-semibold text-forest no-underline hover:underline"
									>
										Pace calculator &rarr;
									</Link>
								</Card>
							);
						}}
					</For>
				</div>
			</section>

			{/* 3. Standings Snapshot */}
			<section>
				<div class="mb-4 flex flex-wrap items-end justify-between gap-2">
					<h2 class="font-display text-scrim m-0 text-2xl font-normal text-foreground">
						Standings Snapshot
					</h2>
					<Link
						to="/events/$slug/results"
						params={{ slug: params().slug }}
						class="text-scrim text-sm font-semibold text-forest no-underline hover:underline"
					>
						Full results &rarr;
					</Link>
				</div>

				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{disc().competitorLabel}</TableHead>
							<TableHead>Athlete</TableHead>
							<TableHead>Division</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Latest Checkpoint</TableHead>
							<TableHead class="text-right">Elapsed</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<For each={featuredEntrants()}>
							{(ent) => {
								const st = ENTRANT_STATUS_META[ent.status];
								return (
									<TableRow>
										<TableCell class="font-bold tabular-nums text-forest">
											#{ent.competitorNumber}
										</TableCell>
										<TableCell class="font-semibold">
											<Link
												to="/athletes/$personId"
												params={{ personId: ent.personId }}
												class="text-foreground no-underline hover:text-forest"
											>
												{ent.displayName}
											</Link>
										</TableCell>
										<TableCell class="text-muted-foreground">
											{ent.division}
										</TableCell>
										<TableCell>
											<Badge variant={st.badgeVariant}>{st.label}</Badge>
										</TableCell>
										<TableCell class="text-muted-foreground">
											{ent.lastSplit?.splitName ?? "Start Line"}
										</TableCell>
										<TableCell class="text-right font-semibold tabular-nums">
											{ent.lastSplit?.elapsedFormatted ?? "—"}
										</TableCell>
									</TableRow>
								);
							}}
						</For>
					</TableBody>
				</Table>
			</section>
		</div>
	);
}
