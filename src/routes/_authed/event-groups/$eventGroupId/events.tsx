import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import ActionError from "~/components/ActionError";
import ConfirmButton from "~/components/ConfirmButton";
import EmptyState from "~/components/EmptyState";
import FormField from "~/components/FormField";
import FormSelect from "~/components/FormSelect";
import OrgSection from "~/components/OrgSection";
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
	addEvent,
	editEvent,
	removeEvent,
} from "~/event-groups/event-groups.functions";
import { utcToZonedLocal } from "~/lib/zoned-time";
import { createOrgAction } from "~/orgs/actions";
import { formatStart } from "~/orgs/format";
import type { getEventGroup } from "~/orgs/orgs.functions";

export const Route = createFileRoute(
	"/_authed/event-groups/$eventGroupId/events",
)({ component: Events });

const groupRoute = getRouteApi("/_authed/event-groups/$eventGroupId");

type Page = Awaited<ReturnType<typeof getEventGroup>>;
type GroupEvent = Page["events"][number];

function Events() {
	const data = groupRoute.useLoaderData();
	const [editing, setEditing] = createSignal<GroupEvent | "new">();
	const remove = createOrgAction();
	const timeZone = () => data().eventGroup.timeZone;

	return (
		<OrgSection
			title="Events"
			description={`Distances or classes in this group. Times are in ${timeZone().replaceAll("_", " ")}.`}
			action={
				<Show when={data().can.updateEventGroup && !editing()}>
					<Button
						disabled={data().courses.length === 0}
						onClick={() => setEditing("new")}
					>
						New event
					</Button>
				</Show>
			}
		>
			<div class="flex flex-col gap-6">
				<Show when={data().can.updateEventGroup && data().courses.length === 0}>
					<p class="text-scrim m-0 text-sm text-muted-foreground">
						Every event runs on a course.{" "}
						<Link
							to="/orgs/$slug/courses"
							params={{ slug: data().eventGroup.organizationSlug }}
							class="text-foreground underline underline-offset-4"
						>
							Add a course
						</Link>{" "}
						first.
					</p>
				</Show>
				<Show when={editing()} keyed>
					{(target) => (
						<EventForm
							eventGroupId={data().eventGroup.id}
							timeZone={timeZone()}
							courses={data().courses}
							event={target === "new" ? undefined : target}
							onDone={() => setEditing(undefined)}
						/>
					)}
				</Show>
				<ActionError error={remove.error()} />
				<Show
					when={data().events.length > 0}
					fallback={
						<Show when={!editing()}>
							<EmptyState
								title="No events yet"
								description="Add each distance you run this weekend, like the 100 mile and the 50K."
							/>
						</Show>
					}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Event</TableHead>
								<TableHead>Course</TableHead>
								<TableHead>Scheduled start</TableHead>
								<TableHead>Actual start</TableHead>
								<TableHead class="text-right">Laps</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={data().events}>
								{(event) => (
									<TableRow>
										<TableCell class="font-semibold">{event.name}</TableCell>
										<TableCell>
											<Show
												when={data().courses.length > 0}
												fallback={event.courseName}
											>
												<Link
													to="/orgs/$slug/courses/$courseId"
													params={{
														slug: data().eventGroup.organizationSlug,
														courseId: event.courseId,
													}}
													class="text-foreground underline-offset-4 hover:underline"
												>
													{event.courseName}
												</Link>
											</Show>
										</TableCell>
										<TableCell class="whitespace-nowrap tabular-nums">
											{formatStart(event.scheduledStart, timeZone())}
										</TableCell>
										<TableCell class="whitespace-nowrap tabular-nums text-muted-foreground">
											{event.actualStart
												? formatStart(event.actualStart, timeZone())
												: "—"}
										</TableCell>
										<TableCell class="text-right tabular-nums">
											{event.lapsRequired}
										</TableCell>
										<TableCell class="text-right whitespace-nowrap">
											<Show when={data().can.updateEventGroup}>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setEditing(event)}
												>
													Edit
												</Button>
												<ConfirmButton
													label="Delete"
													pending={remove.pending()}
													onConfirm={() =>
														remove.run(() =>
															removeEvent({ data: { eventId: event.id } }),
														)
													}
												/>
											</Show>
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

function EventForm(props: {
	eventGroupId: string;
	timeZone: string;
	courses: Page["courses"];
	event?: GroupEvent;
	onDone: () => void;
}) {
	const action = createOrgAction();
	const [name, setName] = createSignal(props.event?.name ?? "");
	const [courseId, setCourseId] = createSignal(
		props.event?.courseId ?? props.courses[0].id,
	);
	const [laps, setLaps] = createSignal(String(props.event?.lapsRequired ?? 1));
	const [scheduledStart, setScheduledStart] = createSignal(
		props.event
			? utcToZonedLocal(props.event.scheduledStart, props.timeZone)
			: "",
	);
	const [actualStart, setActualStart] = createSignal(
		props.event?.actualStart
			? utcToZonedLocal(props.event.actualStart, props.timeZone)
			: "",
	);

	const submit = async (e: SubmitEvent) => {
		e.preventDefault();
		const fields = {
			name: name(),
			courseId: courseId(),
			lapsRequired: Number(laps()),
			scheduledStart: scheduledStart(),
			actualStart: actualStart() || null,
		};
		const event = props.event;
		const ok = await action.run(() =>
			event
				? editEvent({ data: { eventId: event.id, ...fields } })
				: addEvent({ data: { eventGroupId: props.eventGroupId, ...fields } }),
		);
		if (ok) props.onDone();
	};

	return (
		<Card class="max-w-xl p-6">
			<form class="grid gap-6" onSubmit={submit}>
				<FormField
					label="Name"
					value={name()}
					onChange={setName}
					placeholder="100 Mile"
					required
				/>
				<div class="grid grid-cols-[1fr_auto] gap-4">
					<FormSelect
						label="Course"
						value={courseId()}
						onChange={setCourseId}
						options={props.courses.map((c) => ({ value: c.id, label: c.name }))}
					/>
					<FormField
						label="Laps"
						type="number"
						step="1"
						value={laps()}
						onChange={setLaps}
						required
					/>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<FormField
						label="Scheduled start"
						type="datetime-local"
						value={scheduledStart()}
						onChange={setScheduledStart}
						required
					/>
					<FormField
						label="Actual start"
						type="datetime-local"
						value={actualStart()}
						onChange={setActualStart}
					/>
				</div>
				<ActionError error={action.error()} />
				<div class="flex flex-wrap gap-3">
					<Button type="submit" disabled={action.pending()}>
						{props.event ? "Save event" : "Add event"}
					</Button>
					<Button variant="ghost" onClick={props.onDone}>
						Cancel
					</Button>
				</div>
			</form>
		</Card>
	);
}
