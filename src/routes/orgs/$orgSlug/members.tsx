import { createFileRoute, getRouteApi } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import EmptyState from "~/components/EmptyState";
import OrgSection from "~/components/OrgSection";
import { Badge, type BadgeProps } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { type OrgRole, roleLabels } from "~/lib/organizations";

export const Route = createFileRoute("/orgs/$orgSlug/members")({
	component: Members,
});

const orgRoute = getRouteApi("/orgs/$orgSlug");

const roleBadges: Record<OrgRole, BadgeProps["variant"]> = {
	owner: "forest",
	admin: "sage",
	volunteer: "chip",
};

function Members() {
	const data = orgRoute.useLoaderData();

	return (
		<OrgSection
			title="Members"
			description="People who can set up events or log times for this organization."
			action={<Button disabled>Invite member</Button>}
		>
			<Show
				when={data().org.members.length > 0}
				fallback={
					<EmptyState
						title="Just you so far"
						description="Invite admins to help with setup and volunteers to run the checkpoints."
					/>
				}
			>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Email</TableHead>
							<TableHead>Role</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<For each={data().org.members}>
							{(member) => (
								<TableRow>
									<TableCell class="font-semibold">{member.name}</TableCell>
									<TableCell class="text-muted-foreground">
										{member.email}
									</TableCell>
									<TableCell>
										<Badge variant={roleBadges[member.role]}>
											{roleLabels[member.role]}
										</Badge>
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
