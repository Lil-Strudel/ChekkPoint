import { createFileRoute, useRouter } from "@tanstack/solid-router";
import { createResource, createSignal, Show } from "solid-js";
import { ORG_ROLE_LABELS, parseOrgRoles } from "~/auth/access";
import { authClient } from "~/auth/client";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

export const Route = createFileRoute(
	"/_authed/accept-invitation/$invitationId",
)({
	ssr: false,
	component: AcceptInvitation,
});

function AcceptInvitation() {
	const router = useRouter();
	const params = Route.useParams();
	const [error, setError] = createSignal<string>();

	const [invitation] = createResource(
		() => params().invitationId,
		async (id) => {
			const { data, error } = await authClient.organization.getInvitation({
				query: { id },
			});
			if (error) setError(error.message ?? "Invitation not found");
			return data;
		},
	);

	const respond = async (accept: boolean) => {
		const invitationId = params().invitationId;
		const { error } = accept
			? await authClient.organization.acceptInvitation({ invitationId })
			: await authClient.organization.rejectInvitation({ invitationId });
		if (error) return setError(error.message ?? "Could not respond");
		await router.invalidate();
		const slug = invitation()?.organizationSlug;
		if (accept && slug)
			await router.navigate({ to: "/orgs/$slug", params: { slug } });
		else await router.navigate({ to: "/orgs" });
	};

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Invitation</p>
			<Show
				when={invitation()}
				fallback={<h1 class="page-title">Invitation</h1>}
			>
				{(inv) => (
					<>
						<h1 class="page-title">Join {inv().organizationName}</h1>
						<p class="page-sub">
							{inv().inviterEmail} invited you as{" "}
							{parseOrgRoles(inv().role)
								.map((r) => ORG_ROLE_LABELS[r])
								.join(", ")}
							.
						</p>
						<Card class="flex max-w-md gap-3 p-6">
							<Button onClick={() => respond(true)}>Accept</Button>
							<Button variant="ghost" onClick={() => respond(false)}>
								Decline
							</Button>
						</Card>
					</>
				)}
			</Show>
			<Show when={error()}>
				<Alert variant="destructive" class="mt-6 max-w-md">
					<AlertDescription>{error()}</AlertDescription>
				</Alert>
			</Show>
		</main>
	);
}
