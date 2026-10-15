import { useRouter } from "@tanstack/solid-router";
import { createSignal } from "solid-js";

type AuthResult = { error: { message?: string } | null };

export function createOrgAction() {
	const router = useRouter();
	const [error, setError] = createSignal<string>();
	const [pending, setPending] = createSignal(false);

	const run = async (action: () => Promise<unknown>) => {
		setError(undefined);
		setPending(true);
		try {
			await action();
			await router.invalidate();
			return true;
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			return false;
		} finally {
			setPending(false);
		}
	};

	const runAuth = (action: () => Promise<AuthResult>) =>
		run(async () => {
			const { error } = await action();
			if (error) throw new Error(error.message);
		});

	return { error, pending, run, runAuth };
}
