import {
	createFileRoute,
	Link,
	notFound,
	Outlet,
} from "@tanstack/solid-router";
import { For } from "solid-js";
import { Button } from "~/components/ui/button";
import { getOrg } from "~/lib/mock-orgs";

export const Route = createFileRoute("/orgs/$orgSlug")({
	loader: ({ params }) => {
		const now = new Date();
		const org = getOrg(params.orgSlug, now);
		if (!org) throw notFound();
		return { now, org };
	},
	component: OrgLayout,
	notFoundComponent: OrgNotFound,
});

const sections = [
	{ to: "/orgs/$orgSlug", label: "Overview", exact: true },
	{ to: "/orgs/$orgSlug/event-groups", label: "Event groups" },
	{ to: "/orgs/$orgSlug/events", label: "Events" },
	{ to: "/orgs/$orgSlug/courses", label: "Courses" },
	{ to: "/orgs/$orgSlug/timing-points", label: "Timing points" },
	{ to: "/orgs/$orgSlug/members", label: "Members" },
	{ to: "/orgs/$orgSlug/settings", label: "Settings" },
] as const;

function OrgLayout() {
	const data = Route.useLoaderData();
	const params = Route.useParams();

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Organization</p>
			<h1 class="page-title">{data().org.name}</h1>

			<nav aria-label="Organization" class="mb-12 pt-4">
				<div class="flex flex-wrap gap-x-6 gap-y-4 text-sm font-semibold">
					<For each={sections}>
						{(section) => (
							<Link
								to={section.to}
								params={{ orgSlug: params().orgSlug }}
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
				There's no organization at /orgs/{params().orgSlug}.
			</p>
			<Button as={Link} to="/orgs" variant="outline">
				Your organizations
			</Button>
		</main>
	);
}
