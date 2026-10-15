import { createFileRoute, redirect } from "@tanstack/solid-router";

export const Route = createFileRoute("/_authed")({
	beforeLoad: ({ context, location }) => {
		if (!context.viewer) {
			throw redirect({ to: "/sign-in", search: { redirect: location.href } });
		}
		return { viewer: context.viewer };
	},
});
