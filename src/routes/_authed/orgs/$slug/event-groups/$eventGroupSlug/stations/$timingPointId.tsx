import { createFileRoute, Link, useRouter } from "@tanstack/solid-router";
import { createSignal, onCleanup, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverTitle,
	PopoverTrigger,
} from "~/components/ui/popover";
import {
	getStationCrossCheck,
	recordQuickAction,
} from "~/field-ops/field-ops.functions";
import type { StationEntrantCard } from "~/field-ops/field-ops.shared";

export const Route = createFileRoute(
	"/_authed/orgs/$slug/event-groups/$eventGroupSlug/stations/$timingPointId",
)({
	loader: ({ params }) =>
		getStationCrossCheck({
			data: {
				slug: params.slug,
				eventGroupSlug: params.eventGroupSlug,
				timingPointId: params.timingPointId,
			},
		}),
	component: StationCrossCheckBoardPage,
});

function formatDwellHms(seconds: number | null | undefined): string {
	if (seconds === null || seconds === undefined || seconds < 0) return "—";
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0) {
		return `${h}h ${m}m ${s}s`;
	}
	return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatTimeOnly(time: Date | string | null | undefined): string {
	if (!time) return "—";
	const d = new Date(time);
	return d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function StationCrossCheckBoardPage() {
	const data = Route.useLoaderData();
	const params = Route.useParams();
	const router = useRouter();

	const station = () => data().station;
	const eventGroup = () => data().eventGroup;
	const zones = () => data().zones;

	// View Mode: 'grid' vs 'table'
	const [viewMode, setViewMode] = createSignal<"grid" | "table">("grid");

	// Active quick action state
	const [activeActionId, setActiveActionId] = createSignal<string | null>(null);
	const [isSubmitting, setIsSubmitting] = createSignal(false);

	// Live ticker for dwell timer
	const [now, setNow] = createSignal(new Date());
	const ticker = setInterval(() => setNow(new Date()), 1000);
	onCleanup(() => clearInterval(ticker));

	const handleQuickAction = async (
		entrantId: string,
		action: "record_in" | "record_out" | "stopped_here",
	) => {
		setIsSubmitting(true);
		try {
			await recordQuickAction({
				data: {
					eventGroupId: eventGroup().id,
					timingPointId: station().id,
					entrantId,
					action,
				},
			});
			setActiveActionId(null);
			await router.invalidate();
		} catch (err: unknown) {
			console.error("Quick action failed:", err);
			alert(err instanceof Error ? err.message : "Failed to record action");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div class="px-6 py-8 max-w-7xl mx-auto space-y-6">
			{/* Breadcrumb & Navigation */}
			<div class="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground print:hidden">
				<div class="flex items-center gap-2">
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/stations"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="hover:text-foreground font-semibold hover:underline inline-flex items-center gap-1"
					>
						← All Aid Stations
					</Link>
					<span>/</span>
					<span class="text-foreground font-bold">{station().name}</span>
					<Badge variant="sage" class="font-mono text-[10px]">
						{station().code}
					</Badge>
				</div>

				<div class="flex items-center gap-3">
					<button
						type="button"
						onClick={() => setViewMode(viewMode() === "grid" ? "table" : "grid")}
						class={buttonVariants({ variant: "outline", size: "sm" })}
					>
						{viewMode() === "grid" ? "📊 Sortable Table" : "🔲 Bib Grid"}
					</button>

					<button
						type="button"
						onClick={() => window.print()}
						class={buttonVariants({ variant: "outline", size: "sm" })}
					>
						🖨️ Print Sheet
					</button>

					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/logger"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						search={{ station: station().code }}
						class={buttonVariants({ variant: "forest", size: "sm" })}
					>
						⏱️ Open Station Logger
					</Link>
				</div>
			</div>

			{/* Station Header */}
			<div class="border-b border-border pb-4 flex flex-wrap items-center justify-between gap-4 print:hidden">
				<div>
					<h1 class="text-2xl font-bold font-serif text-foreground tracking-tight">
						{station().name} Cross-Check Board
					</h1>
					<p class="text-xs text-muted-foreground mt-0.5">
						Station Code: <span class="font-mono font-bold text-foreground">{station().code}</span>
						{station().elevationMeters && ` · Elevation: ${station().elevationMeters}m`}
						{` · GPS: ${station().latitude.toFixed(4)}, ${station().longitude.toFixed(4)}`}
					</p>
				</div>

				{/* 4-Zone Count Badges */}
				<div class="flex items-center gap-2 text-xs font-mono tabular-nums">
					<div class="rounded-lg bg-card border border-border px-3 py-1.5 text-center">
						<span class="text-[10px] uppercase font-sans text-muted-foreground block">
							Expected
						</span>
						<span class="font-bold text-sm text-foreground">
							{zones().expectedNext.length}
						</span>
					</div>
					<div class="rounded-lg bg-forest/10 border border-forest/30 px-3 py-1.5 text-center">
						<span class="text-[10px] uppercase font-sans text-forest block">
							In Station
						</span>
						<span class="font-bold text-sm text-forest">
							{zones().inStationNow.length}
						</span>
					</div>
					<div class="rounded-lg bg-card border border-border px-3 py-1.5 text-center">
						<span class="text-[10px] uppercase font-sans text-muted-foreground block">
							Departed
						</span>
						<span class="font-bold text-sm text-muted-foreground">
							{zones().departed.length}
						</span>
					</div>
					<div class="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-1.5 text-center">
						<span class="text-[10px] uppercase font-sans text-destructive block">
							Stopped
						</span>
						<span class="font-bold text-sm text-destructive">
							{zones().stoppedDnf.length}
						</span>
					</div>
				</div>
			</div>

			{/* ========================================================================= */}
			{/* VIEW MODE 1: 4-ZONE INTERACTIVE BIB NUMBER GRID                           */}
			{/* ========================================================================= */}
			<Show when={viewMode() === "grid"}>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start print:hidden">
					{/* ZONE 1: EXPECTED NEXT */}
					<Card class="border-border bg-card/30">
						<CardHeader class="p-4 pb-2 border-b border-border/80">
							<div class="flex items-center justify-between">
								<CardTitle class="text-sm font-bold font-serif text-foreground">
									1. Expected Next
								</CardTitle>
								<Badge variant="outline" class="font-mono text-xs tabular-nums">
									{zones().expectedNext.length}
								</Badge>
							</div>
							<CardDescription class="text-[11px]">
								Ordered by estimated arrival window.
							</CardDescription>
						</CardHeader>
						<CardContent class="p-3 space-y-2">
							<Show
								when={zones().expectedNext.length > 0}
								fallback={
									<div class="py-8 text-center text-xs text-muted-foreground">
										No expected runners at this time.
									</div>
								}
							>
								<For each={zones().expectedNext}>
									{(runner) => (
										<BibGridCard
											runner={runner}
											zone="expected"
											onQuickAction={handleQuickAction}
											isSubmitting={isSubmitting()}
										/>
									)}
								</For>
							</Show>
						</CardContent>
					</Card>

					{/* ZONE 2: IN STATION NOW (WITH LIVE TICKING DWELL TIMER) */}
					<Card class="border-forest/40 bg-forest/5">
						<CardHeader class="p-4 pb-2 border-b border-forest/20">
							<div class="flex items-center justify-between">
								<CardTitle class="text-sm font-bold font-serif text-forest">
									2. In Station Now
								</CardTitle>
								<Badge variant="forest" class="font-mono text-xs tabular-nums">
									{zones().inStationNow.length}
								</Badge>
							</div>
							<CardDescription class="text-[11px] text-forest/80">
								Checked IN without OUT. Live dwell ticker.
							</CardDescription>
						</CardHeader>
						<CardContent class="p-3 space-y-2">
							<Show
								when={zones().inStationNow.length > 0}
								fallback={
									<div class="py-8 text-center text-xs text-muted-foreground">
										No competitors currently in station.
									</div>
								}
							>
								<For each={zones().inStationNow}>
									{(runner) => (
										<BibGridCard
											runner={runner}
											zone="in_station"
											now={now()}
											onQuickAction={handleQuickAction}
											isSubmitting={isSubmitting()}
										/>
									)}
								</For>
							</Show>
						</CardContent>
					</Card>

					{/* ZONE 3: DEPARTED */}
					<Card class="border-border bg-card/30">
						<CardHeader class="p-4 pb-2 border-b border-border/80">
							<div class="flex items-center justify-between">
								<CardTitle class="text-sm font-bold font-serif text-foreground">
									3. Departed
								</CardTitle>
								<Badge variant="outline" class="font-mono text-xs tabular-nums">
									{zones().departed.length}
								</Badge>
							</div>
							<CardDescription class="text-[11px]">
								Checked OUT or POINT punch recorded.
							</CardDescription>
						</CardHeader>
						<CardContent class="p-3 space-y-2">
							<Show
								when={zones().departed.length > 0}
								fallback={
									<div class="py-8 text-center text-xs text-muted-foreground">
										No departures recorded yet.
									</div>
								}
							>
								<For each={zones().departed}>
									{(runner) => (
										<BibGridCard
											runner={runner}
											zone="departed"
											onQuickAction={handleQuickAction}
											isSubmitting={isSubmitting()}
										/>
									)}
								</For>
							</Show>
						</CardContent>
					</Card>

					{/* ZONE 4: STOPPED / DNF */}
					<Card class="border-destructive/30 bg-destructive/5">
						<CardHeader class="p-4 pb-2 border-b border-destructive/20">
							<div class="flex items-center justify-between">
								<CardTitle class="text-sm font-bold font-serif text-destructive">
									4. Stopped / DNF
								</CardTitle>
								<Badge variant="destructive" class="font-mono text-xs tabular-nums">
									{zones().stoppedDnf.length}
								</Badge>
							</div>
							<CardDescription class="text-[11px] text-destructive/80">
								Dropped or terminated effort at this aid station.
							</CardDescription>
						</CardHeader>
						<CardContent class="p-3 space-y-2">
							<Show
								when={zones().stoppedDnf.length > 0}
								fallback={
									<div class="py-8 text-center text-xs text-muted-foreground">
										Zero runner drops at this station.
									</div>
								}
							>
								<For each={zones().stoppedDnf}>
									{(runner) => (
										<BibGridCard
											runner={runner}
											zone="stopped"
											onQuickAction={handleQuickAction}
											isSubmitting={isSubmitting()}
										/>
									)}
								</For>
							</Show>
						</CardContent>
					</Card>
				</div>
			</Show>

			{/* ========================================================================= */}
			{/* VIEW MODE 2: SORTABLE TABLE & PRINTABLE STATION BACKUP SHEET              */}
			{/* ========================================================================= */}
			<Show when={viewMode() === "table"}>
				<Card class="border-border print:hidden">
					<CardHeader class="border-b border-border/80">
						<CardTitle class="text-base font-bold font-serif">
							Full Accountability Roster — {station().name}
						</CardTitle>
						<CardDescription class="text-xs">
							Complete cross-check log including projections, actual IN/OUT, dwell time, and SAR safety flags.
						</CardDescription>
					</CardHeader>
					<CardContent class="p-0">
						<div class="overflow-x-auto">
							<table class="w-full text-left text-xs">
								<thead>
									<tr class="border-b border-border/80 bg-muted/40 font-semibold text-muted-foreground select-none">
										<th class="py-3 px-4">Bib</th>
										<th class="py-3 px-4">Competitor</th>
										<th class="py-3 px-4">Sub-Event / Div</th>
										<th class="py-3 px-4 text-center">Projected Arrival</th>
										<th class="py-3 px-4 text-center">IN Time</th>
										<th class="py-3 px-4 text-center">OUT Time</th>
										<th class="py-3 px-4 text-center">Dwell Time</th>
										<th class="py-3 px-4 text-center">Status / Zone</th>
										<th class="py-3 px-4 text-right">SAR Badges</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border/60">
									<For
										each={[
											...zones().inStationNow,
											...zones().expectedNext,
											...zones().departed,
											...zones().stoppedDnf,
										]}
									>
										{(r) => (
											<tr class="hover:bg-muted/20">
												<td class="py-2.5 px-4 font-mono font-bold text-forest">
													#{r.bibNumber}
												</td>
												<td class="py-2.5 px-4">
													<div class="font-semibold text-foreground">
														{r.firstName} {r.lastName}
													</div>
													<Show when={r.withPacer}>
														<div class="text-[10px] text-forest">
															Pacer: {r.pacerName || "Yes"}
														</div>
													</Show>
												</td>
												<td class="py-2.5 px-4 text-muted-foreground">
													{r.subEventName} · {r.division}
												</td>
												<td class="py-2.5 px-4 text-center font-mono tabular-nums text-muted-foreground">
													{r.projectedArrivalUtc ? formatTimeOnly(r.projectedArrivalUtc) : "—"}
												</td>
												<td class="py-2.5 px-4 text-center font-mono tabular-nums">
													{r.inTime ? (
														<span class="text-forest font-semibold">
															{formatTimeOnly(r.inTime)}
														</span>
													) : (
														"—"
													)}
												</td>
												<td class="py-2.5 px-4 text-center font-mono tabular-nums">
													{r.outTime ? formatTimeOnly(r.outTime) : "—"}
												</td>
												<td class="py-2.5 px-4 text-center font-mono tabular-nums">
													{r.inTime && !r.outTime ? (
														<span class="text-forest font-bold">
															{formatDwellHms(
																Math.max(
																	0,
																	Math.round(
																		(now().getTime() - new Date(r.inTime).getTime()) / 1000,
																	),
																),
															)}
														</span>
													) : r.dwellSeconds ? (
														formatDwellHms(r.dwellSeconds)
													) : (
														"—"
													)}
												</td>
												<td class="py-2.5 px-4 text-center">
													<Show when={r.stoppedHere}>
														<Badge variant="destructive" class="text-[10px]">
															Stopped Here
														</Badge>
													</Show>
													<Show when={!r.stoppedHere && r.outTime}>
														<Badge variant="outline" class="text-[10px]">
															Departed
														</Badge>
													</Show>
													<Show when={!r.stoppedHere && r.inTime && !r.outTime}>
														<Badge variant="forest" class="text-[10px]">
															In Station
														</Badge>
													</Show>
													<Show when={!r.stoppedHere && !r.inTime && !r.outTime}>
														<Badge variant="clay" class="text-[10px]">
															Expected
														</Badge>
													</Show>
												</td>
												<td class="py-2.5 px-4 text-right space-x-1">
													<Show when={r.sarBadge}>
														<Badge variant="clay" class="text-[10px]">
															{r.sarBadge}
														</Badge>
													</Show>
													<Show when={r.expectedCutoffRisk}>
														<Badge variant="destructive" class="text-[10px]">
															Cutoff Risk
														</Badge>
													</Show>
												</td>
											</tr>
										)}
									</For>
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>
			</Show>

			{/* =================================================================== */}
			{/* DEDICATED PRINTABLE STATION BACKUP SHEET (@media print)             */}
			{/* =================================================================== */}
			<div class="hidden print:block text-black bg-white p-4 font-serif">
				<div class="border-b-2 border-black pb-2 mb-4">
					<div class="flex justify-between items-baseline">
						<h1 class="text-xl font-bold uppercase tracking-wider">
							Official Aid Station Backup & Custody Sheet
						</h1>
						<span class="font-mono text-xs">
							{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour12: false })}
						</span>
					</div>
					<p class="text-xs mt-1">
						Event Group: <strong>{eventGroup().name}</strong> · Station:{" "}
						<strong>{station().name}</strong> ({station().code})
						{station().elevationMeters && ` · Elevation: ${station().elevationMeters}m`}
						{` · GPS: ${station().latitude.toFixed(4)}, ${station().longitude.toFixed(4)}`}
					</p>
					<div class="flex gap-4 mt-2 text-xs font-mono">
						<span>Expected: {zones().expectedNext.length}</span>
						<span>In Station: {zones().inStationNow.length}</span>
						<span>Departed: {zones().departed.length}</span>
						<span>Stopped/DNF: {zones().stoppedDnf.length}</span>
						<span>
							Total Roster:{" "}
							{zones().expectedNext.length +
								zones().inStationNow.length +
								zones().departed.length +
								zones().stoppedDnf.length}
						</span>
					</div>
				</div>

				<table class="w-full text-left text-xs border-collapse border border-black">
					<thead>
						<tr class="border-b-2 border-black bg-gray-100 font-bold">
							<th class="py-1.5 px-2 border border-black font-mono w-14">Bib</th>
							<th class="py-1.5 px-2 border border-black">Competitor Name</th>
							<th class="py-1.5 px-2 border border-black">Sub-Event / Div</th>
							<th class="py-1.5 px-2 border border-black text-center font-mono w-20">Projected</th>
							<th class="py-1.5 px-2 border border-black text-center font-mono w-20">Actual IN</th>
							<th class="py-1.5 px-2 border border-black text-center font-mono w-20">Actual OUT</th>
							<th class="py-1.5 px-2 border border-black text-center font-mono w-16">Dwell</th>
							<th class="py-1.5 px-2 border border-black text-center w-20">Status</th>
							<th class="py-1.5 px-2 border border-black w-32">Notes / Signature</th>
						</tr>
					</thead>
					<tbody>
						<For
							each={[
								...zones().inStationNow,
								...zones().expectedNext,
								...zones().departed,
								...zones().stoppedDnf,
							]}
						>
							{(r) => (
								<tr class="border-b border-gray-400">
									<td class="py-1.5 px-2 border border-black font-mono font-bold text-sm">
										#{r.bibNumber}
									</td>
									<td class="py-1.5 px-2 border border-black font-semibold">
										{r.firstName} {r.lastName}
										{r.withPacer && " (+Pacer)"}
									</td>
									<td class="py-1.5 px-2 border border-black text-[11px]">
										{r.subEventName} · {r.division}
									</td>
									<td class="py-1.5 px-2 border border-black text-center font-mono">
										{r.projectedArrivalUtc ? formatTimeOnly(r.projectedArrivalUtc) : "—"}
									</td>
									<td class="py-1.5 px-2 border border-black text-center font-mono">
										{r.inTime ? formatTimeOnly(r.inTime) : "[   :   ]"}
									</td>
									<td class="py-1.5 px-2 border border-black text-center font-mono">
										{r.outTime ? formatTimeOnly(r.outTime) : "[   :   ]"}
									</td>
									<td class="py-1.5 px-2 border border-black text-center font-mono">
										{r.dwellSeconds != null ? formatDwellHms(r.dwellSeconds) : "—"}
									</td>
									<td class="py-1.5 px-2 border border-black text-center uppercase font-mono text-[10px]">
										{r.status}
									</td>
									<td class="py-1.5 px-2 border border-black text-[10px]">
										{r.sarBadge ? `[${r.sarBadge}] ` : ""}
										{r.expectedCutoffRisk ? "[Cutoff Risk]" : ""}
									</td>
								</tr>
							)}
						</For>
					</tbody>
				</table>

				<div class="mt-6 pt-4 border-t border-black text-xs flex justify-between">
					<div>
						<span>Checkpoint Captain Signature: ___________________________</span>
					</div>
					<div>
						<span>Page Generated by ChekkPoint Live Ops</span>
					</div>
				</div>
			</div>
		</div>
	);
}

