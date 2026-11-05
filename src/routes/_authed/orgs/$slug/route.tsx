import { createFileRoute, Link, Outlet } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { ORG_ROLE_LABELS } from "~/auth/access";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { getOrganization } from "~/orgs/orgs.functions";

export const Route = createFileRoute("/_authed/orgs/$slug")({
	loader: async ({ params }) => ({
		now: new Date(),
		...(await getOrganization({ data: { slug: params.slug } })),
	}),
	component: OrgLayout,
	notFoundComponent: OrgNotFound,
});

function orgInitials(name: string): string {
	const words = name.trim().split(/\s+/);
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return (words[0][0] + words[1][0]).toUpperCase();
}

function OrgLayout() {
	const data = Route.useLoaderData();
	const params = Route.useParams();
	const [collapsed, setCollapsed] = createSignal(false);
	const [expandedGroupIds, setExpandedGroupIds] = createSignal<
		Record<string, boolean>
	>({});

	const toggleGroupExpanded = (groupId: string) => {
		setExpandedGroupIds((prev) => ({
			...prev,
			[groupId]: !prev[groupId],
		}));
	};

	const org = () => data().organization;
	const isStaffOnly = () => data().isStaffOnly;

	// Event groups visible to the user:
	const displayGroups = () => {
		if (isStaffOnly()) {
			// Staff only see their assigned event groups
			const staffIds = new Set(data().staffEventGroups.map((s) => s.id));
			return data().eventGroups.filter((g) => staffIds.has(g.id));
		}
		return data().eventGroups;
	};

	const subEventsForGroup = (groupId: string) =>
		data().events.filter((e) => e.eventGroupId === groupId);

	return (
		<div class="flex min-h-[calc(100vh-4rem)] w-full bg-background text-foreground">
			{/* Collapsible Left Sidebar */}
			<aside
				aria-label="Organization sidebar"
				class={`shrink-0 border-r border-border bg-card/40 select-none flex flex-col transition-[width] duration-200 ${
					collapsed() ? "w-16" : "w-72"
				}`}
			>
				{/* Org Header / Switcher */}
				<div class="border-b border-border p-3 flex flex-col gap-2">
					<div class="flex items-center justify-between gap-2">
						<Link
							to="/orgs"
							class="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
							title="All Organizations"
						>
							<span>←</span>
							<Show when={!collapsed()}>
								<span>All Orgs</span>
							</Show>
						</Link>

						<button
							type="button"
							onClick={() => setCollapsed(!collapsed())}
							class="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
							title={collapsed() ? "Expand sidebar" : "Collapse sidebar"}
							aria-label={collapsed() ? "Expand sidebar" : "Collapse sidebar"}
						>
							{collapsed() ? "▶" : "◀"}
						</button>
					</div>

					<div class="flex items-center gap-3">
						<Show
							when={org().logo}
							fallback={
								<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-forest text-xs font-semibold text-paper shadow-xs">
									{orgInitials(org().name)}
								</div>
							}
						>
							<img
								src={org().logo!}
								alt={org().name}
								class="h-9 w-9 shrink-0 rounded-md object-cover border border-border"
							/>
						</Show>

						<Show when={!collapsed()}>
							<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
								<span
									class="truncate font-serif text-base font-semibold leading-tight text-foreground"
									title={org().name}
								>
									{org().name}
								</span>
								<div class="flex items-center gap-1.5 pt-0.5">
									<Show
										when={!isStaffOnly()}
										fallback={
											<Badge variant="sage" class="text-[10px] py-0 px-1.5">
												Event Staff
											</Badge>
										}
									>
										<For each={data().myRoles}>
											{(role) => (
												<Badge
													variant="forest"
													class="text-[10px] py-0 px-1.5"
												>
													{ORG_ROLE_LABELS[role]}
												</Badge>
											)}
										</For>
									</Show>
								</div>
							</div>
						</Show>
					</div>

					<Show when={!collapsed()}>
						<div class="pt-1 flex items-center gap-2">
							<Link
								to="/organizers/$slug"
								params={{ slug: params().slug }}
								target="_blank"
								class="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
							>
								<span>Public Storefront</span>
								<span>↗</span>
							</Link>
						</div>
					</Show>
				</div>

				{/* Sidebar Navigation */}
				<nav class="flex-1 overflow-y-auto p-2 space-y-4">
					{/* Primary Org Workspace Links */}
					<div class="space-y-1">
						<Link
							to="/orgs/$slug"
							params={{ slug: params().slug }}
							activeOptions={{ exact: true }}
							class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
							activeProps={{
								class:
									"flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-semibold bg-muted text-foreground",
							}}
							title="Overview"
						>
							<span class="text-sm">🏠</span>
							<Show when={!collapsed()}>
								<span>Overview</span>
							</Show>
						</Link>

						<Show when={!isStaffOnly()}>
							<Link
								to="/orgs/$slug/courses"
								params={{ slug: params().slug }}
								class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
								activeProps={{
									class:
										"flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-semibold bg-muted text-foreground",
								}}
								title="Courses Library"
							>
								<span class="text-sm">🗺️</span>
								<Show when={!collapsed()}>
									<span>Courses</span>
								</Show>
							</Link>

							<Link
								to="/orgs/$slug/timing-points"
								params={{ slug: params().slug }}
								class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
								activeProps={{
									class:
										"flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-semibold bg-muted text-foreground",
								}}
								title="Timing Points"
							>
								<span class="text-sm">⏱️</span>
								<Show when={!collapsed()}>
									<span>Timing Points</span>
								</Show>
							</Link>

							<Link
								to="/orgs/$slug/members"
								params={{ slug: params().slug }}
								class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
								activeProps={{
									class:
										"flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-semibold bg-muted text-foreground",
								}}
								title="Team Members"
							>
								<span class="text-sm">👥</span>
								<Show when={!collapsed()}>
									<span>Members</span>
								</Show>
							</Link>

							<Link
								to="/orgs/$slug/settings"
								params={{ slug: params().slug }}
								class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
								activeProps={{
									class:
										"flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-semibold bg-muted text-foreground",
								}}
								title="Organization Settings"
							>
								<span class="text-sm">⚙️</span>
								<Show when={!collapsed()}>
									<span>Settings</span>
								</Show>
							</Link>
						</Show>
					</div>

					{/* Nested Event Groups Tree */}
					<div class="pt-2 border-t border-border/60">
						<div class="px-2 pb-1.5 flex items-center justify-between">
							<Show
								when={!collapsed()}
								fallback={
									<span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mx-auto">
										EG
									</span>
								}
							>
								<Link
									to="/orgs/$slug/event-groups"
									params={{ slug: params().slug }}
									class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
								>
									Event Groups
								</Link>
								<Show when={data().can.createEventGroup}>
									<Link
										to="/orgs/$slug/event-groups"
										params={{ slug: params().slug }}
										class="text-xs text-primary hover:underline font-semibold"
										title="New Event Group"
									>
										+ New
									</Link>
								</Show>
							</Show>
						</div>

						<div class="space-y-1">
							<For each={displayGroups()}>
								{(group) => {
									const isExpanded = () =>
										Boolean(expandedGroupIds()[group.id]);
									const subs = () => subEventsForGroup(group.id);

									return (
										<div class="flex flex-col">
											<div class="flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted/40 transition-colors text-xs">
												<button
													type="button"
													onClick={() => toggleGroupExpanded(group.id)}
													class="p-1 text-muted-foreground hover:text-foreground text-[10px]"
													aria-label={
														isExpanded()
															? `Collapse ${group.name}`
															: `Expand ${group.name}`
													}
												>
													{isExpanded() ? "▼" : "▶"}
												</button>

												<Link
													to="/event-groups/$eventGroupId"
													params={{ eventGroupId: group.id }}
													class="truncate font-medium text-foreground hover:underline flex-1"
													title={group.name}
												>
													<Show
														when={!collapsed()}
														fallback={group.name.slice(0, 3)}
													>
														{group.name}
													</Show>
												</Link>
											</div>

											{/* Expanded Sub-Events */}
											<Show when={isExpanded() && !collapsed()}>
												<div class="ml-4 pl-2 border-l border-border/60 space-y-0.5 py-1">
													<For each={subs()}>
														{(event) => (
															<div class="flex items-center justify-between text-[11px] py-0.5 px-1 rounded hover:bg-muted/30">
																<Link
																	to="/event-groups/$eventGroupId"
																	params={{ eventGroupId: group.id }}
																	class="truncate text-muted-foreground hover:text-foreground"
																	title={event.name}
																>
																	• {event.name}
																</Link>
															</div>
														)}
													</For>

													<Show when={subs().length === 0}>
														<span class="text-[10px] text-muted-foreground/60 italic px-1">
															No sub-events yet
														</span>
													</Show>

													<div class="pt-1">
														<Link
															to="/event-groups/$eventGroupId"
															params={{ eventGroupId: group.id }}
															class="text-[10px] font-semibold text-primary hover:underline px-1 block"
														>
															Open Workspace →
														</Link>
													</div>
												</div>
											</Show>
										</div>
									);
								}}
							</For>

							<Show when={displayGroups().length === 0}>
								<div class="px-2 py-2 text-center text-xs text-muted-foreground italic">
									<Show when={!collapsed()}>No event groups</Show>
								</div>
							</Show>
						</div>
					</div>
				</nav>
			</aside>

			{/* Main Content Workspace */}
			<main class="flex-1 min-w-0 p-6 md:p-8 lg:p-10 overflow-y-auto">
				<Outlet />
			</main>
		</div>
	);
}

function OrgNotFound() {
	const params = Route.useParams();

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Organization</p>
			<h1 class="page-title">Nothing here</h1>
			<p class="page-sub">
				There's no organization at /orgs/{params().slug}, or you're not a member
				or assigned staff of it.
			</p>
			<Link to="/orgs" class={buttonVariants({ variant: "outline" })}>
				Your organizations
			</Link>
		</main>
	);
}
