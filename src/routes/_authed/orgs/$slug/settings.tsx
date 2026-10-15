import {
	createFileRoute,
	getRouteApi,
	useNavigate,
	useRouter,
} from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import { authClient } from "~/auth/client";
import EmptyState from "~/components/EmptyState";
import OrgForm, { orgFormErrors } from "~/components/OrgForm";
import OrgSection from "~/components/OrgSection";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import type { OrganizationInput } from "~/orgs/orgs.shared";

export const Route = createFileRoute("/_authed/orgs/$slug/settings")({
	component: Settings,
});

const orgRoute = getRouteApi("/_authed/orgs/$slug");

function Settings() {
	const data = orgRoute.useLoaderData();
	const navigate = useNavigate();
	const router = useRouter();
	const org = () => data().organization;

	const save = async (input: OrganizationInput) => {
		const { error } = await authClient.organization.update({
			organizationId: org().id,
			data: input,
		});
		if (error) return orgFormErrors(error);
		if (input.slug === org().slug) await router.invalidate();
		else await navigate({ to: "/orgs/$slug/settings", params: input });
	};

	return (
		<Show
			when={data().can.updateOrganization || data().can.deleteOrganization}
			fallback={
				<EmptyState
					title="Settings are for owners and admins"
					description="Ask one of them if the name or address needs to change."
				/>
			}
		>
			<div class="flex max-w-xl flex-col gap-16">
				<Show when={data().can.updateOrganization}>
					<OrgSection title="Details">
						<Card class="p-6">
							<OrgForm
								initial={{ name: org().name, slug: org().slug }}
								submitLabel="Save changes"
								onSubmit={save}
							/>
						</Card>
					</OrgSection>
				</Show>

				<Show when={data().can.deleteOrganization}>
					<DeleteOrganization organizationId={org().id} name={org().name} />
				</Show>
			</div>
		</Show>
	);
}

function DeleteOrganization(props: { organizationId: string; name: string }) {
	const navigate = useNavigate();
	const [confirming, setConfirming] = createSignal(false);
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal<string>();

	// Not createOrgAction: reloading this org after deleting it would 404.
	const remove = async () => {
		setPending(true);
		const result = await authClient.organization.delete({
			organizationId: props.organizationId,
		});
		setPending(false);
		if (result.error) return setError(result.error.message);
		await navigate({ to: "/orgs" });
	};

	return (
		<OrgSection title="Danger zone">
			<Card class="border-destructive/30 p-6">
				<h3 class="m-0 text-sm font-semibold text-foreground">
					Delete this organization
				</h3>
				<p class="m-0 mt-1 text-sm text-muted-foreground">
					Removes every event group, course, timing point and result it holds.
					This can't be undone.
				</p>
				<Show when={error()}>
					<Alert variant="destructive" class="mt-5">
						<AlertDescription>{error()}</AlertDescription>
					</Alert>
				</Show>
				<div class="mt-5 flex flex-wrap gap-3">
					<Show
						when={confirming()}
						fallback={
							<Button variant="destructive" onClick={() => setConfirming(true)}>
								Delete organization
							</Button>
						}
					>
						<Button variant="destructive" disabled={pending()} onClick={remove}>
							Delete {props.name} for good
						</Button>
						<Button variant="ghost" onClick={() => setConfirming(false)}>
							Keep it
						</Button>
					</Show>
				</div>
			</Card>
		</OrgSection>
	);
}
