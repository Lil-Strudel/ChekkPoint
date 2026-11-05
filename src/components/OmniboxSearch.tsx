import { Link, useNavigate } from "@tanstack/solid-router";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { searchPublicOmnibox } from "~/public/public.functions";
import { formatDistanceMiles } from "~/public/public.shared";

type OmniboxResult = Awaited<ReturnType<typeof searchPublicOmnibox>>;

interface FlatOption {
	id: string;
	kind: "event" | "athlete" | "course" | "organizer";
	label: string;
	sublabel: string;
	href: string;
}

export default function OmniboxSearch(props: {
	initialQuery?: string;
	placeholder?: string;
}) {
	const navigate = useNavigate();
	const [query, setQuery] = createSignal(props.initialQuery ?? "");
	const [isOpen, setIsOpen] = createSignal(false);
	const [loading, setLoading] = createSignal(false);
	const [results, setResults] = createSignal<OmniboxResult | null>(null);
	const [activeIndex, setActiveIndex] = createSignal(-1);

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	const runSearch = async (q: string) => {
		setLoading(true);
		try {
			const data = await searchPublicOmnibox({ data: { query: q } });
			setResults(data);
		} catch {
			// Ignore transient network errors in typeahead
		} finally {
			setLoading(false);
		}
	};

	const triggerDebouncedSearch = (q: string) => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			void runSearch(q);
		}, 140);
	};

	onCleanup(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
	});

	const flatOptions = (): FlatOption[] => {
		const r = results();
		if (!r) return [];
		const list: FlatOption[] = [];

		for (const ev of r.events) {
			list.push({
				id: `event-${ev.id}`,
				kind: "event",
				label: ev.name,
				sublabel: ev.location,
				href: `/events/${ev.slug}`,
			});
		}

		for (const ath of r.athletes) {
			list.push({
				id: `athlete-${ath.id}`,
				kind: "athlete",
				label: ath.displayName,
				sublabel: ath.cityState,
				href: `/athletes/${ath.id}`,
			});
		}

		for (const c of r.courses) {
			list.push({
				id: `course-${c.id}`,
				kind: "course",
				label: c.name,
				sublabel: formatDistanceMiles(c.distanceMeters),
				href: `/courses/${c.id}`,
			});
		}

		for (const org of r.organizers) {
			list.push({
				id: `organizer-${org.id}`,
				kind: "organizer",
				label: org.name,
				sublabel: org.location,
				href: `/organizers/${org.slug}`,
			});
		}

		return list;
	};

	const handleFocus = () => {
		setIsOpen(true);
		if (!results()) {
			void runSearch(query());
		}
	};

	const handleInput = (val: string) => {
		setQuery(val);
		setIsOpen(true);
		setActiveIndex(-1);
		triggerDebouncedSearch(val);
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		const opts = flatOptions();
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setIsOpen(true);
			setActiveIndex((prev) =>
				opts.length > 0 ? (prev + 1) % opts.length : -1,
			);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setIsOpen(true);
			setActiveIndex((prev) =>
				opts.length > 0 ? (prev - 1 + opts.length) % opts.length : -1,
			);
		} else if (e.key === "Escape") {
			setIsOpen(false);
			setActiveIndex(-1);
		} else if (e.key === "Enter") {
			const idx = activeIndex();
			if (isOpen() && idx >= 0 && idx < opts.length) {
				e.preventDefault();
				const chosen = opts[idx];
				setIsOpen(false);
				void navigate({ to: chosen.href });
			}
		}
	};

	const handleSubmit = (e: SubmitEvent) => {
		e.preventDefault();
		setIsOpen(false);
		const q = query().trim();
		void navigate({
			to: "/events",
			search: q ? { q } : {},
		});
	};

	return (
		<div class="relative w-full max-w-xl">
			<form onSubmit={handleSubmit}>
				<div class="relative">
					<Input
						type="search"
						role="combobox"
						aria-label="Search events, athletes, courses, or organizers"
						aria-expanded={isOpen()}
						aria-controls="omnibox-results-listbox"
						aria-activedescendant={
							activeIndex() >= 0 ? flatOptions()[activeIndex()]?.id : undefined
						}
						value={query()}
						onFocus={handleFocus}
						onBlur={() => {
							setTimeout(() => setIsOpen(false), 180);
						}}
						onInput={(e) => handleInput(e.currentTarget.value)}
						onKeyDown={handleKeyDown}
						placeholder={
							props.placeholder ??
							"Search events, athletes, courses, or organizers…"
						}
						class="h-11 rounded-2xl bg-card pl-4 pr-10 text-base shadow-glass"
					/>
					<Show when={loading()}>
						<span class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
							…
						</span>
					</Show>
				</div>
			</form>

			<Show when={isOpen() && results()}>
				<Card
					id="omnibox-results-listbox"
					role="listbox"
					aria-label="Search suggestions"
					class="absolute left-0 right-0 top-13 z-50 max-h-[26rem] overflow-y-auto border-border bg-popover p-3 shadow-lg"
				>
					<Show
						when={flatOptions().length > 0}
						fallback={
							<div class="p-4 text-center text-sm text-muted-foreground">
								No matches found for "{query()}".
							</div>
						}
					>
						<div class="flex flex-col gap-3">
							<Show when={(results()?.events.length ?? 0) > 0}>
								<div>
									<p class="m-0 px-2 pb-1 text-xs font-bold uppercase tracking-widest text-forest">
										Events
									</p>
									<For each={results()?.events}>
										{(ev) => (
											<Link
												to="/events/$slug"
												params={{ slug: ev.slug }}
												role="option"
												id={`event-${ev.id}`}
												class="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-sm no-underline transition-colors hover:bg-accent"
											>
												<div class="min-w-0">
													<p class="m-0 truncate font-semibold text-foreground">
														{ev.name}
													</p>
													<p class="m-0 text-xs text-muted-foreground">
														{ev.location}
													</p>
												</div>
												<Show when={ev.temporalState === "live"}>
													<Badge variant="clay">Live</Badge>
												</Show>
											</Link>
										)}
									</For>
								</div>
							</Show>

							<Show when={(results()?.athletes.length ?? 0) > 0}>
								<div>
									<p class="m-0 px-2 pb-1 text-xs font-bold uppercase tracking-widest text-forest">
										Athletes
									</p>
									<For each={results()?.athletes}>
										{(ath) => (
											<Link
												to="/athletes/$personId"
												params={{ personId: ath.id }}
												role="option"
												id={`athlete-${ath.id}`}
												class="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-sm no-underline transition-colors hover:bg-accent"
											>
												<p class="m-0 truncate font-semibold text-foreground">
													{ath.displayName}
												</p>
												<span class="shrink-0 text-xs text-muted-foreground">
													{ath.cityState}
												</span>
											</Link>
										)}
									</For>
								</div>
							</Show>

							<Show when={(results()?.courses.length ?? 0) > 0}>
								<div>
									<p class="m-0 px-2 pb-1 text-xs font-bold uppercase tracking-widest text-forest">
										Courses
									</p>
									<For each={results()?.courses}>
										{(c) => (
											<Link
												to="/courses/$courseId"
												params={{ courseId: c.id }}
												role="option"
												id={`course-${c.id}`}
												class="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-sm no-underline transition-colors hover:bg-accent"
											>
												<p class="m-0 truncate font-semibold text-foreground">
													{c.name}
												</p>
												<span class="shrink-0 text-xs tabular-nums text-muted-foreground">
													{formatDistanceMiles(c.distanceMeters)}
												</span>
											</Link>
										)}
									</For>
								</div>
							</Show>

							<Show when={(results()?.organizers.length ?? 0) > 0}>
								<div>
									<p class="m-0 px-2 pb-1 text-xs font-bold uppercase tracking-widest text-forest">
										Organizers
									</p>
									<For each={results()?.organizers}>
										{(org) => (
											<Link
												to="/organizers/$slug"
												params={{ slug: org.slug }}
												role="option"
												id={`organizer-${org.id}`}
												class="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-sm no-underline transition-colors hover:bg-accent"
											>
												<p class="m-0 truncate font-semibold text-foreground">
													{org.name}
												</p>
												<span class="shrink-0 text-xs text-muted-foreground">
													{org.location}
												</span>
											</Link>
										)}
									</For>
								</div>
							</Show>
						</div>
					</Show>
				</Card>
			</Show>
		</div>
	);
}
