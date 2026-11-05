import { createFileRoute, getRouteApi } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import ActionError from "~/components/ActionError";
import ConfirmButton from "~/components/ConfirmButton";
import EmptyState from "~/components/EmptyState";
import FormField from "~/components/FormField";
import OrgSection from "~/components/OrgSection";
import { Badge } from "~/components/ui/badge";
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
import { createOrgAction } from "~/orgs/actions";
import {
	feetToMeters,
	formatFeet,
	inputValue,
	metersToFeet,
	numberOrNull,
} from "~/orgs/format";
import {
	addTimingPoint,
	editTimingPoint,
	removeTimingPoint,
} from "~/orgs/orgs.functions";

export const Route = createFileRoute("/_authed/orgs/$slug/timing-points")({
	component: TimingPoints,
});

const orgRoute = getRouteApi("/_authed/orgs/$slug");

type TimingPoint = {
	id: string;
	name: string;
	code: string;
	latitude: number | null;
	longitude: number | null;
	elevationMeters: number | null;
};

function TimingPoints() {
	const data = orgRoute.useLoaderData();
	const [editing, setEditing] = createSignal<TimingPoint | "new">();
	const remove = createOrgAction();

	return (
		<OrgSection
			title="Timing points"
			description="Physical places where times are logged. A course can pass one more than once."
			action={
				<Show when={data().can.createTimingPoint && !editing()}>
					<Button onClick={() => setEditing("new")}>New timing point</Button>
				</Show>
			}
		>
			<div class="flex flex-col gap-6">
				<Show when={editing()} keyed>
					{(target) => (
						<TimingPointForm
							organizationId={data().organization.id}
							point={target === "new" ? undefined : target}
							onDone={() => setEditing(undefined)}
						/>
					)}
				</Show>

				<ActionError error={remove.error()} />

				<Show
					when={data().timingPoints.length > 0}
					fallback={
						<Show when={!editing()}>
							<EmptyState
								title="No timing points yet"
								description="Add the aid stations, crossings and finish lines where your volunteers will sit."
							/>
						</Show>
					}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Code</TableHead>
								<TableHead>Coordinates</TableHead>
								<TableHead class="text-right">Elevation</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={data().timingPoints}>
								{(point) => (
									<TableRow>
										<TableCell class="font-semibold">{point.name}</TableCell>
										<TableCell>
											<Badge variant="chip">{point.code}</Badge>
										</TableCell>
										<TableCell class="tabular-nums text-muted-foreground">
											{point.latitude === null || point.longitude === null
												? "—"
												: `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`}
										</TableCell>
										<TableCell class="text-right tabular-nums text-muted-foreground">
											{point.elevationMeters === null
												? "—"
												: formatFeet(point.elevationMeters)}
										</TableCell>
										<TableCell class="text-right whitespace-nowrap">
											<Show when={data().can.updateTimingPoint}>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setEditing(point)}
												>
													Edit
												</Button>
											</Show>
											<Show when={data().can.deleteTimingPoint}>
												<ConfirmButton
													label="Delete"
													pending={remove.pending()}
													onConfirm={() =>
														remove.run(() =>
															removeTimingPoint({
																data: { timingPointId: point.id },
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

function TimingPointForm(props: {
	organizationId: string;
	point?: TimingPoint;
	onDone: () => void;
}) {
	const action = createOrgAction();
	const [name, setName] = createSignal(props.point?.name ?? "");
	const [code, setCode] = createSignal(props.point?.code ?? "");
	const [latitude, setLatitude] = createSignal(
		inputValue(props.point?.latitude, 6),
	);
	const [longitude, setLongitude] = createSignal(
		inputValue(props.point?.longitude, 6),
	);
	const [elevationFeet, setElevationFeet] = createSignal(
		inputValue(
			props.point?.elevationMeters == null
				? null
				: metersToFeet(props.point.elevationMeters),
		),
	);

	const submit = async (e: SubmitEvent) => {
		e.preventDefault();
		const feet = numberOrNull(elevationFeet());
		const fields = {
			name: name(),
			code: code(),
			latitude: numberOrNull(latitude()),
			longitude: numberOrNull(longitude()),
			elevationMeters: feet === null ? null : Math.round(feetToMeters(feet)),
		};
		const point = props.point;
		const ok = await action.run(() =>
			point
				? editTimingPoint({ data: { timingPointId: point.id, ...fields } })
				: addTimingPoint({
						data: { organizationId: props.organizationId, ...fields },
					}),
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
					placeholder="Twin Lakes aid station"
					required
				/>
				<FormField
					label="Code"
					value={code()}
					onChange={setCode}
					placeholder="TWIN_LAKES"
					description="Short identifier sent by timing hardware."
					required
				/>
				<div class="grid grid-cols-2 gap-4">
					<FormField
						label="Latitude"
						type="number"
						value={latitude()}
						onChange={setLatitude}
					/>
					<FormField
						label="Longitude"
						type="number"
						value={longitude()}
						onChange={setLongitude}
					/>
				</div>
				<FormField
					label="Elevation (ft)"
					type="number"
					value={elevationFeet()}
					onChange={setElevationFeet}
				/>
				<ActionError error={action.error()} />
				<div class="flex flex-wrap gap-3">
					<Button type="submit" disabled={action.pending()}>
						{props.point ? "Save timing point" : "Add timing point"}
					</Button>
					<Button variant="ghost" onClick={props.onDone}>
						Cancel
					</Button>
				</div>
			</form>
		</Card>
	);
}
