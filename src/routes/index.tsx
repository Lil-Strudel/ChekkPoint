import { createFileRoute, Link } from "@tanstack/solid-router";
import { Card } from "../components/ui/card";

export const Route = createFileRoute("/")({ component: App });

const features = [
	["Type-Safe Routing", "Routes and links stay in sync across every page."],
	[
		"Server Functions",
		"Call server code from your UI without creating API boilerplate.",
	],
	[
		"Streaming by Default",
		"Ship progressively rendered responses for faster experiences.",
	],
	[
		"Tailwind Native",
		"Design quickly with utility-first styling and reusable tokens.",
	],
];

const marks = [
	<svg viewBox="0 0 24 24" class="size-4" aria-hidden="true">
		<path
			d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10Z"
			fill="var(--forest)"
		/>
		<circle cx="12" cy="11" r="2" fill="var(--paper)" />
	</svg>,
	<svg viewBox="0 0 24 24" class="size-4" aria-hidden="true">
		<path d="M1 19 9 5l5 8 3-4 6 10Z" fill="var(--forest)" opacity="0.85" />
	</svg>,
	<svg viewBox="0 0 24 24" class="size-4" aria-hidden="true">
		<path d="M1 19 9 5l5 8 3-4 6 10Z" fill="var(--clay)" opacity="0.85" />
	</svg>,
	<svg viewBox="0 0 24 24" class="size-4" aria-hidden="true">
		<circle cx="12" cy="12" r="9" fill="var(--clay)" opacity="0.8" />
	</svg>,
];

function App() {
	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">TanStack Start Base Template</p>
			<h1 class="page-title">Start simple, ship quickly.</h1>
			<p class="page-sub">
				This base starter intentionally keeps things light: two routes, clean
				structure, and the essentials you need to build from scratch.
			</p>

			<div class="grid gap-6 lg:grid-cols-[1fr_280px]">
				<div class="flex flex-col gap-6">
					<Card class="p-6">
						<div class="mb-5 flex items-baseline justify-between">
							<h2 class="font-display m-0 text-2xl font-normal text-foreground">
								Features
							</h2>
							<span class="font-display text-lg text-forest">4 included</span>
						</div>
						<ul class="m-0 list-none p-0 divide-y divide-border/60">
							{features.map(([title, desc], i) => (
								<li class="flex items-center gap-3 py-2.5">
									<span class="flex w-5 justify-center">{marks[i]}</span>
									<span class="text-sm font-medium text-foreground">
										{title}
									</span>
									<span class="text-xs text-muted-foreground ml-auto text-right">
										{desc}
									</span>
								</li>
							))}
						</ul>
					</Card>

					<Card class="p-6">
						<div class="mb-5 flex items-baseline justify-between">
							<h2 class="font-display m-0 text-2xl font-normal text-foreground">
								Quick Start
							</h2>
							<span class="page-label text-xs">3 steps</span>
						</div>
						<ul class="m-0 list-none p-0 divide-y divide-border/60">
							<li class="flex items-center gap-3 py-2.5 text-sm">
								<span class="text-xs text-muted-foreground w-5 text-center">
									1
								</span>
								<span class="text-foreground">
									Edit <code>src/routes/index.tsx</code> to customize the home
									page.
								</span>
							</li>
							<li class="flex items-center gap-3 py-2.5 text-sm">
								<span class="text-xs text-muted-foreground w-5 text-center">
									2
								</span>
								<span class="text-foreground">
									Update <code>src/components/Header.tsx</code> for navigation
									and product links.
								</span>
							</li>
							<li class="flex items-center gap-3 py-2.5 text-sm">
								<span class="text-xs text-muted-foreground w-5 text-center">
									3
								</span>
								<span class="text-foreground">
									Add routes in <code>src/routes</code> and tweak visual tokens
									in <code>src/styles.css</code>.
								</span>
							</li>
						</ul>
					</Card>
				</div>

				<div class="flex flex-col gap-6">
					<Card class="p-5">
						<h3 class="font-display m-0 text-xl font-normal text-foreground">
							Routes
						</h3>
						<p class="font-display m-0 mt-1 text-5xl leading-none text-foreground">
							2
						</p>
						<p class="text-xs text-muted-foreground m-0 mt-1">
							Home &amp; About
						</p>
					</Card>
					<Card class="p-5">
						<h3 class="font-display m-0 text-xl font-normal text-foreground">
							Get Going
						</h3>
						<div class="mt-2 flex flex-col divide-y divide-border/60">
							<Link
								to="/about"
								class="py-2.5 text-sm text-forest-deep hover:underline"
							>
								About This Starter
							</Link>
							<a
								href="https://tanstack.com/router"
								target="_blank"
								rel="noopener noreferrer"
								class="py-2.5 text-sm text-forest-deep hover:underline"
							>
								Router Guide
							</a>
						</div>
					</Card>
				</div>
			</div>
		</main>
	);
}
