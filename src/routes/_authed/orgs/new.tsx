import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { authClient } from "~/auth/client";
import OrgForm, { orgFormErrors } from "~/components/OrgForm";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import type { OrganizationInput } from "~/orgs/orgs.shared";

export const Route = createFileRoute("/_authed/orgs/new")({
	component: NewOrg,
});

function NewOrg() {
	const navigate = useNavigate();

	const create = async (input: OrganizationInput) => {
		const { error } = await authClient.organization.create(input);
		if (error) return orgFormErrors(error);
		await navigate({ to: "/orgs/$slug", params: { slug: input.slug } });
	};

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">New organization</p>
			<h1 class="page-title">Create an organization</h1>
			<p class="page-sub">
				Name the club, series or company that puts on your races. You'll be its
				owner, and you can change both later.
			</p>

			<Card class="max-w-xl p-6">
				<OrgForm submitLabel="Create organization" onSubmit={create}>
					<Button as={Link} to="/orgs" variant="ghost">
						Cancel
					</Button>
				</OrgForm>
			</Card>
		</main>
	);
}
