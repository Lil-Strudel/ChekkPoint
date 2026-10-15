import { createFileRoute, getRouteApi } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import EmptyState from "~/components/EmptyState";
import OrgSection from "~/components/OrgSection";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { formatFeet } from "~/lib/organizations";

export const Route = createFileRoute("/orgs/$orgSlug/timing-points")({
	component: TimingPoints,
});

const orgRoute = getRouteApi("/orgs/$orgSlug");

function TimingPoints() {
	const data = orgRoute.useLoaderData();

	return (
		<OrgSection
			title="Timing points"
			description="Physical places where times are logged. A course can pass one more than once."
			action={<Button disabled>New timing point</Button>}
		>
			<Show
				when={data().org.timingPoints.length > 0}
				fallback={
					<EmptyState
						title="No timing points yet"
						description="Add the aid stations, crossings and finish lines where your volunteers will sit."
					/>
				}
			>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Code</TableHead>
							<TableHead class="text-right">Elevation</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<For each={data().org.timingPoints}>
							{(point) => (
								<TableRow>
									<TableCell class="font-semibold">{point.name}</TableCell>
									<TableCell>
										<Badge variant="chip">{point.code}</Badge>
									</TableCell>
									<TableCell class="text-right tabular-nums text-muted-foreground">
										{point.elevationMeters === null
											? "—"
											: formatFeet(point.elevationMeters)}
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
