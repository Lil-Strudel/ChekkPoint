import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import ActionError from "~/components/ActionError";
import ConfirmButton from "~/components/ConfirmButton";
import CourseForm from "~/components/CourseForm";
import { CourseSplitBuilder } from "~/components/CourseSplitBuilder";
import EmptyState from "~/components/EmptyState";
import FormField from "~/components/FormField";
import OrgSection from "~/components/OrgSection";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
	duplicateCourse,
	editCourse,
	getCourse,
	removeCourse,
} from "~/courses/courses.functions";
import { createOrgAction } from "~/orgs/actions";
import { formatFeet, formatMiles } from "~/orgs/format";

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

function CoursePage() {
	const data = Route.useLoaderData();
	const params = Route.useParams();
	const navigate = useNavigate();
	const router = useRouter();
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
								if (ok) {
									setMode(undefined);
									await router.invalidate();
								}
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

			<OrgSection
				title="Splits & Timing Gates"
				description="Checkpoints in the order runners reach them. Timing points can appear more than once (e.g. out-and-back or laps)."
			>
				<CourseSplitBuilder
					courseId={data().course.id}
					courseDistanceMeters={data().course.distanceMeters}
					organizationId={data().course.organizationId}
					splits={data().splits}
					timingPoints={data().timingPoints}
					canUpdate={data().can.update}
					onSplitsChanged={() => router.invalidate()}
				/>
			</OrgSection>

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
									<span class="font-semibold text-foreground">
										{event.name}
									</span>{" "}
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
