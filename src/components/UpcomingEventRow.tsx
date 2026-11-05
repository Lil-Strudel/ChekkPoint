import { Link } from "@tanstack/solid-router";
import DateBlock from "~/components/DateBlock";
import type { EnrichedPublicEventGroup } from "~/components/LiveEventCard";
import { formatStartsIn } from "~/lib/events";
import { DISCIPLINE_META } from "~/public/public.shared";

export default function UpcomingEventRow(props: {
	group: EnrichedPublicEventGroup;
	now: Date;
}) {
	const startDate = () => new Date(props.group.startDate);
	const disc = () => DISCIPLINE_META[props.group.discipline];

	return (
		<li class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
			<div class="flex min-w-0 flex-1 items-center gap-4">
				<DateBlock date={startDate()} timeZone={props.group.timeZone} />

				<div class="min-w-0 flex-1">
					<h3 class="font-display m-0 truncate text-xl font-normal text-foreground">
						<Link
							to="/events/$slug"
							params={{ slug: props.group.slug }}
							class="text-foreground no-underline hover:text-forest"
						>
							{props.group.name}
						</Link>
					</h3>

					<p class="m-0 mt-0.5 text-sm text-muted-foreground">
						{disc().shortLabel} · {props.group.location} ·{" "}
						<Link
							to="/organizers/$slug"
							params={{ slug: props.group.organizationSlug }}
							class="text-muted-foreground hover:text-forest"
						>
							{props.group.organizationName}
						</Link>
					</p>
				</div>
			</div>

			<span class="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
				{formatStartsIn(startDate(), props.now)}
			</span>
		</li>
	);
}
