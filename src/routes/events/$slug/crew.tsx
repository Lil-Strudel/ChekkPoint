import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import {
	formatDistanceMiles,
	formatDuration,
	formatElevationFeet,
} from "~/public/public.shared";

const parentRoute = getRouteApi("/events/$slug");

export const Route = createFileRoute("/events/$slug/crew")({
	component: EventGroupCrewPage,
});

function EventGroupCrewPage() {
	const data = parentRoute.useLoaderData();

	return (
		<div class="flex flex-col gap-8">
			<Alert variant="info">
				<AlertTitle>
					Crew Access Gating Protocol — Congestion &amp; Permit Protection
				</AlertTitle>
				<AlertDescription>
					To protect US Forest Service road permits and keep emergency lanes
					clear at mountain aid stations, support vehicles are cleared to enter
					an aid station lot only after their runner has recorded a verified
					split at the designated <strong>Upstream Gate Checkpoint</strong>.
				</AlertDescription>
			</Alert>

			<Show
				when={data().crewStations.length > 0}
				fallback={
					<Card class="p-8 text-center text-sm text-muted-foreground">
						No crew-gated aid stations are configured for this event group.
					</Card>
				}
			>
				<div class="grid grid-cols-1 gap-6">
					<For each={data().crewStations}>
						{(station) => (
							<Card class="flex flex-col gap-5 p-6">
								<div class="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
									<div>
										<div class="flex flex-wrap items-center gap-2">
											<Badge variant="forest">{station.courseName}</Badge>
											<code>{station.timingPointCode}</code>
											<span class="text-xs font-medium tabular-nums text-muted-foreground">
												{formatDistanceMiles(station.distanceFromStartMeters)} ·{" "}
												{formatElevationFeet(station.elevationMeters)}
											</span>
										</div>
										<h2 class="font-display m-0 mt-2 text-2xl font-normal text-foreground">
											{station.stationName}
										</h2>
										<p class="m-0 mt-1 text-sm text-muted-foreground">
											Upstream Gating Split:{" "}
											<strong class="text-foreground">
												{station.upstreamGateName}
											</strong>{" "}
											({formatDistanceMiles(station.upstreamGateDistanceMeters)}
											)
										</p>
									</div>

									<div class="text-right tabular-nums">
										<Show when={station.cutoffDurationSeconds}>
											{(cut) => (
												<Badge variant="clay">
													Station Cutoff: {formatDuration(cut())}
												</Badge>
											)}
										</Show>
									</div>
								</div>

								<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
									<div class="rounded-xl border border-forest/30 bg-forest/5 p-4">
										<div class="mb-3 flex items-center justify-between gap-2">
											<span class="text-xs font-bold uppercase tracking-widest text-forest">
												Cleared — Crew Access Open (
												{station.clearedRunners.length})
											</span>
											<Badge variant="forest">Lot Entry Permitted</Badge>
										</div>

										<Show
											when={station.clearedRunners.length > 0}
											fallback={
												<p class="m-0 text-xs text-muted-foreground">
													No active runners are currently in the cleared window
													for this station.
												</p>
											}
										>
											<ul class="m-0 flex list-none flex-col divide-y divide-border/60 p-0 text-xs">
												<For each={station.clearedRunners}>
													{(r) => (
														<li class="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
															<div>
																<span class="mr-2 font-bold tabular-nums text-forest">
																	#{r.competitorNumber}
																</span>
																<Link
																	to="/athletes/$personId"
																	params={{ personId: r.personId }}
																	class="font-semibold text-foreground hover:text-forest"
																>
																	{r.displayName}
																</Link>
																<span class="ml-1.5 text-muted-foreground">
																	· {r.clearedAtSplitName} (
																	{r.clearedElapsedFormatted})
																</span>
															</div>
															<Badge
																variant={r.arrivedAtStation ? "clay" : "sage"}
															>
																{r.arrivedAtStation
																	? "At Station"
																	: "En Route (Cleared)"}
															</Badge>
														</li>
													)}
												</For>
											</ul>
										</Show>
									</div>

									<div class="rounded-xl border border-border bg-surface/60 p-4">
										<div class="mb-3 flex items-center justify-between gap-2">
											<span class="text-xs font-bold uppercase tracking-widest text-muted-foreground">
												In Transit to Gate ({station.approachingRunners.length})
											</span>
											<Badge variant="sand">Hold in Staging Area</Badge>
										</div>

										<Show
											when={station.approachingRunners.length > 0}
											fallback={
												<p class="m-0 text-xs text-muted-foreground">
													All active runners on this course have cleared the
													upstream gate.
												</p>
											}
										>
											<ul class="m-0 flex list-none flex-col divide-y divide-border/60 p-0 text-xs">
												<For each={station.approachingRunners}>
													{(r) => (
														<li class="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
															<div>
																<span class="mr-2 font-bold tabular-nums text-muted-foreground">
																	#{r.competitorNumber}
																</span>
																<Link
																	to="/athletes/$personId"
																	params={{ personId: r.personId }}
																	class="font-semibold text-foreground hover:text-forest"
																>
																	{r.displayName}
																</Link>
															</div>
															<span class="text-muted-foreground">
																Last: {r.lastSplitName}
															</span>
														</li>
													)}
												</For>
											</ul>
										</Show>
									</div>
								</div>
							</Card>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
}
