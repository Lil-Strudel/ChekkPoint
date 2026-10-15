import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import { authClient } from "~/auth/client";
import { safeRedirect } from "~/auth/redirect";
import { getAuthOptions } from "~/auth/session.functions";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "~/components/ui/text-field";

export const Route = createFileRoute("/sign-in")({
	validateSearch: (search: { redirect?: string }): { redirect?: string } => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
	beforeLoad: ({ context, search }) => {
		if (context.viewer) throw redirect({ href: safeRedirect(search.redirect) });
	},
	loader: () => getAuthOptions(),
	component: SignIn,
});

function SignIn() {
	const router = useRouter();
	const search = Route.useSearch();
	const target = () => safeRedirect(search().redirect);
	const options = Route.useLoaderData();

	const [email, setEmail] = createSignal("");
	const [password, setPassword] = createSignal("");
	const [otp, setOtp] = createSignal("");
	const [codeSent, setCodeSent] = createSignal(false);
	const [notice, setNotice] = createSignal<string>();
	const [error, setError] = createSignal<string>();
	const [pending, setPending] = createSignal(false);

	const run = async (
		action: () => Promise<{ error: { message?: string } | null }>,
	) => {
		setError(undefined);
		setNotice(undefined);
		setPending(true);
		const { error } = await action();
		setPending(false);
		if (error) setError(error.message ?? "Something went wrong");
		return !error;
	};

	const finish = async () => {
		await router.invalidate();
		await router.navigate({ href: target() });
	};

	const sendCode = async (e: SubmitEvent) => {
		e.preventDefault();
		const ok = await run(() =>
			authClient.emailOtp.sendVerificationOtp({
				email: email(),
				type: "sign-in",
			}),
		);
		if (ok) setCodeSent(true);
	};

	const verifyCode = async (e: SubmitEvent) => {
		e.preventDefault();
		if (
			await run(() =>
				authClient.signIn.emailOtp({ email: email(), otp: otp() }),
			)
		)
			await finish();
	};

	const sendMagicLink = async () => {
		const ok = await run(() =>
			authClient.signIn.magicLink({
				email: email(),
				callbackURL: target(),
			}),
		);
		if (ok) setNotice(`We sent a sign-in link to ${email()}.`);
	};

	const signInWithPassword = async (e: SubmitEvent) => {
		e.preventDefault();
		const ok = await run(() =>
			authClient.signIn.email({ email: email(), password: password() }),
		);
		if (ok) await finish();
	};

	const signInWithPasskey = async () => {
		if (await run(() => authClient.signIn.passkey())) await finish();
	};

	const signInWithGoogle = () =>
		run(() =>
			authClient.signIn.social({
				provider: "google",
				callbackURL: target(),
			}),
		);

	const EmailField = () => (
		<TextField value={email()} onChange={setEmail} required>
			<TextFieldLabel>Email</TextFieldLabel>
			<TextFieldInput type="email" autocomplete="email webauthn" />
		</TextField>
	);

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Account</p>
			<h1 class="page-title">Sign in</h1>
			<p class="page-sub">
				Volunteers, race directors and racers all sign in here.
			</p>

			<Card class="max-w-md p-6">
				<Tabs defaultValue="code">
					<TabsList class="w-full">
						<TabsTrigger value="code">Email code</TabsTrigger>
						<TabsTrigger value="password">Password</TabsTrigger>
						<TabsTrigger value="passkey">Passkey</TabsTrigger>
					</TabsList>

					<TabsContent value="code">
						<Show
							when={codeSent()}
							fallback={
								<form class="grid gap-4" onSubmit={sendCode}>
									<EmailField />
									<Button type="submit" disabled={pending()}>
										Email me a code
									</Button>
									<Button
										type="button"
										variant="link"
										disabled={pending() || !email()}
										onClick={sendMagicLink}
									>
										Email me a sign-in link instead
									</Button>
								</form>
							}
						>
							<form class="grid gap-4" onSubmit={verifyCode}>
								<p class="m-0 text-sm text-muted-foreground">
									Enter the 6-digit code sent to {email()}.
								</p>
								<TextField value={otp()} onChange={setOtp} required>
									<TextFieldLabel>Code</TextFieldLabel>
									<TextFieldInput
										inputmode="numeric"
										autocomplete="one-time-code"
										maxLength={6}
										class="tabular-nums tracking-widest"
									/>
								</TextField>
								<Button type="submit" disabled={pending()}>
									Sign in
								</Button>
								<Button
									type="button"
									variant="link"
									onClick={() => setCodeSent(false)}
								>
									Use a different email
								</Button>
							</form>
						</Show>
					</TabsContent>

					<TabsContent value="password">
						<form class="grid gap-4" onSubmit={signInWithPassword}>
							<EmailField />
							<TextField value={password()} onChange={setPassword} required>
								<TextFieldLabel>Password</TextFieldLabel>
								<TextFieldInput
									type="password"
									autocomplete="current-password"
								/>
							</TextField>
							<Button type="submit" disabled={pending()}>
								Sign in
							</Button>
							<Link to="/forgot-password" class="text-sm text-primary">
								Forgot your password?
							</Link>
						</form>
					</TabsContent>

					<TabsContent value="passkey" class="grid gap-4">
						<p class="m-0 text-sm text-muted-foreground">
							Use the passkey saved on this device. Add one from your account
							page after signing in another way.
						</p>
						<Button disabled={pending()} onClick={signInWithPasskey}>
							Sign in with a passkey
						</Button>
					</TabsContent>
				</Tabs>

				<Show when={options().google}>
					<Separator class="my-6" />
					<Button
						variant="outline"
						class="w-full"
						disabled={pending()}
						onClick={signInWithGoogle}
					>
						Continue with Google
					</Button>
				</Show>

				<Show when={notice()}>
					<Alert variant="info" class="mt-6">
						<AlertDescription>{notice()}</AlertDescription>
					</Alert>
				</Show>
				<Show when={error()}>
					<Alert variant="destructive" class="mt-6">
						<AlertDescription>{error()}</AlertDescription>
					</Alert>
				</Show>

				<p class="mb-0 mt-6 text-sm text-muted-foreground">
					New here?{" "}
					<Link to="/sign-up" class="text-primary">
						Create an account
					</Link>
				</p>
			</Card>
		</main>
	);
}