// Sub-component: Bib Card with Quick Action Popover
function BibGridCard(props: {
	runner: StationEntrantCard;
	zone: "expected" | "in_station" | "departed" | "stopped";
	now?: Date;
	onQuickAction: (
		entrantId: string,
		action: "record_in" | "record_out" | "stopped_here",
	) => Promise<void>;
	isSubmitting: boolean;
}) {
	const r = () => props.runner;

	// Compute live dwell seconds for in_station cards
	const dwellSeconds = () => {
		if (props.zone === "in_station" && r().inTime && props.now) {
			return Math.max(
				0,
				Math.round((props.now.getTime() - new Date(r().inTime!).getTime()) / 1000),
			);
		}
		return r().dwellSeconds ?? null;
	};

	return (
		<Popover>
			<PopoverTrigger
				class={`w-full text-left rounded-xl border p-2.5 transition-colors cursor-pointer outline-hidden select-none ${
					props.zone === "in_station"
						? "bg-forest/10 border-forest/40 hover:bg-forest/15"
						: props.zone === "stopped"
							? "bg-destructive/10 border-destructive/30 hover:bg-destructive/15"
							: "bg-surface border-border hover:bg-muted/50"
				}`}
			>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-1.5">
						<span class="text-base font-bold font-mono text-forest">
							#{r().bibNumber}
						</span>
						<Show when={r().withPacer}>
							<span class="text-[10px] rounded-sm bg-forest/20 text-forest px-1 font-semibold" title={r().pacerName ? `Pacer: ${r().pacerName}` : "With Pacer"}>
								+P
							</span>
						</Show>
					</div>

					<Show when={r().sarBadge}>
						<Badge variant="clay" class="text-[9px] py-0 px-1">
							{r().sarBadge}
						</Badge>
					</Show>
				</div>

				<div class="font-medium text-xs text-foreground truncate mt-0.5">
					{r().firstName} {r().lastName}
				</div>

				<div class="flex items-center justify-between text-[11px] text-muted-foreground mt-1 tabular-nums font-mono">
					<span class="truncate max-w-[120px]">{r().subEventName}</span>
					<Show when={props.zone === "in_station"}>
						<span class="font-bold text-forest">
							⏱️ {formatDwellHms(dwellSeconds())}
						</span>
					</Show>
					<Show when={props.zone === "expected" && r().projectedArrivalUtc}>
						<span>Est: {formatTimeOnly(r().projectedArrivalUtc)}</span>
					</Show>
					<Show when={props.zone === "departed" && r().outTime}>
						<span>Out: {formatTimeOnly(r().outTime)}</span>
					</Show>
					<Show when={props.zone === "stopped"}>
						<span class="text-destructive font-semibold">Stopped</span>
					</Show>
				</div>
			</PopoverTrigger>

			{/* Quick Action Popover */}
			<PopoverContent class="w-64 space-y-3 p-3 print:hidden">
				<div class="border-b border-border pb-2">
					<div class="flex items-center justify-between">
						<PopoverTitle class="text-sm font-bold font-mono text-forest">
							Bib #{r().bibNumber}
						</PopoverTitle>
						<Badge variant="outline" class="text-[10px]">
							{r().division}
						</Badge>
					</div>
					<PopoverDescription class="text-xs font-semibold text-foreground mt-0.5">
						{r().firstName} {r().lastName}
					</PopoverDescription>
					<div class="text-[11px] text-muted-foreground">
						Sub-Event: {r().subEventName}
						{r().pacerName && ` · Pacer: ${r().pacerName}`}
					</div>
				</div>

				{/* 1-Tap Field Quick Actions */}
				<div class="space-y-1.5 pt-1">
					<div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						1-Tap Quick Action
					</div>
					<div class="grid grid-cols-2 gap-1.5">
						<Button
							type="button"
							variant="forest"
							size="sm"
							class="text-xs h-8"
							disabled={props.isSubmitting}
							onClick={() => props.onQuickAction(r().entrantId, "record_in")}
						>
							Record IN
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="text-xs h-8"
							disabled={props.isSubmitting}
							onClick={() => props.onQuickAction(r().entrantId, "record_out")}
						>
							Record OUT
						</Button>
					</div>
					<Button
						type="button"
						variant="destructive"
						size="sm"
						class="w-full text-xs h-7 mt-1"
						disabled={props.isSubmitting}
						onClick={() => {
							if (confirm(`Confirm runner #${r().bibNumber} (${r().firstName} ${r().lastName}) is STOPPING / DNF at this station?`)) {
								props.onQuickAction(r().entrantId, "stopped_here");
							}
						}}
					>
						Stopped Here (DNF)
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
