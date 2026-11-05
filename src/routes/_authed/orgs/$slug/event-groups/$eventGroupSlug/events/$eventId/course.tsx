import { createFileRoute, useRouter } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { CourseSplitBuilder } from "~/components/CourseSplitBuilder";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { formatFeet, formatMiles } from "~/orgs/format";
import { getSubEventCourse } from "~/race-control/race-control.functions";

export const Route = createFileRoute(
	"/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/course",
)({
	loader: ({ params }) =>
		getSubEventCourse({
			data: {
				slug: params.slug,
				eventGroupSlug: params.eventGroupSlug,
				eventId: params.eventId,
			},
		}),
	component: SubEventCourseCutoffsTab,
});

function SubEventCourseCutoffsTab() {
	const data = Route.useLoaderData();
	const router = useRouter();

	const event = () => data().event;
	const course = () => data().course;
	const splits = () => data().splits;
	const timingPoints = () => data().timingPoints;
	const org = () => data().organization;
	const group = () => data().eventGroup;
	const access = () => data().access;

	return (
		<div class="px-6 py-8 max-w-7xl mx-auto space-y-8">
			{/* Course Overview Card */}
			<div class="rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<h2 class="text-xl font-bold font-serif text-foreground">
							{course().name}
						</h2>
						<Badge variant="sage" class="text-xs">
							Bound to {event().name}
						</Badge>
					</div>
					<p class="text-xs text-muted-foreground font-mono tabular-nums">
						{formatMiles(course().distanceMeters)} ({(course().distanceMeters / 1000).toFixed(1)} km)
						{course().elevationGainMeters !== null &&
							` · ${formatFeet(course().elevationGainMeters ?? 0)} elevation gain`}
						{` · ${splits().length} timed checkpoint splits`}
					</p>
				</div>

				<div class="flex items-center gap-3">
					<Show when={course().gpxRouteUrl}>
						<a
							href={course().gpxRouteUrl!}
							target="_blank"
							rel="noopener noreferrer"
							class="text-xs text-forest hover:underline font-semibold"
						>
							Download GPX Route ↗
						</a>
					</Show>
				</div>
			</div>

			{/* Course Split Builder Embedded In-Place */}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<h3 class="text-lg font-bold font-serif text-foreground">
							Course Splits, Timing Gates & Departure Cutoffs
						</h3>
						<p class="text-xs text-muted-foreground">
							Define cumulative milestone distances, departure cutoffs from gun start, and assign physical station timing points.
						</p>
					</div>
				</div>

				<CourseSplitBuilder
					courseId={course().id}
					courseDistanceMeters={course().distanceMeters}
					organizationId={org().id}
					splits={splits()}
					timingPoints={timingPoints()}
					canUpdate={access().canManageCourse}
					discipline={group().discipline}
					onSplitsChanged={() => router.invalidate()}
				/>
			</div>
		</div>
	);
}
