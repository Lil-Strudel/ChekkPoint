import { createFileRoute, getRouteApi } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import EmptyState from "~/components/EmptyState";
import OrgSection from "~/components/OrgSection";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { formatFeet, formatMiles } from "~/orgs/format";

export const Route = createFileRoute("/_authed/orgs/$slug/courses")({
	component: Courses,
});

const orgRoute = getRouteApi("/_authed/orgs/$slug");

function Courses() {
	const data = orgRoute.useLoaderData();

	return (
		<OrgSection
			title="Courses"
			description="Routes your events run on, shared across event groups."
		>
			<Show
				when={data().courses.length > 0}
				fallback={
					<EmptyState
						title="No courses yet"
						description="A course is set up once and reused every year, or copied when the route changes."
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
						<For each={data().courses}>
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
