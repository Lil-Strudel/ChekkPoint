import {
	createFileRoute,
	Link,
	Outlet,
	useLocation,
	useRouter,
} from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { disciplineLabels } from "~/lib/events";
import { formatDay } from "~/orgs/format";
import { addSubEventFn, getWeekendHubOverview } from "~/race-control/race-control.functions";

export const Route = createFileRoute(
	"/_authed/orgs/$slug/event-groups/$eventGroupSlug",
)({
	loader: ({ params }) =>
		getWeekendHubOverview({
			data: { slug: params.slug, eventGroupSlug: params.eventGroupSlug },
		}),
	component: EventGroupWorkspaceLayout,
	notFoundComponent: EventGroupWorkspaceNotFound,
});

function EventGroupWorkspaceLayout() {
	const data = Route.useLoaderData();
	const params = Route.useParams();
	const router = useRouter();
	const location = useLocation();

	const group = () => data().eventGroup;
	const org = () => data().organization;
	const subEvents = () => data().subEvents;

	// Add Event modal dialog state
	const [addEventOpen, setAddEventOpen] = createSignal(false);
	const [eventName, setEventName] = createSignal("");
	const [selectedCourseId, setSelectedCourseId] = createSignal(
		data().organizationCourses[0]?.id ?? "",
	);
	const [scheduledStart, setScheduledStart] = createSignal(
		group().startDate.slice(0, 16),
	);
	const [lapsRequired, setLapsRequired] = createSignal(1);
	const [isSubmitting, setIsSubmitting] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	const handleAddEvent = async (e: Event) => {
		e.preventDefault();
		if (!eventName().trim() || !selectedCourseId()) {
			setError("Event name and course selection are required.");
			return;
		}

		setIsSubmitting(true);
		setError(null);
		try {
			await addSubEventFn({
				data: {
					eventGroupId: group().id,
					name: eventName().trim(),
					courseId: selectedCourseId(),
					lapsRequired: lapsRequired(),
					scheduledStart: scheduledStart(),
				},
			});
			setAddEventOpen(false);
			setEventName("");
			await router.invalidate();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to create event.");
		} finally {
			setIsSubmitting(false);
		}
	};

	// Determine if currently in weekend hub vs specific sub-event
	const isWeekendHub = () => {
		const path = location().pathname;
		return (
			path === `/orgs/${params().slug}/event-groups/${params().eventGroupSlug}` ||
			path === `/orgs/${params().slug}/event-groups/${params().eventGroupSlug}/` ||
			path.includes(`/orgs/${params().slug}/event-groups/${params().eventGroupSlug}/rules-staff`)
		);
	};

	return (
		<div class="flex flex-col min-h-full w-full bg-background text-foreground">
			{/* Event Group Context Header */}
			<div class="border-b border-border bg-card/25 px-6 pt-5 pb-4">
				<div class="flex flex-wrap items-center justify-between gap-3 mb-2">
					<div class="flex items-center gap-2 text-xs text-muted-foreground">
						<Link
							to="/orgs/$slug"
							params={{ slug: params().slug }}
							class="hover:text-foreground hover:underline font-medium"
						>
							{org().name}
						</Link>
						<span>/</span>
						<span class="text-foreground font-semibold">{group().name}</span>
					</div>

					<div class="flex items-center gap-2">
						<Badge variant="clay">{disciplineLabels[group().discipline]}</Badge>
						<span class="text-xs text-muted-foreground tabular-nums">
							{formatDay(new Date(group().startDate))}
							{group().location && ` · ${group().location}`}
							{` · ${group().timeZone}`}
						</span>
					</div>
				</div>

				<h1 class="text-2xl font-bold font-serif text-foreground tracking-tight">
					{group().name}
				</h1>
			</div>

			{/* Top Horizontal Sub-Event Bar */}
			<div
				aria-label="Sub-Event navigation"
				class="border-b border-border bg-card/60 px-6 py-2.5 flex items-center justify-between gap-4 overflow-x-auto select-none"
			>
				{/* Left Tabs: Weekend Hub + Specific Sub-Events + Add Event */}
				<div class="flex items-center gap-1.5 shrink-0">
					{/* [ All Events (Weekend Hub) ] */}
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
							isWeekendHub()
								? "bg-foreground text-background shadow-xs font-bold"
								: "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
						}`}
					>
						<span>🏠</span>
						<span>All Events (Weekend Hub)</span>
						<span class="ml-1 rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] tabular-nums font-mono">
							{data().combinedCustody.total}
						</span>
					</Link>

					<div class="h-4 w-px bg-border mx-1" />

					{/* Specific Sub-Events: [ 100M ] | [ 50K ] */}
					<For each={subEvents()}>
						{(sub) => (
							<Link
								to="/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId"
								params={{
									slug: params().slug,
									eventGroupSlug: params().eventGroupSlug,
									eventId: sub.id,
								}}
								class="px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
								activeProps={{
									class:
										"px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 bg-foreground text-background shadow-xs transition-colors cursor-pointer",
								}}
							>
								<span>{sub.name}</span>
								<span class="ml-1 rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] tabular-nums font-mono">
									{sub.custody.total}
								</span>
							</Link>
						)}
					</For>

					{/* [ + Add Event ] Button */}
					<Show when={data().access.orgRoles.length > 0}>
						<button
							type="button"
							onClick={() => setAddEventOpen(true)}
							class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-forest hover:bg-muted/60 inline-flex items-center gap-1 transition-colors cursor-pointer ml-1"
							title="Add Sub-Event Distance"
						>
							<span>+ Add Event</span>
						</button>
					</Show>
				</div>

				{/* Right Actions: View Public Page & Launch Field Logger */}
				<div class="flex items-center gap-3 shrink-0">
					<Link
						to="/events/$slug"
						params={{ slug: group().slug }}
						target="_blank"
						class="text-xs font-medium text-muted-foreground hover:text-forest inline-flex items-center gap-1 transition-colors"
						title="Open Public Spectator View"
					>
						<span>View Public Page</span>
						<span class="text-sm">↗</span>
					</Link>

					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/logger"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class={buttonVariants({
							variant: "forest",
							size: "sm",
							class: "gap-1.5 font-semibold text-xs",
						})}
					>
						<span>⏱️</span>
						<span>Launch Field Logger</span>
					</Link>
				</div>
			</div>

			{/* Add Sub-Event Dialog */}
			<Dialog open={addEventOpen()} onOpenChange={setAddEventOpen}>
				<DialogContent class="max-w-md">
					<DialogHeader>
						<DialogTitle>Add Sub-Event Distance</DialogTitle>
						<DialogDescription>
							Create a new distance or category within {group().name}.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleAddEvent} class="space-y-4 py-2">
						<Show when={error()}>
							<div class="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
								{error()}
							</div>
						</Show>

						<div class="space-y-1">
							<label class="text-xs font-semibold text-foreground">
								Sub-Event Name (e.g. "100 Mile Championship", "50K Open")
							</label>
							<Input
								value={eventName()}
								onInput={(e) => setEventName(e.currentTarget.value)}
								placeholder="e.g. 100 Mile Ultra"
								required
							/>
						</div>

						<div class="space-y-1">
							<label class="text-xs font-semibold text-foreground">Course</label>
							<select
								value={selectedCourseId()}
								onChange={(e) => setSelectedCourseId(e.currentTarget.value)}
								class="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
								required
							>
								<For each={data().organizationCourses}>
									{(c) => (
										<option value={c.id}>
											{c.name} ({(c.distanceMeters / 1000).toFixed(1)} km)
										</option>
									)}
								</For>
							</select>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1">
								<label class="text-xs font-semibold text-foreground">
									Scheduled Start Time
								</label>
								<Input
									type="datetime-local"
									value={scheduledStart()}
									onInput={(e) => setScheduledStart(e.currentTarget.value)}
									required
								/>
							</div>

							<div class="space-y-1">
								<label class="text-xs font-semibold text-foreground">
									Laps Required
								</label>
								<Input
									type="number"
									min="1"
									value={lapsRequired()}
									onInput={(e) => setLapsRequired(parseInt(e.currentTarget.value, 10) || 1)}
									required
								/>
							</div>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setAddEventOpen(false)}
								disabled={isSubmitting()}
							>
								Cancel
							</Button>
							<Button type="submit" variant="forest" disabled={isSubmitting()}>
								{isSubmitting() ? "Creating..." : "Create Sub-Event"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Child Workspace Outlet */}
			<div class="flex-1 w-full">
				<Outlet />
			</div>
		</div>
	);
}

function EventGroupWorkspaceNotFound() {
	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Race Control Workspace</p>
			<h1 class="page-title">Event Group Not Found</h1>
			<p class="page-sub">
				The event group you requested doesn't exist or you don't have access credentials.
			</p>
		</main>
	);
}
