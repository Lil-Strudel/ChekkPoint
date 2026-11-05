import { Link } from "@tanstack/solid-router";
import { Separator } from "~/components/ui/separator";

export default function Footer() {
	return (
		<footer class="mt-16 border-t border-border bg-card">
			<div class="page-wrap py-14">
				<div class="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
					<div class="flex flex-col gap-3">
						<Link to="/" class="brand-pill w-fit">
							<svg class="brand-mark" viewBox="0 0 38 30" aria-hidden="true">
								<path
									d="M0 30 L13 6 L21 20 L26 12 L38 30 Z"
									fill="currentColor"
								/>
								<circle cx="22" cy="4" r="3" fill="var(--clay)" />
							</svg>
							ChekkPoint
						</Link>
						<p class="m-0 text-sm leading-relaxed text-muted-foreground">
							Every checkpoint, accounted for. Offline-first endurance race
							timing, immutable split ledgers, and lifetime athlete results.
						</p>
					</div>

					<div>
						<p class="m-0 mb-3 text-xs font-bold uppercase tracking-widest text-forest">
							Discover
						</p>
						<ul class="m-0 flex list-none flex-col gap-2 p-0 text-sm">
							<li>
								<Link
									to="/events"
									class="text-muted-foreground hover:text-foreground no-underline"
								>
									Events &amp; Results Hub
								</Link>
							</li>
							<li>
								<Link
									to="/athletes"
									class="text-muted-foreground hover:text-foreground no-underline"
								>
									Athlete Directory
								</Link>
							</li>
							<li>
								<Link
									to="/events/$slug"
									params={{ slug: "bonneville-ridge-100" }}
									class="text-muted-foreground hover:text-foreground no-underline"
								>
									Bonneville Ridge 100 (Live)
								</Link>
							</li>
							<li>
								<Link
									to="/courses/$courseId"
									params={{
										courseId: "30000000-0000-4000-8000-000000000001",
									}}
									class="text-muted-foreground hover:text-foreground no-underline"
								>
									Course Pace Calculator
								</Link>
							</li>
						</ul>
					</div>

					<div>
						<p class="m-0 mb-3 text-xs font-bold uppercase tracking-widest text-forest">
							Platform Guides
						</p>
						<ul class="m-0 flex list-none flex-col gap-2 p-0 text-sm">
							<li>
								<Link
									to="/for-organizers"
									class="text-muted-foreground hover:text-foreground no-underline"
								>
									For Race Organizers
								</Link>
							</li>
							<li>
								<Link
									to="/for-volunteers"
									class="text-muted-foreground hover:text-foreground no-underline"
								>
									For Field Volunteers
								</Link>
							</li>
							<li>
								<Link
									to="/for-athletes"
									class="text-muted-foreground hover:text-foreground no-underline"
								>
									For Athletes &amp; Crews
								</Link>
							</li>
							<li>
								<Link
									to="/about"
									class="text-muted-foreground hover:text-foreground no-underline"
								>
									About &amp; Heritage
								</Link>
							</li>
						</ul>
					</div>

					<div>
						<p class="m-0 mb-3 text-xs font-bold uppercase tracking-widest text-forest">
							Operations
						</p>
						<ul class="m-0 flex list-none flex-col gap-2 p-0 text-sm">
							<li>
								<Link
									to="/orgs"
									class="text-muted-foreground hover:text-foreground no-underline"
								>
									Organizer Workspace
								</Link>
							</li>
							<li>
								<Link
									to="/sign-in"
									class="text-muted-foreground hover:text-foreground no-underline"
								>
									Sign In / Claim Profile
								</Link>
							</li>
							<li>
								<Link
									to="/manage-db"
									class="text-muted-foreground hover:text-foreground no-underline"
								>
									Database Inspector
								</Link>
							</li>
						</ul>
					</div>
				</div>

				<Separator class="my-8" />

				<div class="flex flex-col items-start justify-between gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center">
					<p class="m-0">
						Built on the heritage of OpenSplitTime &amp; TRacer. Paper &amp;
						Topo design system.
					</p>
					<p class="m-0 tabular-nums">
						7 Disciplines · Offline Checkpoint Sync · CQRS Split Ledger
					</p>
				</div>
			</div>
		</footer>
	);
}
