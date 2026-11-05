import { createFileRoute, Link, useRouter } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
	getRawTimingStream,
	ingestMt63Block,
	simulatePulse,
} from "~/field-ops/field-ops.functions";
import type { SubSplitKind, TimingSource } from "~/field-ops/field-ops.shared";
import { z } from "zod";

const rawStreamSearchSchema = z.object({
	status: z.string().optional(),
});

export const Route = createFileRoute(
	"/_authed/orgs/$slug/event-groups/$eventGroupSlug/raw-stream",
)({
	validateSearch: (search) => rawStreamSearchSchema.parse(search),
	loader: ({ params, location }) => {
		const searchParams = new URLSearchParams(location.search);
		return getRawTimingStream({
			data: {
				slug: params.slug,
				eventGroupSlug: params.eventGroupSlug,
				status: searchParams.get("status") ?? undefined,
			},
		});
	},
	component: RawTimingStreamPage,
});

const STATUS_BADGE_VARIANTS: Record<string, "forest" | "clay" | "sage" | "destructive" | "outline"> = {
	unprocessed: "outline",
	matched: "forest",
	duplicate_subordinate: "clay",
	rejected_invalid: "destructive",
	flagged_discrepancy: "destructive",
};

function RawTimingStreamPage() {
	const data = Route.useLoaderData();
	const params = Route.useParams();
	const search = Route.useSearch();
	const router = useRouter();

	const group = () => data().eventGroup;
	const items = () => data().items;
	const counts = () => data().counts;
	const currentStatus = () => search().status || "all";

	// MT63 Paste Modal
	const [mt63ModalOpen, setMt63ModalOpen] = createSignal(false);
	const [mt63RawText, setMt63RawText] = createSignal("");
	const [mt63Feedback, setMt63Feedback] = createSignal<string | null>(null);
	const [isSubmittingMt63, setIsSubmittingMt63] = createSignal(false);

	// Simulate Hardware Pulse Modal
	const [simModalOpen, setSimModalOpen] = createSignal(false);
	const [simStationCode, setSimStationCode] = createSignal("");
	const [simBib, setSimBib] = createSignal("");
	const [simKind, setSimKind] = createSignal<SubSplitKind>("point");
	const [simSource, setSimSource] = createSignal<TimingSource>("optical_photocell");
	const [isSimulating, setIsSimulating] = createSignal(false);

	const handleIngestMt63 = async (e: Event) => {
		e.preventDefault();
		if (!mt63RawText().trim()) return;

		setIsSubmittingMt63(true);
		setMt63Feedback(null);
		try {
			const res = await ingestMt63Block({
				data: {
					eventGroupId: group().id,
					rawText: mt63RawText().trim(),
				},
			});
			setMt63Feedback(
				`Imported ${res.importedCount} punches with ${res.errorCount} line errors.`,
			);
			if (res.importedCount > 0) {
				setMt63RawText("");
				await router.invalidate();
			}
		} catch (err: unknown) {
			setMt63Feedback(err instanceof Error ? err.message : "Failed to ingest block.");
		} finally {
			setIsSubmittingMt63(false);
		}
	};

	const handleSimulatePulse = async (e: Event) => {
		e.preventDefault();
		if (!simStationCode().trim() || !simBib().trim()) return;

		setIsSimulating(true);
		try {
			await simulatePulse({
				data: {
					eventGroupId: group().id,
					timingPointCode: simStationCode().trim().toUpperCase(),
					competitorNumber: simBib().trim(),
					subSplitKind: simKind(),
					source: simSource(),
				},
			});
			setSimModalOpen(false);
			setSimBib("");
			await router.invalidate();
		} catch (err: unknown) {
			console.error("Simulation failed:", err);
			alert(err instanceof Error ? err.message : "Pulse simulation failed");
		} finally {
			setIsSimulating(false);
		}
	};

	return (
		<div class="px-6 py-8 max-w-7xl mx-auto space-y-6">
			{/* Weekend Hub Sub-Nav */}
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div class="flex items-center gap-4 text-xs font-semibold">
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
					>
						Weekend Overview & Readiness
					</Link>
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/rules-staff"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
					>
						Discipline Rules & Staff Matrix
					</Link>
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/stations"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
					>
						Stations Cross-Check
					</Link>
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/sar"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
					>
						Net Control & SAR
					</Link>
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug/raw-stream"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class="text-foreground border-b-2 border-forest pb-3 -mb-3.5 font-bold"
					>
						Raw Timing Stream
					</Link>
				</div>
			</div>

			{/* Header & Actions */}
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 class="text-2xl font-bold font-serif text-foreground tracking-tight">
						Raw Timing Stream & Hardware Telemetry
					</h1>
					<p class="text-sm text-muted-foreground mt-0.5">
						Append-only immutable audit ledger of all hardware pulses, volunteer timestamps, and ham radio packets.
					</p>
				</div>

				<div class="flex items-center gap-3">
					<Button
						type="button"
						variant="outline"
						size="sm"
						class="gap-1.5"
						onClick={() => setMt63ModalOpen(true)}
					>
						<span>📻</span>
						<span>Paste MT63 Radio Block</span>
					</Button>

					<Button
						type="button"
						variant="forest"
						size="sm"
						class="gap-1.5"
						onClick={() => setSimModalOpen(true)}
					>
						<span>⚡</span>
						<span>Simulate Hardware Pulse</span>
					</Button>
				</div>
			</div>

			{/* Status Filter Tabs */}
			<div class="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto text-xs font-semibold">
				<Link
					to="/orgs/$slug/event-groups/$eventGroupSlug/raw-stream"
					params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
					class={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors ${
						currentStatus() === "all"
							? "bg-foreground text-background font-bold shadow-xs"
							: "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
					}`}
				>
					<span>All Pulses</span>
					<span class="rounded-full bg-muted/40 px-1.5 py-0.2 text-[10px] tabular-nums font-mono">
						{counts().all}
					</span>
				</Link>

				<Link
					to="/orgs/$slug/event-groups/$eventGroupSlug/raw-stream"
					params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
					search={{ status: "matched" }}
					class={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors ${
						currentStatus() === "matched"
							? "bg-forest text-forest-foreground font-bold shadow-xs"
							: "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
					}`}
				>
					<span>Matched</span>
					<span class="rounded-full bg-forest/20 px-1.5 py-0.2 text-[10px] tabular-nums font-mono">
						{counts().matched}
					</span>
				</Link>

				<Link
					to="/orgs/$slug/event-groups/$eventGroupSlug/raw-stream"
					params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
					search={{ status: "unprocessed" }}
					class={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors ${
						currentStatus() === "unprocessed"
							? "bg-foreground text-background font-bold shadow-xs"
							: "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
					}`}
				>
					<span>Unprocessed</span>
					<span class="rounded-full bg-muted/40 px-1.5 py-0.2 text-[10px] tabular-nums font-mono">
						{counts().unprocessed}
					</span>
				</Link>

				<Link
					to="/orgs/$slug/event-groups/$eventGroupSlug/raw-stream"
					params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
					search={{ status: "duplicate_subordinate" }}
					class={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors ${
						currentStatus() === "duplicate_subordinate"
							? "bg-clay text-clay-foreground font-bold shadow-xs"
							: "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
					}`}
				>
					<span>Clustered Backup</span>
					<span class="rounded-full bg-clay/20 px-1.5 py-0.2 text-[10px] tabular-nums font-mono">
						{counts().duplicate_subordinate}
					</span>
				</Link>

				<Link
					to="/orgs/$slug/event-groups/$eventGroupSlug/raw-stream"
					params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
					search={{ status: "flagged_discrepancy" }}
					class={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors ${
						currentStatus() === "flagged_discrepancy"
							? "bg-destructive text-destructive-foreground font-bold shadow-xs"
							: "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
					}`}
				>
					<span>Discrepancies</span>
					<span class="rounded-full bg-destructive/20 px-1.5 py-0.2 text-[10px] tabular-nums font-mono">
						{counts().flagged_discrepancy}
					</span>
				</Link>
			</div>

			{/* Raw Pulses Table */}
			<Card class="border-border">
				<CardContent class="p-0">
					<div class="overflow-x-auto">
						<table class="w-full text-left text-xs font-mono">
							<thead>
								<tr class="border-b border-border/80 bg-muted/40 font-semibold text-muted-foreground select-none font-sans">
									<th class="py-3 px-4">Timestamp (UTC)</th>
									<th class="py-3 px-4">Station</th>
									<th class="py-3 px-4">Bib</th>
									<th class="py-3 px-4">Split Kind</th>
									<th class="py-3 px-4">Source</th>
									<th class="py-3 px-4">Status</th>
									<th class="py-3 px-4">Recorded By / Note</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								<Show
									when={items().length > 0}
									fallback={
										<tr>
											<td colspan="7" class="py-12 text-center text-xs text-muted-foreground font-sans">
												Zero raw timing events match the current filter.
											</td>
										</tr>
									}
								>
									<For each={items()}>
										{(item) => (
											<tr class="hover:bg-muted/20">
												<td class="py-2.5 px-4 tabular-nums text-foreground">
													{new Date(item.recordedTimeUtc).toISOString()}
												</td>
												<td class="py-2.5 px-4 font-bold text-forest">
													{item.timingPointCode}
												</td>
												<td class="py-2.5 px-4 font-bold text-foreground">
													#{item.competitorNumber}
													<Show when={item.withPacer}>
														<span class="ml-1 text-[10px] text-forest">+P</span>
													</Show>
												</td>
												<td class="py-2.5 px-4">
													<Badge variant="outline" class="text-[10px] uppercase">
														{item.subSplitKind}
													</Badge>
												</td>
												<td class="py-2.5 px-4 text-muted-foreground">
													{item.source}
												</td>
												<td class="py-2.5 px-4">
													<Badge
														variant={STATUS_BADGE_VARIANTS[item.status] || "outline"}
														class="text-[10px]"
													>
														{item.status}
													</Badge>
												</td>
												<td class="py-2.5 px-4 text-muted-foreground font-sans text-[11px] truncate max-w-xs">
													{item.recordedByPersonName || item.auditNote || "—"}
												</td>
											</tr>
										)}
									</For>
								</Show>
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>

			{/* Modal 1: MT63 Radio Block Ingestion */}
			<Dialog open={mt63ModalOpen()} onOpenChange={setMt63ModalOpen}>
				<DialogContent class="max-w-lg">
					<DialogHeader>
						<DialogTitle>Net Control MT63 Radio Block Ingestion</DialogTitle>
						<DialogDescription>
							Paste acoustic text transcripts decoded from digital MT63 VHF/UHF amateur radio bursts.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleIngestMt63} class="space-y-4 py-2">
						<Show when={mt63Feedback()}>
							<div class="rounded-lg bg-primary/10 border border-primary/20 p-2.5 text-xs text-primary font-medium">
								{mt63Feedback()}
							</div>
						</Show>

						<div class="space-y-1">
							<label class="text-xs font-semibold text-foreground">
								MT63 Lines (format: &lt;STATION&gt; &lt;BIB&gt; &lt;IN|OUT|POINT&gt; &lt;HH:MM:SS&gt; [P])
							</label>
							<textarea
								value={mt63RawText()}
								onInput={(e) => setMt63RawText(e.currentTarget.value)}
								placeholder={`TWIN 142 IN 14:22:31 P\nTWIN 142 OUT 14:35:10\nHOPE 88 POINT 14:40:00`}
								class="w-full h-40 rounded-xl border border-input bg-surface p-3 text-xs font-mono select-all leading-relaxed"
								required
							/>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setMt63ModalOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" variant="forest" disabled={isSubmittingMt63()}>
								{isSubmittingMt63() ? "Ingesting..." : "Batch Ingest Radio Block"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Modal 2: Hardware Test Pulse Simulator */}
			<Dialog open={simModalOpen()} onOpenChange={setSimModalOpen}>
				<DialogContent class="max-w-md">
					<DialogHeader>
						<DialogTitle>Simulate Hardware / Webhook Pulse</DialogTitle>
						<DialogDescription>
							Inject a mock timing pulse from automated laser photocell gates or RFID chip mats.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleSimulatePulse} class="space-y-4 py-2">
						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1">
								<label class="text-xs font-semibold text-foreground">
									Station Code
								</label>
								<Input
									value={simStationCode()}
									onInput={(e) => setSimStationCode(e.currentTarget.value)}
									placeholder="e.g. TWIN"
									required
								/>
							</div>

							<div class="space-y-1">
								<label class="text-xs font-semibold text-foreground">
									Competitor Bib
								</label>
								<Input
									value={simBib()}
									onInput={(e) => setSimBib(e.currentTarget.value)}
									placeholder="e.g. 101"
									required
								/>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1">
								<label class="text-xs font-semibold text-foreground">
									Split Kind
								</label>
								<select
									value={simKind()}
									onChange={(e) => setSimKind(e.currentTarget.value as SubSplitKind)}
									class="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm"
								>
									<option value="point">POINT (Flying Gate)</option>
									<option value="in">IN (Aid Arrival)</option>
									<option value="out">OUT (Aid Departure)</option>
								</select>
							</div>

							<div class="space-y-1">
								<label class="text-xs font-semibold text-foreground">
									Hardware Source
								</label>
								<select
									value={simSource()}
									onChange={(e) => setSimSource(e.currentTarget.value as TimingSource)}
									class="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm"
								>
									<option value="optical_photocell">Optical Photocell (Laser)</option>
									<option value="rfid_transponder">RFID Chip Mat</option>
									<option value="api_webhook">API Webhook</option>
								</select>
							</div>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setSimModalOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" variant="forest" disabled={isSimulating()}>
								{isSimulating() ? "Firing..." : "Fire Test Pulse"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
