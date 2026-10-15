import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import { authClient } from "~/auth/client";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "~/components/ui/text-field";

export const Route = createFileRoute("/reset-password")({
	validateSearch: (search: { token?: string }) => ({
		token: typeof search.token === "string" ? search.token : undefined,
	}),
	component: ResetPassword,
});

function ResetPassword() {
	const search = Route.useSearch();
	const [password, setPassword] = createSignal("");
	const [error, setError] = createSignal<string>();
	const [done, setDone] = createSignal(false);

	const submit = async (e: SubmitEvent) => {
		e.preventDefault();
		const token = search().token;
		if (!token) return setError("This reset link is missing its token.");
		const { error } = await authClient.resetPassword({
			newPassword: password(),
			token,
		});
		if (error) setError(error.message ?? "Could not reset your password");
		else setDone(true);
	};

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Account</p>
			<h1 class="page-title">Choose a new password</h1>
			<Card class="max-w-md p-6">
				<Show
					when={!done()}
					fallback={
						<Alert variant="info">
							<AlertDescription>
								Password updated.{" "}
								<Link to="/sign-in" class="text-primary">
									Sign in
								</Link>
							</AlertDescription>
						</Alert>
					}
				>
					<form class="grid gap-4" onSubmit={submit}>
						<TextField value={password()} onChange={setPassword} required>
							<TextFieldLabel>New password</TextFieldLabel>
							<TextFieldInput
								type="password"
								autocomplete="new-password"
								minLength={8}
							/>
						</TextField>
						<Button type="submit">Update password</Button>
					</form>
					<Show when={error()}>
						<Alert variant="destructive" class="mt-6">
							<AlertDescription>{error()}</AlertDescription>
						</Alert>
					</Show>
				</Show>
			</Card>
		</main>
	);
}
