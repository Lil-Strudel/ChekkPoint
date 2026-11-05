import {
	createFileRoute,
	getRouteApi,
	useNavigate,
} from "@tanstack/solid-router";
import { createMemo, createSignal, For, type JSX, Show } from "solid-js";
import { z } from "zod";
import ActionError from "~/components/ActionError";
import ConfirmButton from "~/components/ConfirmButton";
import EmptyState from "~/components/EmptyState";
import FormField from "~/components/FormField";
import FormSelect from "~/components/FormSelect";
import OrgSection from "~/components/OrgSection";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
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
	TextFieldLabel,
	TextFieldTextArea,
} from "~/components/ui/text-field";
import type { ParticipantData } from "~/db/schema";
import {
	addEntrant,
	editEntrant,
	getEntrants,
	removeEntrant,
	uploadEntrants,
} from "~/entrants/entrants.functions";
import {
	DROPPED_STATUSES,
	ENTRANT_STATUS_LABELS,
	ENTRANT_STATUSES,
	type EntrantStatus,
	IMPORT_COLUMNS,
	type ImportRow,
	importRowInput,
} from "~/entrants/entrants.shared";
import { csvRecords } from "~/lib/csv";
import { utcToZonedLocal } from "~/lib/zoned-time";
import { createOrgAction } from "~/orgs/actions";
import { formatStart } from "~/orgs/format";
import type { getEventGroup } from "~/orgs/orgs.functions";

export const Route = createFileRoute(
	"/_authed/event-groups/$eventGroupId/entrants",
)({
	validateSearch: z.object({ event: z.uuid().optional() }),
	loader: ({ params }) =>
		getEntrants({ data: { eventGroupId: params.eventGroupId } }),
	component: Entrants,
	notFoundComponent: () => (
		<EmptyState
			title="Entrants are for organization members"
			description="Ask an organizer to add you to the organization."
		/>
	),
});

const groupRoute = getRouteApi("/_authed/event-groups/$eventGroupId");

type Group = Awaited<ReturnType<typeof getEventGroup>>;
type Page = Awaited<ReturnType<typeof getEntrants>>;
type Entrant = Page["entrants"][number];

const ALL_EVENTS = "all";

const statusOptions = ENTRANT_STATUSES.map((value) => ({
	value,
	label: ENTRANT_STATUS_LABELS[value],
}));

function orNull(value: string | undefined) {
	return value?.trim() || null;
}

