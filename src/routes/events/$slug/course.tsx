import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
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
	formatDistanceMiles,
	formatDuration,
	formatElevationFeet,
	formatSubSplitKindLabel,
} from "~/public/public.shared";

const parentRoute = getRouteApi("/events/$slug");

export const Route = createFileRoute("/events/$slug/course")({
	component: EventGroupCoursePage,
});

function EventGroupCoursePage() {
	const data = parentRoute.useLoaderData();

	return (
		<div class="flex flex-col gap-10">
			<For each={data().subEvents}>
				{(ev) => {
					const splits = data().splitsByCourse[ev.course.id] ?? [];
					return (
						<section class="flex flex-col gap-5">
							<Card class="flex flex-col justify-between gap-4 border-forest/30 p-6 sm:flex-row sm:items-center">
								<div>
									<div class="flex flex-wrap items-center gap-2">
										<Badge variant="forest">{ev.name}</Badge>
										<Badge variant="chip" class="tabular-nums">
											{formatDistanceMiles(
												ev.course.distanceMeters * ev.lapsRequired,
											)}{" "}
											·{" "}
											{formatElevationFeet(
												ev.course.elevationGainMeters !== null
													? ev.course.elevationGainMeters * ev.lapsRequired
													: null,
											)}{" "}
											gain
										</Badge>
									</div>
									<h2 class="font-display m-0 mt-2 text-2xl font-normal text-foreground sm:text-3xl">
										{ev.course.name}
									</h2>
									<p class="m-0 mt-1 text-sm text-muted-foreground">
										Want to model custom arrival times, day/night transitions,
										and cutoff safety buffers for this course? Use the
										interactive Pace Calculator on the canonical course page.
									</p>
								</div>

								<div class="shrink-0">
									<Link
										to="/courses/$courseId"
										params={{ courseId: ev.course.id }}
										class={buttonVariants({ size: "lg" })}
									>
										Open "Plan My Effort" Pace Calculator &rarr;
									</Link>
								</div>
							</Card>

							<Show
								when={splits.length > 0}
								fallback={
									<Card class="p-8 text-center text-sm text-muted-foreground">
										No public checkpoints published for this course yet.
									</Card>
								}
							>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>#</TableHead>
											<TableHead>Checkpoint / Split</TableHead>
											<TableHead>Timing Point Code</TableHead>
											<TableHead>Cumulative Distance</TableHead>
											<TableHead>Elevation</TableHead>
											<TableHead>Timing Mode</TableHead>
											<TableHead class="text-right">
												Hard Cutoff (From Start)
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										<For each={splits}>
											{(sp) => (
												<TableRow>
													<TableCell class="font-bold tabular-nums text-muted-foreground">
														{sp.sequenceOrder}
													</TableCell>
													<TableCell class="font-semibold text-foreground">
														{sp.name}
													</TableCell>
													<TableCell>
														<code>{sp.timingPointCode}</code>
													</TableCell>
													<TableCell class="tabular-nums">
														{formatDistanceMiles(sp.distanceFromStartMeters)}
													</TableCell>
													<TableCell class="tabular-nums">
														{formatElevationFeet(sp.elevationMeters)}
													</TableCell>
													<TableCell>
														<Badge
															variant={
																sp.subSplitBitmap === 3 ? "forest" : "sand"
															}
														>
															{formatSubSplitKindLabel(sp.subSplitBitmap)}
														</Badge>
													</TableCell>
													<TableCell class="text-right font-semibold tabular-nums">
														{sp.cutoffDurationSeconds
															? formatDuration(sp.cutoffDurationSeconds)
															: "No hard cutoff"}
													</TableCell>
												</TableRow>
											)}
										</For>
									</TableBody>
								</Table>
							</Show>
						</section>
					);
				}}
			</For>
		</div>
	);
}
