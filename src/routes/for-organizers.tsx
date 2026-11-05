import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, For } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
	DISCIPLINE_META,
	PUBLIC_DISCIPLINES,
	type PublicDiscipline,
} from "~/public/public.shared";

export const Route = createFileRoute("/for-organizers")({
	component: ForOrganizersPage,
});

const participantModels = [
	{
		badge: "solo_competitor",
		title: "Solo Competitor",
		description:
			"Foot ultras, marathons, solo gravel, and downhill MTB runs with pacer registration, gear checks, and normalized 1:1 emergency contact links.",
	},
	{
		badge: "vehicle_crew",
		title: "Vehicle & Co-Driver Crew",
		description:
			"TSD regularity rallies and two-person adventure stages tracking driver/navigator licenses, vehicle class, and 2x early-arrival penalty factors.",
	},
	{
		badge: "relay_team",
		title: "Multi-Leg Relay Squad",
		description:
			"Ekiden and 24-hour loop relays tracking team captain contact, ordered leg handoffs, and per-runner split attribution.",
	},
] as const;

const architecturePillars = [
	{
		label: "CQRS Timing Architecture",
		title: "Immutable Raw Ledger + Deterministic Rebuild",
		description:
			"Every chip read, manual keypad tap, and ham radio packet lands in an append-only raw_timing_events ledger. Scored standings (scored_split_times) can be rebuilt cleanly at any moment after time allowances or steward corrections.",
	},
	{
		label: "Search & Rescue Intelligence",
		title: "Two-Stage SAR Triage & Historical Projections",
		description:
			"Pre-race historical scraping across UltraSignup, ITRA, and DUV computes expected arrival windows for every bib. Overdue runners trigger Stage 1 pace alerts before escalating to Stage 2 cutoff & custody verification.",
	},
	{
		label: "Permit & Traffic Protection",
		title: "Automated Crew Access Gating Boards",
		description:
			"Prevent aid station parking gridlock. Support crews see real-time clearance status gated on their runner's verified departure from the upstream checkpoint.",
	},
	{
		label: "Shared Infrastructure",
		title: "EventGroup Multi-Distance Operations",
		description:
			"Run 100M, 50M, and 50K distances simultaneously over shared physical timing points. Volunteers enter passing bibs once without guessing which sub-event a runner belongs to.",
	},
] as const;

function ForOrganizersPage() {
	const [activeDiscipline, setActiveDiscipline] =
		createSignal<PublicDiscipline>("trail_ultra");

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">For Race Directors &amp; Timing Stewards</p>
			<h1 class="page-title">
				Mission-critical timing for backcountry endurance events.
			</h1>
			<p class="page-sub">
				ChekkPoint combines an immutable CQRS timing ledger, multi-discipline
				scoring rules, and automated athlete safety triage in a calm interface
				your volunteers can learn in two minutes.
			</p>

			<div class="mb-16 flex flex-wrap gap-3">
				<Link to="/sign-up" class={buttonVariants({ size: "lg" })}>
					Create Organizer Account
				</Link>
				<Link
					to="/orgs"
					class={buttonVariants({ variant: "outline", size: "lg" })}
				>
					Open Organizer Workspace
				</Link>
				<Link
					to="/events/$slug"
					params={{ slug: "bonneville-ridge-100" }}
					class={buttonVariants({ variant: "ghost", size: "lg" })}
				>
					Inspect Live Demo Race &rarr;
				</Link>
			</div>

			{/* 7 Supported Disciplines via solid-ui Tabs */}
			<section class="mb-20">
				<p class="page-label mb-1">Unified Rules Engine</p>
				<h2 class="font-display text-scrim m-0 mb-5 text-3xl font-normal text-foreground">
					Seven Endurance Disciplines, One Schema
				</h2>

				<Tabs
					value={activeDiscipline()}
					onChange={(v) => setActiveDiscipline(v as PublicDiscipline)}
				>
					<TabsList class="mb-6 flex h-auto w-full flex-wrap justify-start gap-1.5 p-1.5">
						<For each={PUBLIC_DISCIPLINES}>
							{(disc) => (
								<TabsTrigger value={disc} class="flex-none px-3.5 py-1.5">
									{DISCIPLINE_META[disc].label}
								</TabsTrigger>
							)}
						</For>
					</TabsList>

					<For each={PUBLIC_DISCIPLINES}>
						{(disc) => {
							const meta = DISCIPLINE_META[disc];
							return (
								<TabsContent value={disc}>
									<Card class="p-6 sm:p-8">
										<div class="flex flex-wrap items-center gap-2.5">
											<Badge variant={meta.badgeVariant}>{meta.label}</Badge>
											<Badge variant="chip">
												Identifier: {meta.competitorLabel}
											</Badge>
										</div>
										<h3 class="font-display m-0 mt-3 text-2xl font-normal text-foreground sm:text-3xl">
											{meta.summary}
										</h3>
										<p class="m-0 mt-3 text-sm leading-relaxed text-muted-foreground">
											<strong class="text-foreground">
												Scoring &amp; Enforcement:{" "}
											</strong>
											{meta.scoringSummary}
										</p>
									</Card>
								</TabsContent>
							);
						}}
					</For>
				</Tabs>
			</section>

			{/* 4 Architectural Pillars */}
			<section class="mb-20">
				<p class="page-label mb-1">Operational Integrity</p>
				<h2 class="font-display text-scrim m-0 mb-5 text-3xl font-normal text-foreground">
					Engineered for Zero-Signal Mountain Checkpoints
				</h2>
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
					<For each={architecturePillars}>
						{(pillar) => (
							<Card class="flex flex-col gap-3 p-6">
								<p class="m-0 text-xs font-bold uppercase tracking-widest text-forest">
									{pillar.label}
								</p>
								<h3 class="font-display m-0 text-2xl font-normal text-foreground">
									{pillar.title}
								</h3>
								<p class="m-0 text-sm leading-relaxed text-muted-foreground">
									{pillar.description}
								</p>
							</Card>
						)}
					</For>
				</div>
			</section>

			{/* 3 Participant Models */}
			<section class="mb-16">
				<p class="page-label mb-1">Polymorphic Entrant Schema</p>
				<h2 class="font-display text-scrim m-0 mb-5 text-3xl font-normal text-foreground">
					Three Native Participant Models
				</h2>
				<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
					<For each={participantModels}>
						{(model) => (
							<Card class="flex flex-col gap-3 p-6">
								<code>{model.badge}</code>
								<h3 class="font-display m-0 text-2xl font-normal text-foreground">
									{model.title}
								</h3>
								<p class="m-0 text-sm leading-relaxed text-muted-foreground">
									{model.description}
								</p>
							</Card>
						)}
					</For>
				</div>
			</section>
		</main>
	);
}
