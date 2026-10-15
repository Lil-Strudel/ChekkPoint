import { createFileRoute, useRouter } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { getAccountOverview, updateMyName } from "~/auth/account.functions";
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

export const Route = createFileRoute("/_authed/account")({
	loader: () => getAccountOverview(),
	component: Account,
});

const PROVIDER_LABELS: Record<string, string> = {
	credential: "Email & password",
	google: "Google",
	strava: "Strava",
};

async function unwrap<T>(
	request: Promise<{ data: T | null; error: { message?: string } | null }>,
) {
	const { data, error } = await request;
	if (error) throw new Error(error.message ?? "Request failed");
	return data;
}

function Account() {
	const router = useRouter();
	const context = Route.useRouteContext();
	const data = Route.useLoaderData();
	const viewer = () => context().viewer;
	const [error, setError] = createSignal<string>();

	const act = async (action: () => Promise<unknown>) => {
		setError(undefined);
		try {
			await action();
			await router.invalidate();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		}
	};

	const [firstName, setFirstName] = createSignal(
		viewer().person?.firstName ?? "",
	);
	const [lastName, setLastName] = createSignal(viewer().person?.lastName ?? "");
	const saveName = (e: SubmitEvent) => {
		e.preventDefault();
		return act(() =>
			updateMyName({ data: { firstName: firstName(), lastName: lastName() } }),
		);
	};

	const linked = (providerId: string) =>
		data().accounts.some((a) => a.providerId === providerId);

	const link = (provider: "google" | "strava") =>
		act(() =>
			unwrap(authClient.linkSocial({ provider, callbackURL: "/account" })),
		);

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Account</p>
			<h1 class="page-title">{viewer().user.name || viewer().user.email}</h1>
			<p class="page-sub">{viewer().user.email}</p>

			<Show when={error()}>
				<Alert variant="destructive" class="mb-6">
					<AlertDescription>{error()}</AlertDescription>
				</Alert>
			</Show>

			<div class="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Your name</CardTitle>
						<CardDescription>
							Shown to organizers and on results.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form class="grid gap-4" onSubmit={saveName}>
							<div class="grid grid-cols-2 gap-4">
								<TextField value={firstName()} onChange={setFirstName} required>
									<TextFieldLabel>First name</TextFieldLabel>
									<TextFieldInput autocomplete="given-name" />
								</TextField>
								<TextField value={lastName()} onChange={setLastName}>
									<TextFieldLabel>Last name</TextFieldLabel>
									<TextFieldInput autocomplete="family-name" />
								</TextField>
							</div>
							<Button type="submit" class="justify-self-start">
								Save
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Passkeys</CardTitle>
						<CardDescription>
							Sign in at a checkpoint with your fingerprint or face.
						</CardDescription>
					</CardHeader>
					<CardContent class="grid gap-3">
						<For
							each={data().passkeys}
							fallback={
								<p class="m-0 text-sm text-muted-foreground">
									No passkeys yet.
								</p>
							}
						>
							{(key) => (
								<div class="flex items-center justify-between gap-3 text-sm">
									<span>
										{key.name || "Passkey"}{" "}
										<span class="text-muted-foreground">
											added {new Date(key.createdAt).toLocaleDateString()}
										</span>
									</span>
									<Button
										size="sm"
										variant="ghost"
										onClick={() =>
											act(() =>
												unwrap(
													authClient.passkey.deletePasskey({ id: key.id }),
												),
											)
										}
									>
										Remove
									</Button>
								</div>
							)}
						</For>
						<Button
							class="justify-self-start"
							onClick={() => act(() => unwrap(authClient.passkey.addPasskey()))}
						>
							Add a passkey
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Linked accounts</CardTitle>
					</CardHeader>
					<CardContent class="grid gap-3">
						<For each={data().accounts}>
							{(account) => (
								<div class="flex items-center justify-between gap-3 text-sm">
									<Badge variant="chip">
										{PROVIDER_LABELS[account.providerId] ?? account.providerId}
									</Badge>
									<Show when={account.providerId !== "credential"}>
										<Button
											size="sm"
											variant="ghost"
											onClick={() =>
												act(() =>
													unwrap(
														authClient.unlinkAccount({
															accountId: account.id,
														}),
													),
												)
											}
										>
											Unlink
										</Button>
									</Show>
								</div>
							)}
						</For>
						<div class="flex flex-wrap gap-2">
							<Show when={data().providers.google && !linked("google")}>
								<Button variant="outline" onClick={() => link("google")}>
									Link Google
								</Button>
							</Show>
							<Show when={data().providers.strava && !linked("strava")}>
								<Button variant="outline" onClick={() => link("strava")}>
									Link Strava
								</Button>
							</Show>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Signed-in devices</CardTitle>
					</CardHeader>
					<CardContent class="grid gap-3">
						<For each={data().sessions}>
							{(session) => (
								<div class="flex items-center justify-between gap-3 text-sm">
									<span class="min-w-0 truncate text-muted-foreground">
										{session.userAgent ?? "Unknown device"}
									</span>
									<Button
										size="sm"
										variant="ghost"
										onClick={() =>
											act(() =>
												unwrap(
													authClient.revokeSession({ token: session.token }),
												),
											)
										}
									>
										Sign out
									</Button>
								</div>
							)}
						</For>
						<Button
							variant="outline"
							class="justify-self-start"
							onClick={() =>
								act(() => unwrap(authClient.revokeOtherSessions()))
							}
						>
							Sign out everywhere else
						</Button>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
