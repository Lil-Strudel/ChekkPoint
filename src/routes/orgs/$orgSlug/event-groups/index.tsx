import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import EmptyState from "~/components/EmptyState";
import OrgSection from "~/components/OrgSection";
import { Button } from "~/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { disciplineLabels } from "~/lib/events";
import { formatDate } from "~/lib/organizations";

export const Route = createFileRoute("/orgs/$orgSlug/event-groups/")({
	component: EventGroups,
});

const orgRoute = getRouteApi("/orgs/$orgSlug");

function EventGroups() {
	const data = orgRoute.useLoaderData();
	const params = orgRoute.useParams();

	const groups = () =>
		[...data().org.eventGroups].sort(
			(a, b) => b.startDate.getTime() - a.startDate.getTime(),
		);

	return (
		<OrgSection
			title="Event groups"
			description="Races that share a weekend, volunteers and timing points."
			action={<Button disabled>New event group</Button>}
		>
			<Show
				when={groups().length > 0}
				fallback={
					<EmptyState
						title="No event groups yet"
						description="An event group is one race weekend. Each distance you run that weekend becomes an event inside it."
					/>
				}
			>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Discipline</TableHead>
							<TableHead>Starts</TableHead>
							<TableHead>Location</TableHead>
							<TableHead class="text-right">Events</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<For each={groups()}>
							{(group) => (
								<TableRow>
									<TableCell class="font-semibold">
										<Link
											to="/orgs/$orgSlug/event-groups/$groupSlug"
											params={{
												orgSlug: params().orgSlug,
												groupSlug: group.slug,
											}}
											class="text-foreground underline-offset-4 hover:underline"
										>
											{group.name}
										</Link>
									</TableCell>
									<TableCell class="text-muted-foreground">
										{disciplineLabels[group.discipline]}
									</TableCell>
									<TableCell class="whitespace-nowrap tabular-nums">
										{formatDate(group.startDate, group.timeZone)}
									</TableCell>
									<TableCell class="text-muted-foreground">
										{group.location}
									</TableCell>
									<TableCell class="text-right tabular-nums">
										{group.events.length}
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
