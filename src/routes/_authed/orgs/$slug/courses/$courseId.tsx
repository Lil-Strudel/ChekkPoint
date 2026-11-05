import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import ActionError from "~/components/ActionError";
import ConfirmButton from "~/components/ConfirmButton";
import CourseForm from "~/components/CourseForm";
import EmptyState from "~/components/EmptyState";
import FormField from "~/components/FormField";
import FormSelect from "~/components/FormSelect";
import OrgSection from "~/components/OrgSection";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
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
	addSplit,
	duplicateCourse,
	editCourse,
	editSplit,
	getCourse,
	removeCourse,
	removeSplit,
	reorderSplit,
} from "~/courses/courses.functions";
import { SUB_SPLIT_IN, SUB_SPLIT_OUT } from "~/courses/courses.shared";
import { createOrgAction } from "~/orgs/actions";
import {
	formatDuration,
	formatFeet,
	formatMiles,
	inputValue,
	metersToMiles,
	milesToMeters,
	numberOrNull,
	parseDuration,
} from "~/orgs/format";

export const Route = createFileRoute("/_authed/orgs/$slug/courses/$courseId")({
	loader: ({ params }) => getCourse({ data: { courseId: params.courseId } }),
	component: CoursePage,
	notFoundComponent: () => (
		<EmptyState
			title="Course not found"
			description="It may have been deleted."
		/>
	),
});

type Page = Awaited<ReturnType<typeof getCourse>>;
type Split = Page["splits"][number];

function subSplitLabel(bitmap: number) {
	const parts = [];
	if (bitmap & SUB_SPLIT_IN) parts.push("In");
	if (bitmap & SUB_SPLIT_OUT) parts.push("Out");
	return parts.join(" + ");
}

function CoursePage() {
	const data = Route.useLoaderData();
	const params = Route.useParams();
	const navigate = useNavigate();
	const [mode, setMode] = createSignal<"edit" | "copy">();
	const action = createOrgAction();
	const edit = createOrgAction();

	const backToCourses = () =>
		navigate({ to: "/orgs/$slug/courses", params: { slug: params().slug } });

	return (
		<div class="flex flex-col gap-12">
			<OrgSection
				title={data().course.name}
				description={`${formatMiles(data().course.distanceMeters)}${
					data().course.elevationGainMeters === null
						? ""
						: ` · ${formatFeet(data().course.elevationGainMeters ?? 0)} gain`
				}`}
				action={
					<div class="flex flex-wrap items-center gap-2">
						<Link
							to="/orgs/$slug/courses"
							params={{ slug: params().slug }}
							class={buttonVariants({ variant: "ghost", size: "sm" })}
						>
							All courses
						</Link>
						<Show when={data().can.update}>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setMode("edit")}
							>
								Edit
							</Button>
						</Show>
						<Show when={data().can.create}>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setMode("copy")}
							>
								Copy
							</Button>
						</Show>
						<Show when={data().can.delete}>
							<ConfirmButton
								label="Delete course"
								pending={action.pending()}
								onConfirm={() =>
									action.run(async () => {
										await removeCourse({
											data: { courseId: data().course.id },
										});
										await backToCourses();
									})
								}
							/>
						</Show>
					</div>
				}
			>
				<div class="flex flex-col gap-6">
					<Show when={data().copiedFrom}>
						{(source) => (
							<p class="text-scrim m-0 text-sm text-muted-foreground">
								Copied from{" "}
								<Link
									to="/orgs/$slug/courses/$courseId"
									params={{ slug: params().slug, courseId: source().id }}
									class="text-foreground underline underline-offset-4"
								>
									{source().name}
								</Link>
							</p>
						)}
					</Show>
					<ActionError error={action.error()} />
					<Show when={mode() === "edit"}>
						<CourseForm
							initial={data().course}
							submitLabel="Save course"
							error={edit.error()}
							pending={edit.pending()}
							onSubmit={async (course) => {
								const ok = await edit.run(() =>
									editCourse({
										data: { courseId: data().course.id, ...course },
									}),
								);
								if (ok) setMode(undefined);
							}}
						>
							<Button variant="ghost" onClick={() => setMode(undefined)}>
								Cancel
							</Button>
						</CourseForm>
					</Show>
					<Show when={mode() === "copy"}>
						<CopyCourse
							courseId={data().course.id}
							name={`${data().course.name} (copy)`}
							onCancel={() => setMode(undefined)}
							onCopied={async (courseId) => {
								setMode(undefined);
								await navigate({
									to: "/orgs/$slug/courses/$courseId",
									params: { slug: params().slug, courseId },
								});
							}}
						/>
					</Show>
				</div>
			</OrgSection>

			<Splits />

			<OrgSection
				title="Events on this course"
				description="Changing splits changes them for every event below."
			>
				<Show
					when={data().events.length > 0}
					fallback={
						<p class="text-scrim m-0 text-sm text-muted-foreground">
							No events use this course yet.
						</p>
					}
				>
					<ul class="m-0 flex list-none flex-col gap-2 p-0">
						<For each={data().events}>
							{(event) => (
								<li class="text-sm">
									<Link
										to="/event-groups/$eventGroupId"
										params={{ eventGroupId: event.eventGroupId }}
										class="font-semibold text-foreground underline-offset-4 hover:underline"
									>
										{event.name}
									</Link>{" "}
									<span class="text-muted-foreground">
										· {event.eventGroupName}
									</span>
								</li>
							)}
						</For>
					</ul>
				</Show>
			</OrgSection>
		</div>
	);
}

