import DateBlock from "~/components/DateBlock";
import {
	disciplineLabels,
	type EventGroupSummary,
	formatStartsIn,
} from "~/lib/events";

export default function UpcomingEventRow(props: {
	group: EventGroupSummary;
	now: Date;
}) {
	return (
		<li class="flex items-center gap-5 py-4">
			<DateBlock date={props.group.startDate} timeZone={props.group.timeZone} />

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
