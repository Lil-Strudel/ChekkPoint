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
	type LiveEventGroup,
} from "~/lib/events";

export default function LiveEventCard(props: {
	group: LiveEventGroup;
	now: Date;
}) {
	const elapsed = () => elapsedHours(props.group, props.now);

	return (
		<Card class="flex flex-col gap-6 border-clay/40 p-7">
			<span class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-clay">
				<span class="relative flex size-2">
					<span class="absolute inline-flex size-full animate-ping rounded-full bg-clay opacity-60" />
					<span class="relative inline-flex size-2 rounded-full bg-clay" />
				</span>
				Live now
			</span>

			<div>
				<h2 class="font-display m-0 text-3xl font-normal leading-tight text-foreground">
					{props.group.name}
				</h2>
				<p class="m-0 mt-1 text-sm text-muted-foreground">
					{disciplineLabels[props.group.discipline]} · {props.group.location}
				</p>
			</div>

			<p class="m-0 flex items-baseline gap-2">
				<span class="font-display text-5xl leading-none tabular-nums text-foreground">
					{props.group.onCourse}
				</span>
				<span class="text-sm text-muted-foreground">on course</span>
			</p>

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
						Race clock
					</ProgressLabel>
					<ProgressValueLabel class="text-xs font-semibold tabular-nums" />
				</div>
			</Progress>
		</Card>
	);
}
