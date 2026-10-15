import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import OrgSection from "~/components/OrgSection";
import UpcomingEventRow from "~/components/UpcomingEventRow";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

export const Route = createFileRoute("/orgs/$orgSlug/")({
	component: Overview,
});

const orgRoute = getRouteApi("/orgs/$orgSlug");

const setupSteps = [
	{
		to: "/orgs/$orgSlug/courses",
		title: "Add your courses",
		desc: "Distances and climbing, reused from year to year.",
	},
	{
		to: "/orgs/$orgSlug/timing-points",
		title: "Place timing points",
		desc: "The aid stations and road crossings where volunteers log times.",
	},
	{
		to: "/orgs/$orgSlug/event-groups",
		title: "Create an event group",
		desc: "A race weekend, with each distance as an event inside it.",
	},
	{
		to: "/orgs/$orgSlug/members",
		title: "Invite your team",
		desc: "Admins to help set up, volunteers to run the checkpoints.",
	},
] as const;

function Overview() {
	const data = orgRoute.useLoaderData();
	const params = orgRoute.useParams();

	const upcoming = () =>
		data()
			.org.eventGroups.filter((group) => group.startDate > data().now)
			.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

	const stats = () =>
		[
			["Event groups", data().org.eventGroups.length],
			["Upcoming", upcoming().length],
			["Courses", data().org.courses.length],
			["Members", data().org.members.length],
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
				when={data().org.eventGroups.length > 0}
				fallback={
					<OrgSection
						title="Get set up"
						description="Four steps before your first race day."
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
													params={{ orgSlug: params().orgSlug }}
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
				}
			>
				<OrgSection
					title="Next up"
					action={
						<Link
							to="/orgs/$orgSlug/event-groups"
							params={{ orgSlug: params().orgSlug }}
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
										<UpcomingEventRow group={group} now={data().now} />
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
