import { createFileRoute, Link, useRouter } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { ORG_ROLE_LABELS, parseOrgRoles } from "~/auth/access";
import { authClient } from "~/auth/client";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "~/components/ui/text-field";
import { getMyOrganizations } from "~/orgs/orgs.functions";
import { STAFF_ROLE_LABELS, slugify } from "~/orgs/orgs.shared";

export const Route = createFileRoute("/_authed/orgs/")({
	loader: () => getMyOrganizations(),
	component: Organizations,
});

function Organizations() {
	const router = useRouter();
	const data = Route.useLoaderData();
	const [name, setName] = createSignal("");
	const [error, setError] = createSignal<string>();

	const create = async (e: SubmitEvent) => {
		e.preventDefault();
		setError(undefined);
		const slug = slugify(name());
		const { error } = await authClient.organization.create({
			name: name(),
			slug,
		});
		if (error)
			return setError(error.message ?? "Could not create organization");
		await router.navigate({ to: "/orgs/$slug", params: { slug } });
	};

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Organizations</p>
			<h1 class="page-title">Where you belong</h1>
			<p class="page-sub">
				Organization roles apply to every event the organization runs. Staffing
				applies to a single event group.
			</p>

			<div class="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Your organizations</CardTitle>
					</CardHeader>
					<CardContent class="grid gap-3">
						<For
							each={data().memberships}
							fallback={
								<p class="m-0 text-sm text-muted-foreground">
									You are not a member of any organization yet.
								</p>
							}
						>
							{(org) => (
								<Link
									to="/orgs/$slug"
									params={{ slug: org.slug }}
									class="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:bg-accent"
								>
									<span class="font-semibold">{org.name}</span>
									<span class="flex flex-wrap gap-1">
										<For each={parseOrgRoles(org.role)}>
											{(role) => (
												<Badge variant="forest">{ORG_ROLE_LABELS[role]}</Badge>
											)}
										</For>
									</span>
								</Link>
							)}
						</For>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Your staffing</CardTitle>
						<CardDescription>
							Event groups where an organizer rostered you.
						</CardDescription>
					</CardHeader>
					<CardContent class="grid gap-3">
						<For
							each={data().staffing}
							fallback={
								<p class="m-0 text-sm text-muted-foreground">
									No staffing assignments.
								</p>
							}
						>
							{(staff) => (
								<Link
									to="/event-groups/$eventGroupId"
									params={{ eventGroupId: staff.eventGroupId }}
									class="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:bg-accent"
								>
									<span>
										<span class="block font-semibold">
											{staff.eventGroupName}
										</span>
										<span class="text-xs text-muted-foreground">
											{staff.organizationName}
										</span>
									</span>
									<span class="flex flex-wrap gap-1">
										<For each={staff.roles}>
											{(role) => (
												<Badge variant="sage">{STAFF_ROLE_LABELS[role]}</Badge>
											)}
										</For>
									</span>
								</Link>
							)}
						</For>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>New organization</CardTitle>
						<CardDescription>You become its owner.</CardDescription>
					</CardHeader>
					<CardContent>
						<form class="grid gap-4" onSubmit={create}>
							<TextField value={name()} onChange={setName} required>
								<TextFieldLabel>Name</TextFieldLabel>
								<TextFieldInput placeholder="Wasatch Mountain Club" />
							</TextField>
							<Button type="submit" class="justify-self-start">
								Create organization
							</Button>
							<Show when={error()}>
								<Alert variant="destructive">
									<AlertDescription>{error()}</AlertDescription>
								</Alert>
							</Show>
						</form>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
