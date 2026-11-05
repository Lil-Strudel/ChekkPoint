import { createRouter as createTanStackRouter } from "@tanstack/solid-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,

		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadDelay: 150,
		defaultPreloadStaleTime: 30_000,
	});

	return router;
}

declare module "@tanstack/solid-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
