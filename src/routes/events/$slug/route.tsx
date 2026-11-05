import { createFileRoute, Link, Outlet } from "@tanstack/solid-router";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import EntrantTelemetryView, {
	getFollowedBibs,
	toggleFollowBib,
} from "~/components/EntrantTelemetryView";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/components/ui/sheet";
import { getPublicEventGroupBySlug } from "~/public/public.functions";
import { DISCIPLINE_META } from "~/public/public.shared";
import { getStaffPortalBridge } from "~/race-control/race-control.functions";

export const Route = createFileRoute("/events/$slug")({
	loader: async ({ params }) => {
		const [publicData, staffBridge] = await Promise.all([
			getPublicEventGroupBySlug({ data: { slug: params.slug } }),
			getStaffPortalBridge({ data: { slug: params.slug } }).catch(() => null),
		]);
		return {
			...publicData,
			staffBridge,
		};
	},
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
	const staffBridge = () => data().staffBridge;

	const [followedBibs, setFollowedBibs] = createSignal<string[]>([]);
	const [activeTelemetryEntrantId, setActiveTelemetryEntrantId] = createSignal<
		string | null
	>(null);

	// Sync followed bibs from localStorage
	const refreshFollowed = () => {
		setFollowedBibs(getFollowedBibs(params().slug));
	};

	onMount(() => {
		refreshFollowed();

		const handleWatchlistChange = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail?.slug === params().slug) {
				setFollowedBibs(detail.bibs || []);
			}
		};

		const handleOpenTelemetry = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail?.entrantId) {
				setActiveTelemetryEntrantId(detail.entrantId);
			}
		};

		window.addEventListener("chekkpoint:watchlist-updated", handleWatchlistChange);
		window.addEventListener("chekkpoint:open-telemetry", handleOpenTelemetry);

		onCleanup(() => {
			window.removeEventListener(
				"chekkpoint:watchlist-updated",
				handleWatchlistChange,
			);
			window.removeEventListener(
				"chekkpoint:open-telemetry",
				handleOpenTelemetry,
			);
		});
	});

	const formatStartEnd = () => {
		const start = new Date(group().startDate);
		return new Intl.DateTimeFormat("en-US", {
			timeZone: group().timeZone,
			month: "short",
			day: "numeric",
			year: "numeric",
		}).format(start);
	};

	// Match followed bibs with entrants
	const followedEntrants = () => {
		const bibs = followedBibs();
		if (bibs.length === 0) return [];

		const map = new Map(data().entrants.map((e) => [e.competitorNumber, e]));
		return bibs
			.map((bib) => {
				const ent = map.get(bib);
				return {
					bib,
					entrantId: ent?.id,
					name: ent?.displayName ?? `Bib #${bib}`,
					status: ent?.status ?? "on course",
				};
			})
			.filter(Boolean);
	};

	const handleChipClick = (entrantId?: string) => {
		if (entrantId) {
			setActiveTelemetryEntrantId(entrantId);
		}
	};

	const handleUnfollowChip = (e: MouseEvent, bib: string) => {
		e.stopPropagation();
		toggleFollowBib(params().slug, bib);
	};

	return (
		<main class="page-wrap pb-24 pt-12">
			{/* Contextual Staff Access Banner */}
			<Show when={staffBridge()?.isStaff}>
				<div class="mb-6 rounded-xl border border-forest/30 bg-forest/10 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
					<div class="flex items-center gap-2.5">
						<span class="text-lg">🛡️</span>
						<div>
							<div class="font-bold text-foreground">
								Staff Credentials Detected
							</div>
							<div class="text-muted-foreground">
								You have authorized access to manage race control or record times for {group().name}.
							</div>
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<Link
							to="/orgs/$slug/event-groups/$eventGroupSlug"
							params={{
								slug: staffBridge()!.orgSlug!,
								eventGroupSlug: staffBridge()!.eventGroupSlug!,
							}}
							class={buttonVariants({
								variant: "forest",
								size: "sm",
								class: "text-xs font-semibold gap-1",
							})}
						>
							<span>Open Race Control →</span>
						</Link>

						<Show when={staffBridge()?.stationCode}>
							<Link
								to="/orgs/$slug/event-groups/$eventGroupSlug/logger"
								params={{
									slug: staffBridge()!.orgSlug!,
									eventGroupSlug: staffBridge()!.eventGroupSlug!,
								}}
								class={buttonVariants({
									variant: "outline",
									size: "sm",
									class: "text-xs font-semibold gap-1",
								})}
							>
								<span>Launch My Aid Station Logger ({staffBridge()!.stationCode}) →</span>
							</Link>
						</Show>
					</div>
				</div>
			</Show>

			{/* Pinned "Following (N)" Watchlist Ribbon */}
			<Show when={followedEntrants().length > 0}>
				<div class="mb-6 rounded-xl border border-border bg-card/60 p-3 shadow-xs">
					<div class="flex items-center justify-between gap-2 mb-2">
						<div class="flex items-center gap-2 text-xs font-bold text-foreground">
							<span class="text-forest">★</span>
							<span>Following ({followedEntrants().length})</span>
						</div>
						<span class="text-[10px] text-muted-foreground">
							Saved locally · Click chip for live telemetry
						</span>
					</div>

					<div class="flex flex-wrap gap-2">
						<For each={followedEntrants()}>
							{(item) => (
								<button
									type="button"
									onClick={() => handleChipClick(item.entrantId)}
									class="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-border bg-background hover:border-forest/50 hover:bg-forest/5 text-xs text-foreground cursor-pointer shadow-2xs"
								>
									<span class="font-mono font-bold text-forest tabular-nums">
										#{item.bib}
									</span>
									<span class="font-medium truncate max-w-[120px]">
										{item.name}
									</span>
									<Badge variant="outline" class="text-[9px] py-0 px-1">
										{item.status}
									</Badge>
									<span
										onClick={(e) => handleUnfollowChip(e, item.bib)}
										class="text-muted-foreground hover:text-destructive text-sm leading-none ml-0.5"
										title="Unfollow"
									>
										×
									</span>
								</button>
							)}
						</For>
					</div>
				</div>
			</Show>

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

			{/* Slide-Over Telemetry Sheet */}
			<Sheet
				open={Boolean(activeTelemetryEntrantId())}
				onOpenChange={(open) => {
					if (!open) setActiveTelemetryEntrantId(null);
				}}
			>
				<SheetContent side="right" class="w-full sm:max-w-2xl overflow-y-auto">
					<SheetHeader class="mb-4">
						<SheetTitle>Entrant Live Telemetry</SheetTitle>
						<SheetDescription>
							Unified split times, pacing telemetry, and projected arrival windows.
						</SheetDescription>
					</SheetHeader>
					<Show when={activeTelemetryEntrantId()}>
						<EntrantTelemetryView
							slug={params().slug}
							entrantId={activeTelemetryEntrantId()!}
							isSheet={true}
							onClose={() => setActiveTelemetryEntrantId(null)}
						/>
					</Show>
				</SheetContent>
			</Sheet>
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
