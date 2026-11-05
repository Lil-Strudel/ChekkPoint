import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import FormSelect from "~/components/FormSelect";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { getPublicCourseById } from "~/public/public.functions";
import {
	calculateEffortSplits,
	DISCIPLINE_META,
	formatDistanceMiles,
	formatDuration,
	formatElevationFeet,
	formatPacePerMile,
	formatSubSplitKindLabel,
	type PacingStrategy,
} from "~/public/public.shared";

export const Route = createFileRoute("/courses/$courseId")({
	loader: ({ params }) =>
		getPublicCourseById({ data: { courseId: params.courseId } }),
	component: PublicCourseHomePage,
	notFoundComponent: CourseNotFound,
});

const strategyOptions = [
	{
		value: "conservative",
		label: "Conservative Ultra (+8% second-half fade)",
	},
	{ value: "even", label: "Even Split Pace (Constant velocity)" },
	{
		value: "positive",
		label: "Mountain / Night Fade (+16% second-half slow-down)",
	},
];

function PublicCourseHomePage() {
	const data = Route.useLoaderData();
	const course = () => data().course;

	const defaultHours = () => {
		const distKm = course().distanceMeters / 1000;
		if (distKm >= 140) return 26;
		if (distKm >= 70) return 11;
		if (distKm >= 40) return 6;
		return 2;
	};

	const [targetHours, setTargetHours] = createSignal(defaultHours());
	const [targetMinutes, setTargetMinutes] = createSignal(30);
	const [startTimeHHMM, setStartTimeHHMM] = createSignal("05:00");
	const [strategy, setStrategy] = createSignal<PacingStrategy>("conservative");

	const targetTotalSeconds = () =>
		Math.max(
			300,
			(Number.isFinite(targetHours()) ? targetHours() : 0) * 3600 +
				(Number.isFinite(targetMinutes()) ? targetMinutes() : 0) * 60,
		);

	const averagePacePerKm = () =>
		targetTotalSeconds() / Math.max(0.1, course().distanceMeters / 1000);

	const effortSplits = () =>
		calculateEffortSplits({
			totalDistanceMeters: course().distanceMeters,
			targetFinishSeconds: targetTotalSeconds(),
			startTimeHHMM: startTimeHHMM(),
			strategy: strategy(),
			splits: data().splits,
		});

	const hasMissedCutoff = () =>
		effortSplits().some((s) => s.cutoffStatus === "missed");

	return (
		<main class="page-wrap pb-24 pt-12">
			<div class="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
				<Link
					to="/events"
					class="text-scrim font-semibold text-forest no-underline hover:underline"
				>
					&larr; Events Directory
				</Link>
				<span>/</span>
				<Link
					to="/organizers/$slug"
					params={{ slug: course().organization.slug }}
					class="text-scrim text-muted-foreground no-underline hover:text-forest"
				>
					{course().organization.name}
				</Link>
			</div>

			<p class="page-label">Canonical Course &amp; Effort Planner</p>
			<h1 class="page-title mb-2">{course().name}</h1>
			<p class="page-sub mb-6">
				Stewarded by{" "}
				<Link
					to="/organizers/$slug"
					params={{ slug: course().organization.slug }}
					class="font-semibold text-forest hover:underline"
				>
					{course().organization.name}
				</Link>{" "}
				({course().organization.location})
				<Show
					when={course().copiedFromCourseId && course().copiedFromCourseName}
				>
					{" · "}Derived from{" "}
					<Link
						to="/courses/$courseId"
						params={{ courseId: course().copiedFromCourseId ?? "" }}
						class="font-medium text-forest hover:underline"
					>
						{course().copiedFromCourseName}
					</Link>
				</Show>
			</p>

			{/* Course Summary Stat Tiles */}
			<section class="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
				<Card class="p-5">
					<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
						Total Distance
					</p>
					<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-foreground">
						{formatDistanceMiles(course().distanceMeters)}
					</p>
					<p class="m-0 mt-1 text-xs tabular-nums text-muted-foreground">
						{(course().distanceMeters / 1000).toFixed(1)} km
					</p>
				</Card>

				<Card class="p-5">
					<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
						Elevation Gain
					</p>
					<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-foreground">
						{formatElevationFeet(course().elevationGainMeters)}
					</p>
					<p class="m-0 mt-1 text-xs tabular-nums text-muted-foreground">
						{course().elevationGainMeters ?? 0} m vertical climb
					</p>
				</Card>

				<Card class="p-5">
					<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
						Public Checkpoints
					</p>
					<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-foreground">
						{data().splits.length}
					</p>
					<p class="m-0 mt-1 text-xs text-muted-foreground">
						Verified timing stations
					</p>
				</Card>

				<Card class="p-5">
					<p class="m-0 text-xs font-bold uppercase tracking-widest text-clay">
						Target Overall Pace
					</p>
					<p class="font-display m-0 mt-2 text-4xl leading-none tabular-nums text-clay">
						{formatPacePerMile(averagePacePerKm())}
					</p>
					<p class="m-0 mt-1 text-xs tabular-nums text-muted-foreground">
						Goal: {formatDuration(targetTotalSeconds())}
					</p>
				</Card>
			</section>

			{/* Exclusive "Plan My Effort" Interactive Pace Calculator */}
			<section class="mb-16">
				<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
					<div>
						<p class="page-label mb-1">Interactive Crew &amp; Pacer Sheet</p>
						<h2 class="font-display text-scrim m-0 text-3xl font-normal text-foreground">
							"Plan My Effort" Pace &amp; Cutoff Calculator
						</h2>
					</div>
					<div class="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								setTargetHours(Math.max(1, Math.round(defaultHours() * 0.78)));
								setTargetMinutes(0);
							}}
						>
							Front-Pack Preset
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								setTargetHours(defaultHours());
								setTargetMinutes(30);
							}}
						>
							Median Finisher
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								setTargetHours(Math.round(defaultHours() * 1.25));
								setTargetMinutes(0);
							}}
						>
							Cutoff-Saver
						</Button>
					</div>
				</div>

				<Card class="mb-6 p-6">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
						<div class="grid gap-2">
							<label
								for="pace-target-hours"
								class="text-sm font-medium text-foreground"
							>
								Target Hours
							</label>
							<Input
								id="pace-target-hours"
								type="number"
								min="0"
								max="120"
								value={targetHours()}
								onInput={(e) =>
									setTargetHours(
										Math.max(
											0,
											Number.parseInt(e.currentTarget.value || "0", 10),
										),
									)
								}
							/>
						</div>

						<div class="grid gap-2">
							<label
								for="pace-target-minutes"
								class="text-sm font-medium text-foreground"
							>
								Target Minutes
							</label>
							<Input
								id="pace-target-minutes"
								type="number"
								min="0"
								max="59"
								value={targetMinutes()}
								onInput={(e) =>
									setTargetMinutes(
										Math.min(
											59,
											Math.max(
												0,
												Number.parseInt(e.currentTarget.value || "0", 10),
											),
										),
									)
								}
							/>
						</div>

						<div class="grid gap-2">
							<label
								for="pace-start-time"
								class="text-sm font-medium text-foreground"
							>
								Planned Start Time (24h)
							</label>
							<Input
								id="pace-start-time"
								type="time"
								value={startTimeHHMM()}
								onInput={(e) => setStartTimeHHMM(e.currentTarget.value)}
							/>
						</div>

						<FormSelect
							label="Pacing Curve Strategy"
							options={strategyOptions}
							value={strategy()}
							onChange={(v) => setStrategy(v as PacingStrategy)}
						/>
					</div>
				</Card>

				<Show when={hasMissedCutoff()}>
					<Alert variant="warning" class="mb-6">
						<AlertTitle>Cutoff Warning Detected</AlertTitle>
						<AlertDescription>
							With a target finish time of{" "}
							<strong>{formatDuration(targetTotalSeconds())}</strong> under the{" "}
							<strong>{strategy()}</strong> pacing strategy, one or more
							checkpoints exceed the official station departure cutoff.
						</AlertDescription>
					</Alert>
				</Show>

				<Show
					when={effortSplits().length > 0}
					fallback={
						<Card class="p-8 text-center text-sm text-muted-foreground">
							No public splits available for pace modeling.
						</Card>
					}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>#</TableHead>
								<TableHead>Checkpoint</TableHead>
								<TableHead>Distance</TableHead>
								<TableHead>Elevation</TableHead>
								<TableHead>Mode</TableHead>
								<TableHead>Predicted Elapsed</TableHead>
								<TableHead>Clock Arrival</TableHead>
								<TableHead>Segment Pace</TableHead>
								<TableHead>Hard Cutoff</TableHead>
								<TableHead class="text-right">Safety Buffer</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={effortSplits()}>
								{(sp) => (
									<TableRow>
										<TableCell class="font-bold tabular-nums text-muted-foreground">
											{sp.sequenceOrder}
										</TableCell>
										<TableCell class="font-semibold text-foreground">
											{sp.name}
										</TableCell>
										<TableCell class="tabular-nums">
											{formatDistanceMiles(sp.distanceFromStartMeters)}
										</TableCell>
										<TableCell class="tabular-nums">
											{formatElevationFeet(sp.elevationMeters)}
										</TableCell>
										<TableCell>
											<Badge variant="chip">
												{formatSubSplitKindLabel(sp.subSplitBitmap)}
											</Badge>
										</TableCell>
										<TableCell class="font-bold tabular-nums text-forest">
											{sp.predictedElapsedFormatted}
										</TableCell>
										<TableCell class="tabular-nums">
											<div class="flex items-center gap-1.5">
												<span class="font-medium">{sp.timeOfDayFormatted}</span>
												<Badge variant={sp.isNighttime ? "clay" : "sand"}>
													{sp.isNighttime ? "Night" : "Day"}
												</Badge>
											</div>
										</TableCell>
										<TableCell class="tabular-nums">
											{sp.segmentPaceFormatted}
										</TableCell>
										<TableCell class="tabular-nums text-muted-foreground">
											{sp.cutoffDurationSeconds
												? formatDuration(sp.cutoffDurationSeconds)
												: "—"}
										</TableCell>
										<TableCell class="text-right tabular-nums">
											<Badge
												variant={
													sp.cutoffStatus === "safe"
														? "forest"
														: sp.cutoffStatus === "tight"
															? "clay"
															: sp.cutoffStatus === "missed"
																? "destructive"
																: "sand"
												}
											>
												{sp.cutoffBufferFormatted}
											</Badge>
										</TableCell>
									</TableRow>
								)}
							</For>
						</TableBody>
					</Table>
				</Show>
			</section>

			{/* Events & Course Records Held on This Course */}
			<section>
				<h2 class="font-display text-scrim m-0 mb-4 text-3xl font-normal text-foreground">
					Events &amp; Course Records on {course().name}
				</h2>

				<Show
					when={data().eventsHeld.length > 0}
					fallback={
						<Card class="p-8 text-center text-sm text-muted-foreground">
							No events have been scheduled on this course yet.
						</Card>
					}
				>
					<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
						<For each={data().eventsHeld}>
							{(ev) => {
								const disc = DISCIPLINE_META[ev.discipline];
								return (
									<Card class="flex flex-col justify-between gap-4 p-6">
										<div>
											<div class="flex flex-wrap items-center gap-2">
												<Badge
													variant={
														ev.temporalState === "live"
															? "clay"
															: ev.temporalState === "upcoming"
																? "forest"
																: "sage"
													}
												>
													{ev.temporalState === "live"
														? "Live now"
														: ev.temporalState === "upcoming"
															? "Upcoming"
															: "Official results"}
												</Badge>
												<Badge variant={disc.badgeVariant}>{disc.label}</Badge>
											</div>

											<h3 class="font-display m-0 mt-2 text-2xl font-normal text-foreground">
												<Link
													to="/events/$slug"
													params={{ slug: ev.eventGroupSlug }}
													class="text-foreground no-underline hover:text-forest"
												>
													{ev.eventGroupName} — {ev.eventName}
												</Link>
											</h3>

											<p class="m-0 mt-1 text-sm tabular-nums text-muted-foreground">
												{ev.finisherCount} official finishers /{" "}
												{ev.totalEntrants} entrants
											</p>
										</div>

										<Show when={ev.courseRecord}>
											{(rec) => (
												<div class="rounded-xl border border-border bg-surface/60 px-4 py-3 text-xs">
													<span class="font-bold uppercase tracking-widest text-forest">
														Fastest Verified Effort:{" "}
													</span>
													<Link
														to="/athletes/$personId"
														params={{ personId: rec().personId }}
														class="font-semibold text-foreground hover:text-forest"
													>
														{rec().displayName}
													</Link>{" "}
													(#{rec().competitorNumber}) in{" "}
													<strong class="tabular-nums text-forest">
														{rec().elapsedFormatted}
													</strong>
												</div>
											)}
										</Show>

										<div class="flex flex-wrap gap-2">
											<Link
												to="/events/$slug"
												params={{ slug: ev.eventGroupSlug }}
												class={buttonVariants({ size: "sm" })}
											>
												Event Hub
											</Link>
											<Link
												to="/events/$slug/results"
												params={{ slug: ev.eventGroupSlug }}
												class={buttonVariants({
													variant: "outline",
													size: "sm",
												})}
											>
												Leaderboard
											</Link>
										</div>
									</Card>
								);
							}}
						</For>
					</div>
				</Show>
			</section>
		</main>
	);
}

function CourseNotFound() {
	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Course</p>
			<h1 class="page-title">Course not found</h1>
			<p class="page-sub">
				The requested course ID does not exist in the public directory.
			</p>
			<Link to="/events" class={buttonVariants({ variant: "outline" })}>
				Browse Events Directory
			</Link>
		</main>
	);
}
