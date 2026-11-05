import { Link } from "@tanstack/solid-router";
import { createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { getPublicEntrantTelemetryFn } from "~/audit/audit.functions";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";

// ============================================================================
// WATCHLIST LOCAL STORAGE HELPERS & EVENT BUS
// ============================================================================

export function getFollowedBibs(slug: string): string[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(`chekkpoint:following:${slug}`);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

export function isBibFollowed(slug: string, bib: string): boolean {
	return getFollowedBibs(slug).includes(bib);
}

export function toggleFollowBib(slug: string, bib: string): boolean {
	if (typeof window === "undefined") return false;
	try {
		const key = `chekkpoint:following:${slug}`;
		const bibs = getFollowedBibs(slug);
		const idx = bibs.indexOf(bib);
		let isNowFollowed = false;

		if (idx >= 0) {
			bibs.splice(idx, 1);
			isNowFollowed = false;
		} else {
			bibs.push(bib);
			isNowFollowed = true;
		}

		localStorage.setItem(key, JSON.stringify(bibs));
		window.dispatchEvent(
			new CustomEvent("chekkpoint:watchlist-updated", {
				detail: { slug, bibs },
			}),
		);
		return isNowFollowed;
	} catch {
		return false;
	}
}

export function openTelemetrySheet(entrantId: string) {
	if (typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent("chekkpoint:open-telemetry", {
			detail: { entrantId },
		}),
	);
}

// ============================================================================
// COMPONENT
// ============================================================================

export interface EntrantTelemetryViewProps {
	slug: string;
	entrantId: string;
	isSheet?: boolean;
	onClose?: () => void;
}

export default function EntrantTelemetryView(props: EntrantTelemetryViewProps) {
	const [telemetryData] = createResource(
		() => ({ slug: props.slug, entrantId: props.entrantId }),
		async ({ slug, entrantId }) => {
			return getPublicEntrantTelemetryFn({ data: { slug, entrantId } });
		},
	);

	const [isStarred, setIsStarred] = createSignal(false);

	// Sync watchlist star status
	const checkStarred = () => {
		const bib = telemetryData()?.entrant.bibNumber;
		if (bib) {
			setIsStarred(isBibFollowed(props.slug, bib));
		}
	};

	onMount(() => {
		checkStarred();
		const handleWatchlistChange = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail?.slug === props.slug) {
				checkStarred();
			}
		};
		window.addEventListener("chekkpoint:watchlist-updated", handleWatchlistChange);
		onCleanup(() => {
			window.removeEventListener("chekkpoint:watchlist-updated", handleWatchlistChange);
		});
	});

	const handleStarToggle = () => {
		const bib = telemetryData()?.entrant.bibNumber;
		if (bib) {
			const res = toggleFollowBib(props.slug, bib);
			setIsStarred(res);
		}
	};

	// SVG Elevation Profile calculations
	const svgPoints = () => {
		const data = telemetryData();
		if (!data || data.elevationProfile.length === 0) return { pathD: "", markers: [] };

		const profile = data.elevationProfile;
		const width = 600;
		const height = 120;
		const padX = 24;
		const padY = 16;

		const maxDist = Math.max(...profile.map((p) => p.distanceKm), 1);
		const elevs = profile.map((p) => p.elevationMeters);
		const minElev = Math.min(...elevs) - 50;
		const maxElev = Math.max(...elevs) + 50;
		const elevRange = maxElev - minElev || 1;

		const scaleX = (d: number) => padX + (d / maxDist) * (width - 2 * padX);
		const scaleY = (e: number) =>
			height - padY - ((e - minElev) / elevRange) * (height - 2 * padY);

		const coords = profile.map((p) => ({
			x: scaleX(p.distanceKm),
			y: scaleY(p.elevationMeters),
			...p,
		}));

		// Build SVG path
		let pathD = `M ${coords[0].x} ${coords[0].y}`;
		for (let i = 1; i < coords.length; i++) {
			pathD += ` L ${coords[i].x} ${coords[i].y}`;
		}

		// Close path for gradient fill
		const fillPathD = `${pathD} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

		return { pathD, fillPathD, markers: coords };
	};

	return (
		<div class="flex flex-col gap-6 text-foreground">
			<Show
				when={!telemetryData.loading && telemetryData()}
				fallback={
					<div class="p-12 text-center text-xs font-mono text-muted-foreground animate-pulse">
						Loading telemetry stream…
					</div>
				}
			>
				{/* Top Hero Banner */}
				<Card class="p-6 border-forest/20 flex flex-col gap-4">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div class="flex items-center gap-3">
							<span class="font-mono text-3xl font-extrabold text-forest tabular-nums">
								#{telemetryData()!.entrant.bibNumber}
							</span>
							<div>
								<h2 class="text-xl font-bold font-serif text-foreground">
									{telemetryData()!.entrant.displayName}
								</h2>
								<div class="text-xs text-muted-foreground">
									{telemetryData()!.entrant.cityState} · {telemetryData()!.entrant.division}
								</div>
							</div>
						</div>

						<div class="flex items-center gap-2">
							<Button
								variant={isStarred() ? "forest" : "outline"}
								size="sm"
								onClick={handleStarToggle}
								class="text-xs font-semibold gap-1.5"
							>
								<span>{isStarred() ? "★ Following" : "☆ Follow Bib"}</span>
							</Button>

							<Show when={props.isSheet}>
								<Link
									to="/events/$slug/entrants/$entrantId"
									params={{
										slug: props.slug,
										entrantId: props.entrantId,
									}}
									class="text-xs font-semibold text-forest hover:underline flex items-center gap-1 px-2 py-1"
								>
									<span>Shareable Page ↗</span>
								</Link>
							</Show>
						</div>
					</div>

					{/* Metrics Grid */}
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/60 text-xs font-mono tabular-nums">
						<div class="flex flex-col gap-0.5">
							<span class="text-[10px] text-muted-foreground uppercase tracking-wider">
								Status
							</span>
							<Badge
								variant={
									telemetryData()!.entrant.status === "finished"
										? "forest"
										: telemetryData()!.entrant.status === "in_progress"
											? "clay"
											: "outline"
								}
								class="w-fit text-xs"
							>
								{telemetryData()!.entrant.status}
							</Badge>
						</div>

						<div class="flex flex-col gap-0.5">
							<span class="text-[10px] text-muted-foreground uppercase tracking-wider">
								Overall Place
							</span>
							<span class="font-bold text-base text-foreground">
								{telemetryData()!.summary.overallPlace
									? `#${telemetryData()!.summary.overallPlace}`
									: "—"}
							</span>
						</div>

						<div class="flex flex-col gap-0.5">
							<span class="text-[10px] text-muted-foreground uppercase tracking-wider">
								Total Elapsed
							</span>
							<span class="font-bold text-base text-foreground">
								{telemetryData()!.summary.adjustedElapsedFormatted !== "—"
									? telemetryData()!.summary.adjustedElapsedFormatted
									: telemetryData()!.summary.totalElapsedFormatted}
							</span>
							<Show when={telemetryData()!.summary.totalAllowanceSeconds > 0}>
								<span class="text-[10px] text-forest font-semibold">
									(Net -{Math.floor(telemetryData()!.summary.totalAllowanceSeconds / 60)}m hold)
								</span>
							</Show>
						</div>

						<div class="flex flex-col gap-0.5">
							<span class="text-[10px] text-muted-foreground uppercase tracking-wider">
								Projected Finish
							</span>
							<span class="font-bold text-base text-foreground">
								{telemetryData()!.summary.projectedFinishFormatted ?? "—"}
							</span>
						</div>
					</div>
				</Card>

				{/* Topographic SVG Elevation Chart */}
				<Card class="p-4 flex flex-col gap-2">
					<div class="flex items-center justify-between text-xs">
						<span class="font-bold text-foreground">Topographic Elevation Profile</span>
						<span class="text-[11px] font-mono tabular-nums text-muted-foreground">
							{Math.round(telemetryData()!.course.distanceMeters / 1000)} km · +
							{Math.round(telemetryData()!.course.elevationGainMeters)}m
						</span>
					</div>

					<div class="w-full overflow-hidden rounded bg-muted/20 border border-border/50">
						<svg
							viewBox="0 0 600 120"
							class="w-full h-28 stroke-linejoin-round"
							preserveAspectRatio="none"
						>
							<defs>
								<linearGradient id="topo-grad" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stop-color="var(--forest)" stop-opacity="0.25" />
									<stop offset="100%" stop-color="var(--forest)" stop-opacity="0.02" />
								</linearGradient>
							</defs>

							{/* Gradient area under profile */}
							<path d={svgPoints().fillPathD} fill="url(#topo-grad)" />

							{/* Terrain elevation stroke */}
							<path
								d={svgPoints().pathD}
								fill="none"
								stroke="var(--forest)"
								stroke-width="2"
							/>

							{/* Checkpoint Station Dots */}
							<For each={svgPoints().markers}>
								{(m) => (
									<g>
										<circle
											cx={m.x}
											cy={m.y}
											r={m.isCurrent ? "6" : m.isCompleted ? "4.5" : "3.5"}
											fill={
												m.isCurrent
													? "var(--clay)"
													: m.isCompleted
														? "var(--forest)"
														: "var(--muted-foreground)"
											}
											stroke="var(--background)"
											stroke-width="1.5"
										/>
										<Show when={m.isCurrent}>
											<circle
												cx={m.x}
												cy={m.y}
												r="10"
												fill="none"
												stroke="var(--clay)"
												stroke-width="1.5"
												stroke-dasharray="2 2"
											/>
										</Show>
									</g>
								)}
							</For>
						</svg>
					</div>

					<div class="flex items-center justify-between text-[10px] font-mono text-muted-foreground px-1">
						<span>Start (0 km)</span>
						<span class="flex items-center gap-2">
							<span class="inline-flex items-center gap-1">
								<span class="size-2 rounded-full bg-forest" /> Completed
							</span>
							<span class="inline-flex items-center gap-1">
								<span class="size-2 rounded-full bg-clay" /> Current
							</span>
							<span class="inline-flex items-center gap-1">
								<span class="size-2 rounded-full bg-muted-foreground/60" /> Projected
							</span>
						</span>
						<span>Finish ({Math.round(telemetryData()!.course.distanceMeters / 1000)} km)</span>
					</div>
				</Card>

				{/* Unified Split & Projection Timeline */}
				<Card class="overflow-x-auto">
					<div class="p-4 border-b border-border/80">
						<h3 class="text-sm font-bold text-foreground">
							Unified Split & Pacing Timeline
						</h3>
						<p class="text-xs text-muted-foreground">
							Completed checkpoint splits transition seamlessly into shaded
							projected arrival windows and station cutoff buffers.
						</p>
					</div>

					<Table>
						<TableHeader>
							<TableRow>
								<TableHead class="w-10">#</TableHead>
								<TableHead>Checkpoint</TableHead>
								<TableHead>Dist</TableHead>
								<TableHead>Time of Day</TableHead>
								<TableHead>Elapsed</TableHead>
								<TableHead>Pace</TableHead>
								<TableHead>Dwell</TableHead>
								<TableHead class="text-right">Projected / Cutoff</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={telemetryData()!.timeline}>
								{(row) => {
									const isCompleted = row.status === "completed";
									return (
										<TableRow
											class={
												isCompleted
													? "bg-card/40"
													: "bg-muted/15 border-dashed"
											}
										>
											<TableCell class="font-mono tabular-nums text-muted-foreground text-xs">
												{row.sequenceOrder}
											</TableCell>
											<TableCell class="font-bold text-foreground">
												<div class="flex items-center gap-2">
													<span>{row.splitName}</span>
													<Show when={isCompleted && row.subSplitKind}>
														<Badge variant="outline" class="text-[9px] py-0 px-1 font-mono">
															{row.subSplitKind!.toUpperCase()}
														</Badge>
													</Show>
													<Show when={!isCompleted}>
														<Badge variant="sage" class="text-[9px] py-0 px-1">
															Projected
														</Badge>
													</Show>
												</div>
												<Show when={row.timeAllowanceSeconds}>
													<div class="text-[10px] text-forest font-semibold font-mono">
														+{Math.floor(row.timeAllowanceSeconds! / 60)}m Time Allowance Credited
													</div>
												</Show>
											</TableCell>
											<TableCell class="font-mono tabular-nums text-xs text-muted-foreground">
												{Math.round(row.distanceMeters / 1000)} km
											</TableCell>
											<TableCell class="font-mono tabular-nums text-xs">
												{row.timeOfDayFormatted ?? "—"}
											</TableCell>
											<TableCell class="font-mono font-bold tabular-nums">
												{isCompleted
													? row.adjustedElapsedFormatted || row.elapsedFormatted
													: "—"}
											</TableCell>
											<TableCell class="font-mono tabular-nums text-xs text-muted-foreground">
												{row.paceFormatted ?? "—"}
											</TableCell>
											<TableCell class="font-mono tabular-nums text-xs text-muted-foreground">
												{row.dwellFormatted ?? "—"}
											</TableCell>
											<TableCell class="text-right font-mono tabular-nums text-xs">
												<Show
													when={!isCompleted}
													fallback={
														<Show when={row.cutoffDurationSeconds}>
															<span class="text-muted-foreground text-[11px]">
																Cutoff: {Math.floor(row.cutoffDurationSeconds! / 3600)}h
															</span>
														</Show>
													}
												>
													<div class="flex flex-col items-end gap-0.5">
														<span class="font-bold text-foreground">
															{row.projectedArrivalFormatted ?? "—"}
														</span>
														<Show when={row.earliestArrivalFormatted && row.latestArrivalFormatted}>
															<span class="text-[10px] text-muted-foreground">
																Band: {row.earliestArrivalFormatted} – {row.latestArrivalFormatted}
															</span>
														</Show>
														<Show when={row.cutoffMarginSeconds !== null}>
															<Badge
																variant={row.cutoffRisk ? "clay" : "forest"}
																class="text-[9px] py-0 px-1 mt-0.5"
															>
																{row.cutoffMarginSeconds! > 0
																	? `+${Math.floor(row.cutoffMarginSeconds! / 60)}m margin`
																	: "Cutoff Miss Risk"}
															</Badge>
														</Show>
													</div>
												</Show>
											</TableCell>
										</TableRow>
									);
								}}
							</For>
						</TableBody>
					</Table>
				</Card>
			</Show>
		</div>
	);
}
