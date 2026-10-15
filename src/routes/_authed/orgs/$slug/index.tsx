import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import DateBlock from "~/components/DateBlock";
import EmptyState from "~/components/EmptyState";
import OrgSection from "~/components/OrgSection";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { disciplineLabels, formatStartsIn } from "~/lib/events";

export const Route = createFileRoute("/_authed/orgs/$slug/")({
	component: Overview,
});

const orgRoute = getRouteApi("/_authed/orgs/$slug");

const setupSteps = [
	{
		to: "/orgs/$slug/timing-points",
		title: "Place timing points",
		desc: "The aid stations and road crossings where volunteers log times.",
	},
	{
		to: "/orgs/$slug/event-groups",
		title: "Create an event group",
		desc: "A race weekend, with each distance as an event inside it.",
	},
	{
		to: "/orgs/$slug/members",
		title: "Invite your team",
		desc: "Admins and race directors to help set up, stewards to run timing.",
	},
] as const;

function Overview() {
	const data = orgRoute.useLoaderData();
	const params = orgRoute.useParams();

	const upcoming = () =>
		data()
			.eventGroups.filter((group) => group.startDate > data().now)
			.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

	const stats = () =>
		[
			["Event groups", data().eventGroups.length],
			["Upcoming", upcoming().length],
			["Timing points", data().timingPoints.length],
			["Members", data().members.length],
		] as const;

	return (
		<div class="flex flex-col gap-16">
			<ul class="m-0 grid list-none grid-cols-2 gap-6 p-0 lg:grid-cols-4">
				<For each={stats()}>
					{([label, value]) => (
						<li>
							<Card class="p-5">
								<p class="font-display m-0 text-5xl leading-none tabular-nums text-foreground">
									{value}
								</p>
								<p class="m-0 mt-2 text-sm text-muted-foreground">{label}</p>
							</Card>
						</li>
					)}
				</For>
			</ul>

			<Show
				when={data().eventGroups.length > 0}
				fallback={
					<Show
						when={data().can.createEventGroup}
						fallback={
							<EmptyState
								title="No event groups yet"
								description="Race directors and admins set these up. They'll show here once they do."
							/>
						}
					>
						<OrgSection
							title="Get set up"
							description="Three steps before your first race day."
						>
							<Card class="p-6">
								<ol class="m-0 flex list-none flex-col gap-5 p-0">
									<For each={setupSteps}>
										{(step, i) => (
											<li class="flex gap-4">
												<span class="font-display text-2xl leading-none tabular-nums text-clay">
													{i() + 1}
												</span>
												<div>
													<Link
														to={step.to}
														params={{ slug: params().slug }}
														class="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
													>
														{step.title}
													</Link>
													<p class="m-0 mt-1 text-sm text-muted-foreground">
														{step.desc}
													</p>
												</div>
											</li>
										)}
									</For>
								</ol>
							</Card>
						</OrgSection>
					</Show>
				}
			>
				<OrgSection
					title="Next up"
					action={
						<Link
							to="/orgs/$slug/event-groups"
							params={{ slug: params().slug }}
							class={buttonVariants({ variant: "outline" })}
						>
							All event groups
						</Link>
					}
				>
					<Show
						when={upcoming().length > 0}
						fallback={
							<p class="text-scrim m-0 text-sm text-muted-foreground">
								Nothing scheduled.
							</p>
						}
					>
						<Card class="px-6 py-2">
							<ul class="m-0 list-none divide-y divide-border p-0">
								<For each={upcoming()}>
									{(group) => (
										<li class="flex items-center gap-5 py-4">
											<DateBlock date={group.startDate} timeZone="UTC" />
											<div class="min-w-0 flex-1">
												<Link
													to="/event-groups/$eventGroupId"
													params={{ eventGroupId: group.id }}
													class="font-display text-xl text-foreground underline-offset-4 hover:underline"
												>
													{group.name}
												</Link>
												<p class="m-0 mt-0.5 text-sm text-muted-foreground">
													{disciplineLabels[group.discipline]}
												</p>
											</div>
											<span class="hidden shrink-0 text-sm text-muted-foreground sm:block">
												{formatStartsIn(group.startDate, data().now)}
											</span>
										</li>
									)}
								</For>
							</ul>
						</Card>
					</Show>
				</OrgSection>
			</Show>
		</div>
	);
}
