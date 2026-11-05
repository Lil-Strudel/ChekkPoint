import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import ActionError from "~/components/ActionError";
import EmptyState from "~/components/EmptyState";
import EventGroupForm, {
	dayInputValue,
	type EventGroupFields,
} from "~/components/EventGroupForm";
import OrgSection from "~/components/OrgSection";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { type Discipline, disciplineLabels } from "~/lib/events";
import { createOrgAction } from "~/orgs/actions";
import { formatDay } from "~/orgs/format";
import {
	addEventGroup,
	editEventGroup,
	removeEventGroup,
} from "~/orgs/orgs.functions";
import { DISCIPLINES } from "~/orgs/orgs.shared";

export const Route = createFileRoute("/_authed/orgs/$slug/event-groups/")({
	component: EventGroups,
});

const orgRoute = getRouteApi("/_authed/orgs/$slug");

type EventGroupItem = {
	id: string;
	name: string;
	slug: string;
	discipline: Discipline;
	startDate: string;
	endDate: string;
	timeZone: string;
	location: string | null;
	eventCount?: number;
};

const disciplineOptions = DISCIPLINES.map((value) => ({
	value,
	label: disciplineLabels[value],
}));

const zones = Intl.supportedValuesOf("timeZone");
const timeZones = zones.includes("UTC") ? zones : ["UTC", ...zones];

