import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { getPublicAthleteById } from "~/public/public.functions";
import {
	DISCIPLINE_META,
	ENTRANT_STATUS_META,
	formatDistanceMiles,
	formatElevationFeet,
	formatPacePerMile,
} from "~/public/public.shared";

export const Route = createFileRoute("/athletes/$personId")({
	loader: ({ params }) =>
		getPublicAthleteById({ data: { personId: params.personId } }),
	component: PublicAthleteHomePage,
	notFoundComponent: AthleteNotFound,
});

function PublicAthleteHomePage() {
	const data = Route.useLoaderData();
	const [sourceFilter, setSourceFilter] = createSignal<
		"all" | "chekkpoint" | "external"
	>("all");

	const person = () => data().person;
	const summary = () => data().summary;

	return (
		<main class="page-wrap pb-24 pt-12">
			<div class="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
				<Link
					to="/athletes"
					class="text-scrim font-semibold text-forest no-underline hover:underline"
				>
					&larr; Athletes
				</Link>
			</div>

			<h1 class="page-title mb-2">{person().displayName}</h1>
			<p class="page-sub mb-8">{person().cityState}</p>

			{/* Active or Upcoming Race Callout */}
			<Show when={data().activeOrUpcomingEntrants.length > 0}>
				<section class="mb-12" aria-label="Active or upcoming race entries">
					<div class="flex flex-col gap-4">
						<For each={data().activeOrUpcomingEntrants}>
							{(active) => {
								const st = ENTRANT_STATUS_META[active.status];
								const disc = DISCIPLINE_META[active.discipline];
								return (
									<Card class="flex flex-col justify-between gap-4 border-clay/40 p-6 sm:flex-row sm:items-center">
										<div>
											<div class="flex flex-wrap items-center gap-2">
												<Badge
													variant={
														active.temporalState === "live" ? "clay" : "forest"
													}
												>
													{active.temporalState === "live"
														? "On course"
														: "Upcoming"}
												</Badge>
												<Badge variant={st.badgeVariant}>{st.label}</Badge>
											</div>

											<h2 class="font-display m-0 mt-2 text-2xl font-normal text-foreground">
												<Link
													to="/events/$slug"
													params={{ slug: active.eventGroupSlug }}
													class="text-foreground no-underline hover:text-forest"
												>
													{active.eventGroupName} — {active.eventName}
												</Link>
											</h2>

											<p class="m-0 mt-1 text-sm tabular-nums text-muted-foreground">
												{disc.competitorLabel} #{active.competitorNumber} ·{" "}
												{active.lastSplitName} ({active.lastElapsedFormatted})
											</p>
										</div>

										<Link
											to="/events/$slug/results"
											params={{ slug: active.eventGroupSlug }}
											class="shrink-0 text-sm font-semibold text-forest no-underline hover:underline"
										>
											View standings &rarr;
										</Link>
									</Card>
								);
							}}
						</For>
					</div>
				</section>
			</Show>

			{/* Career Summary Stat Tiles */}
			<section class="mb-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
				<Card class="p-5">
					<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
						Career Finishes
					</p>
					<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-foreground">
						{summary().totalFinishes}{" "}
						<span class="text-xl text-muted-foreground">
							/ {summary().totalRaces}
						</span>
					</p>
				</Card>

				<Card class="p-5">
					<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
						Longest Distance
					</p>
					<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-foreground">
						{formatDistanceMiles(summary().maxDistanceMeters)}
					</p>
				</Card>

				<Card class="p-5">
					<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
						UltraSignup Rank
					</p>
					<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-foreground">
						{summary().ultrasignupRank
							? `${summary().ultrasignupRank?.toFixed(1)}%`
							: "—"}
					</p>
				</Card>

				<Card class="p-5">
					<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
						Avg Pace
					</p>
					<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-foreground">
						{formatPacePerMile(summary().avgPaceSecondsPerKm)}
					</p>
				</Card>
			</section>

			{/* Career Race History */}
			<section class="mb-14">
				<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
					<h2 class="font-display text-scrim m-0 text-3xl font-normal text-foreground">
						Career Race History
					</h2>
					<div class="flex flex-wrap gap-2">
						<Button
							type="button"
							variant={sourceFilter() === "all" ? "default" : "outline"}
							size="sm"
							onClick={() => setSourceFilter("all")}
						>
							All Results
						</Button>
						<Button
							type="button"
							variant={sourceFilter() === "chekkpoint" ? "default" : "outline"}
							size="sm"
							onClick={() => setSourceFilter("chekkpoint")}
						>
							ChekkPoint ({data().chekkpointResults.length})
						</Button>
						<Button
							type="button"
							variant={sourceFilter() === "external" ? "default" : "outline"}
							size="sm"
							onClick={() => setSourceFilter("external")}
						>
							External ({data().historicalResults.length})
						</Button>
					</div>
				</div>

				<Show
					when={sourceFilter() === "all" || sourceFilter() === "chekkpoint"}
				>
					<div class="mb-8">
						<p class="text-scrim m-0 mb-3 text-xs font-bold uppercase tracking-widest text-forest">
							ChekkPoint Timed Events
						</p>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Event</TableHead>
									<TableHead>Bib</TableHead>
									<TableHead>Division</TableHead>
									<TableHead>Status</TableHead>
									<TableHead class="text-right">Elapsed</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<For each={data().chekkpointResults}>
									{(res) => {
										const st = ENTRANT_STATUS_META[res.status];
										return (
											<TableRow>
												<TableCell class="font-semibold">
													<Link
														to="/events/$slug"
														params={{ slug: res.eventGroupSlug }}
														class="text-foreground no-underline hover:text-forest"
													>
														{res.eventGroupName} — {res.eventName}
													</Link>
												</TableCell>
												<TableCell class="font-bold tabular-nums text-forest">
													#{res.competitorNumber}
												</TableCell>
												<TableCell class="text-muted-foreground">
													{res.division}
												</TableCell>
												<TableCell>
													<Badge variant={st.badgeVariant}>{st.label}</Badge>
												</TableCell>
												<TableCell class="text-right font-semibold tabular-nums">
													{res.lastElapsedFormatted}
												</TableCell>
											</TableRow>
										);
									}}
								</For>
							</TableBody>
						</Table>
					</div>
				</Show>

				<Show when={sourceFilter() === "all" || sourceFilter() === "external"}>
					<div>
						<p class="text-scrim m-0 mb-3 text-xs font-bold uppercase tracking-widest text-forest">
							External Archive
						</p>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Race</TableHead>
									<TableHead>Distance</TableHead>
									<TableHead>Place</TableHead>
									<TableHead class="text-right">Finish Time</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<For each={data().historicalResults}>
									{(hist) => (
										<TableRow>
											<TableCell class="tabular-nums text-muted-foreground">
												{hist.raceDate}
											</TableCell>
											<TableCell class="font-semibold text-foreground">
												{hist.raceName}
											</TableCell>
											<TableCell class="tabular-nums text-muted-foreground">
												{hist.distanceLabel} ·{" "}
												{formatElevationFeet(hist.elevationGainMeters)}
											</TableCell>
											<TableCell class="tabular-nums">
												{hist.overallPlace
													? `${hist.overallPlace} / ${hist.totalFinishers ?? "—"}`
													: "—"}
											</TableCell>
											<TableCell class="text-right font-bold tabular-nums text-forest">
												{hist.finishTimeFormatted}
											</TableCell>
										</TableRow>
									)}
								</For>
							</TableBody>
						</Table>
					</div>
				</Show>
			</section>

			{/* Public Profile Claiming Callout */}
			<Alert variant="info">
				<AlertTitle>Is this your athlete profile?</AlertTitle>
				<AlertDescription class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
					<span>
						Sign in with the email address you used during race registration to
						claim this profile.
					</span>
					<Link
						to="/sign-in"
						class={buttonVariants({ size: "sm", class: "shrink-0" })}
					>
						Claim Profile
					</Link>
				</AlertDescription>
			</Alert>
		</main>
	);
}

function AthleteNotFound() {
	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Athlete Profile</p>
			<h1 class="page-title">Athlete not found</h1>
			<p class="page-sub">
				No public athlete record exists for that identifier.
			</p>
			<Link to="/athletes" class={buttonVariants({ variant: "outline" })}>
				Back to Athlete Directory
			</Link>
		</main>
	);
}
