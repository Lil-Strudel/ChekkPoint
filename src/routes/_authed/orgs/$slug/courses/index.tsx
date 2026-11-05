import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import CourseForm from "~/components/CourseForm";
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
import {
	addCourse,
	duplicateCourse,
	removeCourse,
} from "~/courses/courses.functions";
import { createOrgAction } from "~/orgs/actions";
import { formatFeet, formatMiles } from "~/orgs/format";

export const Route = createFileRoute("/_authed/orgs/$slug/courses/")({
	component: Courses,
});

const orgRoute = getRouteApi("/_authed/orgs/$slug");

function Courses() {
	const data = orgRoute.useLoaderData();
	const params = orgRoute.useParams();
	const [creating, setCreating] = createSignal(false);
	const [cloneTarget, setCloneTarget] = createSignal<{
		id: string;
		name: string;
	} | null>(null);
	const [cloneName, setCloneName] = createSignal("");
	const [deleteError, setDeleteError] = createSignal<string | null>(null);
	const [deletingCourseId, setDeletingCourseId] = createSignal<string | null>(
		null,
	);

	const createAction = createOrgAction();
	const cloneAction = createOrgAction();
	const deleteAction = createOrgAction();

	function openCloneModal(course: { id: string; name: string }) {
		setCloneTarget(course);
		setCloneName(`${course.name} (Copy)`);
	}

	async function handleClone() {
		const target = cloneTarget();
		if (!target || !cloneName().trim()) return;

		const ok = await cloneAction.run(() =>
			duplicateCourse({
				data: {
					courseId: target.id,
					name: cloneName().trim(),
				},
			}),
		);
		if (ok) {
			setCloneTarget(null);
			setCloneName("");
		}
	}

	async function handleDelete(courseId: string, courseName: string) {
		if (
			!confirm(
				`Are you sure you want to delete course "${courseName}"? This action cannot be undone.`,
			)
		) {
			return;
		}

		setDeleteError(null);
		setDeletingCourseId(courseId);
		try {
			const ok = await deleteAction.run(() =>
				removeCourse({
					data: { courseId },
				}),
			);
			if (!ok && deleteAction.error()) {
				setDeleteError(deleteAction.error());
			}
		} catch (err) {
			setDeleteError(err instanceof Error ? err.message : String(err));
		} finally {
			setDeletingCourseId(null);
		}
	}

	return (
		<OrgSection
			title="Courses"
			description="Master library of trail, road, and rally courses shared across all event groups."
			action={
				<Show when={data().can.createCourse && !creating()}>
					<Button onClick={() => setCreating(true)}>+ New course</Button>
				</Show>
			}
		>
			<div class="flex flex-col gap-6">
				<Show when={deleteError()}>
					<Alert variant="destructive">
						<AlertTitle>Cannot Delete Course</AlertTitle>
						<AlertDescription>{deleteError()}</AlertDescription>
					</Alert>
				</Show>

				<Show when={creating()}>
					<div class="rounded-lg border border-border bg-card p-6 shadow-xs">
						<div class="mb-4">
							<h3 class="text-base font-semibold text-foreground">
								Create New Course
							</h3>
							<p class="text-xs text-muted-foreground">
								Define base route geometry. You can build timing stations and
								splits next.
							</p>
						</div>
						<CourseForm
							submitLabel="Create course"
							error={createAction.error()}
							pending={createAction.pending()}
							onSubmit={async (course) => {
								const ok = await createAction.run(() =>
									addCourse({
										data: { organizationId: data().organization.id, ...course },
									}),
								);
								if (ok) setCreating(false);
							}}
						>
							<Button variant="ghost" onClick={() => setCreating(false)}>
								Cancel
							</Button>
						</CourseForm>
					</div>
				</Show>

				<Show
					when={data().courses.length > 0}
					fallback={
						<Show when={!creating()}>
							<EmptyState
								title="No courses yet"
								description="A course is set up once with its timing checkpoints and reused every year, or cloned when routes change."
							/>
						</Show>
					}
				>
					<div class="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Course Name</TableHead>
									<TableHead class="text-right">Distance</TableHead>
									<TableHead class="text-right">Elevation Gain</TableHead>
									<TableHead class="text-center">Splits</TableHead>
									<TableHead class="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<For each={data().courses}>
									{(course) => (
										<TableRow>
											<TableCell class="font-medium">
												<div class="flex flex-col gap-1">
													<div class="flex items-center gap-2">
														<Link
															to="/orgs/$slug/courses/$courseId"
															params={{
																slug: params().slug,
																courseId: course.id,
															}}
															class="font-semibold text-foreground underline-offset-4 hover:underline"
														>
															{course.name}
														</Link>
														<Show when={course.copiedFromCourseId}>
															<Badge variant="chip" class="text-[10px]">
																Cloned
															</Badge>
														</Show>
													</div>
													<Show when={course.gpxRouteUrl}>
														<span class="text-xs text-muted-foreground truncate max-w-xs">
															GPX linked
														</span>
													</Show>
												</div>
											</TableCell>
											<TableCell class="text-right tabular-nums font-mono text-sm">
												{formatMiles(course.distanceMeters)}
											</TableCell>
											<TableCell class="text-right tabular-nums font-mono text-sm text-muted-foreground">
												{course.elevationGainMeters === null
													? "—"
													: formatFeet(course.elevationGainMeters)}
											</TableCell>
											<TableCell class="text-center">
												<Badge variant="outline" class="tabular-nums">
													{course.splitCount ?? 0} splits
												</Badge>
											</TableCell>
											<TableCell class="text-right">
												<div class="flex items-center justify-end gap-2">
													<Link
														to="/courses/$courseId"
														params={{ courseId: course.id }}
														target="_blank"
														class="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
													>
														Pace Calc ↗
													</Link>
													<Link
														to="/orgs/$slug/courses/$courseId"
														params={{
															slug: params().slug,
															courseId: course.id,
														}}
														class="text-xs font-medium text-primary hover:underline"
													>
														Splits
													</Link>
													<Show when={data().can.createCourse}>
														<Button
															variant="outline"
															size="sm"
															class="h-7 px-2 text-xs"
															onClick={() => openCloneModal(course)}
														>
															Clone
														</Button>
													</Show>
													<Show when={data().can.deleteCourse}>
														<Button
															variant="ghost"
															size="sm"
															class="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
															disabled={deletingCourseId() === course.id}
															onClick={() =>
																handleDelete(course.id, course.name)
															}
														>
															{deletingCourseId() === course.id
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
				open={cloneTarget() !== null}
				onOpenChange={(open) => {
					if (!open) setCloneTarget(null);
				}}
			>
				<DialogContent class="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Clone Course</DialogTitle>
						<DialogDescription>
							Create an independent duplicate of "{cloneTarget()?.name}"
							including all ordered timing checkpoints and cutoffs.
						</DialogDescription>
					</DialogHeader>

					<Show when={cloneAction.error()}>
						<Alert variant="destructive">
							<AlertTitle>Clone Failed</AlertTitle>
							<AlertDescription>{cloneAction.error()}</AlertDescription>
						</Alert>
					</Show>

					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleClone();
						}}
						class="space-y-4 py-2"
					>
						<div class="space-y-2">
							<Label for="cloneCourseName">New Course Name</Label>
							<Input
								id="cloneCourseName"
								value={cloneName()}
								onInput={(e) => setCloneName(e.currentTarget.value)}
								placeholder="e.g. Cascade Crest 100M (2027 Reroute)"
								required
								autofocus
							/>
						</div>
						<DialogFooter class="pt-2">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setCloneTarget(null)}
								disabled={cloneAction.pending()}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={cloneAction.pending() || !cloneName().trim()}
							>
								{cloneAction.pending() ? "Cloning..." : "Duplicate Course"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</OrgSection>
	);
}
