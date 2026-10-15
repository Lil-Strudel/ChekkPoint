import { createFileRoute } from "@tanstack/solid-router";
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

export const Route = createFileRoute("/forgot-password")({
	component: ForgotPassword,
});

function ForgotPassword() {
	const [email, setEmail] = createSignal("");
	const [sent, setSent] = createSignal(false);

	const submit = async (e: SubmitEvent) => {
		e.preventDefault();
		await authClient.requestPasswordReset({
			email: email(),
			redirectTo: "/reset-password",
		});
		setSent(true);
	};

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Account</p>
			<h1 class="page-title">Reset your password</h1>
			<Card class="max-w-md p-6">
				<Show
					when={!sent()}
					fallback={
						<Alert variant="info">
							<AlertDescription>
								If an account exists for {email()}, a reset link is on its way.
							</AlertDescription>
						</Alert>
					}
				>
					<form class="grid gap-4" onSubmit={submit}>
						<TextField value={email()} onChange={setEmail} required>
							<TextFieldLabel>Email</TextFieldLabel>
							<TextFieldInput type="email" autocomplete="email" />
						</TextField>
						<Button type="submit">Send reset link</Button>
					</form>
				</Show>
			</Card>
		</main>
	);
}
