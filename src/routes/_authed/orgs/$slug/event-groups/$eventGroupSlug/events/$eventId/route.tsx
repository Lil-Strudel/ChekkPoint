import {
	createFileRoute,
	Link,
	Outlet,
	useLocation,
} from "@tanstack/solid-router";
import { Badge } from "~/components/ui/badge";
import { getSubEventOverview } from "~/race-control/race-control.functions";

export const Route = createFileRoute(
	"/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId",
)({
	loader: ({ params }) =>
		getSubEventOverview({
			data: {
				slug: params.slug,
				eventGroupSlug: params.eventGroupSlug,
				eventId: params.eventId,
			},
		}),
	component: SubEventShellLayout,
	notFoundComponent: SubEventNotFound,
});

function SubEventShellLayout() {
	const data = Route.useLoaderData();
	const params = Route.useParams();
	const location = useLocation();

	const event = () => data().event;
	const eventGroup = () => data().eventGroup;
	const custody = () => data().custody;

	const basePath = () =>
		`/orgs/${params().slug}/event-groups/${params().eventGroupSlug}/events/${params().eventId}`;

	const isOverviewActive = () => {
		const path = location().pathname;
		return path === basePath() || path === `${basePath()}/`;
	};

	const isCourseActive = () => location().pathname.endsWith("/course");
	const isEntrantsActive = () => location().pathname.endsWith("/entrants");
	const isSarActive = () => location().pathname.endsWith("/sar");
	const isAuditActive = () => location().pathname.endsWith("/audit");

	return (
		<div class="flex flex-col min-h-full w-full bg-background text-foreground">
			{/* Sub-Event Header Strip */}
			<div class="border-b border-border bg-card/15 px-6 py-4">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<div class="flex items-center gap-2 text-xs text-muted-foreground mb-1">
							<Link
								to="/orgs/$slug/event-groups/$eventGroupSlug"
								params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
								class="hover:text-foreground hover:underline font-medium"
							>
								← {eventGroup().name}
							</Link>
							<span>/</span>
							<span class="text-foreground font-semibold">{event().name}</span>
						</div>

						<div class="flex items-center gap-3">
							<h2 class="text-xl font-bold font-serif text-foreground">
								{event().name}
							</h2>
							<Badge
								variant={event().actualStartIso ? "clay" : "forest"}
								class="text-xs"
							>
								{event().actualStartIso ? "Racing Now" : "Pre-Race"}
							</Badge>
						</div>
					</div>

					<div class="flex items-center gap-4 text-xs font-mono tabular-nums text-muted-foreground">
						<div>
							Field: <span class="font-bold text-foreground">{custody().total}</span>
						</div>
						<div>
							Checked In:{" "}
							<span class="font-bold text-forest">{custody().checkedIn}</span>
						</div>
						<div>
							On Course:{" "}
							<span class="font-bold text-primary">{custody().inProgress}</span>
						</div>
					</div>
				</div>

				{/* Contextual 5-Tab Bar */}
				<nav
					aria-label="Sub-Event sections"
					class="mt-4 flex items-center gap-2 border-b border-border/80 pb-0 text-xs font-semibold overflow-x-auto"
				>
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId"
						params={{
							slug: params().slug,
							eventGroupSlug: params().eventGroupSlug,
							eventId: params().eventId,
						}}
						class={`px-3 pb-2.5 transition-colors cursor-pointer ${
							isOverviewActive()
								? "text-foreground border-b-2 border-forest font-bold"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Overview & Gun Start
					</Link>

					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/course"
						params={{
							slug: params().slug,
							eventGroupSlug: params().eventGroupSlug,
							eventId: params().eventId,
						}}
						class={`px-3 pb-2.5 transition-colors cursor-pointer ${
							isCourseActive()
								? "text-foreground border-b-2 border-forest font-bold"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Course & Cutoffs
					</Link>

					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/entrants"
						params={{
							slug: params().slug,
							eventGroupSlug: params().eventGroupSlug,
							eventId: params().eventId,
						}}
						class={`px-3 pb-2.5 transition-colors cursor-pointer ${
							isEntrantsActive()
								? "text-foreground border-b-2 border-forest font-bold"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Entrants & Check-In Desk
					</Link>

					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/sar"
						params={{
							slug: params().slug,
							eventGroupSlug: params().eventGroupSlug,
							eventId: params().eventId,
						}}
						class={`px-3 pb-2.5 transition-colors cursor-pointer ${
							isSarActive()
								? "text-foreground border-b-2 border-forest font-bold"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Live Progress & SAR
					</Link>

					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/audit"
						params={{
							slug: params().slug,
							eventGroupSlug: params().eventGroupSlug,
							eventId: params().eventId,
						}}
						class={`px-3 pb-2.5 transition-colors cursor-pointer ${
							isAuditActive()
								? "text-foreground border-b-2 border-forest font-bold"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Results, Audit & Exports
					</Link>
				</nav>
			</div>

			<div class="flex-1 w-full">
				<Outlet />
			</div>
		</div>
	);
}

function SubEventNotFound() {
	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Sub-Event Workspace</p>
			<h1 class="page-title">Sub-Event Not Found</h1>
			<p class="page-sub">This sub-event distance does not exist or you lack credentials.</p>
		</main>
	);
}
