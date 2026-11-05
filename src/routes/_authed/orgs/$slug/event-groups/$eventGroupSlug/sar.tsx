import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/components/ui/sheet";
import {
	getEmergencyDossier,
	getNetControlSar,
} from "~/field-ops/field-ops.functions";
import type {
	EntrantEmergencyDossier,
	SarStage1Alert,
	SarStage2Alert,
} from "~/field-ops/field-ops.shared";

export const Route = createFileRoute(
	"/_authed/orgs/$slug/event-groups/$eventGroupSlug/sar",
)({
	loader: ({ params }) =>
		getNetControlSar({
			data: { slug: params.slug, eventGroupSlug: params.eventGroupSlug },
		}),
	component: CombinedNetControlSarPage,
});

function formatDurationHms(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0) return `${h}h ${m}m ${s}s`;
	return `${m}m ${s}s`;
}

function CombinedNetControlSarPage() {
	const data = Route.useLoaderData();
	const params = Route.useParams();

	const group = () => data().eventGroup;
	const funnel = () => data().funnel;
	const stage1 = () => data().stage1Overdue;
	const stage2 = () => data().stage2Lingering;

	// Sheet state for selected entrant dossier
	const [selectedEntrantId, setSelectedEntrantId] = createSignal<string | null>(null);
	const [dossier, setDossier] = createSignal<EntrantEmergencyDossier | null>(null);
	const [isLoadingDossier, setIsLoadingDossier] = createSignal(false);

	const handleOpenDossier = async (entrantId: string) => {
		setSelectedEntrantId(entrantId);
		setIsLoadingDossier(true);
		try {
			const res = await getEmergencyDossier({
				data: {
					eventGroupId: group().id,
					entrantId,
				},
			});
			setDossier(res);
		} catch (err: unknown) {
			console.error("Failed to load emergency dossier:", err);
		} finally {
			setIsLoadingDossier(false);
		}
	};

	return (
		<div class="px-6 py-8 max-w-7xl mx-auto space-y-8">
			{/* Weekend Hub Sub-Nav */}
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div class="flex items-center gap-4 text-xs font-semibold">
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
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
						class="text-foreground border-b-2 border-forest pb-3 -mb-3.5 font-bold"
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

			{/* Page Header */}
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 class="text-2xl font-bold font-serif text-foreground tracking-tight">
						Combined Net Control & Two-Stage SAR Triage
					</h1>
					<p class="text-sm text-muted-foreground mt-0.5">
						Search & Rescue operations, Course Segment Progress Funnel, and Stage 1 & 2 safety alert queues.
					</p>
				</div>

				<div class="flex items-center gap-2">
					<Badge variant="clay" class="font-mono text-xs tabular-nums">
						{data().totalActiveEntrants} Active on Course
					</Badge>
				</div>
			</div>

			{/* 1. Course Segment Progress Funnel */}
			<Card class="border-border">
				<CardHeader class="pb-3 border-b border-border/80">
					<CardTitle class="text-base font-bold font-serif">
						Course Segment Progress Funnel
					</CardTitle>
					<CardDescription class="text-xs">
						Competitors currently traversing open trail between checkpoints vs. dwelling inside aid stations.
					</CardDescription>
				</CardHeader>
				<CardContent class="p-4">
					<Show
						when={funnel().length > 0}
						fallback={
							<div class="py-6 text-center text-xs text-muted-foreground">
								No checkpoint segments defined for this course.
							</div>
						}
					>
						<div class="space-y-4">
							<For each={funnel()}>
								{(seg) => (
									<div class="space-y-1.5">
										<div class="flex items-center justify-between text-xs font-semibold">
											<div class="flex items-center gap-2">
												<span class="size-2 rounded-full bg-forest" />
												<span class="text-foreground">{seg.fromCheckpointName}</span>
												<span class="text-muted-foreground">→</span>
												<span class="text-foreground">{seg.toCheckpointName}</span>
											</div>
											<div class="font-mono text-xs tabular-nums text-muted-foreground">
												<span class="font-bold text-foreground">
													{seg.entrantsBetweenCount}
												</span>{" "}
												on trail ·{" "}
												<span class="font-bold text-forest">
													{seg.entrantsInDestinationStationCount}
												</span>{" "}
												in station
											</div>
										</div>

										{/* Progress segment bar */}
										<div class="h-3 w-full rounded-full bg-muted/40 overflow-hidden flex">
											<div
												class="bg-forest/80 h-full"
												style={{
													width: `${Math.min(100, (seg.entrantsBetweenCount / (data().totalActiveEntrants || 1)) * 100)}%`,
												}}
												title={`${seg.entrantsBetweenCount} on trail`}
											/>
											<div
												class="bg-forest h-full"
												style={{
													width: `${Math.min(100, (seg.entrantsInDestinationStationCount / (data().totalActiveEntrants || 1)) * 100)}%`,
												}}
												title={`${seg.entrantsInDestinationStationCount} inside station`}
											/>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>
				</CardContent>
			</Card>

			{/* 2. Two-Stage Alert Cards Grid */}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
				{/* STAGE 1: OVERDUE BETWEEN CHECKPOINTS */}
				<Card class="border-clay/40 bg-clay/5">
					<CardHeader class="p-4 border-b border-clay/20">
						<div class="flex items-center justify-between">
							<CardTitle class="text-sm font-bold font-serif text-clay-foreground flex items-center gap-2">
								<span>⚠️ Stage 1: Overdue Between Checkpoints</span>
							</CardTitle>
							<Badge variant="clay" class="font-mono text-xs tabular-nums">
								{stage1().length}
							</Badge>
						</div>
						<CardDescription class="text-xs">
							Active runners who have exceeded projected arrival upper confidence band or cutoff risk threshold.
						</CardDescription>
					</CardHeader>
					<CardContent class="p-4 space-y-3">
						<Show
							when={stage1().length > 0}
							fallback={
								<div class="py-12 text-center text-xs text-muted-foreground">
									Zero competitors overdue between checkpoints.
								</div>
							}
						>
							<For each={stage1()}>
								{(alert) => (
									<div
										onClick={() => handleOpenDossier(alert.entrantId)}
										class="rounded-xl border border-clay/30 bg-surface p-3 transition-colors hover:bg-muted/40 cursor-pointer space-y-2 select-none shadow-xs"
									>
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<span class="text-sm font-bold font-mono text-forest">
													#{alert.bibNumber}
												</span>
												<span class="font-bold text-xs text-foreground">
													{alert.fullName}
												</span>
											</div>
											<Show when={alert.sarBadge}>
												<Badge variant="clay" class="text-[10px]">
													{alert.sarBadge}
												</Badge>
											</Show>
										</div>

										<div class="grid grid-cols-2 gap-2 text-xs text-muted-foreground font-mono tabular-nums">
											<div>
												<span class="text-[10px] uppercase font-sans text-muted-foreground block">
													Departed
												</span>
												<span class="text-foreground">{alert.lastSplitName}</span>
											</div>
											<div>
												<span class="text-[10px] uppercase font-sans text-muted-foreground block">
													Expected At
												</span>
												<span class="text-foreground">{alert.expectedSplitName}</span>
											</div>
										</div>

										<div class="flex items-center justify-between text-xs pt-1 border-t border-border/80">
											<div class="font-semibold text-destructive font-mono tabular-nums">
												Overdue: +{formatDurationHms(alert.overdueSeconds)}
											</div>
											<span class="text-[11px] text-forest font-semibold hover:underline">
												View Triage Dossier →
											</span>
										</div>
									</div>
								)}
							</For>
						</Show>
					</CardContent>
				</Card>

				{/* STAGE 2: LINGERING IN STATION & RETIRED ON COURSE */}
				<Card class="border-destructive/30 bg-destructive/5">
					<CardHeader class="p-4 border-b border-destructive/20">
						<div class="flex items-center justify-between">
							<CardTitle class="text-sm font-bold font-serif text-destructive flex items-center gap-2">
								<span>🚨 Stage 2: Lingering or Retired on Course</span>
							</CardTitle>
							<Badge variant="destructive" class="font-mono text-xs tabular-nums">
								{stage2().length}
							</Badge>
						</div>
						<CardDescription class="text-xs text-destructive/80">
							Station dwell times exceeding 45 minutes or runners withdrawn on course between checkpoints.
						</CardDescription>
					</CardHeader>
					<CardContent class="p-4 space-y-3">
						<Show
							when={stage2().length > 0}
							fallback={
								<div class="py-12 text-center text-xs text-muted-foreground">
									Zero lingering station dwells or unaccounted drops.
								</div>
							}
						>
							<For each={stage2()}>
								{(alert) => (
									<div
										onClick={() => handleOpenDossier(alert.entrantId)}
										class="rounded-xl border border-destructive/30 bg-surface p-3 transition-colors hover:bg-muted/40 cursor-pointer space-y-2 select-none shadow-xs"
									>
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<span class="text-sm font-bold font-mono text-destructive">
													#{alert.bibNumber}
												</span>
												<span class="font-bold text-xs text-foreground">
													{alert.fullName}
												</span>
											</div>
											<Badge
												variant={alert.alertType === "retired_on_course" ? "destructive" : "clay"}
												class="text-[10px]"
											>
												{alert.alertType === "retired_on_course"
													? "Retired on Course"
													: "Lingering in Station"}
											</Badge>
										</div>

										<div class="text-xs text-foreground">
											<span class="font-semibold text-muted-foreground">Location: </span>
											{alert.locationName}
										</div>

										<div class="text-xs text-muted-foreground">
											{alert.details}
										</div>

										<div class="flex items-center justify-between text-xs pt-1 border-t border-border/80">
											<Show when={alert.emergencyContactOnSite}>
												<Badge variant="forest" class="text-[10px]">
													Emergency Contact On-Site
												</Badge>
											</Show>
											<span class="text-[11px] text-forest font-semibold hover:underline ml-auto">
												View Triage Dossier →
											</span>
										</div>
									</div>
								)}
							</For>
						</Show>
					</CardContent>
				</Card>
			</div>

			{/* Slide-Over Emergency & Medical Triage Sheet */}
			<Sheet
				open={selectedEntrantId() !== null}
				onOpenChange={(open) => {
					if (!open) {
						setSelectedEntrantId(null);
						setDossier(null);
					}
				}}
			>
				<SheetContent side="right" class="w-full sm:max-w-md overflow-y-auto">
					<SheetHeader>
						<SheetTitle>Search & Rescue Triage Dossier</SheetTitle>
						<SheetDescription>
							Complete safety telemetry, emergency contact, and medical clearance data.
						</SheetDescription>
					</SheetHeader>

					<Show
						when={dossier()}
						fallback={
							<div class="py-12 text-center text-xs text-muted-foreground">
								Loading triage dossier...
							</div>
						}
					>
						{(d) => (
							<div class="space-y-6 py-4">
								{/* Competitor Overview */}
								<div class="rounded-xl border border-border bg-card/40 p-4 space-y-2">
									<div class="flex items-center justify-between">
										<span class="text-2xl font-bold font-mono text-forest">
											#{d().entrant.bibNumber}
										</span>
										<Badge variant="outline" class="text-xs">
											{d().entrant.status.toUpperCase()}
										</Badge>
									</div>
									<div class="text-base font-bold text-foreground">
										{d().person.firstName} {d().person.lastName}
									</div>
									<div class="text-xs text-muted-foreground">
										Division: {d().entrant.division}
									</div>
									<Show when={d().person.phone}>
										<div class="text-xs text-muted-foreground font-mono">
											Phone: {d().person.phone}
										</div>
									</Show>
								</div>

								{/* Emergency Contact */}
								<div class="rounded-xl border border-border bg-card/40 p-4 space-y-2">
									<div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										Primary Emergency Contact
									</div>
									<Show
										when={d().emergencyContact.name}
										fallback={
											<div class="text-xs text-muted-foreground">
												No emergency contact on file.
											</div>
										}
									>
										<div class="font-bold text-sm text-foreground">
											{d().emergencyContact.name}
											<Show when={d().emergencyContact.relation}>
												<span class="font-normal text-muted-foreground text-xs ml-1">
													({d().emergencyContact.relation})
												</span>
											</Show>
										</div>
										<Show when={d().emergencyContact.phone}>
											<div class="text-xs font-mono font-semibold text-primary">
												📞 {d().emergencyContact.phone}
											</div>
										</Show>
										<Show when={d().emergencyContact.isOnSite}>
											<Badge variant="forest" class="text-xs mt-1">
												Emergency Contact Is On-Site at Venue
											</Badge>
										</Show>
									</Show>
								</div>

								{/* Medical & Safety Notes (RBAC Gated) */}
								<div class="rounded-xl border border-border bg-card/40 p-4 space-y-2">
									<div class="flex items-center justify-between">
										<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											Medical & Triage Notes
										</span>
										<Show when={d().isMedicalDataMasked}>
											<Badge variant="clay" class="text-[10px]">
												Masked
											</Badge>
										</Show>
									</div>

									<Show
										when={!d().isMedicalDataMasked}
										fallback={
											<div class="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground italic border border-border/80">
												Medical notes redacted. Staff role "Medical & SAR Lead" or Organization Admin privileges required to view confidential athlete medical disclosures.
											</div>
										}
									>
										<div class="text-xs text-foreground space-y-2">
											<div>
												<span class="font-semibold text-muted-foreground block">
													Allergies / Medications / Conditions:
												</span>
												<span>
													{d().participantData.medicalNotes || "None reported"}
												</span>
											</div>
											<Show when={d().historicalSummary?.safetyTriageNotes}>
												<div>
													<span class="font-semibold text-muted-foreground block">
														Historical Safety Notes:
													</span>
													<span>{d().historicalSummary!.safetyTriageNotes}</span>
												</div>
											</Show>
										</div>
									</Show>
								</div>

								{/* Vehicle Crew (for Rally / Downhill) */}
								<Show when={d().participantData.vehicle}>
									<div class="rounded-xl border border-border bg-card/40 p-4 space-y-2 text-xs">
										<div class="font-semibold uppercase tracking-wider text-muted-foreground">
											Vehicle & Crew
										</div>
										<div class="font-mono text-foreground font-bold">
											{d().participantData.vehicle!.year} {d().participantData.vehicle!.make}{" "}
											{d().participantData.vehicle!.model}
										</div>
										<div class="text-muted-foreground">
											Class: {d().participantData.vehicle!.vehicleClass}
										</div>
									</div>
								</Show>

								{/* Last Known Split */}
								<Show when={d().lastKnownSplit}>
									<div class="rounded-xl border border-border bg-card/40 p-4 space-y-1.5 text-xs font-mono">
										<div class="font-semibold uppercase tracking-wider text-muted-foreground font-sans">
											Last Known Recorded Split
										</div>
										<div class="font-bold text-foreground">
											{d().lastKnownSplit!.splitName} ({d().lastKnownSplit!.stationCode})
										</div>
										<div class="text-muted-foreground tabular-nums">
											Time: {new Date(d().lastKnownSplit!.timeUtc).toLocaleTimeString()} ·
											Elapsed: {formatDurationHms(d().lastKnownSplit!.elapsedSeconds)}
										</div>
									</div>
								</Show>
							</div>
						)}
					</Show>
				</SheetContent>
			</Sheet>
		</div>
	);
}
