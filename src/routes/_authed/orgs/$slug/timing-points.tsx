import { createFileRoute, getRouteApi } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import ActionError from "~/components/ActionError";
import EmptyState from "~/components/EmptyState";
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
	const [activeModal, setActiveModal] = createSignal<
		TimingPoint | "new" | null
	>(null);
	const [deleteError, setDeleteError] = createSignal<string | null>(null);
	const [deletingId, setDeletingId] = createSignal<string | null>(null);

	const removeAction = createOrgAction();

	async function handleDelete(point: TimingPoint) {
		if (
			!confirm(
				`Are you sure you want to delete timing point "${point.name}" (${point.code})?`,
			)
		) {
			return;
		}

		setDeleteError(null);
		setDeletingId(point.id);
		try {
			const ok = await removeAction.run(() =>
				removeTimingPoint({
					data: { timingPointId: point.id },
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
			title="Timing Points"
			description="Physical checkpoints and aid stations where times are logged. Shared across all courses and event groups."
			action={
				<Show when={data().can.createTimingPoint}>
					<Button onClick={() => setActiveModal("new")}>
						+ New Timing Point
					</Button>
				</Show>
			}
		>
			<div class="flex flex-col gap-6">
				<Show when={deleteError()}>
					<Alert variant="destructive">
						<AlertTitle>Cannot Delete Timing Point</AlertTitle>
						<AlertDescription>{deleteError()}</AlertDescription>
					</Alert>
				</Show>

				<Show
					when={data().timingPoints.length > 0}
					fallback={
						<EmptyState
							title="No timing points yet"
							description="Add aid stations, trail intersections, summits, and finish lines where volunteers or RFID mats will sit."
						/>
					}
				>
					<div class="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Station Name</TableHead>
									<TableHead>Hardware Code</TableHead>
									<TableHead>GPS Coordinates</TableHead>
									<TableHead class="text-right">Elevation</TableHead>
									<TableHead class="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<For each={data().timingPoints}>
									{(point) => (
										<TableRow>
											<TableCell class="font-semibold text-foreground">
												{point.name}
											</TableCell>
											<TableCell>
												<Badge variant="chip" class="font-mono text-xs">
													{point.code}
												</Badge>
											</TableCell>
											<TableCell class="tabular-nums font-mono text-xs text-muted-foreground">
												{point.latitude === null || point.longitude === null ? (
													<span class="text-muted-foreground/60">—</span>
												) : (
													<a
														href={`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`}
														target="_blank"
														rel="noopener noreferrer"
														class="underline-offset-2 hover:underline hover:text-foreground"
														title="View in Google Maps"
													>
														{point.latitude.toFixed(5)},{" "}
														{point.longitude.toFixed(5)} ↗
													</a>
												)}
											</TableCell>
											<TableCell class="text-right tabular-nums text-sm text-muted-foreground">
												{point.elevationMeters === null ? (
													"—"
												) : (
													<span>
														<span class="font-medium text-foreground">
															{formatFeet(point.elevationMeters)}
														</span>{" "}
														<span class="text-xs text-muted-foreground">
															({Math.round(point.elevationMeters)}m)
														</span>
													</span>
												)}
											</TableCell>
											<TableCell class="text-right whitespace-nowrap">
												<div class="flex items-center justify-end gap-2">
													<Show when={data().can.updateTimingPoint}>
														<Button
															variant="outline"
															size="sm"
															class="h-7 px-2.5 text-xs"
															onClick={() => setActiveModal(point)}
														>
															Edit
														</Button>
													</Show>
													<Show when={data().can.deleteTimingPoint}>
														<Button
															variant="ghost"
															size="sm"
															class="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10"
															disabled={deletingId() === point.id}
															onClick={() => handleDelete(point)}
														>
															{deletingId() === point.id
																? "Deleting..."
																: "Delete"}
														</Button>
													</Show>
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
				open={activeModal() !== null}
				onOpenChange={(open) => {
					if (!open) setActiveModal(null);
				}}
			>
				<DialogContent class="sm:max-w-md">
					<TimingPointModalForm
						organizationId={data().organization.id}
						point={
							activeModal() === "new"
								? undefined
								: (activeModal() as TimingPoint)
						}
						onDone={() => setActiveModal(null)}
					/>
				</DialogContent>
			</Dialog>
		</OrgSection>
	);
}

function TimingPointModalForm(props: {
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

	const isEditing = () => Boolean(props.point);

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

		const current = props.point;
		const ok = await action.run(() =>
			current
				? editTimingPoint({ data: { timingPointId: current.id, ...fields } })
				: addTimingPoint({
						data: { organizationId: props.organizationId, ...fields },
					}),
		);
		if (ok) props.onDone();
	};

	return (
		<div>
			<DialogHeader>
				<DialogTitle>
					{isEditing() ? "Edit Timing Point" : "New Timing Point"}
				</DialogTitle>
				<DialogDescription>
					Physical checkpoint location where timing hardware, volunteers, or
					mobile loggers record athlete splits.
				</DialogDescription>
			</DialogHeader>

			<Show when={action.error()}>
				<div class="mt-3">
					<ActionError error={action.error()} />
				</div>
			</Show>

			<form class="space-y-4 py-3" onSubmit={submit}>
				<div class="space-y-1.5">
					<Label for="tpName">Station Name</Label>
					<Input
						id="tpName"
						value={name()}
						onInput={(e) => setName(e.currentTarget.value)}
						placeholder="e.g. Twin Lakes Aid Station"
						required
						autofocus
					/>
				</div>

				<div class="space-y-1.5">
					<Label for="tpCode">Hardware Identifier / Code</Label>
					<Input
						id="tpCode"
						value={code()}
						onInput={(e) => setCode(e.currentTarget.value)}
						placeholder="e.g. TWIN_LAKES"
						required
					/>
					<p class="text-[11px] text-muted-foreground">
						Short uppercase code used by RFID antennas and handheld loggers.
					</p>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label for="tpLat">Latitude</Label>
						<Input
							id="tpLat"
							type="number"
							step="any"
							value={latitude()}
							onInput={(e) => setLatitude(e.currentTarget.value)}
							placeholder="e.g. 47.12345"
						/>
					</div>
					<div class="space-y-1.5">
						<Label for="tpLng">Longitude</Label>
						<Input
							id="tpLng"
							type="number"
							step="any"
							value={longitude()}
							onInput={(e) => setLongitude(e.currentTarget.value)}
							placeholder="e.g. -121.54321"
						/>
					</div>
				</div>

				<div class="space-y-1.5">
					<Label for="tpElev">Elevation (Feet)</Label>
					<Input
						id="tpElev"
						type="number"
						step="1"
						value={elevationFeet()}
						onInput={(e) => setElevationFeet(e.currentTarget.value)}
						placeholder="e.g. 3850"
					/>
					<Show when={numberOrNull(elevationFeet()) !== null}>
						<p class="text-[11px] text-muted-foreground">
							≈ {Math.round(feetToMeters(Number(elevationFeet())))} meters
						</p>
					</Show>
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
						{action.pending()
							? "Saving..."
							: isEditing()
								? "Save Changes"
								: "Create Station"}
					</Button>
				</DialogFooter>
			</form>
		</div>
	);
}
