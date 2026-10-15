import { For } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import {
	Progress,
	ProgressLabel,
	ProgressValueLabel,
} from "~/components/ui/progress";
import {
	disciplineLabels,
	elapsedHours,
	formatRaceClock,
	formatStartTime,
	type LiveEventGroup,
} from "~/lib/events";

export function LiveIndicator() {
	return (
		<span class="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-clay">
			<span class="relative flex size-2">
				<span class="absolute inline-flex size-full animate-ping rounded-full bg-clay opacity-60" />
				<span class="relative inline-flex size-2 rounded-full bg-clay" />
			</span>
			Live
		</span>
	);
}

export default function LiveEventCard(props: {
	group: LiveEventGroup;
	now: Date;
}) {
	const elapsed = () => elapsedHours(props.group, props.now);
	const stats = () => [
		{ label: "On course", value: props.group.onCourse },
		{ label: "Finished", value: props.group.finished },
		{ label: "Out", value: props.group.out },
	];

	return (
		<Card class="flex flex-col gap-5 p-6">
			<div class="flex items-center justify-between gap-3">
				<LiveIndicator />
				<Badge variant="chip">{disciplineLabels[props.group.discipline]}</Badge>
			</div>

			<div>
				<h3 class="font-display m-0 text-2xl font-normal leading-tight text-foreground">
					{props.group.name}
				</h3>
				<p class="m-0 mt-1 text-sm text-muted-foreground">
					{props.group.organization} · {props.group.location}
				</p>
			</div>

			<Progress
				value={Math.min(elapsed(), props.group.timeLimitHours)}
				maxValue={props.group.timeLimitHours}
				getValueLabel={({ value, max }) =>
					`${formatRaceClock(value * 3_600_000)} of ${formatRaceClock(max * 3_600_000)}`
				}
				class="flex flex-col gap-2"
			>
				<div class="flex items-baseline justify-between gap-3">
					<ProgressLabel class="text-xs font-normal text-muted-foreground">
						Race clock · started {formatStartTime(props.group)}
					</ProgressLabel>
					<ProgressValueLabel class="text-xs font-semibold tabular-nums" />
				</div>
			</Progress>

			<dl class="m-0 grid grid-cols-3 gap-3 border-t border-border pt-4">
				<For each={stats()}>
					{(stat) => (
						<div>
							<dt class="text-xs text-muted-foreground">{stat.label}</dt>
							<dd class="font-display m-0 mt-1 text-3xl leading-none tabular-nums text-foreground">
								{stat.value}
							</dd>
						</div>
					)}
				</For>
			</dl>

			<div class="mt-auto flex flex-wrap gap-1.5">
				<For each={props.group.races}>
					{(race) => <Badge variant="sage">{race}</Badge>}
				</For>
			</div>
		</Card>
	);
}
