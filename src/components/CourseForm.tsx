import { createSignal, type JSX } from "solid-js";
import ActionError from "~/components/ActionError";
import FormField from "~/components/FormField";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
	feetToMeters,
	inputValue,
	metersToFeet,
	metersToMiles,
	milesToMeters,
	numberOrNull,
} from "~/orgs/format";

export type CourseFields = {
	name: string;
	distanceMeters: number;
	elevationGainMeters: number | null;
	gpxRouteUrl: string | null;
};

export default function CourseForm(props: {
	initial?: CourseFields;
	submitLabel: string;
	error: string | undefined;
	pending: boolean;
	onSubmit: (course: CourseFields) => void;
	children?: JSX.Element;
}) {
	const [name, setName] = createSignal(props.initial?.name ?? "");
	const [miles, setMiles] = createSignal(
		props.initial
			? inputValue(metersToMiles(props.initial.distanceMeters), 2)
			: "",
	);
	const [gainFeet, setGainFeet] = createSignal(
		props.initial?.elevationGainMeters == null
			? ""
			: inputValue(metersToFeet(props.initial.elevationGainMeters)),
	);
	const [gpxUrl, setGpxUrl] = createSignal(props.initial?.gpxRouteUrl ?? "");

	const submit = (e: SubmitEvent) => {
		e.preventDefault();
		const gain = numberOrNull(gainFeet());
		props.onSubmit({
			name: name(),
			distanceMeters: milesToMeters(Number(miles())),
			elevationGainMeters:
				gain === null ? null : Math.round(feetToMeters(gain)),
			gpxRouteUrl: gpxUrl().trim() || null,
		});
	};

	return (
		<Card class="max-w-xl p-6">
			<form class="grid gap-6" onSubmit={submit}>
				<FormField
					label="Name"
					value={name()}
					onChange={setName}
					placeholder="Bonneville Ridge 100 mile course"
					required
				/>
				<div class="grid grid-cols-2 gap-4">
					<FormField
						label="Distance (mi)"
						type="number"
						value={miles()}
						onChange={setMiles}
						required
					/>
					<FormField
						label="Elevation gain (ft)"
						type="number"
						value={gainFeet()}
						onChange={setGainFeet}
					/>
				</div>
				<FormField
					label="GPX route URL"
					value={gpxUrl()}
					onChange={setGpxUrl}
					placeholder="https://…"
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
