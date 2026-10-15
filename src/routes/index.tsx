import { createFileRoute, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import LiveEventCard from "~/components/LiveEventCard";
import UpcomingEventRow from "~/components/UpcomingEventRow";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
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

function SectionHeading(props: { title: string }) {
	return (
		<h2 class="font-display text-scrim m-0 mb-5 text-3xl font-normal text-foreground">
			{props.title}
		</h2>
	);
}

function Home() {
	const data = Route.useLoaderData();

	return (
		<main class="page-wrap pb-24 pt-24">
			<section class="mb-28">
				<p class="page-label">Race timing &amp; live tracking</p>
				<h1 class="page-title">Every checkpoint, accounted for.</h1>
				<p class="page-sub">
					Volunteers log times at the aid station, signal or not. Everyone else
					follows along live.
				</p>
				<div class="flex flex-wrap gap-3">
					<Button as="a" href="#live" size="lg">
						Follow a live race
					</Button>
					<Button as={Link} to="/about" variant="outline" size="lg">
						How it works
					</Button>
				</div>
			</section>

			<section id="live" class="mb-20 scroll-mt-28">
				<SectionHeading title="Live now" />
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

			<div class="grid grid-cols-1 gap-x-6 gap-y-20 lg:grid-cols-[minmax(0,1fr)_340px]">
				<section id="upcoming" class="scroll-mt-28">
					<SectionHeading title="Upcoming" />
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
