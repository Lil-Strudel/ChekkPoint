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
import { formatDateTime } from "~/lib/organizations";

export const Route = createFileRoute("/orgs/$orgSlug/events")({
	component: Events,
});

const orgRoute = getRouteApi("/orgs/$orgSlug");

function Events() {
	const data = orgRoute.useLoaderData();
	const params = orgRoute.useParams();

	const events = () =>
		data()
			.org.eventGroups.flatMap((group) =>
				group.events.map((event) => ({ ...event, group })),
			)
			.sort((a, b) => b.scheduledStart.getTime() - a.scheduledStart.getTime());

	return (
		<OrgSection
			title="Events"
			description="Every event across your event groups."
		>
			<Show
				when={events().length > 0}
				fallback={
					<EmptyState
						title="No events yet"
						description="Events are created inside an event group. Once you add some, they all show up here."
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
						<For each={events()}>
							{(event) => (
								<TableRow>
									<TableCell class="font-semibold">{event.name}</TableCell>
									<TableCell>
										<Link
											to="/orgs/$orgSlug/event-groups/$groupSlug"
											params={{
												orgSlug: params().orgSlug,
												groupSlug: event.group.slug,
											}}
											class="text-foreground underline-offset-4 hover:underline"
										>
											{event.group.name}
										</Link>
									</TableCell>
									<TableCell class="text-muted-foreground">
										{event.courseName}
									</TableCell>
									<TableCell class="whitespace-nowrap tabular-nums">
										{formatDateTime(event.scheduledStart, event.group.timeZone)}
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
