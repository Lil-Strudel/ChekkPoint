import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import OrgForm from "~/components/OrgForm";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { createMockOrg, getOrg } from "~/lib/mock-orgs";
import type { OrganizationInput } from "~/lib/organizations";

export const Route = createFileRoute("/orgs/new")({
	component: NewOrg,
});

function NewOrg() {
	const navigate = useNavigate();

	const create = (input: OrganizationInput) => {
		const org = createMockOrg(input);
		navigate({ to: "/orgs/$orgSlug", params: { orgSlug: org.slug } });
	};

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">New organization</p>
			<h1 class="page-title">Create an organization</h1>
			<p class="page-sub">
				Name the club, series or company that puts on your races. You can change
				both later.
			</p>

			<Card class="max-w-xl p-6">
				<OrgForm
					submitLabel="Create organization"
					isSlugTaken={(slug) => getOrg(slug, new Date()) !== undefined}
					onSubmit={create}
				>
					<Button as={Link} to="/orgs" variant="ghost">
						Cancel
					</Button>
				</OrgForm>
			</Card>
		</main>
	);
}
