import { createFileRoute, getRouteApi, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import CourseForm from "~/components/CourseForm";
import EmptyState from "~/components/EmptyState";
import OrgSection from "~/components/OrgSection";
import { Button } from "~/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { addCourse } from "~/courses/courses.functions";
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
	const create = createOrgAction();

	return (
		<OrgSection
			title="Courses"
			description="Routes your events run on, shared across event groups."
			action={
				<Show when={data().can.createCourse && !creating()}>
					<Button onClick={() => setCreating(true)}>New course</Button>
				</Show>
			}
		>
			<div class="flex flex-col gap-6">
				<Show when={creating()}>
					<CourseForm
						submitLabel="Create course"
						error={create.error()}
						pending={create.pending()}
						onSubmit={async (course) => {
							const ok = await create.run(() =>
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
				</Show>

				<Show
					when={data().courses.length > 0}
					fallback={
						<Show when={!creating()}>
							<EmptyState
								title="No courses yet"
								description="A course is set up once and reused every year, or copied when the route changes."
							/>
						</Show>
					}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead class="text-right">Distance</TableHead>
								<TableHead class="text-right">Elevation gain</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={data().courses}>
								{(course) => (
									<TableRow>
										<TableCell class="font-semibold">
											<Link
												to="/orgs/$slug/courses/$courseId"
												params={{ slug: params().slug, courseId: course.id }}
												class="text-foreground underline-offset-4 hover:underline"
											>
												{course.name}
											</Link>
										</TableCell>
										<TableCell class="text-right tabular-nums">
											{formatMiles(course.distanceMeters)}
										</TableCell>
										<TableCell class="text-right tabular-nums text-muted-foreground">
											{course.elevationGainMeters === null
												? "—"
												: formatFeet(course.elevationGainMeters)}
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
