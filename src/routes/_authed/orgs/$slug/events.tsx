import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import EmptyState from "~/components/EmptyState";
import OrgSection from "~/components/OrgSection";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { formatStart } from "~/orgs/format";

export const Route = createFileRoute("/_authed/orgs/$slug/events")({
	component: Events,
});

const orgRoute = getRouteApi("/_authed/orgs/$slug");

function Events() {
	const data = orgRoute.useLoaderData();

	return (
		<OrgSection
			title="Events"
			description="Every event across your event groups."
		>
			<Show
				when={data().events.length > 0}
				fallback={
					<EmptyState
						title="No events yet"
						description="Events are the distances or classes inside an event group, like the 100 mile and the 50K. They'll all be listed here."
					/>
				}
			>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Event</TableHead>
							<TableHead>Event group</TableHead>
							<TableHead>Course</TableHead>
							<TableHead>Scheduled start</TableHead>
							<TableHead class="text-right">Laps</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<For each={data().events}>
							{(event) => (
								<TableRow>
									<TableCell class="font-semibold">{event.name}</TableCell>
									<TableCell>
										<Link
											to="/event-groups/$eventGroupId"
											params={{ eventGroupId: event.eventGroupId }}
											class="text-foreground underline-offset-4 hover:underline"
										>
											{event.eventGroupName}
										</Link>
									</TableCell>
									<TableCell class="text-muted-foreground">
										{event.courseName}
									</TableCell>
									<TableCell class="whitespace-nowrap tabular-nums">
										{formatStart(event.scheduledStart)}
									</TableCell>
									<TableCell class="text-right tabular-nums">
										{event.lapsRequired}
									</TableCell>
								</TableRow>
							)}
						</For>
					</TableBody>
				</Table>
			</Show>
		</OrgSection>
	);
}
