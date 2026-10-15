import { createFileRoute, Link, Outlet } from "@tanstack/solid-router";
import { For } from "solid-js";
import { ORG_ROLE_LABELS } from "~/auth/access";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { getOrganization } from "~/orgs/orgs.functions";

export const Route = createFileRoute("/_authed/orgs/$slug")({
	loader: async ({ params }) => ({
		now: new Date(),
		...(await getOrganization({ data: { slug: params.slug } })),
	}),
	component: OrgLayout,
	notFoundComponent: OrgNotFound,
});

const sections = [
	{ to: "/orgs/$slug", label: "Overview", exact: true },
	{ to: "/orgs/$slug/event-groups", label: "Event groups" },
	{ to: "/orgs/$slug/events", label: "Events" },
	{ to: "/orgs/$slug/courses", label: "Courses" },
	{ to: "/orgs/$slug/timing-points", label: "Timing points" },
	{ to: "/orgs/$slug/members", label: "Members" },
	{ to: "/orgs/$slug/settings", label: "Settings" },
] as const;

function OrgLayout() {
	const data = Route.useLoaderData();
	const params = Route.useParams();

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Organization</p>
			<h1 class="page-title">{data().organization.name}</h1>
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-scrim text-sm text-muted-foreground">Your roles</span>
				<For each={data().myRoles}>
					{(role) => <Badge variant="forest">{ORG_ROLE_LABELS[role]}</Badge>}
				</For>
			</div>

			<nav aria-label="Organization" class="mb-12 pt-8">
				<div class="flex flex-wrap gap-x-6 gap-y-4 text-sm font-semibold">
					<For each={sections}>
						{(section) => (
							<Link
								to={section.to}
								params={{ slug: params().slug }}
								activeOptions={{ exact: "exact" in section }}
								class="nav-link whitespace-nowrap"
								activeProps={{ class: "nav-link is-active whitespace-nowrap" }}
							>
								{section.label}
							</Link>
						)}
					</For>
				</div>
			</nav>

			<Outlet />
		</main>
	);
}

function OrgNotFound() {
	const params = Route.useParams();

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Organization</p>
			<h1 class="page-title">Nothing here</h1>
			<p class="page-sub">
				There's no organization at /orgs/{params().slug}, or you're not a member
				of it.
			</p>
			<Button as={Link} to="/orgs" variant="outline">
				Your organizations
			</Button>
		</main>
	);
}
