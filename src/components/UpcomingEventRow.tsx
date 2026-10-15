import {
	dateParts,
	disciplineLabels,
	type EventGroupSummary,
	formatStartsIn,
} from "~/lib/events";

export default function UpcomingEventRow(props: {
	group: EventGroupSummary;
	now: Date;
}) {
	const start = () => dateParts(props.group.startDate, props.group.timeZone);

	return (
		<li class="flex items-center gap-5 py-4">
			<time
				datetime={props.group.startDate.toISOString()}
				class="flex w-14 shrink-0 flex-col items-center rounded-xl border border-border bg-surface py-2"
			>
				<span class="text-xs font-semibold uppercase tracking-widest text-forest">
					{start().month}
				</span>
				<span class="font-display text-3xl leading-none tabular-nums text-foreground">
					{start().day}
				</span>
			</time>

			<div class="min-w-0 flex-1">
				<h3 class="font-display m-0 text-xl font-normal text-foreground">
					{props.group.name}
				</h3>
				<p class="m-0 mt-0.5 text-sm text-muted-foreground">
					{disciplineLabels[props.group.discipline]} · {props.group.location}
				</p>
			</div>

			<span class="hidden shrink-0 text-sm text-muted-foreground sm:block">
				{formatStartsIn(props.group.startDate, props.now)}
			</span>
		</li>
	);
}