function EventGroups() {
	const data = orgRoute.useLoaderData();
	const [creating, setCreating] = createSignal(false);
	const [editingGroup, setEditingGroup] = createSignal<EventGroupItem | null>(
		null,
	);
	const [deleteError, setDeleteError] = createSignal<string | null>(null);
	const [deletingId, setDeletingId] = createSignal<string | null>(null);

	const removeAction = createOrgAction();

	const getEventCount = (groupId: string) => {
		const g = data().eventGroups.find((x) => x.id === groupId);
		if (g && typeof g.eventCount === "number") return g.eventCount;
		return data().events.filter((e) => e.eventGroupId === groupId).length;
	};

	async function handleDelete(group: EventGroupItem) {
		const count = getEventCount(group.id);
		if (count > 0) {
			setDeleteError(
				`Cannot delete event group "${group.name}" because it contains ${count} sub-event(s). Remove all sub-events first.`,
			);
			return;
		}

		if (
			!confirm(
				`Are you sure you want to delete event group "${group.name}"? This action cannot be undone.`,
			)
		) {
			return;
		}

		setDeleteError(null);
		setDeletingId(group.id);
		try {
			const ok = await removeAction.run(() =>
				removeEventGroup({
					data: { eventGroupId: group.id },
				}),
			);
			if (!ok && removeAction.error()) {
				setDeleteError(removeAction.error());
			}
		} catch (err) {
			setDeleteError(err instanceof Error ? err.message : String(err));
		} finally {
			setDeletingId(null);
		}
	}

	return (
		<OrgSection
			title="Event Groups"
			description="Race weekends, festivals, and multi-distance rallies with shared logistics, timing stations, and volunteer rosters."
			action={
				<Show when={data().can.createEventGroup && !creating()}>
					<Button onClick={() => setCreating(true)}>+ New Event Group</Button>
				</Show>
			}
		>
			<div class="flex flex-col gap-6">
				<Show when={deleteError()}>
					<Alert variant="destructive">
						<AlertTitle>Cannot Delete Event Group</AlertTitle>
						<AlertDescription>{deleteError()}</AlertDescription>
					</Alert>
				</Show>

				<Show when={creating()}>
					<div class="rounded-lg border border-border bg-card p-6 shadow-xs">
						<div class="mb-4">
							<h3 class="text-base font-semibold text-foreground">
								Create New Event Group
							</h3>
							<p class="text-xs text-muted-foreground">
								Set the weekend dates, location, and primary discipline. Sub-events
								and timing configurations are configured inside.
							</p>
						</div>
						<NewEventGroup
							organizationId={data().organization.id}
							onDone={() => setCreating(false)}
						/>
					</div>
				</Show>

				<Show
					when={data().eventGroups.length > 0}
					fallback={
						<Show when={!creating()}>
							<EmptyState
								title="No event groups yet"
								description="An event group represents a race weekend or festival. Each distance or division you run becomes an event inside it."
							/>
						</Show>
					}
				>
					<div class="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Event Group</TableHead>
									<TableHead>Discipline</TableHead>
									<TableHead>Location</TableHead>
									<TableHead>Dates</TableHead>
									<TableHead class="text-center">Sub-Events</TableHead>
									<TableHead class="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<For each={data().eventGroups}>
									{(group) => (
										<TableRow>
											<TableCell class="font-medium">
												<div class="flex flex-col gap-1">
													<div class="flex items-center gap-2">
														<Link
															to="/event-groups/$eventGroupId"
															params={{ eventGroupId: group.id }}
															class="font-semibold text-foreground underline-offset-4 hover:underline"
														>
															{group.name}
														</Link>
														<Link
															to="/events/$slug"
															params={{ slug: group.slug }}
															target="_blank"
															class="inline-flex"
														>
															<Badge
																variant="secondary"
																class="text-[10px] hover:bg-secondary/70"
															>
																/events/{group.slug} ↗
															</Badge>
														</Link>
													</div>
													<span class="text-xs text-muted-foreground font-mono">
														{group.timeZone}
													</span>
												</div>
											</TableCell>
											<TableCell>
												<Badge variant="outline">
													{disciplineLabels[group.discipline as Discipline] ??
														group.discipline}
												</Badge>
											</TableCell>
											<TableCell class="text-muted-foreground text-sm">
												{group.location ?? "—"}
											</TableCell>
											<TableCell class="whitespace-nowrap tabular-nums text-sm">
												<span>{formatDay(group.startDate)}</span>
												<Show when={group.endDate !== group.startDate}>
													<span class="text-muted-foreground">
														{" "}
														– {formatDay(group.endDate)}
													</span>
												</Show>
											</TableCell>
											<TableCell class="text-center">
												<Badge variant="chip" class="tabular-nums">
													{getEventCount(group.id)}
												</Badge>
											</TableCell>
											<TableCell class="text-right whitespace-nowrap">
												<div class="flex items-center justify-end gap-2">
													<Link
														to="/event-groups/$eventGroupId"
														params={{ eventGroupId: group.id }}
														class="text-xs font-medium text-primary hover:underline"
													>
														Open Workspace
													</Link>
													<Button
														variant="outline"
														size="sm"
														class="h-7 px-2.5 text-xs"
														onClick={() =>
															setEditingGroup({
																...group,
																discipline: group.discipline as Discipline,
															})
														}
													>
														Edit
													</Button>
													<Button
														variant="ghost"
														size="sm"
														class="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10"
														disabled={deletingId() === group.id}
														onClick={() =>
															handleDelete({
																...group,
																discipline: group.discipline as Discipline,
															})
														}
													>
														{deletingId() === group.id
															? "Deleting..."
															: "Delete"}
													</Button>
												</div>
											</TableCell>
										</TableRow>
									)}
								</For>
							</TableBody>
						</Table>
					</div>
				</Show>
			</div>

			<Dialog
				open={editingGroup() !== null}
				onOpenChange={(open) => {
					if (!open) setEditingGroup(null);
				}}
			>
				<DialogContent class="sm:max-w-lg">
					<Show when={editingGroup()} keyed>
						{(group) => (
							<EditEventGroupModal
								group={group}
								onDone={() => setEditingGroup(null)}
							/>
						)}
					</Show>
				</DialogContent>
			</Dialog>
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

function EditEventGroupModal(props: {
	group: EventGroupItem;
	onDone: () => void;
}) {
	const action = createOrgAction();
	const [name, setName] = createSignal(props.group.name);
	const [slug, setSlug] = createSignal(props.group.slug);
	const [discipline, setDiscipline] = createSignal<Discipline>(
		props.group.discipline,
	);
	const [startDate, setStartDate] = createSignal(
		typeof props.group.startDate === "string"
			? props.group.startDate.slice(0, 10)
			: dayInputValue(new Date(props.group.startDate)),
	);
	const [endDate, setEndDate] = createSignal(
		typeof props.group.endDate === "string"
			? props.group.endDate.slice(0, 10)
			: dayInputValue(new Date(props.group.endDate)),
	);
	const [timeZone, setTimeZone] = createSignal(props.group.timeZone);
	const [location, setLocation] = createSignal(props.group.location ?? "");

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		const ok = await action.run(() =>
			editEventGroup({
				data: {
					eventGroupId: props.group.id,
					name: name().trim(),
					slug: slug().trim(),
					discipline: discipline(),
					startDate: startDate(),
					endDate: endDate() || startDate(),
					timeZone: timeZone(),
					location: location().trim() || null,
				},
			}),
		);
		if (ok) props.onDone();
	}

	return (
		<div>
			<DialogHeader>
				<DialogTitle>Edit Event Group</DialogTitle>
				<DialogDescription>
					Update details for this race weekend or competition group.
				</DialogDescription>
			</DialogHeader>

			<Show when={action.error()}>
				<div class="mt-3">
					<ActionError error={action.error()} />
				</div>
			</Show>

			<form class="space-y-4 py-3" onSubmit={submit}>
				<div class="space-y-1.5">
					<Label for="egName">Name</Label>
					<Input
						id="egName"
						value={name()}
						onInput={(e) => setName(e.currentTarget.value)}
						placeholder="Cascade Crest 100M"
						required
					/>
				</div>

				<div class="space-y-1.5">
					<Label for="egSlug">URL Slug</Label>
					<Input
						id="egSlug"
						value={slug()}
						onInput={(e) => setSlug(e.currentTarget.value)}
						placeholder="cascade-crest-100m"
						required
					/>
					<p class="text-[11px] text-muted-foreground">
						Public landing page will be at /events/{slug() || "slug"}
					</p>
				</div>

				<div class="space-y-1.5">
					<Label for="egDiscipline">Discipline</Label>
					<select
						id="egDiscipline"
						value={discipline()}
						onChange={(e) =>
							setDiscipline(e.currentTarget.value as Discipline)
						}
						class="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
					>
						<For each={disciplineOptions}>
							{(opt) => <option value={opt.value}>{opt.label}</option>}
						</For>
					</select>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label for="egStartDate">Starts</Label>
						<Input
							id="egStartDate"
							type="date"
							value={startDate()}
							onInput={(e) => setStartDate(e.currentTarget.value)}
							required
						/>
					</div>
					<div class="space-y-1.5">
						<Label for="egEndDate">Ends</Label>
						<Input
							id="egEndDate"
							type="date"
							value={endDate()}
							onInput={(e) => setEndDate(e.currentTarget.value)}
							required
						/>
					</div>
				</div>

				<div class="space-y-1.5">
					<Label for="egTimeZone">Time Zone</Label>
					<Input
						id="egTimeZone"
						value={timeZone()}
						onInput={(e) => setTimeZone(e.currentTarget.value)}
						list="eg-timezones"
						required
					/>
					<datalist id="eg-timezones">
						<For each={timeZones}>{(zone) => <option value={zone} />}</For>
					</datalist>
				</div>

				<div class="space-y-1.5">
					<Label for="egLocation">Location</Label>
					<Input
						id="egLocation"
						value={location()}
						onInput={(e) => setLocation(e.currentTarget.value)}
						placeholder="Easton, Washington"
					/>
				</div>

				<DialogFooter class="pt-3">
					<Button
						type="button"
						variant="ghost"
						onClick={props.onDone}
						disabled={action.pending()}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={action.pending()}>
						{action.pending() ? "Saving..." : "Save Changes"}
					</Button>
				</DialogFooter>
			</form>
		</div>
	);
}
