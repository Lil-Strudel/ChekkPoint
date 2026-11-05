import { createFileRoute, Link } from "@tanstack/solid-router";
import { For } from "solid-js";
import { Badge } from "../components/ui/badge";
import { buttonVariants } from "../components/ui/button";
import { Card } from "../components/ui/card";

export const Route = createFileRoute("/about")({
	component: About,
});

const heritageItems = [
	{
		badge: "OpenSplitTime Heritage",
		title: "Multi-Split Dwell & Time Allowance Rigor",
		description:
			"Inspired by OpenSplitTime's gold-standard endurance data model: separating physical TimingPoints from logical CourseSplits, tracking IN/OUT aid station dwell times, and deducting official medical/weather TimeAllowances.",
	},
	{
		badge: "TRacer Field Lineage",
		title: "Zero-Signal Backcountry Capture & Radio Sync",
		description:
			"Rooted in TRacer's amateur radio checkpoint operations: decoupled FIFO chute entry, Damerau-Levenshtein bib typo defense, local IndexedDB/OPFS persistence, and acoustic MT63 VHF/UHF packet transmission.",
	},
	{
		badge: "Paper & Topo Aesthetic",
		title: "Calm Cartographic Clarity Under Pressure",
		description:
			"Designed like a printed USGS trail map rather than a noisy telemetry cockpit—warm paper surfaces, fine contour lines, EB Garamond serif numerals, and strict tabular alignment.",
	},
] as const;

function About() {
	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">About ChekkPoint</p>
			<h1 class="page-title">Every checkpoint, accounted for.</h1>
			<p class="page-sub">
				ChekkPoint is an open, offline-first endurance race timing and athlete
				intelligence platform built for mountain ultras, backyard loops, gravity
				MTB, and regularity rallies.
			</p>

			<section class="mb-16 grid grid-cols-1 gap-6 md:grid-cols-3">
				<For each={heritageItems}>
					{(item) => (
						<Card class="flex flex-col gap-3 p-6">
							<Badge variant="forest">{item.badge}</Badge>
							<h2 class="font-display m-0 text-2xl font-normal text-foreground">
								{item.title}
							</h2>
							<p class="m-0 text-sm leading-relaxed text-muted-foreground">
								{item.description}
							</p>
						</Card>
					)}
				</For>
			</section>

			<Card class="p-6 sm:p-8">
				<div class="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
					<div class="max-w-2xl">
						<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
							Explore the Platform
						</p>
						<h2 class="font-display m-0 mt-2 text-3xl font-normal text-foreground">
							Built for every role on the mountain.
						</h2>
						<p class="m-0 mt-2 text-sm leading-relaxed text-muted-foreground">
							Whether you are directing a 100-mile mountain ultra, logging bibs
							at a windy ridge tent, or pacing a runner through the night,
							explore our dedicated guides and live directories.
						</p>
					</div>

					<div class="flex flex-wrap gap-2.5">
						<Link to="/for-organizers" class={buttonVariants({ size: "sm" })}>
							For Organizers
						</Link>
						<Link
							to="/for-volunteers"
							class={buttonVariants({ variant: "outline", size: "sm" })}
						>
							For Volunteers
						</Link>
						<Link
							to="/for-athletes"
							class={buttonVariants({ variant: "outline", size: "sm" })}
						>
							For Athletes &amp; Crews
						</Link>
						<Link
							to="/events"
							class={buttonVariants({ variant: "secondary", size: "sm" })}
						>
							Events Directory
						</Link>
					</div>
				</div>
			</Card>
		</main>
	);
}
