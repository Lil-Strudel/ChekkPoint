import { createFileRoute, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import DateBlock from "~/components/DateBlock";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { getPublicOrganizerBySlug } from "~/public/public.functions";
import {
	DISCIPLINE_META,
	formatDistanceMiles,
	formatElevationFeet,
} from "~/public/public.shared";

export const Route = createFileRoute("/organizers/$slug")({
	loader: ({ params }) =>
		getPublicOrganizerBySlug({ data: { slug: params.slug } }),
	component: PublicOrganizerHomePage,
	notFoundComponent: OrganizerNotFound,
});

function PublicOrganizerHomePage() {
	const data = Route.useLoaderData();
	const org = () => data().organization;

	return (
		<main class="page-wrap pb-24 pt-12">
			<div class="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
				<Link
					to="/events"
					class="text-scrim font-semibold text-forest no-underline hover:underline"
				>
					&larr; Events Directory
				</Link>
			</div>

			<div class="mb-2 flex flex-wrap items-center gap-2">
				<Badge variant="forest">Verified Race Organization</Badge>
				<Badge variant="chip">{org().location}</Badge>
				<Show when={org().establishedYear}>
					{(yr) => <Badge variant="sand">Est. {yr()}</Badge>}
				</Show>
			</div>

			<h1 class="page-title mb-2">{org().name}</h1>
			<p class="page-sub mb-8">{org().description}</p>

			{/* Summary Counter Tiles */}
			<section class="mb-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
				<Card class="p-5">
					<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
						Event Groups
					</p>
					<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-foreground">
						{data().counters.eventGroupsCount}
					</p>
					<p class="m-0 mt-1 text-xs text-muted-foreground">
						Live, upcoming &amp; archived
					</p>
				</Card>

				<Card class="p-5">
					<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
						Published Courses
					</p>
					<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-foreground">
						{data().counters.coursesCount}
					</p>
					<p class="m-0 mt-1 text-xs text-muted-foreground">
						With interactive pace calculators
					</p>
				</Card>

				<Card class="p-5">
					<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
						Timing Points
					</p>
					<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-foreground">
						{data().counters.timingPointsCount}
					</p>
					<p class="m-0 mt-1 text-xs text-muted-foreground">
						Physical GPS stations
					</p>
				</Card>

				<Card class="p-5">
					<p class="m-0 text-xs font-bold uppercase tracking-widest text-clay">
						Entrants Timed
					</p>
					<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-clay">
						{data().counters.totalEntrantsTimed}
					</p>
					<p class="m-0 mt-1 text-xs text-muted-foreground">
						On ChekkPoint ledger
					</p>
				</Card>
			</section>

			{/* Live & Upcoming Event Groups */}
			<section class="mb-14">
				<h2 class="font-display text-scrim m-0 mb-4 text-3xl font-normal text-foreground">
					Live &amp; Upcoming Event Groups
				</h2>

				<Show
					when={data().liveAndUpcomingGroups.length > 0}
					fallback={
						<Card class="p-8 text-center text-sm text-muted-foreground">
							No active or upcoming events scheduled at this moment.
						</Card>
					}
				>
					<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
						<For each={data().liveAndUpcomingGroups}>
							{(group) => {
								const disc = DISCIPLINE_META[group.discipline];
								return (
									<Card class="flex flex-col justify-between gap-4 p-6">
										<div class="flex items-start gap-4">
											<DateBlock
												date={new Date(group.startDate)}
												timeZone={group.timeZone}
											/>
											<div>
												<div class="flex flex-wrap items-center gap-2">
													<Badge
														variant={
															group.temporalState === "live" ? "clay" : "forest"
														}
													>
														{group.temporalState === "live"
															? "Live now"
															: "Upcoming"}
													</Badge>
													<Badge variant={disc.badgeVariant}>
														{disc.label}
													</Badge>
												</div>
												<h3 class="font-display m-0 mt-2 text-2xl font-normal text-foreground">
													<Link
														to="/events/$slug"
														params={{ slug: group.slug }}
														class="text-foreground no-underline hover:text-forest"
													>
														{group.name}
													</Link>
												</h3>
												<p class="m-0 mt-1 text-xs text-muted-foreground">
													{group.subEvents.map((s) => s.name).join(" · ")}
												</p>
											</div>
										</div>

										<div class="flex flex-wrap gap-2">
											<Link
												to="/events/$slug"
												params={{ slug: group.slug }}
												class={buttonVariants({ size: "sm" })}
											>
												Event Hub
											</Link>
											<Link
												to="/events/$slug/entrants"
												params={{ slug: group.slug }}
												class={buttonVariants({
													variant: "outline",
													size: "sm",
												})}
											>
												Entrants ({group.counts.totalEntrants})
											</Link>
											<Link
												to="/events/$slug/crew"
												params={{ slug: group.slug }}
												class={buttonVariants({ variant: "ghost", size: "sm" })}
											>
												Crew Access
											</Link>
										</div>
									</Card>
								);
							}}
						</For>
					</div>
				</Show>
			</section>

			{/* Historical Results Archive */}
			<Show when={data().pastGroups.length > 0}>
				<section class="mb-14">
					<h2 class="font-display text-scrim m-0 mb-4 text-3xl font-normal text-foreground">
						Official Results Archive
					</h2>
					<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
						<For each={data().pastGroups}>
							{(group) => {
								const disc = DISCIPLINE_META[group.discipline];
								return (
									<Card class="flex flex-col justify-between gap-4 p-6">
										<div>
											<div class="flex flex-wrap items-center gap-2">
												<Badge variant="sage">Official results</Badge>
												<Badge variant={disc.badgeVariant}>{disc.label}</Badge>
											</div>
											<h3 class="font-display m-0 mt-2 text-2xl font-normal text-foreground">
												<Link
													to="/events/$slug/results"
													params={{ slug: group.slug }}
													class="text-foreground no-underline hover:text-forest"
												>
													{group.name}
												</Link>
											</h3>
											<p class="m-0 mt-1 text-xs tabular-nums text-muted-foreground">
												{group.counts.finished} finishers /{" "}
												{group.counts.totalEntrants} entrants (
												{group.finisherRatePct}% finisher rate)
											</p>
										</div>

										<Show when={group.podium.length > 0}>
											<ul class="m-0 flex list-none flex-col gap-1 rounded-xl border border-border bg-surface/60 p-3 text-xs">
												<For each={group.podium}>
													{(pod) => (
														<li class="flex items-center justify-between gap-2">
															<div>
																<span class="mr-1.5 font-bold tabular-nums text-clay">
																	{pod.place}.
																</span>
																<Link
																	to="/athletes/$personId"
																	params={{ personId: pod.personId }}
																	class="font-semibold text-foreground hover:text-forest"
																>
																	{pod.displayName}
																</Link>
															</div>
															<span class="font-semibold tabular-nums">
																{pod.elapsedFormatted}
															</span>
														</li>
													)}
												</For>
											</ul>
										</Show>

										<div class="flex flex-wrap gap-2">
											<Link
												to="/events/$slug/results"
												params={{ slug: group.slug }}
												class={buttonVariants({ size: "sm" })}
											>
												Full Split Matrix
											</Link>
										</div>
									</Card>
								);
							}}
						</For>
					</div>
				</section>
			</Show>

			{/* Published Courses */}
			<section>
				<h2 class="font-display text-scrim m-0 mb-4 text-3xl font-normal text-foreground">
					Published Courses &amp; Pace Calculators
				</h2>
				<div class="grid grid-cols-1 gap-5 md:grid-cols-3">
					<For each={data().courses}>
						{(c) => (
							<Card class="flex flex-col justify-between gap-4 p-6">
								<div>
									<Badge variant="chip" class="tabular-nums">
										{c.splitCount} checkpoints · {c.eventsCount} event(s)
									</Badge>
									<h3 class="font-display m-0 mt-2 text-2xl font-normal text-foreground">
										<Link
											to="/courses/$courseId"
											params={{ courseId: c.id }}
											class="text-foreground no-underline hover:text-forest"
										>
											{c.name}
										</Link>
									</h3>
									<p class="m-0 mt-1 text-sm tabular-nums text-muted-foreground">
										{formatDistanceMiles(c.distanceMeters)} ·{" "}
										{formatElevationFeet(c.elevationGainMeters)} gain
									</p>
								</div>
								<div>
									<Link
										to="/courses/$courseId"
										params={{ courseId: c.id }}
										class={buttonVariants({ variant: "outline", size: "sm" })}
									>
										Plan My Effort Calculator &rarr;
									</Link>
								</div>
							</Card>
						)}
					</For>
				</div>
			</section>
		</main>
	);
}

function OrganizerNotFound() {
	const params = Route.useParams();
	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Organizer</p>
			<h1 class="page-title">Organization not found</h1>
			<p class="page-sub">
				No public race organization exists with slug "{params().slug}".
			</p>
			<Link to="/events" class={buttonVariants({ variant: "outline" })}>
				Back to Events Directory
			</Link>
		</main>
	);
}
