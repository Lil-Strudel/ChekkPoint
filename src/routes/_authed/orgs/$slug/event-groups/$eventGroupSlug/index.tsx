import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, onCleanup, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatDay } from "~/orgs/format";
import { getWeekendHubOverview } from "~/race-control/race-control.functions";

export const Route = createFileRoute(
	"/_authed/orgs/$slug/event-groups/$eventGroupSlug/",
)({
	loader: ({ params }) =>
		getWeekendHubOverview({
			data: { slug: params.slug, eventGroupSlug: params.eventGroupSlug },
		}),
	component: WeekendOverviewReadinessTab,
});

function formatElapsedSeconds(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function WeekendOverviewReadinessTab() {
	const data = Route.useLoaderData();
	const params = Route.useParams();

	const group = () => data().eventGroup;
	const custody = () => data().combinedCustody;
	const readiness = () => data().readiness;
	const subEvents = () => data().subEvents;

	// Live timer ticker for running gun clocks
	const [now, setNow] = createSignal(new Date());
	const timer = setInterval(() => setNow(new Date()), 1000);
	onCleanup(() => clearInterval(timer));

	return (
		<div class="px-6 py-8 max-w-7xl mx-auto space-y-8">
			{/* Weekend Hub Internal Sub-Nav */}
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div class="flex items-center gap-4 text-xs font-semibold">
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-foreground border-b-2 border-forest pb-3 -mb-3.5 font-bold"
					>
						Weekend Overview & Readiness
					</Link>
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/rules-staff"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
					>
						Discipline Rules & Staff Matrix
					</Link>
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/stations"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
					>
						Stations Cross-Check
					</Link>
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/sar"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
					>
						Net Control & SAR
					</Link>
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/raw-stream"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
					>
						Raw Timing Stream
					</Link>
				</div>
			</div>

			{/* Section 1: Combined Field Custody KPIs */}
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-lg font-bold font-serif text-foreground">
							Combined Field Custody
						</h2>
						<p class="text-xs text-muted-foreground">
							Live aggregate custody across all {subEvents().length} sub-event distances.
						</p>
					</div>

					<div class="text-xs text-muted-foreground">
						Total Field:{" "}
						<span class="font-bold text-foreground tabular-nums font-mono text-sm">
							{custody().total}
						</span>{" "}
						Entrants
					</div>
				</div>

				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
					<div class="rounded-xl border border-border bg-card p-3 shadow-xs">
						<div class="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
							Registered
						</div>
						<div class="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">
							{custody().registered}
						</div>
						<div class="text-[10px] text-muted-foreground mt-1">
							{custody().total > 0
								? `${Math.round((custody().registered / custody().total) * 100)}% of field`
								: "0%"}
						</div>
					</div>

					<div class="rounded-xl border border-forest/30 bg-forest/5 p-3 shadow-xs">
						<div class="text-[11px] font-medium text-forest uppercase tracking-wider">
							Checked In
						</div>
						<div class="text-2xl font-bold font-mono tabular-nums text-forest mt-1">
							{custody().checkedIn}
						</div>
						<div class="text-[10px] text-muted-foreground mt-1">
							Packet pickup confirmed
						</div>
					</div>

					<div class="rounded-xl border border-primary/30 bg-primary/5 p-3 shadow-xs">
						<div class="text-[11px] font-medium text-primary uppercase tracking-wider">
							On Course
						</div>
						<div class="text-2xl font-bold font-mono tabular-nums text-primary mt-1">
							{custody().inProgress}
						</div>
						<div class="text-[10px] text-muted-foreground mt-1">
							Currently racing
						</div>
					</div>

					<div class="rounded-xl border border-emerald-600/30 bg-emerald-500/5 p-3 shadow-xs">
						<div class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
							Finished
						</div>
						<div class="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
							{custody().finished}
						</div>
						<div class="text-[10px] text-muted-foreground mt-1">
							Official finishes
						</div>
					</div>

					<div class="rounded-xl border border-rose-600/30 bg-rose-500/5 p-3 shadow-xs">
						<div class="text-[11px] font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider">
							DNF / Swept
						</div>
						<div class="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
							{custody().dnf}
						</div>
						<div class="text-[10px] text-muted-foreground mt-1">
							Station drops & cutoffs
						</div>
					</div>

					<div class="rounded-xl border border-amber-600/30 bg-amber-500/5 p-3 shadow-xs">
						<div class="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
							Retired / DNS
						</div>
						<div class="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
							{custody().retired + custody().dns}
						</div>
						<div class="text-[10px] text-muted-foreground mt-1">
							{custody().dns} DNS · {custody().retired} Retired
						</div>
					</div>
				</div>
			</div>

			{/* Section 2: Multi-Distance Wave & Gun Clocks */}
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-lg font-bold font-serif text-foreground">
							Multi-Distance Wave & Gun Clocks
						</h2>
						<p class="text-xs text-muted-foreground">
							Live start status and custody breakdown per distance.
						</p>
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					<For each={subEvents()}>
						{(sub) => {
							const hasStarted = () => Boolean(sub.actualStart);
							const elapsed = () => {
								if (!sub.actualStart) return 0;
								const startMs = new Date(sub.actualStart).getTime();
								return Math.max(0, Math.floor((now().getTime() - startMs) / 1000));
							};

							return (
								<Card class="flex flex-col justify-between">
									<CardHeader class="pb-2">
										<div class="flex items-center justify-between gap-2">
											<CardTitle class="text-base font-bold font-serif">
												{sub.name}
											</CardTitle>
											<Badge
												variant={hasStarted() ? "primary" : "secondary"}
												class="text-[10px]"
											>
												{hasStarted() ? "Racing Now" : "Pre-Race"}
											</Badge>
										</div>
										<p class="text-xs text-muted-foreground">
											Course: {sub.courseName} ({(sub.courseDistanceMeters / 1000).toFixed(1)} km)
										</p>
									</CardHeader>

									<CardContent class="space-y-3 pt-0">
										{/* Clock display */}
										<div class="rounded-lg bg-surface border border-border/80 p-3 flex items-center justify-between">
											<div>
												<div class="text-[10px] uppercase font-semibold text-muted-foreground">
													{hasStarted() ? "Elapsed Gun Clock" : "Scheduled Start"}
												</div>
												<div class="text-xl font-bold font-mono tabular-nums text-foreground mt-0.5">
													{hasStarted()
														? formatElapsedSeconds(elapsed())
														: new Date(sub.scheduledStart).toLocaleTimeString([], {
																hour: "2-digit",
																minute: "2-digit",
															})}
												</div>
											</div>

											<div class="text-right">
												<div class="text-[10px] uppercase font-semibold text-muted-foreground">
													Field
												</div>
												<div class="text-sm font-semibold font-mono tabular-nums text-foreground mt-0.5">
													{sub.custody.checkedIn + sub.custody.inProgress} / {sub.custody.total}
												</div>
											</div>
										</div>

										{/* Custody summary chips */}
										<div class="flex flex-wrap gap-1.5 text-[11px] font-mono tabular-nums">
											<span class="rounded bg-muted px-2 py-0.5 text-muted-foreground">
												Reg: {sub.custody.registered}
											</span>
											<span class="rounded bg-forest/10 text-forest px-2 py-0.5">
												In: {sub.custody.checkedIn}
											</span>
											<span class="rounded bg-primary/10 text-primary px-2 py-0.5">
												On Course: {sub.custody.inProgress}
											</span>
											<span class="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5">
												Fin: {sub.custody.finished}
											</span>
										</div>

										<Link
											to="/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId"
											params={{
												slug: params().slug,
												eventGroupSlug: params().eventGroupSlug,
												eventId: sub.id,
											}}
											class={buttonVariants({
												variant: "outline",
												size: "sm",
												class: "w-full text-xs font-semibold mt-2",
											})}
										>
											Open Sub-Event Workspace →
										</Link>
									</CardContent>
								</Card>
							);
						}}
					</For>
				</div>
			</div>

			{/* Section 3: Pre-Race Readiness Checklist */}
			<div class="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
				<div>
					<h2 class="text-lg font-bold font-serif text-foreground">
						Pre-Race Readiness Checklist
					</h2>
					<p class="text-xs text-muted-foreground">
						Operational readiness indicators across hardware, checkpoints, roster, and medical contacts.
					</p>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
					<div class="rounded-xl border border-border/80 bg-surface p-4 flex flex-col justify-between">
						<div class="flex items-center justify-between">
							<span class="text-xs font-semibold text-muted-foreground">
								Station Staffing
							</span>
							<span class="text-base">📍</span>
						</div>
						<div class="mt-2">
							<div class="text-2xl font-bold font-mono tabular-nums text-foreground">
								{readiness().totalStaff}
							</div>
							<p class="text-[11px] text-muted-foreground mt-0.5">
								Staff rostered across {readiness().totalTimingPoints} physical timing points
							</p>
						</div>
						<Link
							to="/orgs/$slug/event-groups/$eventGroupSlug/rules-staff"
							params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
							class="text-xs text-forest hover:underline font-semibold mt-3"
						>
							Manage Staff Matrix →
						</Link>
					</div>

					<div class="rounded-xl border border-border/80 bg-surface p-4 flex flex-col justify-between">
						<div class="flex items-center justify-between">
							<span class="text-xs font-semibold text-muted-foreground">
								Courses & Splits
							</span>
							<span class="text-base">🗺️</span>
						</div>
						<div class="mt-2">
							<div class="text-2xl font-bold font-mono tabular-nums text-foreground">
								{readiness().totalSplits}
							</div>
							<p class="text-[11px] text-muted-foreground mt-0.5">
								Total milestones and cutoff splits configured
							</p>
						</div>
						<div class="text-xs text-muted-foreground font-semibold mt-3">
							Active across all courses
						</div>
					</div>

					<div class="rounded-xl border border-border/80 bg-surface p-4 flex flex-col justify-between">
						<div class="flex items-center justify-between">
							<span class="text-xs font-semibold text-muted-foreground">
								Roster Check-In
							</span>
							<span class="text-base">📋</span>
						</div>
						<div class="mt-2">
							<div class="text-2xl font-bold font-mono tabular-nums text-foreground">
								{readiness().checkInRatePct}%
							</div>
							<p class="text-[11px] text-muted-foreground mt-0.5">
								{custody().checkedIn + custody().inProgress} / {custody().total} competitors checked in
							</p>
						</div>
						<div class="text-xs text-muted-foreground font-semibold mt-3">
							Race morning packet pickup
						</div>
					</div>

					<div class="rounded-xl border border-border/80 bg-surface p-4 flex flex-col justify-between">
						<div class="flex items-center justify-between">
							<span class="text-xs font-semibold text-muted-foreground">
								Safety & Contacts
							</span>
							<span class="text-base">⛑️</span>
						</div>
						<div class="mt-2">
							<div class="text-2xl font-bold font-mono tabular-nums text-foreground">
								{readiness().emergencyContactsOnSiteCount}
							</div>
							<p class="text-[11px] text-muted-foreground mt-0.5">
								{readiness().emergencyContactsCount} emergency contacts on file ({readiness().emergencyContactsOnSiteCount} on-site)
							</p>
						</div>
						<div class="text-xs text-muted-foreground font-semibold mt-3">
							Verified for SAR triage
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
