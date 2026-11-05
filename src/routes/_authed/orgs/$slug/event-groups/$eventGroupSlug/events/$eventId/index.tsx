import { createFileRoute, useRouter } from "@tanstack/solid-router";
import { createSignal, onCleanup, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Switch, SwitchControl } from "~/components/ui/switch";
import {
	backyardCloseYardFn,
	downhillGateReleaseFn,
	downhillTriggerRedFlagFn,
	fixedTimeRecordPartialLapFn,
	getSubEventOverview,
	resetGunFn,
	startGunFn,
	tsdGenerateIntervalsFn,
	tsdToggleSecretCheckpointsFn,
} from "~/race-control/race-control.functions";

export const Route = createFileRoute(
	"/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/",
)({
	loader: ({ params }) =>
		getSubEventOverview({
			data: {
				slug: params.slug,
				eventGroupSlug: params.eventGroupSlug,
				eventId: params.eventId,
			},
		}),
	component: SubEventOverviewGunStartTab,
});

function formatElapsed(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function SubEventOverviewGunStartTab() {
	const data = Route.useLoaderData();
	const router = useRouter();

	const event = () => data().event;
	const group = () => data().eventGroup;
	const custody = () => data().custody;
	const entrants = () => data().entrants;
	const access = () => data().access;

	// Live ticker
	const [now, setNow] = createSignal(new Date());
	const ticker = setInterval(() => setNow(new Date()), 1000);
	onCleanup(() => clearInterval(ticker));

	const hasStarted = () => Boolean(event().actualStartIso);
	const elapsedSeconds = () => {
		if (!event().actualStartIso) return 0;
		const startMs = new Date(event().actualStartIso!).getTime();
		return Math.max(0, Math.floor((now().getTime() - startMs) / 1000));
	};

	// Gun start action state
	const [isStartingGun, setIsStartingGun] = createSignal(false);
	const [isResettingGun, setIsResettingGun] = createSignal(false);
	const [gunError, setGunError] = createSignal<string | null>(null);

	const handleStartGun = async () => {
		if (
			!confirm(
				`Start race and record gun time for ${event().name}? All checked-in entrants (${custody().checkedIn}) will transition to 'On Course'.`,
			)
		) {
			return;
		}

		setIsStartingGun(true);
		setGunError(null);
		try {
			await startGunFn({ data: { eventId: event().id } });
			await router.invalidate();
		} catch (err: unknown) {
			setGunError(err instanceof Error ? err.message : "Failed to record gun start.");
		} finally {
			setIsStartingGun(false);
		}
	};

	const handleResetGun = async () => {
		if (
			!confirm(
				"Reset gun start? Entrants currently 'On Course' will revert to 'Checked In'.",
			)
		) {
			return;
		}

		setIsResettingGun(true);
		setGunError(null);
		try {
			await resetGunFn({ data: { eventId: event().id } });
			await router.invalidate();
		} catch (err: unknown) {
			setGunError(err instanceof Error ? err.message : "Failed to reset start.");
		} finally {
			setIsResettingGun(false);
		}
	};

	// =========================================================================
	// DISCIPLINE CONTROLS STATE
	// =========================================================================

	// Backyard Ultra
	const [currentYard, setCurrentYard] = createSignal(1);
	const [isClosingYard, setIsClosingYard] = createSignal(false);
	const [yardFeedback, setYardFeedback] = createSignal<string | null>(null);

	const yardRemainingSeconds = () => {
		const elapsed = elapsedSeconds();
		const limit = group().rulesConfig.yardTimeLimitSeconds ?? 3600;
		const withinYard = elapsed % limit;
		return Math.max(0, limit - withinYard);
	};

	const handleCloseYard = async () => {
		if (
			!confirm(
				`Close Yard #${currentYard()}? Any entrants who haven't completed the loop will be swept as DNF (OTL).`,
			)
		) {
			return;
		}

		setIsClosingYard(true);
		setYardFeedback(null);
		try {
			const res = await backyardCloseYardFn({
				data: {
					eventId: event().id,
					completedYardNumber: currentYard(),
				},
			});
			setYardFeedback(
				`Yard #${currentYard()} closed. ${res.sweptEntrantsCount} entrant(s) marked OTL. Moving to Yard #${currentYard() + 1}.`,
			);
			setCurrentYard((y) => y + 1);
			await router.invalidate();
		} catch (err: unknown) {
			setYardFeedback(err instanceof Error ? err.message : "Failed to close yard.");
		} finally {
			setIsClosingYard(false);
		}
	};

	// TSD Rally
	const [tsdBaseStart, setTsdBaseStart] = createSignal(event().scheduledStartIso.slice(0, 16));
	const [tsdInterval, setTsdInterval] = createSignal(60);
	const [isGeneratingTsd, setIsGeneratingTsd] = createSignal(false);
	const [tsdFeedback, setTsdFeedback] = createSignal<string | null>(null);
	const [secretRevealed, setSecretRevealed] = createSignal(false);

	const handleGenerateTsdIntervals = async (e: Event) => {
		e.preventDefault();
		setIsGeneratingTsd(true);
		setTsdFeedback(null);
		try {
			const res = await tsdGenerateIntervalStartsFn({
				data: {
					eventId: event().id,
					baseStartTimeUtc: new Date(tsdBaseStart()).toISOString(),
					intervalSeconds: tsdInterval(),
				},
			});
			setTsdFeedback(`Successfully generated interval start times for ${res.totalIntervalsAssigned} car crews.`);
			await router.invalidate();
		} catch (err: unknown) {
			setTsdFeedback(err instanceof Error ? err.message : "Failed to generate intervals.");
		} finally {
			setIsGeneratingTsd(false);
		}
	};

	const handleToggleSecretCheckpoints = async (checked: boolean) => {
		setSecretRevealed(checked);
		try {
			await tsdToggleSecretCheckpointsFn({
				data: { eventId: event().id, reveal: checked },
			});
		} catch (err) {
			console.error(err);
		}
	};

	// Downhill MTB
	const [redFlagNote, setRedFlagNote] = createSignal("");
	const [redFlagActive, setRedFlagActive] = createSignal(false);
	const [releasingRiderId, setReleasingRiderId] = createSignal<string | null>(null);

	const handleReleaseGate = async (entrantId: string) => {
		setReleasingRiderId(entrantId);
		try {
			await downhillGateReleaseFn({
				data: {
					eventId: event().id,
					entrantId,
					actualStartTime: new Date().toISOString(),
				},
			});
			await router.invalidate();
		} catch (err) {
			console.error(err);
		} finally {
			setReleasingRiderId(null);
		}
	};

	const handleTriggerRedFlag = async () => {
		const note = redFlagNote().trim() || "Course hold called for safety inspection";
		try {
			await downhillTriggerRedFlagFn({
				data: { eventId: event().id, holdNote: note },
			});
			setRedFlagActive(true);
			await router.invalidate();
		} catch (err) {
			console.error(err);
		}
	};

	// XCO Circuit
	const [xcoLeaderLap, setXcoLeaderLap] = createSignal(1);
	const [xcoLeaderLapTime, setXcoLeaderLapTime] = createSignal(900); // 15 mins default
	const xcoThreshold = () => Math.round(xcoLeaderLapTime() * 0.8);

	// Fixed-Time Loop
	const [partialLapEntrantId, setPartialLapEntrantId] = createSignal("");
	const [partialDistanceMeters, setPartialDistanceMeters] = createSignal(0);
	const [fixedTimeFeedback, setFixedTimeFeedback] = createSignal<string | null>(null);

	const handleRecordPartialDistance = async (e: Event) => {
		e.preventDefault();
		if (!partialLapEntrantId()) return;
		try {
			await fixedTimeRecordPartialLapFn({
				data: {
					eventId: event().id,
					entrantId: partialLapEntrantId(),
					partialDistanceMeters: partialDistanceMeters(),
				},
			});
			setFixedTimeFeedback(`Credited ${partialDistanceMeters()}m to competitor.`);
			await router.invalidate();
		} catch (err: unknown) {
			setFixedTimeFeedback(err instanceof Error ? err.message : "Failed to record distance.");
		}
	};

	return (
		<div class="px-6 py-8 max-w-7xl mx-auto space-y-8">
			{/* Custody KPIs Bar */}
			<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
				<div class="rounded-xl border border-border bg-card p-3 shadow-xs">
					<div class="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
						Registered
					</div>
					<div class="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">
						{custody().registered}
					</div>
				</div>

				<div class="rounded-xl border border-forest/30 bg-forest/5 p-3 shadow-xs">
					<div class="text-[11px] font-medium text-forest uppercase tracking-wider">
						Checked In
					</div>
					<div class="text-2xl font-bold font-mono tabular-nums text-forest mt-1">
						{custody().checkedIn}
					</div>
				</div>

				<div class="rounded-xl border border-primary/30 bg-primary/5 p-3 shadow-xs">
					<div class="text-[11px] font-medium text-primary uppercase tracking-wider">
						On Course
					</div>
					<div class="text-2xl font-bold font-mono tabular-nums text-primary mt-1">
						{custody().inProgress}
					</div>
				</div>

				<div class="rounded-xl border border-emerald-600/30 bg-emerald-500/5 p-3 shadow-xs">
					<div class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
						Finished
					</div>
					<div class="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
						{custody().finished}
					</div>
				</div>

				<div class="rounded-xl border border-rose-600/30 bg-rose-500/5 p-3 shadow-xs">
					<div class="text-[11px] font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider">
						DNF / Drops
					</div>
					<div class="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
						{custody().dnf}
					</div>
				</div>

				<div class="rounded-xl border border-amber-600/30 bg-amber-500/5 p-3 shadow-xs">
					<div class="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
						DNS
					</div>
					<div class="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
						{custody().dns}
					</div>
				</div>
			</div>

			{/* Gun Start Operational Panel */}
			<Card class="border-2 border-border">
				<CardHeader class="pb-3">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<CardTitle class="text-xl font-bold font-serif">
								Race Gun Start Operations
							</CardTitle>
							<CardDescription>
								Trigger official gun time, transition checked-in competitors, and monitor live elapsed race duration.
							</CardDescription>
						</div>

						<Badge
							variant={hasStarted() ? "primary" : "secondary"}
							class="text-xs px-2.5 py-1"
						>
							{hasStarted() ? "Race In Progress" : "Awaiting Gun Start"}
						</Badge>
					</div>
				</CardHeader>

				<CardContent class="space-y-6">
					<Show when={gunError()}>
						<div class="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
							{gunError()}
						</div>
					</Show>

					{/* Time Displays */}
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div class="rounded-xl bg-surface border border-border/80 p-4">
							<div class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Scheduled Start
							</div>
							<div class="text-xl font-bold font-mono tabular-nums text-foreground mt-1">
								{new Date(event().scheduledStartIso).toLocaleString([], {
									month: "short",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								})}
							</div>
							<div class="text-[11px] text-muted-foreground mt-0.5">
								Zone: {group().timeZone}
							</div>
						</div>

						<div class="rounded-xl bg-surface border border-border/80 p-4">
							<div class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Actual Gun Start
							</div>
							<div class="text-xl font-bold font-mono tabular-nums text-foreground mt-1">
								{event().actualStartIso
									? new Date(event().actualStartIso!).toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
											second: "2-digit",
										})
									: "Not Started"}
							</div>
							<div class="text-[11px] text-muted-foreground mt-0.5">
								{hasStarted() ? "Gun recorded in UTC" : "Waiting for start command"}
							</div>
						</div>

						<div class="rounded-xl bg-surface border border-border/80 p-4">
							<div class="text-xs font-semibold text-primary uppercase tracking-wider">
								Live Gun Clock
							</div>
							<div class="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">
								{hasStarted() ? formatElapsed(elapsedSeconds()) : "00:00:00"}
							</div>
							<div class="text-[11px] text-muted-foreground mt-0.5">
								{hasStarted() ? "Official running clock" : "T-0 at race gun"}
							</div>
						</div>
					</div>

					{/* Actions Bar */}
					<div class="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
						<Show
							when={!hasStarted()}
							fallback={
								<div class="flex items-center gap-3">
									<div class="text-xs font-medium text-forest inline-flex items-center gap-1.5">
										<span>●</span>
										<span>Race started at {new Date(event().actualStartIso!).toLocaleTimeString()}</span>
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={handleResetGun}
										disabled={isResettingGun() || !access().canManageRaceControl}
										class="text-xs text-destructive hover:bg-destructive/10"
									>
										{isResettingGun() ? "Resetting..." : "Reset Gun Time"}
									</Button>
								</div>
							}
						>
							<Button
								variant="forest"
								size="lg"
								onClick={handleStartGun}
								disabled={isStartingGun() || !access().canManageRaceControl}
								class="gap-2 font-bold text-sm cursor-pointer"
							>
								<span>🔫</span>
								<span>
									{isStartingGun()
										? "Recording Start..."
										: `Start Race / Record Gun Time (${custody().checkedIn} Entrants)`}
								</span>
							</Button>

							<p class="text-xs text-muted-foreground">
								Starts the race clock and automatically moves all {custody().checkedIn} checked-in competitors to "On Course".
							</p>
						</Show>
					</div>
				</CardContent>
			</Card>

			{/* Discipline-Adaptive Operational Controls */}
			<div class="space-y-4">
				<h2 class="text-lg font-bold font-serif text-foreground">
					Discipline-Adaptive Operational Controls
				</h2>

				{/* 1. BACKYARD ULTRA */}
				<Show when={group().discipline === "backyard_ultra"}>
					<Card class="border-border">
						<CardHeader>
							<div class="flex items-center justify-between">
								<CardTitle class="text-base font-bold font-serif flex items-center gap-2">
									<span>🔔</span>
									<span>Backyard Ultra Yard Controller & Elimination Sweep</span>
								</CardTitle>
								<Badge variant="clay" class="font-mono text-xs">
									Yard #{currentYard()}
								</Badge>
							</div>
							<CardDescription>
								Hourly bell timer with automated whistle alerts and 1-click out-of-time-limit sweep.
							</CardDescription>
						</CardHeader>

						<CardContent class="space-y-4">
							<Show when={yardFeedback()}>
								<div class="rounded-lg bg-primary/10 border border-primary/20 p-2.5 text-xs text-primary font-medium">
									{yardFeedback()}
								</div>
							</Show>

							<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
								<div class="rounded-xl bg-surface border border-border p-4 text-center">
									<div class="text-xs font-semibold text-muted-foreground uppercase">
										Current Yard
									</div>
									<div class="text-3xl font-bold font-mono tabular-nums text-foreground mt-1">
										#{currentYard()}
									</div>
									<div class="text-[11px] text-muted-foreground mt-1">
										{(currentYard() * 4.166667).toFixed(1)} Cumulative Miles
									</div>
								</div>

								<div class="rounded-xl bg-surface border border-border p-4 text-center">
									<div class="text-xs font-semibold text-muted-foreground uppercase">
										Countdown to Next Yard Bell
									</div>
									<div class="text-3xl font-bold font-mono tabular-nums text-primary mt-1">
										{hasStarted()
											? formatElapsed(yardRemainingSeconds()).slice(3)
											: "60:00"}
									</div>
									<div class="text-[11px] text-muted-foreground mt-1">
										{yardRemainingSeconds() <= 180 && yardRemainingSeconds() > 120 && "⚠️ 3 Whistles (3 min)"}
										{yardRemainingSeconds() <= 120 && yardRemainingSeconds() > 60 && "⚠️ 2 Whistles (2 min)"}
										{yardRemainingSeconds() <= 60 && "🚨 1 Whistle (1 min to Corral Close)"}
										{yardRemainingSeconds() > 180 && "Loop timer active"}
									</div>
								</div>

								<div class="rounded-xl bg-surface border border-border p-4 text-center">
									<div class="text-xs font-semibold text-muted-foreground uppercase">
										Field Remaining
									</div>
									<div class="text-3xl font-bold font-mono tabular-nums text-forest mt-1">
										{custody().inProgress}
									</div>
									<div class="text-[11px] text-muted-foreground mt-1">
										Competitors still in competition
									</div>
								</div>
							</div>

							<div class="pt-2 flex items-center justify-between">
								<Button
									variant="clay"
									onClick={handleCloseYard}
									disabled={isClosingYard() || !hasStarted() || !access().canManageRaceControl}
									class="gap-1.5 font-bold text-xs"
								>
									<span>🔔</span>
									<span>
										{isClosingYard()
											? "Sweeping Non-Finishers..."
											: `Close Yard #${currentYard()} & Mark Non-Finishers OTL (DNF)`}
									</span>
								</Button>

								<span class="text-xs text-muted-foreground">
									Whistle cues at 3:00, 2:00, and 1:00 before the top of the hour.
								</span>
							</div>
						</CardContent>
					</Card>
				</Show>

				{/* 2. TSD REGULARITY RALLY */}
				<Show when={group().discipline === "tsd_regularity"}>
					<Card class="border-border">
						<CardHeader>
							<div class="flex items-center justify-between">
								<CardTitle class="text-base font-bold font-serif flex items-center gap-2">
									<span>⏱️</span>
									<span>TSD Rally Staggered Out-Time Generator & Secret Controls</span>
								</CardTitle>
								<div class="flex items-center gap-2">
									<span class="text-xs font-semibold text-muted-foreground">
										Secret Checkpoints
									</span>
									<Switch
										checked={secretRevealed()}
										onChange={handleToggleSecretCheckpoints}
									>
										<SwitchControl />
									</Switch>
								</div>
							</div>
							<CardDescription>
								Generate minute-by-minute interval departures and manage secret rally checkpoint reveals.
							</CardDescription>
						</CardHeader>

						<CardContent class="space-y-4">
							<Show when={tsdFeedback()}>
								<div class="rounded-lg bg-primary/10 border border-primary/20 p-2.5 text-xs text-primary font-medium">
									{tsdFeedback()}
								</div>
							</Show>

							<form onSubmit={handleGenerateTsdIntervals} class="space-y-4">
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div class="space-y-1">
										<label class="text-xs font-semibold text-foreground">
											Base Start Time (Car #1)
										</label>
										<Input
											type="datetime-local"
											value={tsdBaseStart()}
											onInput={(e) => setTsdBaseStart(e.currentTarget.value)}
											required
										/>
									</div>

									<div class="space-y-1">
										<label class="text-xs font-semibold text-foreground">
											Interval Between Cars (Seconds)
										</label>
										<Input
											type="number"
											min="10"
											step="5"
											value={tsdInterval()}
											onInput={(e) => setTsdInterval(parseInt(e.currentTarget.value, 10) || 60)}
											required
										/>
									</div>
								</div>

								<Button
									type="submit"
									variant="forest"
									size="sm"
									disabled={isGeneratingTsd() || !access().canManageRaceControl}
									class="text-xs font-semibold"
								>
									{isGeneratingTsd()
										? "Generating..."
										: "Generate & Apply Car Interval Out-Times"}
								</Button>
							</form>
						</CardContent>
					</Card>
				</Show>

				{/* 3. DOWNHILL MTB / GRAVITY */}
				<Show when={group().discipline === "downhill_mtb"}>
					<Card class="border-border">
						<CardHeader>
							<div class="flex items-center justify-between">
								<CardTitle class="text-base font-bold font-serif flex items-center gap-2">
									<span>🚲</span>
									<span>Downhill MTB Gate Release & Red-Flag Course Hold</span>
								</CardTitle>
								<Show when={redFlagActive()}>
									<Badge variant="destructive" class="text-xs px-2 py-0.5 animate-pulse">
										🚨 Red Flag Active
									</Badge>
								</Show>
							</div>
							<CardDescription>
								Individual optical photocell gate dispatch and safety course hold management.
							</CardDescription>
						</CardHeader>

						<CardContent class="space-y-4">
							{/* Red Flag Trigger */}
							<div class="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex flex-wrap items-center justify-between gap-3">
								<div class="space-y-1">
									<div class="text-xs font-bold text-destructive uppercase tracking-wider">
										Course Red-Flag Hold
									</div>
									<div class="text-[11px] text-muted-foreground">
										Immediately holds starting gate and halts subsequent riders for track clearance.
									</div>
								</div>

								<div class="flex items-center gap-2">
									<Input
										placeholder="Reason for hold..."
										value={redFlagNote()}
										onInput={(e) => setRedFlagNote(e.currentTarget.value)}
										class="w-64 text-xs h-8"
									/>
									<Button
										variant="destructive"
										size="sm"
										onClick={handleTriggerRedFlag}
										disabled={!access().canManageRaceControl}
										class="text-xs font-bold"
									>
										Declare Red Flag
									</Button>
								</div>
							</div>

							{/* Rider Gate Release Roster */}
							<div class="space-y-2">
								<div class="text-xs font-semibold text-foreground">
									Upcoming Rider Drops
								</div>

								<div class="max-h-60 overflow-y-auto space-y-1.5 border border-border rounded-lg p-2">
									<For each={entrants().slice(0, 10)}>
										{(entrant) => {
											const isReleased = () => Boolean(entrant.actualStartTime);
											return (
												<div class="flex items-center justify-between rounded-md bg-surface px-3 py-2 text-xs border border-border/60">
													<div class="flex items-center gap-2">
														<span class="font-bold font-mono tabular-nums text-foreground">
															Plate #{entrant.competitorNumber}
														</span>
														<span>
															{entrant.person.firstName} {entrant.person.lastName}
														</span>
													</div>

													<div>
														<Show
															when={!isReleased()}
															fallback={
																<span class="text-forest font-mono text-[11px] font-semibold">
																	Released:{" "}
																	{new Date(entrant.actualStartTime!).toLocaleTimeString()}
																</span>
															}
														>
															<Button
																size="sm"
																variant="forest"
																class="h-7 text-xs font-bold px-3"
																onClick={() => handleReleaseGate(entrant.id)}
																disabled={
																	releasingRiderId() === entrant.id ||
																	redFlagActive() ||
																	!access().canManageRaceControl
																}
															>
																{releasingRiderId() === entrant.id
																	? "Releasing..."
																	: "Drop Gate 🚀"}
															</Button>
														</Show>
													</div>
												</div>
											);
										}}
									</For>
								</div>
							</div>
						</CardContent>
					</Card>
				</Show>

				{/* 4. LAP-BASED XCO CIRCUIT */}
				<Show when={group().discipline === "xco_cycling" || (group().discipline as string) === "xco_circuit"}>
					<Card class="border-border">
						<CardHeader>
							<CardTitle class="text-base font-bold font-serif flex items-center gap-2">
								<span>🔄</span>
								<span>XCO Circuit Leader Lap Progress & 80% Cutoff Calculator</span>
							</CardTitle>
							<CardDescription>
								UCI 80% rule pull calculation based on leader lap pace.
							</CardDescription>
						</CardHeader>

						<CardContent class="space-y-4">
							<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
								<div class="space-y-1">
									<label class="text-xs font-semibold text-foreground">Leader Lap</label>
									<Input
										type="number"
										min="1"
										value={xcoLeaderLap()}
										onInput={(e) => setXcoLeaderLap(parseInt(e.currentTarget.value, 10) || 1)}
									/>
								</div>

								<div class="space-y-1">
									<label class="text-xs font-semibold text-foreground">
										Leader Lap Duration (Seconds)
									</label>
									<Input
										type="number"
										min="60"
										step="10"
										value={xcoLeaderLapTime()}
										onInput={(e) => setXcoLeaderLapTime(parseInt(e.currentTarget.value, 10) || 900)}
									/>
								</div>

								<div class="rounded-xl bg-surface border border-border p-3 text-center">
									<div class="text-[11px] font-semibold text-muted-foreground uppercase">
										80% Cutoff Gap
									</div>
									<div class="text-2xl font-bold font-mono tabular-nums text-primary mt-1">
										{formatElapsed(xcoThreshold()).slice(3)}
									</div>
									<div class="text-[10px] text-muted-foreground mt-0.5">
										Riders trailing &gt;{xcoThreshold()}s pulled
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</Show>

				{/* 5. FIXED-TIME LOOP */}
				<Show when={group().discipline === "fixed_time_loop"}>
					<Card class="border-border">
						<CardHeader>
							<CardTitle class="text-base font-bold font-serif flex items-center gap-2">
								<span>⏳</span>
								<span>Fixed-Time Loop Horn Countdown & Partial Final Lap Credit</span>
							</CardTitle>
							<CardDescription>
								Credit partial meterage achieved on the course when the final horn sounds.
							</CardDescription>
						</CardHeader>

						<CardContent class="space-y-4">
							<Show when={fixedTimeFeedback()}>
								<div class="rounded-lg bg-primary/10 border border-primary/20 p-2.5 text-xs text-primary font-medium">
									{fixedTimeFeedback()}
								</div>
							</Show>

							<form onSubmit={handleRecordPartialDistance} class="space-y-4">
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div class="space-y-1">
										<label class="text-xs font-semibold text-foreground">
											Select Competitor
										</label>
										<select
											value={partialLapEntrantId()}
											onChange={(e) => setPartialLapEntrantId(e.currentTarget.value)}
											class="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
											required
										>
											<option value="">Select competitor...</option>
											<For each={entrants()}>
												{(entrant) => (
													<option value={entrant.id}>
														Bib #{entrant.competitorNumber} – {entrant.person.firstName}{" "}
														{entrant.person.lastName}
													</option>
												)}
											</For>
										</select>
									</div>

									<div class="space-y-1">
										<label class="text-xs font-semibold text-foreground">
											Partial Distance Credited (Meters)
										</label>
										<Input
											type="number"
											min="0"
											step="5"
											value={partialDistanceMeters()}
											onInput={(e) => setPartialDistanceMeters(parseFloat(e.currentTarget.value) || 0)}
											required
										/>
									</div>
								</div>

								<Button
									type="submit"
									variant="forest"
									size="sm"
									disabled={!access().canManageRaceControl}
									class="text-xs font-semibold"
								>
									Record Partial Final Lap Credit
								</Button>
							</form>
						</CardContent>
					</Card>
				</Show>
			</div>
		</div>
	);
}
