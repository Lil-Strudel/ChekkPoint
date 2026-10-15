import { createFileRoute, Link } from "@tanstack/solid-router";
import { For } from "solid-js";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { getMyOrgs } from "~/lib/mock-orgs";

export const Route = createFileRoute("/orgs/")({
	loader: () => getMyOrgs(new Date()),
	component: Orgs,
});

const plural = (count: number, noun: string) =>
	`${count} ${noun}${count === 1 ? "" : "s"}`;

function Orgs() {
	const orgs = Route.useLoaderData();

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Organizations</p>
			<h1 class="page-title">Your organizations</h1>
			<p class="page-sub">
				An organization holds your event groups, courses, timing points and the
				people who run them.
			</p>

			<div class="mb-8">
				<Button as={Link} to="/orgs/new">
					New organization
				</Button>
			</div>

			<ul class="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2">
				<For each={orgs()}>
					{(org) => (
						<li>
							<Link
								to="/orgs/$orgSlug"
								params={{ orgSlug: org.slug }}
								class="group block rounded-[20px] no-underline focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/40"
							>
								<Card class="p-6 group-hover:border-forest/40">
									<h2 class="font-display m-0 text-2xl font-normal text-foreground">
										{org.name}
									</h2>
									<p class="m-0 mt-1 text-sm text-muted-foreground">
										/orgs/{org.slug}
									</p>
									<p class="m-0 mt-5 text-sm text-foreground">
										{plural(org.eventGroups.length, "event group")} ·{" "}
										{plural(org.members.length, "member")}
									</p>
								</Card>
							</Link>
						</li>
					)}
				</For>
			</ul>
		</main>
	);
}
