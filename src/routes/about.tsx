import { createFileRoute } from "@tanstack/solid-router";
import { Card } from "../components/ui/card";

export const Route = createFileRoute("/about")({
	component: About,
});

function About() {
	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">About</p>
			<h1 class="page-title">A small starter with room to grow.</h1>
			<p class="page-sub">
				Type-safe routing, server functions and SSR defaults.
			</p>
			<Card class="p-6 sm:p-8">
				<p class="m-0 max-w-3xl text-base leading-8 text-muted-foreground">
					TanStack Start gives you type-safe routing, server functions, and
					modern SSR defaults. Use this as a clean foundation, then layer in
					your own routes, styling, and add-ons.
				</p>
			</Card>
		</main>
	);
}
