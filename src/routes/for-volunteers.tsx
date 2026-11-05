import { createFileRoute, Link } from "@tanstack/solid-router";
import { For } from "solid-js";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

export const Route = createFileRoute("/for-volunteers")({
	component: ForVolunteersPage,
});

const volunteerFeatures = [
	{
		badge: "60fps Keypad",
		title: "Glove-Friendly Tactile Entry",
		description:
			"Designed for cold 2:00 AM aid station tents. Large high-contrast targets, zero modal popups, and instant local confirmation.",
	},
	{
		badge: "Decoupled FIFO Chute",
		title: "Tap Timestamp First, Enter Bibs Second",
		description:
			"When a pack of eight runners sprints through the chute together, tap the timestamp button for each finisher in real time, then backfill their bib numbers in order.",
	},
	{
		badge: "Typo Defense",
		title: "Damerau-Levenshtein Anomaly Guard",
		description:
			"ChekkPoint cross-checks every entered bib against runners expected from the upstream station. Transposing #124 into #142 triggers an immediate non-blocking warning.",
	},
	{
		badge: "Offline-First Sync",
		title: "OPFS & IndexedDB Local Persistence",
		description:
			"Every punch is committed locally on the device first. When Starlink, cell, or mesh Wi-Fi returns, batches sync automatically with full provenance.",
	},
	{
		badge: "Custody Clarity",
		title: "DNF (In Station) vs. ROC (Out on Course)",
		description:
			"Clear distinction between a runner who handed in their bib safely at your tent (DNF) versus a runner reported withdrawn between checkpoints (ROC — Search & Rescue alert).",
	},
	{
		badge: "Ham Radio Bridge",
		title: "Acoustic MT63 VHF/UHF Packet Ready",
		description:
			"When a canyon station has zero internet, export compressed split batches over acoustic MT63 ham radio audio straight into net control.",
	},
] as const;

function ForVolunteersPage() {
	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">
				For Aid Station Volunteers, Captains &amp; Radio Operators
			</p>
			<h1 class="page-title">
				Built for cold hands, dark tents, and zero bars of signal.
			</h1>
			<p class="page-sub">
				Field volunteers are the backbone of every endurance event. ChekkPoint
				never blocks a timestamp on network latency or forces you to guess which
				race distance a passing bib belongs to.
			</p>

			<div class="mb-14 flex flex-wrap gap-3">
				<Link to="/sign-in" class={buttonVariants({ size: "lg" })}>
					Volunteer Sign In
				</Link>
				<Link
					to="/events"
					class={buttonVariants({ variant: "outline", size: "lg" })}
				>
					Find Your Assigned Event
				</Link>
			</div>

			<Alert variant="info" class="mb-14">
				<AlertTitle>Pre-Rostered by Your Race Director?</AlertTitle>
				<AlertDescription>
					Race directors assign checkpoint volunteers and captains by email
					ahead of race weekend. Once you sign in with that same email address,
					your assigned timing point and live entry permissions unlock
					automatically.
				</AlertDescription>
			</Alert>

			<section class="mb-16">
				<p class="page-label mb-1">Field-Proven Ergonomics</p>
				<h2 class="font-display text-scrim m-0 mb-5 text-3xl font-normal text-foreground">
					How Checkpoint Capture Works
				</h2>
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					<For each={volunteerFeatures}>
						{(feat) => (
							<Card class="flex flex-col gap-3 p-6">
								<Badge variant="forest">{feat.badge}</Badge>
								<h3 class="font-display m-0 text-2xl font-normal text-foreground">
									{feat.title}
								</h3>
								<p class="m-0 text-sm leading-relaxed text-muted-foreground">
									{feat.description}
								</p>
							</Card>
						)}
					</For>
				</div>
			</section>
		</main>
	);
}
