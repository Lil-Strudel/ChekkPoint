import { createFileRoute, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { getAllStationsCustody } from "~/field-ops/field-ops.functions";

export const Route = createFileRoute(
	"/_authed/orgs/$slug/event-groups/$eventGroupSlug/stations/",
)({
	loader: ({ params }) =>
		getAllStationsCustody({
			data: { slug: params.slug, eventGroupSlug: params.eventGroupSlug },
		}),
	component: AllStationsCustodyPage,
});

function AllStationsCustodyPage() {
	const stations = Route.useLoaderData();
	const params = Route.useParams();

	const totalExpected = () =>
		stations().reduce((acc, s) => acc + s.counts.expectedNext, 0);
	const totalInStation = () =>
		stations().reduce((acc, s) => acc + s.counts.inStationNow, 0);
	const totalDeparted = () =>
		stations().reduce((acc, s) => acc + s.counts.departed, 0);
	const totalStopped = () =>
		stations().reduce((acc, s) => acc + s.counts.stoppedDnf, 0);

	return (
		<div class="px-6 py-8 max-w-7xl mx-auto space-y-8">
			{/* Weekend Hub Internal Sub-Nav */}
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div class="flex items-center gap-4 text-xs font-semibold">
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
					>
						Weekend Overview & Readiness
					</Link>
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/rules-staff"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
					>
						Discipline Rules & Staff Matrix
					</Link>
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/stations"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-foreground border-b-2 border-forest pb-3 -mb-3.5 font-bold"
					>
						Stations Cross-Check
					</Link>
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/sar"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
					>
						Net Control & SAR
					</Link>
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/raw-stream"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
					>
						Raw Timing Stream
					</Link>
				</div>
			</div>

			{/* Overview Header */}
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 class="text-2xl font-bold font-serif text-foreground tracking-tight">
						Combined Aid Stations Cross-Check
					</h1>
					<p class="text-sm text-muted-foreground mt-0.5">
						Live field custody matrix across all {stations().length} physical timing points and course checkpoints.
					</p>
				</div>

				<div class="flex items-center gap-2">
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/logger"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class={buttonVariants({ variant: "forest", size: "sm" })}
					>
						⏱️ Open Volunteer Logger
					</Link>
				</div>
			</div>

			{/* Summary KPI Cards */}
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
				<Card class="bg-card/40 border-border">
					<CardContent class="p-4">
						<div class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Expected Next
						</div>
						<div class="text-2xl font-bold text-foreground font-mono tabular-nums mt-1">
							{totalExpected()}
						</div>
					</CardContent>
				</Card>
				<Card class="bg-card/40 border-border">
					<CardContent class="p-4">
						<div class="text-xs font-semibold text-forest uppercase tracking-wider">
							In Station Now
						</div>
						<div class="text-2xl font-bold text-forest font-mono tabular-nums mt-1">
							{totalInStation()}
						</div>
					</CardContent>
				</Card>
				<Card class="bg-card/40 border-border">
					<CardContent class="p-4">
						<div class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Departed
						</div>
						<div class="text-2xl font-bold text-muted-foreground font-mono tabular-nums mt-1">
							{totalDeparted()}
						</div>
					</CardContent>
				</Card>
				<Card class="bg-card/40 border-border">
					<CardContent class="p-4">
						<div class="text-xs font-semibold text-destructive uppercase tracking-wider">
							Stopped / DNF
						</div>
						<div class="text-2xl font-bold text-destructive font-mono tabular-nums mt-1">
							{totalStopped()}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Custody Matrix Table */}
			<Card class="border-border">
				<CardHeader class="pb-3 border-b border-border/80">
					<CardTitle class="text-base font-bold font-serif">
						Checkpoints Accountability Matrix
					</CardTitle>
					<CardDescription class="text-xs">
						Select a station to open its 4-zone Interactive Bib Grid, live dwell timer, and printable backup sheet.
					</CardDescription>
				</CardHeader>
				<CardContent class="p-0">
					<div class="overflow-x-auto">
						<table class="w-full text-left text-xs">
							<thead>
								<tr class="border-b border-border/80 bg-muted/40 font-semibold text-muted-foreground select-none">
									<th class="py-3 px-4">Station Code</th>
									<th class="py-3 px-4">Aid Station Name</th>
									<th class="py-3 px-4 text-right">Distance (km)</th>
									<th class="py-3 px-4 text-center">Expected Next</th>
									<th class="py-3 px-4 text-center">In Station</th>
									<th class="py-3 px-4 text-center">Departed</th>
									<th class="py-3 px-4 text-center">Stopped / DNF</th>
									<th class="py-3 px-4 text-right">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								<Show
									when={stations().length > 0}
									fallback={
										<tr>
											<td colspan="8" class="py-8 text-center text-muted-foreground">
												No timing points configured for this event group's courses.
											</td>
										</tr>
									}
								>
									<For each={stations()}>
										{(st) => (
											<tr class="hover:bg-muted/20 transition-colors">
												<td class="py-3 px-4 font-mono font-bold text-forest">
													{st.timingPoint.code}
												</td>
												<td class="py-3 px-4">
													<div class="font-semibold text-foreground">
														{st.timingPoint.name}
													</div>
													<Show when={st.timingPoint.elevationMeters}>
														<div class="text-[11px] text-muted-foreground tabular-nums">
															Elev: {st.timingPoint.elevationMeters}m
														</div>
													</Show>
												</td>
												<td class="py-3 px-4 text-right font-mono tabular-nums text-muted-foreground">
													{st.distanceKm !== null && st.distanceKm !== undefined
														? `${st.distanceKm.toFixed(1)} km`
														: "—"}
												</td>
												<td class="py-3 px-4 text-center font-mono tabular-nums">
													<span class="rounded-full bg-muted/60 px-2 py-0.5 font-semibold">
														{st.counts.expectedNext}
													</span>
												</td>
												<td class="py-3 px-4 text-center font-mono tabular-nums">
													<span
														class={`rounded-full px-2 py-0.5 font-bold ${
															st.counts.inStationNow > 0
																? "bg-forest/20 text-forest"
																: "bg-muted/40 text-muted-foreground"
														}`}
													>
														{st.counts.inStationNow}
													</span>
												</td>
												<td class="py-3 px-4 text-center font-mono tabular-nums text-muted-foreground">
													{st.counts.departed}
												</td>
												<td class="py-3 px-4 text-center font-mono tabular-nums">
													<span
														class={`rounded-full px-2 py-0.5 font-bold ${
															st.counts.stoppedDnf > 0
																? "bg-destructive/15 text-destructive"
																: "text-muted-foreground"
														}`}
													>
														{st.counts.stoppedDnf}
													</span>
												</td>
												<td class="py-3 px-4 text-right space-x-2">
													<Link
														to="/orgs/$slug/event-groups/$eventGroupSlug/stations/$timingPointId"
														params={{
															slug: params().slug,
															eventGroupSlug: params().eventGroupSlug,
															timingPointId: st.timingPoint.id,
														}}
														class={buttonVariants({
															variant: "outline",
															size: "sm",
															class: "text-xs h-7 px-2.5",
														})}
													>
														Board →
													</Link>
													<Link
														to="/orgs/$slug/event-groups/$eventGroupSlug/logger"
														params={{
															slug: params().slug,
															eventGroupSlug: params().eventGroupSlug,
														}}
														search={{ station: st.timingPoint.code }}
														class={buttonVariants({
															variant: "sage",
															size: "sm",
															class: "text-xs h-7 px-2",
														})}
														title="Launch Field Logger for this station"
													>
														⏱️
													</Link>
												</td>
											</tr>
										)}
									</For>
								</Show>
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
