import { createEffect, createSignal, For, Show } from "solid-js";
import ActionError from "~/components/ActionError";
import ConfirmButton from "~/components/ConfirmButton";
import EmptyState from "~/components/EmptyState";
import FormField from "~/components/FormField";
import FormSelect from "~/components/FormSelect";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Switch, SwitchControl, SwitchLabel } from "~/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import {
	addSplit,
	editSplit,
	generateStartFinishSplitsEndpoint,
	removeSplit,
	reorderSplit,
} from "~/courses/courses.functions";
import { SUB_SPLIT_IN, SUB_SPLIT_OUT } from "~/courses/courses.shared";
import { createOrgAction } from "~/orgs/actions";
import {
	feetToMeters,
	formatDuration,
	formatMiles,
	inputValue,
	metersToFeet,
	metersToMiles,
	milesToMeters,
	numberOrNull,
	parseDuration,
	subSplitBitmapLabel,
} from "~/orgs/format";
import { addTimingPoint } from "~/orgs/orgs.functions";

export type TimingPointOption = {
	id: string;
	name: string;
	code: string;
	latitude?: number | null;
	longitude?: number | null;
	elevationMeters?: number | null;
};

export type CourseSplitItem = {
	id: string;
	timingPointId: string;
	timingPointCode: string;
	name: string;
	sequenceOrder: number;
	distanceFromStartMeters: number;
	subSplitBitmap: number;
	cutoffDurationSeconds: number | null;
	tsdIdealDurationSeconds: number | null;
	isSecretCheckpoint: boolean;
};

export type CourseSplitBuilderProps = {
	courseId: string;
	courseDistanceMeters: number;
	organizationId: string;
	splits: CourseSplitItem[];
	timingPoints: TimingPointOption[];
	canUpdate: boolean;
	discipline?: string | null;
	onSplitsChanged?: () => void | Promise<void>;
};

