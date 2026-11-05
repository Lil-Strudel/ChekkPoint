import { createFileRoute, Link } from "@tanstack/solid-router";
import { getPublicEntrantTelemetryFn } from "~/audit/audit.functions";
import EntrantTelemetryView from "~/components/EntrantTelemetryView";

export const Route = createFileRoute("/events/$slug/entrants/$entrantId")({
	loader: ({ params }) =>
		getPublicEntrantTelemetryFn({
			data: {
				slug: params.slug,
				entrantId: params.entrantId,
			},
		}),
	component: CanonicalEntrantTelemetryPage,
});

function CanonicalEntrantTelemetryPage() {
	const params = Route.useParams();

	return (
		<div class="flex flex-col gap-6 py-6">
			{/* Navigation back to Leaderboard */}
			<div class="flex items-center justify-between">
				<Link
					to="/events/$slug/results"
					params={{ slug: params().slug }}
					class="text-xs font-semibold text-forest hover:underline flex items-center gap-1.5"
				>
					<span>← Back to Results & Splits Leaderboard</span>
				</Link>
			</div>

			{/* Telemetry View */}
			<EntrantTelemetryView
				slug={params().slug}
				entrantId={params().entrantId}
				isSheet={false}
			/>
		</div>
	);
}
