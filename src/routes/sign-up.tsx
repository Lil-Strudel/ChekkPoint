import { createFileRoute, Link, redirect } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import { authClient } from "~/auth/client";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
} from "~/components/ui/text-field";

export const Route = createFileRoute("/sign-up")({
	beforeLoad: ({ context }) => {
		if (context.viewer) throw redirect({ to: "/orgs" });
	},
	component: SignUp,
});

function SignUp() {
	const [name, setName] = createSignal("");
	const [email, setEmail] = createSignal("");
	const [password, setPassword] = createSignal("");
	const [error, setError] = createSignal<string>();
	const [pending, setPending] = createSignal(false);
	const [sent, setSent] = createSignal(false);

	const submit = async (e: SubmitEvent) => {
		e.preventDefault();
		setError(undefined);
		setPending(true);
		const { error } = await authClient.signUp.email({
			name: name(),
			email: email(),
			password: password(),
			callbackURL: "/orgs",
		});
		setPending(false);
		if (error) setError(error.message ?? "Could not create your account");
		else setSent(true);
	};

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Account</p>
			<h1 class="page-title">Create an account</h1>
			<p class="page-sub">
				If an organizer already added you as a racer or volunteer, use the same
				email and we will connect your account to that record.
			</p>

			<Card class="max-w-md p-6">
				<Show
					when={!sent()}
					fallback={
						<Alert variant="info">
							<AlertTitle>Check your email</AlertTitle>
							<AlertDescription>
								We sent a verification link to {email()}. Open it to finish
								signing up.
							</AlertDescription>
						</Alert>
					}
				>
					<form class="grid gap-4" onSubmit={submit}>
						<TextField value={name()} onChange={setName} required>
							<TextFieldLabel>Full name</TextFieldLabel>
							<TextFieldInput autocomplete="name" />
						</TextField>
						<TextField value={email()} onChange={setEmail} required>
							<TextFieldLabel>Email</TextFieldLabel>
							<TextFieldInput type="email" autocomplete="email" />
						</TextField>
						<TextField value={password()} onChange={setPassword} required>
							<TextFieldLabel>Password</TextFieldLabel>
							<TextFieldInput
								type="password"
								autocomplete="new-password"
								minLength={8}
							/>
							<TextFieldDescription>
								At least 8 characters.
							</TextFieldDescription>
						</TextField>
						<Button type="submit" disabled={pending()}>
							Create account
						</Button>
					</form>
					<Show when={error()}>
						<Alert variant="destructive" class="mt-6">
							<AlertDescription>{error()}</AlertDescription>
						</Alert>
					</Show>
				</Show>
				<p class="mb-0 mt-6 text-sm text-muted-foreground">
					Already have an account?{" "}
					<Link to="/sign-in" class="text-primary">
						Sign in
					</Link>
				</p>
			</Card>
		</main>
	);
}
