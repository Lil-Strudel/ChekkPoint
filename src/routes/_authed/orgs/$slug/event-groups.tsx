import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import EmptyState from "~/components/EmptyState";
import EventGroupForm from "~/components/EventGroupForm";
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
import { createOrgAction } from "~/orgs/actions";
import { formatDay } from "~/orgs/format";
import { addEventGroup } from "~/orgs/orgs.functions";

export const Route = createFileRoute("/_authed/orgs/$slug/event-groups")({
	component: EventGroups,
});

const orgRoute = getRouteApi("/_authed/orgs/$slug");

function EventGroups() {
	const data = orgRoute.useLoaderData();
	const [creating, setCreating] = createSignal(false);

	const eventCount = (eventGroupId: string) =>
		data().events.filter((event) => event.eventGroupId === eventGroupId).length;

	return (
		<OrgSection
			title="Event groups"
			description="Races that share a weekend, volunteers and timing points."
			action={
				<Show when={data().can.createEventGroup && !creating()}>
					<Button onClick={() => setCreating(true)}>New event group</Button>
				</Show>
			}
		>
			<div class="flex flex-col gap-6">
				<Show when={creating()}>
					<NewEventGroup
						organizationId={data().organization.id}
						onDone={() => setCreating(false)}
					/>
				</Show>

				<Show
					when={data().eventGroups.length > 0}
					fallback={
						<Show when={!creating()}>
							<EmptyState
								title="No event groups yet"
								description="An event group is one race weekend. Each distance you run that weekend becomes an event inside it."
							/>
						</Show>
					}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Discipline</TableHead>
								<TableHead>Location</TableHead>
								<TableHead>Starts</TableHead>
								<TableHead>Ends</TableHead>
								<TableHead class="text-right">Events</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={data().eventGroups}>
								{(group) => (
									<TableRow>
										<TableCell class="font-semibold">
											<Link
												to="/event-groups/$eventGroupId"
												params={{ eventGroupId: group.id }}
												class="text-foreground underline-offset-4 hover:underline"
											>
												{group.name}
											</Link>
										</TableCell>
										<TableCell class="text-muted-foreground">
											{disciplineLabels[group.discipline]}
										</TableCell>
										<TableCell class="text-muted-foreground">
											{group.location ?? "—"}
										</TableCell>
										<TableCell class="whitespace-nowrap tabular-nums">
											{formatDay(group.startDate)}
										</TableCell>
										<TableCell class="whitespace-nowrap tabular-nums text-muted-foreground">
											{formatDay(group.endDate)}
										</TableCell>
										<TableCell class="text-right tabular-nums">
											{eventCount(group.id)}
										</TableCell>
									</TableRow>
								)}
							</For>
						</TableBody>
					</Table>
				</Show>
			</div>
		</OrgSection>
	);
}

function NewEventGroup(props: { organizationId: string; onDone: () => void }) {
	const action = createOrgAction();

	return (
		<EventGroupForm
			submitLabel="Create event group"
			error={action.error()}
			pending={action.pending()}
			onSubmit={async (group) => {
				const ok = await action.run(() =>
					addEventGroup({
						data: { organizationId: props.organizationId, ...group },
					}),
				);
				if (ok) props.onDone();
			}}
		>
			<Button variant="ghost" onClick={props.onDone}>
				Cancel
			</Button>
		</EventGroupForm>
	);
}