function Entrants() {
	const group = groupRoute.useLoaderData();
	const data = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const [editing, setEditing] = createSignal<Entrant | "new" | "import">();
	const remove = createOrgAction();

	const filtered = () =>
		search().event
			? data().entrants.filter((e) => e.eventId === search().event)
			: data().entrants;
	const eventOptions = () => [
		{ value: ALL_EVENTS, label: "All events" },
		...group().events.map((e) => ({ value: e.id, label: e.name })),
	];
	const timeZone = () => group().eventGroup.timeZone;

	return (
		<OrgSection
			title="Entrants"
			description={`${filtered().length} of ${data().entrants.length} shown.`}
			action={
				<Show
					when={data().can.create && !editing() && group().events.length > 0}
				>
					<div class="flex flex-wrap gap-3">
						<Button variant="outline" onClick={() => setEditing("import")}>
							Import CSV
						</Button>
						<Button onClick={() => setEditing("new")}>Add entrant</Button>
					</div>
				</Show>
			}
		>
			<div class="flex flex-col gap-6">
				<Show
					when={group().events.length > 0}
					fallback={
						<EmptyState
							title="No events yet"
							description="Entrants sign up for an event. Add one on the Events tab first."
						/>
					}
				>
					<FormSelect
						class="grid max-w-xs gap-2"
						label="Event"
						value={search().event ?? ALL_EVENTS}
						onChange={(value) =>
							navigate({
								search: { event: value === ALL_EVENTS ? undefined : value },
								replace: true,
							})
						}
						options={eventOptions()}
					/>
				</Show>

				<Show when={editing()} keyed>
					{(target) =>
						target === "import" ? (
							<ImportEntrants
								events={group().events}
								eventId={search().event}
								onDone={() => setEditing(undefined)}
							/>
						) : (
							<EntrantForm
								group={group()}
								splits={data().splits}
								entrant={target === "new" ? undefined : target}
								eventId={search().event}
								onDone={() => setEditing(undefined)}
							/>
						)
					}
				</Show>

				<ActionError error={remove.error()} />

				<Show when={filtered().length > 0}>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Bib</TableHead>
								<TableHead>Name</TableHead>
								<Show when={!search().event}>
									<TableHead>Event</TableHead>
								</Show>
								<TableHead>Division</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Wave start</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={filtered()}>
								{(entrant) => (
									<TableRow>
										<TableCell class="tabular-nums font-semibold">
											{entrant.competitorNumber}
										</TableCell>
										<TableCell>
											<span class="block">
												{entrant.person.firstName} {entrant.person.lastName}
											</span>
											<span class="text-xs text-muted-foreground">
												{entrant.person.email}
											</span>
										</TableCell>
										<Show when={!search().event}>
											<TableCell class="text-muted-foreground">
												{entrant.eventName}
											</TableCell>
										</Show>
										<TableCell>{entrant.division}</TableCell>
										<TableCell>
											<Badge
												variant={
													DROPPED_STATUSES.includes(entrant.status)
														? "clay"
														: "chip"
												}
											>
												{ENTRANT_STATUS_LABELS[entrant.status]}
											</Badge>
										</TableCell>
										<TableCell class="whitespace-nowrap tabular-nums text-muted-foreground">
											{entrant.scheduledStartTime
												? formatStart(entrant.scheduledStartTime, timeZone())
												: "—"}
										</TableCell>
										<TableCell class="text-right whitespace-nowrap">
											<Show when={data().can.update}>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setEditing(entrant)}
												>
													Edit
												</Button>
											</Show>
											<Show when={data().can.delete}>
												<ConfirmButton
													label="Delete"
													pending={remove.pending()}
													onConfirm={() =>
														remove.run(() =>
															removeEntrant({
																data: { entrantId: entrant.id },
															}),
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

const participantTemplates: Record<
	Exclude<ParticipantData["kind"], "solo_competitor">,
	ParticipantData
> = {
	vehicle_crew: {
		kind: "vehicle_crew",
		driver: { name: "", licenseNumber: "" },
		vehicle: { make: "", model: "", year: 2000, vehicleClass: "" },
	},
	relay_team: {
		kind: "relay_team",
		teamName: "",
		captainContact: { name: "", phone: "" },
		members: [],
	},
};

function Section(props: { title: string; children: JSX.Element }) {
	return (
		<fieldset class="m-0 grid gap-4 border-0 p-0">
			<legend class="mb-2 p-0 text-sm font-semibold text-foreground">
				{props.title}
			</legend>
			{props.children}
		</fieldset>
	);
}

function EntrantForm(props: {
	group: Group;
	splits: Page["splits"];
	entrant?: Entrant;
	eventId?: string;
	onDone: () => void;
}) {
	const action = createOrgAction();
	const e = props.entrant;
	const timeZone = props.group.eventGroup.timeZone;
	const toLocal = (date: Date | null | undefined) =>
		date ? utcToZonedLocal(date, timeZone) : "";
	const solo =
		e?.participantData.kind === "solo_competitor"
			? e.participantData
			: undefined;

	const [eventId, setEventId] = createSignal(
		e?.eventId ?? props.eventId ?? props.group.events[0].id,
	);
	const [bib, setBib] = createSignal(e?.competitorNumber ?? "");
	const [rfid, setRfid] = createSignal(e?.rfidCode ?? "");
	const [division, setDivision] = createSignal(e?.division ?? "");
	const [status, setStatus] = createSignal<EntrantStatus>(
		e?.status ?? "registered",
	);
	const [firstName, setFirstName] = createSignal(e?.person.firstName ?? "");
	const [lastName, setLastName] = createSignal(e?.person.lastName ?? "");
	const [email, setEmail] = createSignal(e?.person.email ?? "");
	const [gender, setGender] = createSignal(e?.person.gender ?? "");
	const [birthdate, setBirthdate] = createSignal(e?.person.birthdate ?? "");
	const [phone, setPhone] = createSignal(e?.person.phone ?? "");
	const [scheduledStart, setScheduledStart] = createSignal(
		toLocal(e?.scheduledStartTime),
	);
	const [actualStart, setActualStart] = createSignal(
		toLocal(e?.actualStartTime),
	);
	const [kind, setKind] = createSignal<ParticipantData["kind"]>(
		e?.participantData.kind ?? "solo_competitor",
	);
	const [medicalNotes, setMedicalNotes] = createSignal(
		solo?.medicalNotes ?? "",
	);
	const [pacerName, setPacerName] = createSignal(solo?.pacerName ?? "");
	const [shirtSize, setShirtSize] = createSignal(solo?.tShirtSize ?? "");
	const [participantJson, setParticipantJson] = createSignal(
		e && !solo ? JSON.stringify(e.participantData, null, 2) : "",
	);
	const [contactName, setContactName] = createSignal(
		e?.emergencyContact?.name ?? "",
	);
	const [contactPhone, setContactPhone] = createSignal(
		e?.emergencyContact?.phone ?? "",
	);
	const [contactRelationship, setContactRelationship] = createSignal(
		e?.emergencyContact?.relationship ?? "",
	);
	const [contactOnSite, setContactOnSite] = createSignal(
		e?.emergencyContact?.isOnSite ?? false,
	);
	const [droppedSplitId, setDroppedSplitId] = createSignal(
		e?.droppedSplitId ?? "",
	);
	const [dropReason, setDropReason] = createSignal(e?.dropReason ?? "");
	const [dropLocation, setDropLocation] = createSignal(
		e?.dropLocationDescription ?? "",
	);
	const [comments, setComments] = createSignal(e?.comments ?? "");
	const [formError, setFormError] = createSignal<string>();

	const changeKind = (value: string) => {
		const next = value as ParticipantData["kind"];
		setKind(next);
		if (next !== "solo_competitor" && !participantJson()) {
			setParticipantJson(JSON.stringify(participantTemplates[next], null, 2));
		}
	};

	const splitOptions = () => [
		{ value: "", label: "Not at a split" },
		...props.splits
			.filter((s) => s.eventId === eventId())
			.map((s) => ({ value: s.id, label: s.name })),
	];

	const participantData = (): ParticipantData | undefined => {
		if (kind() === "solo_competitor") {
			return {
				kind: "solo_competitor",
				medicalNotes: medicalNotes().trim() || undefined,
				pacerName: pacerName().trim() || undefined,
				tShirtSize: shirtSize().trim() || undefined,
			};
		}
		try {
			return JSON.parse(participantJson());
		} catch {
			return undefined;
		}
	};

	const submit = async (event: SubmitEvent) => {
		event.preventDefault();
		setFormError(undefined);
		const participant = participantData();
		if (!participant) {
			setFormError("The participant details aren't valid JSON.");
			return;
		}
		const dropped = DROPPED_STATUSES.includes(status());
		const fields = {
			eventId: eventId(),
			competitorNumber: bib(),
			rfidCode: orNull(rfid()),
			division: division(),
			status: status(),
			person: {
				firstName: firstName(),
				lastName: lastName(),
				email: orNull(email()),
				gender: orNull(gender()),
				birthdate: orNull(birthdate()),
				phone: orNull(phone()),
			},
			participantData: participant,
			emergencyContact: contactName().trim()
				? {
						name: contactName(),
						phone: orNull(contactPhone()),
						relationship: orNull(contactRelationship()),
						isOnSite: contactOnSite(),
					}
				: null,
			scheduledStartTime: scheduledStart() || null,
			actualStartTime: actualStart() || null,
			droppedSplitId: dropped ? droppedSplitId() || null : null,
			dropReason: dropped ? orNull(dropReason()) : null,
			dropLocationDescription: dropped ? orNull(dropLocation()) : null,
			comments: orNull(comments()),
		};
		const ok = await action.run(() =>
			e
				? editEntrant({ data: { entrantId: e.id, ...fields } })
				: addEntrant({ data: fields }),
		);
		if (ok) props.onDone();
	};

	return (
		<Card class="max-w-3xl p-6">
			<form class="grid gap-8" onSubmit={submit}>
				<Section title="Entry">
					<div class="grid gap-4 sm:grid-cols-2">
						<FormSelect
							label="Event"
							value={eventId()}
							onChange={setEventId}
							options={props.group.events.map((ev) => ({
								value: ev.id,
								label: ev.name,
							}))}
						/>
						<FormSelect
							label="Status"
							value={status()}
							onChange={(v) => setStatus(v as EntrantStatus)}
							options={statusOptions}
						/>
						<FormField label="Bib" value={bib()} onChange={setBib} required />
						<FormField label="RFID tag" value={rfid()} onChange={setRfid} />
						<FormField
							label="Division"
							value={division()}
							onChange={setDivision}
							placeholder="Open M, F40-49…"
							required
						/>
					</div>
				</Section>

				<Section title="Person">
					<Show when={e?.person.userId}>
						<p class="m-0 text-sm text-muted-foreground">
							This person has an account, so their own name and contact details
							are kept as they set them.
						</p>
					</Show>
					<div class="grid gap-4 sm:grid-cols-2">
						<FormField
							label="First name"
							value={firstName()}
							onChange={setFirstName}
							required
						/>
						<FormField
							label="Last name"
							value={lastName()}
							onChange={setLastName}
						/>
						<FormField
							label="Email"
							type="email"
							value={email()}
							onChange={setEmail}
						/>
						<FormField
							label="Phone"
							type="tel"
							value={phone()}
							onChange={setPhone}
						/>
						<FormField label="Gender" value={gender()} onChange={setGender} />
						<FormField
							label="Birthdate"
							type="date"
							value={birthdate()}
							onChange={setBirthdate}
						/>
					</div>
				</Section>

				<Section title={`Start times (${timeZone.replaceAll("_", " ")})`}>
					<div class="grid gap-4 sm:grid-cols-2">
						<FormField
							label="Wave start"
							type="datetime-local"
							value={scheduledStart()}
							onChange={setScheduledStart}
							description="Leave blank to use the event's start."
						/>
						<FormField
							label="Actual start"
							type="datetime-local"
							value={actualStart()}
							onChange={setActualStart}
						/>
					</div>
				</Section>

				<Section title="Participant">
					<FormSelect
						class="grid max-w-xs gap-2"
						label="Kind"
						value={kind()}
						onChange={changeKind}
						options={[
							{ value: "solo_competitor", label: "Solo competitor" },
							{ value: "vehicle_crew", label: "Vehicle crew" },
							{ value: "relay_team", label: "Relay team" },
						]}
					/>
					<Show
						when={kind() === "solo_competitor"}
						fallback={
							<TextField
								value={participantJson()}
								onChange={setParticipantJson}
							>
								<TextFieldLabel>Details (JSON)</TextFieldLabel>
								<TextFieldTextArea class="min-h-48 font-mono text-xs" />
							</TextField>
						}
					>
						<div class="grid gap-4 sm:grid-cols-3">
							<FormField
								label="Pacer"
								value={pacerName()}
								onChange={setPacerName}
							/>
							<FormField
								label="Shirt size"
								value={shirtSize()}
								onChange={setShirtSize}
							/>
						</div>
						<FormField
							label="Medical notes"
							value={medicalNotes()}
							onChange={setMedicalNotes}
							multiline
						/>
					</Show>
				</Section>

				<Section title="Emergency contact">
					<div class="grid gap-4 sm:grid-cols-3">
						<FormField
							label="Name"
							value={contactName()}
							onChange={setContactName}
						/>
						<FormField
							label="Phone"
							type="tel"
							value={contactPhone()}
							onChange={setContactPhone}
						/>
						<FormField
							label="Relationship"
							value={contactRelationship()}
							onChange={setContactRelationship}
						/>
					</div>
					<Checkbox checked={contactOnSite()} onChange={setContactOnSite}>
						On site during the race
					</Checkbox>
				</Section>

				<Show when={DROPPED_STATUSES.includes(status())}>
					<Section title="Drop">
						<div class="grid gap-4 sm:grid-cols-2">
							<FormSelect
								label="Dropped at"
								value={droppedSplitId()}
								onChange={setDroppedSplitId}
								options={splitOptions()}
							/>
							<FormSelect
								label="Reason"
								value={dropReason()}
								onChange={setDropReason}
								options={[
									{ value: "", label: "Not given" },
									{ value: "voluntary", label: "Voluntary" },
									{ value: "medical", label: "Medical" },
									{ value: "mechanical", label: "Mechanical" },
									{ value: "missed_cutoff", label: "Missed cutoff" },
								]}
							/>
						</div>
						<FormField
							label="Where, if between stations"
							value={dropLocation()}
							onChange={setDropLocation}
						/>
					</Section>
				</Show>

				<FormField
					label="Comments"
					value={comments()}
					onChange={setComments}
					multiline
				/>

				<ActionError error={formError() ?? action.error()} />
				<div class="flex flex-wrap gap-3">
					<Button type="submit" disabled={action.pending()}>
						{e ? "Save entrant" : "Add entrant"}
					</Button>
					<Button variant="ghost" onClick={props.onDone}>
						Cancel
					</Button>
				</div>
			</form>
		</Card>
	);
}

type Preview = { line: number; row: ImportRow | null; errors: string[] };

function previewRows(text: string): Preview[] {
	const records = csvRecords(text);
	const bibs = records.map((r) => r.bib?.trim());
	return records.map((r, i) => {
		const result = importRowInput.safeParse({
			competitorNumber: r.bib ?? "",
			person: {
				firstName: r.first_name ?? "",
				lastName: r.last_name ?? "",
				email: orNull(r.email),
				gender: orNull(r.gender),
				birthdate: orNull(r.birthdate),
				phone: orNull(r.phone),
			},
			division: r.division || "Open",
			rfidCode: orNull(r.rfid),
			emergencyContact: r.emergency_name
				? {
						name: r.emergency_name,
						phone: orNull(r.emergency_phone),
						relationship: orNull(r.emergency_relationship),
						isOnSite: false,
					}
				: null,
		});
		const errors = result.success
			? []
			: result.error.issues.map(
					(issue) => `${issue.path.join(".")}: ${issue.message}`,
				);
		if (bibs[i] && bibs.indexOf(bibs[i]) !== i) {
			errors.push(`Bib ${bibs[i]} appears earlier in the file.`);
		}
		return {
			line: i + 2,
			row: result.success ? result.data : null,
			errors,
		};
	});
}

function ImportEntrants(props: {
	events: Group["events"];
	eventId?: string;
	onDone: () => void;
}) {
	const action = createOrgAction();
	const [eventId, setEventId] = createSignal(
		props.eventId ?? props.events[0].id,
	);
	const [text, setText] = createSignal("");
	const preview = createMemo(() => previewRows(text()));
	const invalid = () => preview().filter((p) => p.errors.length > 0);

	const submit = async (e: SubmitEvent) => {
		e.preventDefault();
		const rows = preview().flatMap((p) => (p.row ? [p.row] : []));
		const ok = await action.run(() =>
			uploadEntrants({ data: { eventId: eventId(), rows } }),
		);
		if (ok) props.onDone();
	};

	return (
		<Card class="max-w-3xl p-6">
			<form class="grid gap-6" onSubmit={submit}>
				<FormSelect
					class="grid max-w-xs gap-2"
					label="Import into"
					value={eventId()}
					onChange={setEventId}
					options={props.events.map((ev) => ({ value: ev.id, label: ev.name }))}
				/>
				<TextField value={text()} onChange={setText}>
					<TextFieldLabel>CSV</TextFieldLabel>
					<TextFieldTextArea
						class="min-h-48 font-mono text-xs"
						placeholder={`${IMPORT_COLUMNS.join(",")}\n101,Ada,Lovelace,ada@example.com,F,1990-12-10,F30-39,,,,,`}
					/>
				</TextField>
				<p class="m-0 text-sm text-muted-foreground">
					The first row names the columns: {IMPORT_COLUMNS.join(", ")}. Only bib
					and first_name are required; division defaults to Open.
				</p>
				<Show when={preview().length > 0}>
					<p class="m-0 text-sm">
						{preview().length} rows, {invalid().length} with problems.
					</p>
				</Show>
				<Show when={invalid().length > 0}>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead class="text-right">Line</TableHead>
								<TableHead>Problems</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={invalid()}>
								{(p) => (
									<TableRow>
										<TableCell class="text-right tabular-nums">
											{p.line}
										</TableCell>
										<TableCell class="text-sm">
											{p.errors.join(" · ")}
										</TableCell>
									</TableRow>
								)}
							</For>
						</TableBody>
					</Table>
				</Show>
				<ActionError error={action.error()} />
				<div class="flex flex-wrap gap-3">
					<Button
						type="submit"
						disabled={
							action.pending() || preview().length === 0 || invalid().length > 0
						}
					>
						Import {preview().length || ""} entrants
					</Button>
					<Button variant="ghost" onClick={props.onDone}>
						Cancel
					</Button>
				</div>
			</form>
		</Card>
	);
}
