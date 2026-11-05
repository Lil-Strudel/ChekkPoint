import {
	createFileRoute,
	notFound,
	redirect,
} from "@tanstack/solid-router";
import { getEventGroup } from "~/orgs/orgs.functions";
import { eventGroupIdInput } from "~/orgs/orgs.shared";

export const Route = createFileRoute("/_authed/event-groups/$eventGroupId")({
	loader: async ({ params }) => {
		if (!eventGroupIdInput.safeParse(params).success) throw notFound();
		const data = await getEventGroup({ data: { eventGroupId: params.eventGroupId } });
		if (!data || !data.eventGroup) throw notFound();

		// Clean redirect from legacy ID-based URLs to consolidated hierarchy
		throw redirect({
			to: "/orgs/$slug/event-groups/$eventGroupSlug",
			params: {
				slug: data.eventGroup.organizationSlug,
				eventGroupSlug: data.eventGroup.slug,
			},
		});
	},
	notFoundComponent: () => (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Event group</p>
			<h1 class="page-title">Not found</h1>
			<p class="page-sub">It doesn't exist, or you don't have access to it.</p>
		</main>
	),
	component: () => null,
});
