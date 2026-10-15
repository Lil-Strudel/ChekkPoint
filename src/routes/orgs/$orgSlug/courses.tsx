import { createFileRoute, getRouteApi } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
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
import { formatFeet, formatMiles } from "~/lib/organizations";

export const Route = createFileRoute("/orgs/$orgSlug/courses")({
	component: Courses,
});

const orgRoute = getRouteApi("/orgs/$orgSlug");

function Courses() {
	const data = orgRoute.useLoaderData();

	return (
		<OrgSection
			title="Courses"
			description="Routes your events run on, shared across event groups."
			action={<Button disabled>New course</Button>}
		>
			<Show
				when={data().org.courses.length > 0}
				fallback={
					<EmptyState
						title="No courses yet"
						description="Add a course once and reuse it every year, or copy it when the route changes."
					/>
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
						<For each={data().org.courses}>
							{(course) => (
								<TableRow>
									<TableCell class="font-semibold">{course.name}</TableCell>
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
		</OrgSection>
	);
}
