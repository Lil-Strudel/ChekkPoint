import { createSignal, For, type JSX } from "solid-js";
import ActionError from "~/components/ActionError";
import FormField from "~/components/FormField";
import FormSelect from "~/components/FormSelect";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { type Discipline, disciplineLabels } from "~/lib/events";
import { DISCIPLINES } from "~/orgs/orgs.shared";

export type EventGroupFields = {
	name: string;
	discipline: Discipline;
	startDate: string;
	endDate: string;
	timeZone: string;
	location: string | null;
};

const disciplineOptions = DISCIPLINES.map((value) => ({
	value,
	label: disciplineLabels[value],
}));

const zones = Intl.supportedValuesOf("timeZone");
const timeZones = zones.includes("UTC") ? zones : ["UTC", ...zones];

// Event group dates are calendar days stored as UTC midnight.
export function dayInputValue(date: Date) {
	return date.toISOString().slice(0, 10);
}

export default function EventGroupForm(props: {
	initial?: EventGroupFields;
	submitLabel: string;
	error: string | undefined;
	pending: boolean;
	onSubmit: (group: EventGroupFields) => void;
	children?: JSX.Element;
}) {
	const [name, setName] = createSignal(props.initial?.name ?? "");
	const [discipline, setDiscipline] = createSignal<Discipline>(
		props.initial?.discipline ?? "trail_ultra",
	);
	const [startDate, setStartDate] = createSignal(
		props.initial?.startDate ?? "",
	);
	const [endDate, setEndDate] = createSignal(props.initial?.endDate ?? "");
	const [timeZone, setTimeZone] = createSignal(
		props.initial?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
	);
	const [location, setLocation] = createSignal(props.initial?.location ?? "");

	const submit = (e: SubmitEvent) => {
		e.preventDefault();
		props.onSubmit({
			name: name(),
			discipline: discipline(),
			startDate: startDate(),
			endDate: endDate() || startDate(),
			timeZone: timeZone(),
			location: location(),
		});
	};

	return (
		<Card class="max-w-xl p-6">
			<form class="grid gap-6" onSubmit={submit}>
				<FormField
					label="Name"
					value={name()}
					onChange={setName}
					placeholder="Bonneville Ridge Weekend 2027"
					required
				/>
				<FormSelect
					label="Discipline"
					value={discipline()}
					onChange={(value) => setDiscipline(value as Discipline)}
					options={disciplineOptions}
				/>
				<div class="grid grid-cols-2 gap-4">
					<FormField
						label="Starts"
						type="date"
						value={startDate()}
						onChange={setStartDate}
						required
					/>
					<FormField
						label="Ends"
						type="date"
						value={endDate()}
						onChange={setEndDate}
					/>
				</div>
				<FormField
					label="Time zone"
					value={timeZone()}
					onChange={setTimeZone}
					list="time-zones"
					description="Start typing a city, like Denver."
					required
				/>
				<datalist id="time-zones">
					<For each={timeZones}>{(zone) => <option value={zone} />}</For>
				</datalist>
				<FormField
					label="Location"
					value={location()}
					onChange={setLocation}
					placeholder="Logan, Utah"
				/>
				<ActionError error={props.error} />
				<div class="flex flex-wrap gap-3">
					<Button type="submit" disabled={props.pending}>
						{props.submitLabel}
					</Button>
					{props.children}
				</div>
			</form>
		</Card>
	);
}
