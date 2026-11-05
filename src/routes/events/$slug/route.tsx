import { createFileRoute, Link, Outlet } from "@tanstack/solid-router";
import { For } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { getPublicEventGroupBySlug } from "~/public/public.functions";
import { DISCIPLINE_META } from "~/public/public.shared";

export const Route = createFileRoute("/events/$slug")({
	loader: ({ params }) =>
		getPublicEventGroupBySlug({ data: { slug: params.slug } }),
	component: EventGroupLayout,
	notFoundComponent: EventGroupNotFound,
});

const subNavItems = [
	{ to: "/events/$slug", label: "Overview", exact: true },
	{ to: "/events/$slug/entrants", label: "Entrants" },
	{ to: "/events/$slug/results", label: "Results & Splits" },
	{ to: "/events/$slug/course", label: "Course & Cutoffs" },
	{ to: "/events/$slug/crew", label: "Crew Access" },
] as const;

function EventGroupLayout() {
	const data = Route.useLoaderData();
	const params = Route.useParams();

	const group = () => data().eventGroup;
	const disc = () => DISCIPLINE_META[group().discipline];

	const formatStartEnd = () => {
		const start = new Date(group().startDate);
		return new Intl.DateTimeFormat("en-US", {
			timeZone: group().timeZone,
			month: "short",
			day: "numeric",
			year: "numeric",
		}).format(start);
	};

	return (
		<main class="page-wrap pb-24 pt-12">
			<div class="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
				<Link
					to="/events"
					class="text-scrim font-semibold text-forest no-underline hover:underline"
				>
					&larr; Events
				</Link>
			</div>

			<div class="mb-2 flex flex-wrap items-center gap-2.5">
				<Badge
					variant={
						group().temporalState === "live"
							? "clay"
							: group().temporalState === "upcoming"
								? "forest"
								: "sage"
					}
				>
					{group().temporalState === "live"
						? "Live now"
						: group().temporalState === "upcoming"
							? "Upcoming"
							: "Official results"}
				</Badge>
				<Badge variant={disc().badgeVariant}>{disc().label}</Badge>
			</div>

			<h1 class="page-title mb-2">{group().name}</h1>
			<p class="page-sub mb-6">
				{formatStartEnd()} · {group().location} · Organized by{" "}
				<Link
					to="/organizers/$slug"
					params={{ slug: group().organization.slug }}
					class="font-semibold text-forest hover:underline"
				>
					{group().organization.name}
				</Link>
			</p>

			<nav
				aria-label="Event group sections"
				class="mb-10 border-b border-border/80 pb-3 pt-2"
			>
				<div class="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
					<For each={subNavItems}>
						{(item) => (
							<Link
								to={item.to}
								params={{ slug: params().slug }}
								activeOptions={{ exact: "exact" in item }}
								class="nav-link whitespace-nowrap"
								activeProps={{ class: "nav-link is-active whitespace-nowrap" }}
							>
								{item.label}
							</Link>
						)}
					</For>
				</div>
			</nav>

			<Outlet />
		</main>
	);
}

function EventGroupNotFound() {
	const params = Route.useParams();
	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Event Group</p>
			<h1 class="page-title">Event not found</h1>
			<p class="page-sub">
				No public event group exists with slug "{params().slug}".
			</p>
			<Link to="/events" class={buttonVariants({ variant: "outline" })}>
				Back to Events Directory
			</Link>
		</main>
	);
}
