import { createFileRoute, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import { ORG_ROLE_LABELS, parseOrgRoles } from "~/auth/access";
import EmptyState from "~/components/EmptyState";
import OrgSection from "~/components/OrgSection";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { getMyOrganizations } from "~/orgs/orgs.functions";
import { STAFF_ROLE_LABELS } from "~/orgs/orgs.shared";

export const Route = createFileRoute("/_authed/orgs/")({
	loader: () => getMyOrganizations(),
	component: Organizations,
});

const cardLink =
	"group block rounded-lg no-underline focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/40";

function Organizations() {
	const data = Route.useLoaderData();

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Organizations</p>
			<h1 class="page-title">Your organizations</h1>
			<p class="page-sub">
				An organization holds your event groups, courses, timing points and the
				people who run them.
			</p>

			<div class="flex flex-col gap-16">
				<Show
					when={data().memberships.length > 0}
					fallback={
						<EmptyState
							title="No organizations yet"
							description="Create one for the club, series or company that puts on your races. You'll be its owner."
						>
							<Button as={Link} to="/orgs/new">
								New organization
							</Button>
						</EmptyState>
					}
				>
					<section>
						<div class="mb-8">
							<Button as={Link} to="/orgs/new">
								New organization
							</Button>
						</div>
						<ul class="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2">
							<For each={data().memberships}>
								{(org) => (
									<li>
										<Link
											to="/orgs/$slug"
											params={{ slug: org.slug }}
											class={cardLink}
										>
											<Card class="p-6 group-hover:border-forest/40">
												<h2 class="font-display m-0 text-2xl font-normal text-foreground">
													{org.name}
												</h2>
												<p class="m-0 mt-1 text-sm text-muted-foreground">
													/orgs/{org.slug}
												</p>
												<div class="mt-5 flex flex-wrap gap-1">
													<For each={parseOrgRoles(org.role)}>
														{(role) => (
															<Badge variant="forest">
																{ORG_ROLE_LABELS[role]}
															</Badge>
														)}
													</For>
												</div>
											</Card>
										</Link>
									</li>
								)}
							</For>
						</ul>
					</section>
				</Show>

				<Show when={data().staffing.length > 0}>
					<OrgSection
						title="Your staffing"
						description="Event groups where an organizer rostered you."
					>
						<ul class="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2">
							<For each={data().staffing}>
								{(staff) => (
									<li>
										<Link
											to="/event-groups/$eventGroupId"
											params={{ eventGroupId: staff.eventGroupId }}
											class={cardLink}
										>
											<Card class="p-6 group-hover:border-forest/40">
												<h3 class="font-display m-0 text-xl font-normal text-foreground">
													{staff.eventGroupName}
												</h3>
												<p class="m-0 mt-1 text-sm text-muted-foreground">
													{staff.organizationName}
												</p>
												<div class="mt-5 flex flex-wrap gap-1">
													<For each={staff.roles}>
														{(role) => (
															<Badge variant="sage">
																{STAFF_ROLE_LABELS[role]}
															</Badge>
														)}
													</For>
												</div>
											</Card>
										</Link>
									</li>
								)}
							</For>
						</ul>
					</OrgSection>
				</Show>
			</div>
		</main>
	);
}
