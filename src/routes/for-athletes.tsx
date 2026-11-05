import { createFileRoute, Link } from "@tanstack/solid-router";
import { For } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

export const Route = createFileRoute("/for-athletes")({
	component: ForAthletesPage,
});

const athleteFeatures = [
	{
		badge: "Course Effort Planner",
		title: 'Interactive "Plan My Effort" Pace Calculator',
		description:
			"Select any published course on ChekkPoint, enter your target finish time and start hour, and compare Even, Conservative, and Mountain-Fade pacing curves with exact cutoff buffers and headlamp night windows.",
		ctaText: "Try Pace Calculator",
		ctaHref: "/courses/30000000-0000-4000-8000-000000000001",
	},
	{
		badge: "Unified Athlete Identity",
		title: "Cross-Platform Lifetime Dossier",
		description:
			"Your ChekkPoint athlete profile unifies official checkpoint splits with verified historical results from UltraSignup, ITRA, Strava, and DUV—complete with experience tier badges and finish rate analytics.",
		ctaText: "Browse Athlete Directory",
		ctaHref: "/athletes",
	},
	{
		badge: "Support Crew Logistics",
		title: "Live Crew Access Gating Boards",
		description:
			"Support crews and pacers know the exact moment they are permitted to enter restricted aid station lots based on upstream checkpoint clearance.",
		ctaText: "View Live Crew Board",
		ctaHref: "/events/bonneville-ridge-100/crew",
	},
	{
		badge: "Verified Email Claiming",
		title: "One-Click Profile Ownership",
		description:
			"Sign in with the email address you used to register for a race or volunteer shift and automatically claim your lifetime athlete dossier.",
		ctaText: "Claim Your Profile",
		ctaHref: "/sign-in",
	},
] as const;

function ForAthletesPage() {
	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">
				For Endurance Athletes, Pacers &amp; Support Crews
			</p>
			<h1 class="page-title">
				Plan every split. Crew every station. Own your lifetime results.
			</h1>
			<p class="page-sub">
				From pre-race cutoff modeling to post-race split analysis and lifetime
				ultra resumes, ChekkPoint gives athletes and support crews complete
				visibility into every mile.
			</p>

			<div class="mb-16 flex flex-wrap gap-3">
				<Link to="/athletes" class={buttonVariants({ size: "lg" })}>
					Find Your Athlete Profile
				</Link>
				<Link
					to="/courses/$courseId"
					params={{ courseId: "30000000-0000-4000-8000-000000000001" }}
					class={buttonVariants({ variant: "outline", size: "lg" })}
				>
					Open Course Pace Calculator
				</Link>
				<Link
					to="/events"
					class={buttonVariants({ variant: "ghost", size: "lg" })}
				>
					Browse Events &rarr;
				</Link>
			</div>

			<section class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<For each={athleteFeatures}>
					{(item) => (
						<Card class="flex flex-col justify-between gap-5 p-6">
							<div>
								<Badge variant="forest">{item.badge}</Badge>
								<h2 class="font-display m-0 mt-3 text-2xl font-normal text-foreground">
									{item.title}
								</h2>
								<p class="m-0 mt-2 text-sm leading-relaxed text-muted-foreground">
									{item.description}
								</p>
							</div>
							<div>
								<a
									href={item.ctaHref}
									class={buttonVariants({ variant: "outline", size: "sm" })}
								>
									{item.ctaText} &rarr;
								</a>
							</div>
						</Card>
					)}
				</For>
			</section>
		</main>
	);
}
