import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { z } from "zod";
import DateBlock from "~/components/DateBlock";
import FormSelect from "~/components/FormSelect";
import UpcomingEventRow from "~/components/UpcomingEventRow";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatStartsIn } from "~/lib/events";
import { getPublicEventsDirectory } from "~/public/public.functions";
import {
	DISCIPLINE_META,
	PUBLIC_DISCIPLINES,
	type PublicDiscipline,
} from "~/public/public.shared";

const eventsSearchSchema = z.object({
	q: z.string().optional(),
	discipline: z.enum(PUBLIC_DISCIPLINES).optional(),
	tab: z.enum(["all", "live", "upcoming", "past"]).optional(),
});

export const Route = createFileRoute("/events/")({
	validateSearch: (search) => eventsSearchSchema.parse(search),
	loader: () => getPublicEventsDirectory({ data: {} }),
	component: EventsDirectoryPage,
});

const disciplineOptions = [
	{ value: "all", label: "All disciplines" },
	...PUBLIC_DISCIPLINES.map((d) => ({
		value: d,
		label: DISCIPLINE_META[d].label,
	})),
];

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

function EventsDirectoryPage() {
	const data = Route.useLoaderData();
	const search = Route.useSearch();

	const [query, setQuery] = createSignal(search().q ?? "");
	const [discipline, setDiscipline] = createSignal<string>(
		search().discipline ?? "all",
	);
	const [activeTab, setActiveTab] = createSignal<
		"all" | "live" | "upcoming" | "past"
	>(search().tab ?? "all");

	const now = () => new Date(data().nowIso);

	const filteredGroups = () => {
		const q = query().trim().toLowerCase();
		const disc = discipline();
		const tab = activeTab();

		return data().groups.filter((g) => {
			if (tab !== "all" && g.temporalState !== tab) return false;
			if (disc !== "all" && g.discipline !== (disc as PublicDiscipline)) {
				return false;
			}
			if (q) {
				const hay =
					`${g.name} ${g.slug} ${g.location} ${g.organizationName}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			return true;
		});
	};

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Public Directory</p>
			<h1 class="page-title">Events &amp; Official Results</h1>
			<p class="page-sub mb-12">
				Browse live races, upcoming events, and official results across all
				disciplines.
			</p>

			{/* 1. Two-Column Highlights: Upcoming Events + Recent Official Results */}
			<div class="mb-16 grid grid-cols-1 gap-x-8 gap-y-12 lg:grid-cols-2">
				<section id="upcoming" class="scroll-mt-28">
					<SectionHeading label="Calendar" title="Upcoming Events" />
					<Card class="px-6 py-2">
						<Show
							when={data().upcomingGroups.length > 0}
							fallback={
								<p class="py-8 text-center text-sm text-muted-foreground">
									No upcoming events scheduled.
								</p>
							}
						>
							<ul class="m-0 list-none divide-y divide-border p-0">
								<For each={data().upcomingGroups}>
									{(group) => <UpcomingEventRow group={group} now={now()} />}
								</For>
							</ul>
						</Show>
					</Card>
				</section>

				<section id="results" class="scroll-mt-28">
					<SectionHeading label="Standings" title="Recent Official Results" />
					<Card class="px-6 py-2">
						<Show
							when={data().recentCompletedGroups.length > 0}
							fallback={
								<p class="py-8 text-center text-sm text-muted-foreground">
									No completed results yet.
								</p>
							}
						>
							<ul class="m-0 list-none divide-y divide-border p-0">
								<For each={data().recentCompletedGroups}>
									{(group) => {
										const disc = DISCIPLINE_META[group.discipline];
										const startDate = new Date(group.startDate);
										return (
											<li class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
												<div class="flex min-w-0 flex-1 items-center gap-4">
													<DateBlock
														date={startDate}
														timeZone={group.timeZone}
													/>
													<div class="min-w-0 flex-1">
														<h3 class="font-display m-0 truncate text-xl font-normal text-foreground">
															<Link
																to="/events/$slug/results"
																params={{ slug: group.slug }}
																class="text-foreground no-underline hover:text-forest"
															>
																{group.name}
															</Link>
														</h3>
														<p class="m-0 mt-0.5 text-sm text-muted-foreground">
															{disc.shortLabel} · {group.location}
														</p>
													</div>
												</div>
												<span class="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
													{group.counts.finished} finishers
												</span>
											</li>
										);
									}}
								</For>
							</ul>
						</Show>
					</Card>
				</section>
			</div>

			{/* 2. Search & Filterable Directory */}
			<section aria-label="All events directory">
				<SectionHeading label="Directory" title="All Events" />

				<Card class="mb-8 p-5 sm:p-6">
					<div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:items-end">
						<div class="grid gap-2">
							<label
								for="events-search-input"
								class="text-sm font-medium text-foreground"
							>
								Search events, locations, or organizers
							</label>
							<Input
								id="events-search-input"
								type="search"
								value={query()}
								onInput={(e) => setQuery(e.currentTarget.value)}
								placeholder="Search by race name, city, or organization…"
							/>
						</div>

						<FormSelect
							label="Discipline"
							options={disciplineOptions}
							value={discipline()}
							onChange={(v) => setDiscipline(v)}
						/>
					</div>
				</Card>

				<Tabs
					value={activeTab()}
					onChange={(val) =>
						setActiveTab(val as "all" | "live" | "upcoming" | "past")
					}
				>
					<TabsList class="mb-6 flex w-full flex-wrap sm:w-auto">
						<TabsTrigger value="all">
							All ({data().countsByTab.all})
						</TabsTrigger>
						<TabsTrigger value="live">
							Live ({data().countsByTab.live})
						</TabsTrigger>
						<TabsTrigger value="upcoming">
							Upcoming ({data().countsByTab.upcoming})
						</TabsTrigger>
						<TabsTrigger value="past">
							Past ({data().countsByTab.past})
						</TabsTrigger>
					</TabsList>

					<TabsContent value={activeTab()}>
						<Show
							when={filteredGroups().length > 0}
							fallback={
								<Card class="p-10 text-center">
									<h2 class="font-display m-0 text-2xl font-normal text-foreground">
										No matching events found
									</h2>
									<p class="m-0 mt-2 text-sm text-muted-foreground">
										Try clearing your search query or switching to All
										disciplines.
									</p>
									<div class="mt-4">
										<Button
											variant="outline"
											size="sm"
											onClick={() => {
												setQuery("");
												setDiscipline("all");
												setActiveTab("all");
											}}
										>
											Reset filters
										</Button>
									</div>
								</Card>
							}
						>
							<Card class="px-6 py-2">
								<ul class="m-0 list-none divide-y divide-border p-0">
									<For each={filteredGroups()}>
										{(group) => {
											const disc = DISCIPLINE_META[group.discipline];
											const startDate = new Date(group.startDate);
											return (
												<li class="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
													<div class="flex min-w-0 flex-1 items-center gap-4">
														<DateBlock
															date={startDate}
															timeZone={group.timeZone}
														/>
														<div class="min-w-0 flex-1">
															<div class="flex flex-wrap items-center gap-2">
																<h2 class="font-display m-0 text-2xl font-normal text-foreground">
																	<Link
																		to="/events/$slug"
																		params={{ slug: group.slug }}
																		class="text-foreground no-underline hover:text-forest"
																	>
																		{group.name}
																	</Link>
																</h2>
																<Show when={group.temporalState === "live"}>
																	<Badge variant="clay">Live now</Badge>
																</Show>
																<Badge variant={disc.badgeVariant}>
																	{disc.shortLabel}
																</Badge>
															</div>

															<p class="m-0 mt-0.5 text-sm text-muted-foreground">
																{group.location} ·{" "}
																<Link
																	to="/organizers/$slug"
																	params={{ slug: group.organizationSlug }}
																	class="text-muted-foreground hover:text-forest"
																>
																	{group.organizationName}
																</Link>
															</p>
														</div>
													</div>

													<div class="shrink-0 text-sm font-medium tabular-nums text-muted-foreground sm:text-right">
														{group.temporalState === "live"
															? `${group.counts.onCourse} on course`
															: group.temporalState === "upcoming"
																? formatStartsIn(startDate, now())
																: `${group.counts.finished} finishers`}
													</div>
												</li>
											);
										}}
									</For>
								</ul>
							</Card>
						</Show>
					</TabsContent>
				</Tabs>
			</section>
		</main>
	);
}
