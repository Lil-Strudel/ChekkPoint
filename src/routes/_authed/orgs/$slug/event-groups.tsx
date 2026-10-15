import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import EmptyState from "~/components/EmptyState";
import FormSelect from "~/components/FormSelect";
import OrgSection from "~/components/OrgSection";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "~/components/ui/text-field";
import { type Discipline, disciplineLabels } from "~/lib/events";
import { createOrgAction } from "~/orgs/actions";
import { formatDay } from "~/orgs/format";
import { addEventGroup } from "~/orgs/orgs.functions";
import { DISCIPLINES } from "~/orgs/orgs.shared";

export const Route = createFileRoute("/_authed/orgs/$slug/event-groups")({
	component: EventGroups,
});

const orgRoute = getRouteApi("/_authed/orgs/$slug");

const disciplineOptions = DISCIPLINES.map((value) => ({
	value,
	label: disciplineLabels[value],
}));

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
	const [name, setName] = createSignal("");
	const [discipline, setDiscipline] = createSignal<Discipline>("trail_ultra");
	const [startDate, setStartDate] = createSignal("");
	const [endDate, setEndDate] = createSignal("");

	const submit = async (e: SubmitEvent) => {
		e.preventDefault();
		const ok = await action.run(() =>
			addEventGroup({
				data: {
					organizationId: props.organizationId,
					name: name(),
					discipline: discipline(),
					startDate: startDate(),
					endDate: endDate() || startDate(),
				},
			}),
		);
		if (ok) props.onDone();
	};

	return (
		<Card class="max-w-xl p-6">
			<form class="grid gap-6" onSubmit={submit}>
				<TextField value={name()} onChange={setName} required>
					<TextFieldLabel>Name</TextFieldLabel>
					<TextFieldInput placeholder="Bonneville Ridge Weekend 2027" />
				</TextField>
				<FormSelect
					label="Discipline"
					value={discipline()}
					onChange={(value) => setDiscipline(value as Discipline)}
					options={disciplineOptions}
				/>
				<div class="grid grid-cols-2 gap-4">
					<TextField value={startDate()} onChange={setStartDate} required>
						<TextFieldLabel>Starts</TextFieldLabel>
						<TextFieldInput type="date" />
					</TextField>
					<TextField value={endDate()} onChange={setEndDate}>
						<TextFieldLabel>Ends</TextFieldLabel>
						<TextFieldInput type="date" />
					</TextField>
				</div>
				<Show when={action.error()}>
					<Alert variant="destructive">
						<AlertDescription>{action.error()}</AlertDescription>
					</Alert>
				</Show>
				<div class="flex flex-wrap gap-3">
					<Button type="submit" disabled={action.pending()}>
						Create event group
					</Button>
					<Button variant="ghost" onClick={props.onDone}>
						Cancel
					</Button>
				</div>
			</form>
		</Card>
	);
}
