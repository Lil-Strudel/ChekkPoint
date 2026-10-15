import { createFileRoute, getRouteApi } from "@tanstack/solid-router";
import OrgForm from "~/components/OrgForm";
import OrgSection from "~/components/OrgSection";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { getOrg } from "~/lib/mock-orgs";

export const Route = createFileRoute("/orgs/$orgSlug/settings")({
	component: Settings,
});

const orgRoute = getRouteApi("/orgs/$orgSlug");

function Settings() {
	const data = orgRoute.useLoaderData();

	return (
		<div class="flex max-w-xl flex-col gap-16">
			<OrgSection title="Details">
				<Card class="p-6">
					<OrgForm
						initial={{ name: data().org.name, slug: data().org.slug }}
						submitLabel="Save changes"
						submitDisabled
						isSlugTaken={(slug) => getOrg(slug, data().now) !== undefined}
						onSubmit={() => {}}
					/>
				</Card>
			</OrgSection>

			<OrgSection title="Danger zone">
				<Card class="border-destructive/30 p-6">
					<h3 class="m-0 text-sm font-semibold text-foreground">
						Delete this organization
					</h3>
					<p class="m-0 mt-1 text-sm text-muted-foreground">
						Removes every event group, course, timing point and result it holds.
						This can't be undone.
					</p>
					<Button variant="destructive" class="mt-5" disabled>
						Delete organization
					</Button>
				</Card>
			</OrgSection>
		</div>
	);
}