function CopyCourse(props: {
	courseId: string;
	name: string;
	onCancel: () => void;
	onCopied: (courseId: string) => void;
}) {
	const action = createOrgAction();
	const [name, setName] = createSignal(props.name);

	const submit = async (e: SubmitEvent) => {
		e.preventDefault();
		let copyId = "";
		const ok = await action.run(async () => {
			const copy = await duplicateCourse({
				data: { courseId: props.courseId, name: name() },
			});
			copyId = copy.id;
		});
		if (ok) props.onCopied(copyId);
	};

	return (
		<Card class="max-w-xl p-6">
			<form class="grid gap-6" onSubmit={submit}>
				<FormField
					label="Name of the copy"
					value={name()}
					onChange={setName}
					description="Splits are copied too. The original is left as it is."
					required
				/>
				<ActionError error={action.error()} />
				<div class="flex flex-wrap gap-3">
					<Button type="submit" disabled={action.pending()}>
						Copy course
					</Button>
					<Button variant="ghost" onClick={props.onCancel}>
						Cancel
					</Button>
				</div>
			</form>
		</Card>
	);
}

function Splits() {
	const data = Route.useLoaderData();
	const [editing, setEditing] = createSignal<Split | "new">();
	const action = createOrgAction();

	return (
		<OrgSection
			title="Splits"
			description="Checkpoints in the order runners reach them. A timing point can appear more than once."
			action={
				<Show when={data().can.update && !editing()}>
					<Button
						disabled={data().timingPoints.length === 0}
						onClick={() => setEditing("new")}
					>
						Add split
					</Button>
				</Show>
			}
		>
			<div class="flex flex-col gap-6">
				<Show when={data().can.update && data().timingPoints.length === 0}>
					<p class="text-scrim m-0 text-sm text-muted-foreground">
						Add timing points to the organization before adding splits.
					</p>
				</Show>
				<Show when={editing()} keyed>
					{(target) => (
						<SplitForm
							courseId={data().course.id}
							timingPoints={data().timingPoints}
							split={target === "new" ? undefined : target}
							onDone={() => setEditing(undefined)}
						/>
					)}
				</Show>
				<ActionError error={action.error()} />
				<Show
					when={data().splits.length > 0}
					fallback={
						<Show when={!editing()}>
							<EmptyState
								title="No splits yet"
								description="Add the start, each aid station and the finish."
							/>
						</Show>
					}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead class="text-right">#</TableHead>
								<TableHead>Name</TableHead>
								<TableHead>Timing point</TableHead>
								<TableHead class="text-right">Distance</TableHead>
								<TableHead>Records</TableHead>
								<TableHead class="text-right">Cutoff</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={data().splits}>
								{(split, index) => (
									<TableRow>
										<TableCell class="text-right tabular-nums text-muted-foreground">
											{index() + 1}
										</TableCell>
										<TableCell class="font-semibold">
											{split.name}
											<Show when={split.isSecretCheckpoint}>
												{" "}
												<Badge variant="sand">Secret</Badge>
											</Show>
										</TableCell>
										<TableCell>
											<Badge variant="chip">{split.timingPointCode}</Badge>
										</TableCell>
										<TableCell class="text-right tabular-nums">
											{formatMiles(split.distanceFromStartMeters)}
										</TableCell>
										<TableCell class="text-muted-foreground">
											{subSplitLabel(split.subSplitBitmap)}
										</TableCell>
										<TableCell class="text-right tabular-nums">
											{split.cutoffDurationSeconds === null
												? "—"
												: formatDuration(split.cutoffDurationSeconds)}
										</TableCell>
										<TableCell class="text-right whitespace-nowrap">
											<Show when={data().can.update}>
												<Button
													variant="ghost"
													size="sm"
													aria-label="Move up"
													disabled={index() === 0 || action.pending()}
													onClick={() =>
														action.run(() =>
															reorderSplit({
																data: { splitId: split.id, direction: "up" },
															}),
														)
													}
												>
													↑
												</Button>
												<Button
													variant="ghost"
													size="sm"
													aria-label="Move down"
													disabled={
														index() === data().splits.length - 1 ||
														action.pending()
													}
													onClick={() =>
														action.run(() =>
															reorderSplit({
																data: { splitId: split.id, direction: "down" },
															}),
														)
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
														action.run(() =>
															removeSplit({ data: { splitId: split.id } }),
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

function SplitForm(props: {
	courseId: string;
	timingPoints: Page["timingPoints"];
	split?: Split;
	onDone: () => void;
}) {
	const action = createOrgAction();
	const [timingPointId, setTimingPointId] = createSignal(
		props.split?.timingPointId ?? props.timingPoints[0].id,
	);
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
		<Card class="max-w-xl p-6">
			<form class="grid gap-6" onSubmit={submit}>
				<FormSelect
					label="Timing point"
					value={timingPointId()}
					onChange={setTimingPointId}
					options={props.timingPoints.map((p) => ({
						value: p.id,
						label: `${p.code} · ${p.name}`,
					}))}
				/>
				<FormField
					label="Name"
					value={name()}
					onChange={setName}
					placeholder={pointName() || "Twin Lakes inbound"}
					description="Leave blank to use the timing point's name."
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
						Records in time
					</Checkbox>
					<Checkbox checked={recordsOut()} onChange={setRecordsOut}>
						Records out time
					</Checkbox>
					<Checkbox checked={secret()} onChange={setSecret}>
						Secret checkpoint
					</Checkbox>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<FormField
						label="Cutoff (h:mm from start)"
						value={cutoff()}
						onChange={setCutoff}
						placeholder="30:00"
					/>
					<FormField
						label="TSD ideal (seconds)"
						type="number"
						value={tsdSeconds()}
						onChange={setTsdSeconds}
						description="Regularity rallies only."
					/>
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
