import { For } from "solid-js";
import { Badge } from "~/components/ui/badge";
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
				<span class="mt-0.5 text-xs text-muted-foreground">
					{start().weekday}
				</span>
			</time>

			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<h3 class="font-display m-0 text-xl font-normal text-foreground">
						{props.group.name}
					</h3>
					<span class="text-xs text-muted-foreground">
						{formatStartsIn(props.group.startDate, props.now)}
					</span>
				</div>
				<p class="m-0 mt-0.5 text-sm text-muted-foreground">
					{props.group.organization} · {props.group.location}
				</p>
				<div class="mt-2 flex flex-wrap gap-1.5">
					<Badge variant="chip">
						{disciplineLabels[props.group.discipline]}
					</Badge>
					<For each={props.group.races}>
						{(race) => <Badge variant="outline">{race}</Badge>}
					</For>
				</div>
			</div>

			<div class="hidden shrink-0 text-right sm:block">
				<p class="font-display m-0 text-2xl leading-none tabular-nums text-foreground">
					{props.group.entrants.toLocaleString("en-US")}
				</p>
				<p class="m-0 mt-1 text-xs text-muted-foreground">entrants</p>
			</div>
		</li>
	);
}
