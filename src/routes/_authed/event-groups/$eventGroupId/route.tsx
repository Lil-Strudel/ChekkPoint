import {
	createFileRoute,
	Link,
	notFound,
	Outlet,
} from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import { ORG_ROLE_LABELS } from "~/auth/access";
import { Badge } from "~/components/ui/badge";
import { disciplineLabels } from "~/lib/events";
import { formatDay } from "~/orgs/format";
import { getEventGroup } from "~/orgs/orgs.functions";
import { eventGroupIdInput, STAFF_ROLE_LABELS } from "~/orgs/orgs.shared";

export const Route = createFileRoute("/_authed/event-groups/$eventGroupId")({
	loader: ({ params }) => {
		if (!eventGroupIdInput.safeParse(params).success) throw notFound();
		return getEventGroup({ data: { eventGroupId: params.eventGroupId } });
	},
	notFoundComponent: () => (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Event group</p>
			<h1 class="page-title">Not found</h1>
			<p class="page-sub">It doesn't exist, or you don't have access to it.</p>
		</main>
	),
	component: EventGroupLayout,
});

const sections = [
	{ to: "/event-groups/$eventGroupId", label: "Overview", exact: true },
	{ to: "/event-groups/$eventGroupId/events", label: "Events" },
	{ to: "/event-groups/$eventGroupId/staff", label: "Staff", members: true },
	{ to: "/event-groups/$eventGroupId/timing", label: "Timing" },
] as const;

function EventGroupLayout() {
	const data = Route.useLoaderData();
	const params = Route.useParams();
	const group = () => data().eventGroup;
	const isMember = () => data().access.orgRoles.length > 0;

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">
				<Link to="/orgs/$slug" params={{ slug: group().organizationSlug }}>
					{group().organizationName}
				</Link>
			</p>
			<h1 class="page-title">{group().name}</h1>
			<p class="page-sub">
				{disciplineLabels[group().discipline]} · {formatDay(group().startDate)}
				{group().endDate.getTime() !== group().startDate.getTime() &&
					` – ${formatDay(group().endDate)}`}
				{group().location && ` · ${group().location}`} ·{" "}
				{group().timeZone.replaceAll("_", " ")}
			</p>
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-scrim text-sm text-muted-foreground">
					Your access
				</span>
				<For each={data().access.orgRoles}>
					{(role) => <Badge variant="forest">{ORG_ROLE_LABELS[role]}</Badge>}
				</For>
				<For each={data().access.staffRoles}>
					{(role) => <Badge variant="sage">{STAFF_ROLE_LABELS[role]}</Badge>}
				</For>
			</div>

			<nav aria-label="Event group" class="mb-12 pt-8">
				<div class="flex flex-wrap gap-x-6 gap-y-4 text-sm font-semibold">
					<For each={sections}>
						{(section) => (
							<Show when={!("members" in section) || isMember()}>
								<Link
									to={section.to}
									params={{ eventGroupId: params().eventGroupId }}
									activeOptions={{ exact: "exact" in section }}
									class="nav-link whitespace-nowrap"
									activeProps={{
										class: "nav-link is-active whitespace-nowrap",
									}}
								>
									{section.label}
								</Link>
							</Show>
						)}
					</For>
				</div>
			</nav>

			<Outlet />
		</main>
	);
}