export function CourseSplitBuilder(props: CourseSplitBuilderProps) {
	const [editing, setEditing] = createSignal<CourseSplitItem | "new">();
	const [showTsdFields, setShowTsdFields] = createSignal(
		props.discipline === "tsd_regularity",
	);
	const [newTimingPointModalOpen, setNewTimingPointModalOpen] =
		createSignal(false);
	const [selectedTimingPointId, setSelectedTimingPointId] = createSignal<
		string | undefined
	>();

	const action = createOrgAction();
	const starterAction = createOrgAction();

	const isTsdActive = () =>
		props.discipline === "tsd_regularity" || showTsdFields();

	const handleGenerateStartFinish = async () => {
		const ok = await starterAction.run(async () => {
			await generateStartFinishSplitsEndpoint({
				data: { courseId: props.courseId },
			});
			if (props.onSplitsChanged) await props.onSplitsChanged();
		});
		if (ok) setEditing(undefined);
	};

	const handleTimingPointCreated = (createdId: string) => {
		setSelectedTimingPointId(createdId);
		setNewTimingPointModalOpen(false);
		if (props.onSplitsChanged) props.onSplitsChanged();
	};

	return (
		<div class="flex flex-col gap-6">
			{/* Discipline / TSD Toggle Bar */}
			<div class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card/50 p-4">
				<div class="flex items-center gap-2">
					<span class="text-sm font-semibold text-foreground">
						Course Splits & Checkpoints
					</span>
					<Badge variant="sand">
						{props.splits.length}{" "}
						{props.splits.length === 1 ? "split" : "splits"}
					</Badge>
				</div>
				<div class="flex items-center gap-6">
					<Show when={props.discipline !== "tsd_regularity"}>
						<Switch
							checked={showTsdFields()}
							onChange={setShowTsdFields}
							class="flex items-center gap-2 text-xs text-muted-foreground"
						>
							<SwitchControl />
							<SwitchLabel>Show TSD Rally Fields</SwitchLabel>
						</Switch>
					</Show>
					<Show when={props.canUpdate && !editing()}>
						<Button size="sm" onClick={() => setEditing("new")}>
							+ Add Split
						</Button>
					</Show>
				</div>
			</div>

			<ActionError error={starterAction.error() || action.error()} />

			{/* 1-Click Starter Banner when 0 splits */}
			<Show when={props.splits.length === 0 && !editing()}>
				<Card class="flex flex-col items-center justify-center p-8 text-center border-dashed">
					<div class="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-forest/10 text-forest text-2xl">
						⚡
					</div>
					<h3 class="font-serif text-lg font-bold text-foreground">
						Quick Start: Generate Start + Finish
					</h3>
					<p class="mt-1 max-w-md text-sm text-muted-foreground">
						Instantly scaffold Sequence #1 (Start, 0.0 mi, OUT) and Sequence #2
						(Finish, {formatMiles(props.courseDistanceMeters)}, IN). If START and
						FINISH stations don't exist yet, they'll be automatically created
						for you.
					</p>
					<div class="mt-5 flex flex-wrap gap-3">
						<Show when={props.canUpdate}>
							<Button
								disabled={starterAction.pending()}
								onClick={handleGenerateStartFinish}
							>
								{starterAction.pending()
									? "Generating..."
									: "Generate Start + Finish Splits"}
							</Button>
							<Button variant="outline" onClick={() => setEditing("new")}>
								Build Manually
							</Button>
						</Show>
					</div>
				</Card>
			</Show>

			{/* Inline Split Form */}
			<Show when={editing()} keyed>
				{(target) => (
					<SplitForm
						courseId={props.courseId}
						organizationId={props.organizationId}
						timingPoints={props.timingPoints}
						split={target === "new" ? undefined : target}
						initialTimingPointId={selectedTimingPointId()}
						isTsdActive={isTsdActive()}
						onOpenNewTimingPointModal={() => setNewTimingPointModalOpen(true)}
						onDone={async () => {
							setEditing(undefined);
							setSelectedTimingPointId(undefined);
							if (props.onSplitsChanged) await props.onSplitsChanged();
						}}
					/>
				)}
			</Show>

			{/* Splits Table */}
			<Show when={props.splits.length > 0}>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead class="w-12 text-right">#</TableHead>
							<TableHead>Split Name</TableHead>
							<TableHead>Timing Point</TableHead>
							<TableHead class="text-right">Distance</TableHead>
							<TableHead>Records</TableHead>
							<TableHead class="text-right">Cutoff</TableHead>
							<Show when={isTsdActive()}>
								<TableHead class="text-right">TSD Ideal</TableHead>
								<TableHead class="text-center">Secret</TableHead>
							</Show>
							<TableHead class="text-right w-44" />
						</TableRow>
					</TableHeader>
					<TableBody>
						<For each={props.splits}>
							{(split, index) => (
								<TableRow>
									<TableCell class="text-right tabular-nums text-muted-foreground font-mono">
										{index() + 1}
									</TableCell>
									<TableCell class="font-semibold text-foreground">
										{split.name}
									</TableCell>
									<TableCell>
										<Badge variant="chip">{split.timingPointCode}</Badge>
									</TableCell>
									<TableCell class="text-right tabular-nums">
										{formatMiles(split.distanceFromStartMeters)}
									</TableCell>
									<TableCell class="text-muted-foreground text-xs">
										{subSplitBitmapLabel(split.subSplitBitmap)}
									</TableCell>
									<TableCell class="text-right tabular-nums">
										{split.cutoffDurationSeconds === null
											? "—"
											: formatDuration(split.cutoffDurationSeconds)}
									</TableCell>
									<Show when={isTsdActive()}>
										<TableCell class="text-right tabular-nums">
											{split.tsdIdealDurationSeconds === null
												? "—"
												: `${split.tsdIdealDurationSeconds}s`}
										</TableCell>
										<TableCell class="text-center">
											<Show when={split.isSecretCheckpoint}>
												<Badge variant="sand">Secret</Badge>
											</Show>
										</TableCell>
									</Show>
									<TableCell class="text-right whitespace-nowrap">
										<Show when={props.canUpdate}>
											<Button
												variant="ghost"
												size="sm"
												aria-label="Move up"
												disabled={index() === 0 || action.pending()}
												onClick={() =>
													action.run(async () => {
														await reorderSplit({
															data: { splitId: split.id, direction: "up" },
														});
														if (props.onSplitsChanged)
															await props.onSplitsChanged();
													})
												}
											>
												↑
											</Button>
											<Button
												variant="ghost"
												size="sm"
												aria-label="Move down"
												disabled={
													index() === props.splits.length - 1 ||
													action.pending()
												}
												onClick={() =>
													action.run(async () => {
														await reorderSplit({
															data: { splitId: split.id, direction: "down" },
														});
														if (props.onSplitsChanged)
															await props.onSplitsChanged();
													})
												}
											>
												↓
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setEditing(split)}
											>
												Edit
											</Button>
											<ConfirmButton
												label="Delete"
												pending={action.pending()}
												onConfirm={() =>
													action.run(async () => {
														await removeSplit({ data: { splitId: split.id } });
														if (props.onSplitsChanged)
															await props.onSplitsChanged();
													})
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

			{/* Inline "+ Create New Timing Point" Modal Dialog */}
			<Dialog
				open={newTimingPointModalOpen()}
				onOpenChange={setNewTimingPointModalOpen}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create New Timing Point</DialogTitle>
						<DialogDescription>
							Add a new physical checkpoint station to your organization without
							leaving the course editor.
						</DialogDescription>
					</DialogHeader>
					<InlineTimingPointModalForm
						organizationId={props.organizationId}
						onSuccess={handleTimingPointCreated}
						onCancel={() => setNewTimingPointModalOpen(false)}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function SplitForm(props: {
	courseId: string;
	organizationId: string;
	timingPoints: TimingPointOption[];
	split?: CourseSplitItem;
	initialTimingPointId?: string;
	isTsdActive: boolean;
	onOpenNewTimingPointModal: () => void;
	onDone: () => void;
}) {
	const action = createOrgAction();
	const [timingPointId, setTimingPointId] = createSignal(
		props.initialTimingPointId ??
			props.split?.timingPointId ??
			props.timingPoints[0]?.id ??
			"",
	);

	createEffect(() => {
		if (props.initialTimingPointId) {
			setTimingPointId(props.initialTimingPointId);
		}
	});
	const [name, setName] = createSignal(props.split?.name ?? "");
	const [miles, setMiles] = createSignal(
		props.split
			? inputValue(metersToMiles(props.split.distanceFromStartMeters), 2)
			: "",
	);
	const bitmap = props.split?.subSplitBitmap ?? SUB_SPLIT_IN;
	const [recordsIn, setRecordsIn] = createSignal((bitmap & SUB_SPLIT_IN) !== 0);
	const [recordsOut, setRecordsOut] = createSignal(
		(bitmap & SUB_SPLIT_OUT) !== 0,
	);
	const [cutoff, setCutoff] = createSignal(
		props.split?.cutoffDurationSeconds == null
			? ""
			: formatDuration(props.split.cutoffDurationSeconds),
	);
	const [tsdSeconds, setTsdSeconds] = createSignal(
		inputValue(props.split?.tsdIdealDurationSeconds, 3),
	);
	const [secret, setSecret] = createSignal(
		props.split?.isSecretCheckpoint ?? false,
	);
	const [formError, setFormError] = createSignal<string>();

	const pointName = () =>
		props.timingPoints.find((p) => p.id === timingPointId())?.name ?? "";

	const submit = async (e: SubmitEvent) => {
		e.preventDefault();
		setFormError(undefined);
		if (!timingPointId()) {
			setFormError("Please select or create a timing point first.");
			return;
		}
		const subSplitBitmap =
			(recordsIn() ? SUB_SPLIT_IN : 0) | (recordsOut() ? SUB_SPLIT_OUT : 0);
		if (subSplitBitmap === 0) {
			setFormError("Record at least an in or an out time.");
			return;
		}
		const hasCutoff = cutoff().trim() !== "";
		const cutoffSeconds = hasCutoff ? parseDuration(cutoff()) : null;
		if (hasCutoff && cutoffSeconds === null) {
			setFormError("Write the cutoff as hours:minutes, like 30:00.");
			return;
		}
		const fields = {
			timingPointId: timingPointId(),
			name: name().trim() || pointName(),
			distanceFromStartMeters: milesToMeters(Number(miles())),
			subSplitBitmap,
			cutoffDurationSeconds: cutoffSeconds,
			tsdIdealDurationSeconds: numberOrNull(tsdSeconds()),
			isSecretCheckpoint: secret(),
		};
		const split = props.split;
		const ok = await action.run(() =>
			split
				? editSplit({ data: { splitId: split.id, ...fields } })
				: addSplit({ data: { courseId: props.courseId, ...fields } }),
		);
		if (ok) props.onDone();
	};

	return (
		<Card class="max-w-2xl p-6">
			<form class="grid gap-6" onSubmit={submit}>
				<div class="flex flex-col gap-2">
					<div class="flex items-end gap-3">
						<div class="flex-1">
							<FormSelect
								label="Timing point"
								value={timingPointId()}
								onChange={setTimingPointId}
								options={props.timingPoints.map((p) => ({
									value: p.id,
									label: `${p.code} · ${p.name}`,
								}))}
							/>
						</div>
						<Button
							type="button"
							variant="outline"
							onClick={props.onOpenNewTimingPointModal}
							class="shrink-0 mb-px"
						>
							+ New Station
						</Button>
					</div>
					<Show when={props.timingPoints.length === 0}>
						<p class="text-xs text-clay">
							No timing points exist yet. Click "+ New Station" above to create
							one.
						</p>
					</Show>
				</div>

				<FormField
					label="Split name"
					value={name()}
					onChange={setName}
					placeholder={pointName() || "Twin Lakes inbound"}
					description="Leave blank to default to the timing point's name."
				/>

				<FormField
					label="Distance from start (mi)"
					type="number"
					value={miles()}
					onChange={setMiles}
					required
				/>

				<div class="flex flex-wrap gap-6 text-sm">
					<Checkbox checked={recordsIn()} onChange={setRecordsIn}>
						Records IN time
					</Checkbox>
					<Checkbox checked={recordsOut()} onChange={setRecordsOut}>
						Records OUT time
					</Checkbox>
					<Show when={props.isTsdActive}>
						<Checkbox checked={secret()} onChange={setSecret}>
							Secret checkpoint
						</Checkbox>
					</Show>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField
						label="Cutoff (h:mm from start)"
						value={cutoff()}
						onChange={setCutoff}
						placeholder="30:00"
					/>
					<Show when={props.isTsdActive}>
						<FormField
							label="TSD ideal duration (seconds)"
							type="number"
							value={tsdSeconds()}
							onChange={setTsdSeconds}
							description="Ideal travel time from previous station."
						/>
					</Show>
				</div>

				<ActionError error={formError() ?? action.error()} />

				<div class="flex flex-wrap gap-3">
					<Button type="submit" disabled={action.pending()}>
						{props.split ? "Save split" : "Add split"}
					</Button>
					<Button variant="ghost" onClick={props.onDone}>
						Cancel
					</Button>
				</div>
			</form>
		</Card>
	);
}

function InlineTimingPointModalForm(props: {
	organizationId: string;
	onSuccess: (id: string) => void;
	onCancel: () => void;
}) {
	const action = createOrgAction();
	const [name, setName] = createSignal("");
	const [code, setCode] = createSignal("");
	const [latitude, setLatitude] = createSignal("");
	const [longitude, setLongitude] = createSignal("");
	const [elevationFeet, setElevationFeet] = createSignal("");

	const submit = async (e: SubmitEvent) => {
		e.preventDefault();
		const feet = numberOrNull(elevationFeet());
		const fields = {
			name: name().trim(),
			code: code().trim().toUpperCase(),
			latitude: numberOrNull(latitude()),
			longitude: numberOrNull(longitude()),
			elevationMeters: feet === null ? null : Math.round(feetToMeters(feet)),
		};

		let createdId = "";
		const ok = await action.run(async () => {
			const res = await addTimingPoint({
				data: { organizationId: props.organizationId, ...fields },
			});
			createdId = res.id;
		});
		if (ok && createdId) {
			props.onSuccess(createdId);
		}
	};

	return (
		<form class="grid gap-4 mt-2" onSubmit={submit}>
			<FormField
				label="Station Name"
				value={name()}
				onChange={setName}
				placeholder="Twin Lakes Aid Station"
				required
			/>
			<FormField
				label="Code (hardware identifier)"
				value={code()}
				onChange={setCode}
				placeholder="TWIN_LAKES"
				description="Uppercase alphanumeric code."
				required
			/>
			<div class="grid grid-cols-2 gap-3">
				<FormField
					label="Latitude"
					type="number"
					value={latitude()}
					onChange={setLatitude}
					placeholder="40.5833"
				/>
				<FormField
					label="Longitude"
					type="number"
					value={longitude()}
					onChange={setLongitude}
					placeholder="-111.637"
				/>
			</div>
			<FormField
				label="Elevation (ft)"
				type="number"
				value={elevationFeet()}
				onChange={setElevationFeet}
				placeholder="9200"
			/>
			<ActionError error={action.error()} />
			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" type="button" onClick={props.onCancel}>
					Cancel
				</Button>
				<Button type="submit" disabled={action.pending()}>
					{action.pending() ? "Saving..." : "Create Station"}
				</Button>
			</div>
		</form>
	);
}
