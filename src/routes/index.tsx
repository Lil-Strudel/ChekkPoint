import { createFileRoute, Link } from "@tanstack/solid-router";
import { For, type JSX, Show } from "solid-js";
import LiveEventCard, { LiveIndicator } from "~/components/LiveEventCard";
import UpcomingEventRow from "~/components/UpcomingEventRow";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { formatStartsIn } from "~/lib/events";
import { getHomeEvents } from "~/lib/mock-events";

export const Route = createFileRoute("/")({
	loader: () => getHomeEvents(new Date()),
	component: Home,
});

const steps = [
	[
		"Capture at the checkpoint",
		"Tap first, identify later. Times are kept on the device and sync when signal comes back.",
	],
	[
		"Catch the typos",
		"Bibs are checked against who should be arriving, so 124 never quietly becomes 142.",
	],
	[
		"Publish as it happens",
		"Crews and spectators follow progress and results while the race is still running.",
	],
];

function SectionHeading(props: { title: string; children?: JSX.Element }) {
	return (
		<div class="mb-5 flex items-baseline justify-between gap-4">
			<h2 class="font-display text-scrim m-0 text-3xl font-normal text-foreground">
				{props.title}
			</h2>
			<span class="text-scrim text-sm text-muted-foreground">
				{props.children}
			</span>
		</div>
	);
}

function Home() {
	const data = Route.useLoaderData();
	const onCourse = () =>
		data().live.reduce((sum, group) => sum + group.onCourse, 0);
	const nextUp = () => data().upcoming[0];

	return (
		<main class="page-wrap pb-24 pt-16">
			<section class="mb-20 grid gap-10 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
				<div>
					<p class="page-label">Race timing &amp; live tracking</p>
					<h1 class="page-title">Every checkpoint, accounted for.</h1>
					<p class="page-sub">
						ChekkPoint times trail ultras, gravel and downhill races, and
						regularity rallies. Volunteers log times at the aid station, signal
						or not, and everyone else follows along live.
					</p>
					<div class="flex flex-wrap gap-3">
						<Button as="a" href="#live" size="lg">
							Follow a live race
						</Button>
						<Button as={Link} to="/about" variant="outline" size="lg">
							How it works
						</Button>
					</div>
				</div>

				<Card class="p-6">
					<div class="flex items-center justify-between">
						<h2 class="font-display m-0 text-xl font-normal text-foreground">
							Right now
						</h2>
						<Show when={data().live.length > 0}>
							<LiveIndicator />
						</Show>
					</div>
					<dl class="m-0 mt-5 grid grid-cols-2 gap-5">
						<div>
							<dt class="text-xs text-muted-foreground">Races live</dt>
							<dd class="font-display m-0 mt-1 text-5xl leading-none tabular-nums text-foreground">
								{data().live.length}
							</dd>
						</div>
						<div>
							<dt class="text-xs text-muted-foreground">On course</dt>
							<dd class="font-display m-0 mt-1 text-5xl leading-none tabular-nums text-foreground">
								{onCourse()}
							</dd>
						</div>
						<Show when={nextUp()}>
							{(next) => (
								<div class="col-span-2 border-t border-border pt-4">
									<dt class="text-xs text-muted-foreground">Next start</dt>
									<dd class="m-0 mt-1 text-sm text-foreground">
										<span class="font-semibold">{next().name}</span>{" "}
										<span class="text-muted-foreground">
											{formatStartsIn(next().startDate, data().now)}
										</span>
									</dd>
								</div>
							)}
						</Show>
					</dl>
				</Card>
			</section>

			<section id="live" class="mb-20 scroll-mt-28">
				<SectionHeading title="Live now">
					{data().live.length} races
				</SectionHeading>
				<Show
					when={data().live.length > 0}
					fallback={
						<Card class="p-6 text-sm text-muted-foreground">
							No races on course right now.
						</Card>
					}
				>
					<div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
						<For each={data().live}>
							{(group) => <LiveEventCard group={group} now={data().now} />}
						</For>
					</div>
				</Show>
			</section>

			<div class="grid gap-x-6 gap-y-20 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
				<section id="upcoming" class="scroll-mt-28">
					<SectionHeading title="Upcoming">
						Next {data().upcoming.length}
					</SectionHeading>
					<Card class="px-6 py-2">
						<ul class="m-0 list-none divide-y divide-border p-0">
							<For each={data().upcoming}>
								{(group) => <UpcomingEventRow group={group} now={data().now} />}
							</For>
						</ul>
					</Card>
				</section>

				<section>
					<SectionHeading title="How it works" />
					<Card class="p-6">
						<ol class="m-0 flex list-none flex-col gap-5 p-0">
							<For each={steps}>
								{([title, desc], i) => (
									<li class="flex gap-4">
										<span class="font-display text-2xl leading-none tabular-nums text-clay">
											{i() + 1}
										</span>
										<div>
											<p class="m-0 text-sm font-semibold text-foreground">
												{title}
											</p>
											<p class="m-0 mt-1 text-sm text-muted-foreground">
												{desc}
											</p>
										</div>
									</li>
								)}
							</For>
						</ol>
					</Card>
				</section>
			</div>
		</main>
	);
}
