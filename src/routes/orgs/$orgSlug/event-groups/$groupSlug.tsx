import { createFileRoute, Link, notFound } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import EmptyState from "~/components/EmptyState";
import OrgSection from "~/components/OrgSection";
import { Badge } from "~/components/ui/badge";
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
import { formatDate, formatDateTime } from "~/lib/organizations";

export const Route = createFileRoute("/orgs/$orgSlug/event-groups/$groupSlug")({
	loader: async ({ params, parentMatchPromise }) => {
		const { loaderData } = await parentMatchPromise;
		const group = loaderData?.org.eventGroups.find(
			(g) => g.slug === params.groupSlug,
		);
		if (!group) throw notFound();
		return group;
	},
	component: EventGroup,
	notFoundComponent: EventGroupNotFound,
});

function BackLink() {
	const params = Route.useParams();

	return (
		<Link
			to="/orgs/$orgSlug/event-groups"
			params={{ orgSlug: params().orgSlug }}
			class="text-scrim mb-6 inline-block text-sm font-semibold text-forest underline-offset-4 hover:underline"
		>
			← Event groups
		</Link>
	);
}

function EventGroup() {
	const group = Route.useLoaderData();

	return (
		<div>
			<BackLink />
			<OrgSection
				title={group().name}
				description={`${group().location} · ${formatDate(group().startDate, group().timeZone)}`}
				action={<Button disabled>New event</Button>}
			>
				<div class="mb-5">
					<Badge variant="sage">{disciplineLabels[group().discipline]}</Badge>
				</div>
				<Show
					when={group().events.length > 0}
					fallback={
						<EmptyState
							title="No events yet"
							description="Add each distance or class you're running, like the 100 mile and the 50K."
						/>
					}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Event</TableHead>
								<TableHead>Course</TableHead>
								<TableHead>Scheduled start</TableHead>
								<TableHead class="text-right">Laps</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={group().events}>
								{(event) => (
									<TableRow>
										<TableCell class="font-semibold">{event.name}</TableCell>
										<TableCell class="text-muted-foreground">
											{event.courseName}
										</TableCell>
										<TableCell class="whitespace-nowrap tabular-nums">
											{formatDateTime(event.scheduledStart, group().timeZone)}
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
		</div>
	);
}

function EventGroupNotFound() {
	return (
		<div>
			<BackLink />
			<EmptyState
				title="No such event group"
				description="It may have been renamed or removed."
			/>
		</div>
	);
}
