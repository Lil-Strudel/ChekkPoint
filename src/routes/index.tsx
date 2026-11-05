import { createFileRoute, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import DateBlock from "~/components/DateBlock";
import LiveEventCard from "~/components/LiveEventCard";
import OmniboxSearch from "~/components/OmniboxSearch";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { formatStartsIn } from "~/lib/events";
import { getPublicHomeData } from "~/public/public.functions";
import { DISCIPLINE_META } from "~/public/public.shared";

export const Route = createFileRoute("/")({
	loader: () => getPublicHomeData(),
	component: HomePortal,
});

function SectionHeading(props: { label?: string; title: string }) {
	return (
		<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
			<div>
				<Show when={props.label}>
					<p class="page-label mb-1.5">{props.label}</p>
				</Show>
				<h2 class="font-display text-scrim m-0 text-3xl font-normal text-foreground">
					{props.title}
				</h2>
			</div>
		</div>
	);
}

const personaCallouts = [
	{
		title: "For Organizers",
		description:
			"Multi-discipline race timing, cutoff tracking, and runner accountability.",
		href: "/for-organizers",
	},
	{
		title: "For Volunteers",
		description:
			"Offline checkpoint entry and radio-ready split logging for remote stations.",
		href: "/for-volunteers",
	},
	{
		title: "For Athletes",
		description:
			"Lifetime race history, course pace calculators, and crew access boards.",
		href: "/for-athletes",
	},
] as const;

function HomePortal() {
	const data = Route.useLoaderData();
	const now = () => new Date(data().nowIso);

	return (
		<main class="page-wrap pb-24 pt-16">
			{/* 1. Omnibox Discovery Hero & Live Radar */}
			<section class="mb-20 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
				<div class="pt-2">
					<p class="page-label">Endurance Race Timing &amp; Results</p>
					<h1 class="page-title">Every checkpoint, accounted for.</h1>
					<p class="page-sub mb-6">
						Live splits, official results, and course pacing for backcountry
						endurance events.
					</p>

					<OmniboxSearch />
				</div>

				{/* Live Now Radar or Next Broadcast Fallback */}
				<div>
					<Show
						when={data().liveGroups.length > 0}
						fallback={
							<Show when={data().nextBroadcast}>
								{(next) => (
									<Card class="flex flex-col gap-4 border-border p-6">
										<div class="flex items-center justify-between gap-2">
											<span class="text-xs font-bold uppercase tracking-widest text-forest">
												Next Broadcast
											</span>
											<Badge variant="forest">
												{formatStartsIn(new Date(next().startDate), now())}
											</Badge>
										</div>
										<div class="flex items-center gap-4">
											<DateBlock
												date={new Date(next().startDate)}
												timeZone={next().timeZone}
											/>
											<div class="min-w-0">
												<h2 class="font-display m-0 text-2xl font-normal text-foreground">
													<Link
														to="/events/$slug"
														params={{ slug: next().slug }}
														class="text-foreground no-underline hover:text-forest"
													>
														{next().name}
													</Link>
												</h2>
												<p class="m-0 mt-0.5 text-sm text-muted-foreground">
													{DISCIPLINE_META[next().discipline].shortLabel} ·{" "}
													{next().location}
												</p>
											</div>
										</div>
									</Card>
								)}
							</Show>
						}
					>
						<div class="flex flex-col gap-5">
							<For each={data().liveGroups}>
								{(live) => <LiveEventCard group={live} now={now()} />}
							</For>
						</div>
					</Show>
				</div>
			</section>

			{/* 2. Bottom Persona Callout Strip */}
			<section aria-label="Platform overview by role">
				<SectionHeading
					label="Platform"
					title="Built for backcountry operations."
				/>
				<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
					<For each={personaCallouts}>
						{(card) => (
							<Card class="flex flex-col justify-between gap-4 p-6">
								<div>
									<h3 class="font-display m-0 text-2xl font-normal text-foreground">
										{card.title}
									</h3>
									<p class="m-0 mt-1.5 text-sm leading-relaxed text-muted-foreground">
										{card.description}
									</p>
								</div>
								<Link
									to={card.href}
									class="text-sm font-semibold text-forest no-underline hover:underline"
								>
									Learn more &rarr;
								</Link>
							</Card>
						)}
					</For>
				</div>
			</section>
		</main>
	);
}
