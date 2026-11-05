import { Link, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
	Progress,
	ProgressLabel,
	ProgressValueLabel,
} from "~/components/ui/progress";
import { formatRaceClock } from "~/lib/events";
import type { getPublicHomeData } from "~/public/public.functions";
import { DISCIPLINE_META } from "~/public/public.shared";

export type EnrichedPublicEventGroup = Awaited<
	ReturnType<typeof getPublicHomeData>
>["liveGroups"][number];

export default function LiveEventCard(props: {
	group: EnrichedPublicEventGroup;
	now: Date;
}) {
	const navigate = useNavigate();
	const [lookupBib, setLookupBib] = createSignal("");

	const elapsedHours = () => {
		const startMs = new Date(props.group.startDate).getTime();
		return Math.max(0, (props.now.getTime() - startMs) / 3_600_000);
	};

	const discMeta = () => DISCIPLINE_META[props.group.discipline];

	const handleBibLookup = (e: Event) => {
		e.preventDefault();
		const b = lookupBib().trim();
		if (!b) return;
		navigate({
			to: "/events/$slug/results",
			params: { slug: props.group.slug },
		});
	};

	return (
		<Card class="flex flex-col gap-5 border-clay/40 p-6">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<span class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-clay">
					<span class="relative inline-flex size-2.5 rounded-full bg-clay ring-4 ring-clay/20" />
					Live now
				</span>
				<Badge variant={discMeta().badgeVariant}>{discMeta().label}</Badge>
			</div>

			<div>
				<h2 class="font-display m-0 text-3xl font-normal leading-tight text-foreground">
					<Link
						to="/events/$slug"
						params={{ slug: props.group.slug }}
						class="text-foreground no-underline hover:text-forest"
					>
						{props.group.name}
					</Link>
				</h2>
				<p class="m-0 mt-1 text-sm text-muted-foreground">
					{props.group.location} ·{" "}
					<Link
						to="/organizers/$slug"
						params={{ slug: props.group.organizationSlug }}
						class="text-muted-foreground hover:text-forest"
					>
						{props.group.organizationName}
					</Link>
				</p>
			</div>

			<div class="flex items-baseline justify-between gap-4">
				<div class="flex items-baseline gap-2">
					<span class="font-display text-4xl leading-none tabular-nums text-foreground">
						{props.group.counts.onCourse}
					</span>
					<span class="text-sm text-muted-foreground">on course</span>
				</div>
				<span class="text-xs tabular-nums text-muted-foreground">
					{props.group.counts.finished} finished
				</span>
			</div>

			<Progress
				value={Math.min(elapsedHours(), props.group.timeLimitHours)}
				maxValue={props.group.timeLimitHours}
				getValueLabel={({ value, max }) =>
					`${formatRaceClock(value * 3_600_000)} of ${formatRaceClock(max * 3_600_000)}`
				}
				class="flex flex-col gap-2"
			>
				<div class="flex items-baseline justify-between gap-3">
					<ProgressLabel class="text-xs font-normal text-muted-foreground">
						Race clock
					</ProgressLabel>
					<ProgressValueLabel class="text-xs font-semibold tabular-nums" />
				</div>
			</Progress>

			{/* Bib Quick-Search Track Form */}
			<form
				onSubmit={handleBibLookup}
				class="flex items-center gap-2 pt-2 border-t border-border/50"
			>
				<Input
					type="search"
					placeholder="Track Bib # (e.g. 101)…"
					value={lookupBib()}
					onInput={(e) => setLookupBib(e.currentTarget.value)}
					class="h-8 text-xs font-mono"
				/>
				<Button
					type="submit"
					size="sm"
					variant="outline"
					class="h-8 px-3 text-xs font-semibold shrink-0"
				>
					Track →
				</Button>
			</form>

			<div>
				<Link
					to="/events/$slug"
					params={{ slug: props.group.slug }}
					class="text-sm font-semibold text-forest no-underline hover:underline"
				>
					View live race &rarr;
				</Link>
			</div>
		</Card>
	);
}
