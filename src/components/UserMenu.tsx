import {
	Link,
	useNavigate,
	useRouteContext,
	useRouter,
} from "@tanstack/solid-router";
import { Show } from "solid-js";
import { authClient } from "~/auth/client";
import type { Viewer } from "~/auth/session.server";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

function displayName(viewer: Viewer) {
	const person = viewer.person;
	if (person) return `${person.firstName} ${person.lastName}`.trim();
	return viewer.user.name || viewer.user.email;
}

export default function UserMenu() {
	const context = useRouteContext({ from: "__root__" });
	const router = useRouter();
	const navigate = useNavigate();

	const signOut = async () => {
		await authClient.signOut();
		await router.invalidate();
		await navigate({ to: "/" });
	};

	return (
		<Show
			when={context().viewer}
			fallback={
				<Button as={Link} to="/sign-in" variant="pill" size="pill">
					Sign in
				</Button>
			}
		>
			{(viewer) => (
				<DropdownMenu>
					<DropdownMenuTrigger as={Button} variant="outline" size="pill">
						{displayName(viewer())}
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuLabel class="font-normal text-muted-foreground">
							{viewer().user.email}
						</DropdownMenuLabel>
						<DropdownMenuItem as={Link} to="/orgs">
							Organizations
						</DropdownMenuItem>
						<DropdownMenuItem as={Link} to="/account">
							Account
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={signOut}>Sign out</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</Show>
	);
}
