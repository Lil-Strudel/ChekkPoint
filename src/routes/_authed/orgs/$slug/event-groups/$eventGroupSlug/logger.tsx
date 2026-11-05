import { createFileRoute, Link, useRouter } from "@tanstack/solid-router";
import { createSignal, onCleanup, For, Show } from "solid-js";
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
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/components/ui/sheet";
import {
	getFieldLogger,
	recordDrop,
	recordSplit,
} from "~/field-ops/field-ops.functions";
import {
	damerauLevenshtein,
	getTypoRecommendation,
	type SubSplitKind,
	type TypoRecommendation,
} from "~/field-ops/field-ops.shared";
import { z } from "zod";

const loggerSearchSchema = z.object({
	station: z.string().optional(),
});

export const Route = createFileRoute(
	"/_authed/orgs/$slug/event-groups/$eventGroupSlug/logger",
)({
	validateSearch: (search) => loggerSearchSchema.parse(search),
	loader: ({ params }) =>
		getFieldLogger({
			data: { slug: params.slug, eventGroupSlug: params.eventGroupSlug },
		}),
	component: FullScreenVolunteerLoggerPage,
});

interface LocalPunch {
	id: string;
	stationCode: string;
	bibNumber: string;
	subSplitKind: SubSplitKind;
	withPacer: boolean;
	recordedTimeUtc: Date;
	synced: boolean;
	error?: string;
}

interface FifoTicket {
	id: string;
	timestampUtc: Date;
	subSplitKind: SubSplitKind;
	assignedBib: string | null;
}

function FullScreenVolunteerLoggerPage() {
	const loggerData = Route.useLoaderData();
	const stations = () => loggerData().stations;
	const candidateBibs = () => loggerData().candidateBibs;
	const entrantsPool = () => loggerData().entrants;
	const eventGroupId = () => loggerData().eventGroupId;

	const params = Route.useParams();
	const search = Route.useSearch();
	const router = useRouter();

	// Active Station Selection
	const initialStation = () => {
		if (search().station) {
			const match = stations().find(
				(s) => s.timingPoint.code.toUpperCase() === search().station?.toUpperCase(),
			);
			if (match) return match.timingPoint;
		}
		return stations()[0]?.timingPoint;
	};

	const [selectedStation, setSelectedStation] = createSignal(initialStation());

	// Keypad Input Buffer
	const [bibInput, setBibInput] = createSignal("");
	const [activeKind, setActiveKind] = createSignal<SubSplitKind>("in");
	const [withPacer, setWithPacer] = createSignal(false);

	// Punches queue (recent & offline outbox)
	const [recentPunches, setRecentPunches] = createSignal<LocalPunch[]>([]);

	// Decoupled FIFO Chute Queue
	const [fifoTickets, setFifoTickets] = createSignal<FifoTicket[]>([]);
	const [activeFifoTicketId, setActiveFifoTicketId] = createSignal<string | null>(null);

	// Mobile Bottom Sheet (< lg)
	const [mobileSheetOpen, setMobileSheetOpen] = createSignal(false);

	// DNF vs ROC Modal
	const [dropModalOpen, setDropModalOpen] = createSignal(false);
	const [dropBib, setDropBib] = createSignal("");
	const [dropKind, setDropKind] = createSignal<"dnf" | "retired">("dnf");
	const [dropReason, setDropReason] = createSignal("voluntary");
	const [dropLocationDesc, setDropLocationDesc] = createSignal("");
	const [isSubmittingDrop, setIsSubmittingDrop] = createSignal(false);

	// MT63 Export Modal
	const [mt63ModalOpen, setMt63ModalOpen] = createSignal(false);
	const [copiedNotice, setCopiedNotice] = createSignal(false);

	// Live clock ticker
	const [now, setNow] = createSignal(new Date());
	const ticker = setInterval(() => setNow(new Date()), 500);
	onCleanup(() => clearInterval(ticker));

	// Real Damerau-Levenshtein Typo-Defense HUD logic
	const typoRecommendation = (): TypoRecommendation | null => {
		const raw = bibInput().trim();
		if (!raw || raw.length < 1) return null;
		return getTypoRecommendation(raw, candidateBibs(), 1);
	};

	const matchedRunner = () => {
		const raw = bibInput().trim();
		if (!raw) return null;
		return entrantsPool().find((e) => e.bibNumber === raw) || null;
	};

	const isUnregisteredBib = () => {
		const raw = bibInput().trim();
		if (!raw || candidateBibs().length === 0) return false;
		return !candidateBibs().includes(raw);
	};

	// Keypad operations
	const handlePressDigit = (digit: string) => {
		setBibInput((prev) => prev + digit);
	};

	const handleBackspace = () => {
		setBibInput((prev) => prev.slice(0, -1));
	};

	const handleClear = () => {
		setBibInput("");
		setActiveFifoTicketId(null);
	};

	// Record Timestamp First (FIFO Mode)
	const handleFifoTimestampNow = () => {
		const ticket: FifoTicket = {
			id: `fifo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			timestampUtc: new Date(),
			subSplitKind: activeKind(),
			assignedBib: null,
		};
		setFifoTickets((prev) => [ticket, ...prev]);
	};

	// Commit Punch
	const handleCommitPunch = async () => {
		const bib = bibInput().trim();
		if (!bib) return;

		const st = selectedStation();
		if (!st) {
			alert("Please select a timing station first.");
			return;
		}

		// Check if we are binding to an unassigned FIFO ticket
		const pendingTicket = activeFifoTicketId()
			? fifoTickets().find((t) => t.id === activeFifoTicketId())
			: fifoTickets().find((t) => t.assignedBib === null);

		const punchTime = pendingTicket ? pendingTicket.timestampUtc : new Date();
		const kind = pendingTicket ? pendingTicket.subSplitKind : activeKind();

		if (pendingTicket) {
			// Mark ticket assigned
			setFifoTickets((prev) =>
				prev.map((t) =>
					t.id === pendingTicket.id ? { ...t, assignedBib: bib } : t,
				),
			);
			setActiveFifoTicketId(null);
		}

		const localId = `punch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		const newPunch: LocalPunch = {
			id: localId,
			stationCode: st.code,
			bibNumber: bib,
			subSplitKind: kind,
			withPacer: withPacer(),
			recordedTimeUtc: punchTime,
			synced: false,
		};

		setRecentPunches((prev) => [newPunch, ...prev.slice(0, 49)]);
		setBibInput("");
		setWithPacer(false);

		// Synchronous or background dispatch
		try {
			await recordSplit({
				data: {
					eventGroupId: eventGroupId(),
					competitorNumber: bib,
					timingPointCode: st.code,
					subSplitKind: kind,
					recordedTimeUtc: punchTime,
					withPacer: newPunch.withPacer,
					source: "manual_web_entry",
				},
			});
			setRecentPunches((prev) =>
				prev.map((p) => (p.id === localId ? { ...p, synced: true } : p)),
			);
		} catch (err: unknown) {
			// Buffered offline
			console.warn("Punch queued locally (offline or server error):", err);
		}
	};

	// Open Drop Modal
	const handleOpenDrop = () => {
		setDropBib(bibInput() || "");
		setDropKind("dnf");
		setDropReason("voluntary");
		setDropLocationDesc("");
		setDropModalOpen(true);
	};

	const handleSubmitDrop = async (e: Event) => {
		e.preventDefault();
		const bib = dropBib().trim();
		if (!bib) return;

		const matched = entrantsPool().find((e) => e.bibNumber === bib);
		const targetEntrantId = matched?.id;

		setIsSubmittingDrop(true);
		try {
			await recordDrop({
				data: {
					eventGroupId: eventGroupId(),
					entrantId: targetEntrantId,
					competitorNumber: bib,
					timingPointId: selectedStation()?.id,
					dropKind: dropKind(),
					dropReason: dropReason(),
					dropLocationDescription: dropLocationDesc(),
				},
			});
			setDropModalOpen(false);
			setBibInput("");
		} catch (err: unknown) {
			console.error("Drop submission failed:", err);
		} finally {
			setIsSubmittingDrop(false);
		}
	};

	// Generate MT63 Radio Text Block
	const mt63Text = () => {
		const lines = recentPunches().map((p) => {
			const timeStr = p.recordedTimeUtc.toISOString().slice(11, 19);
			const pacer = p.withPacer ? " P" : "";
			return `${p.stationCode} ${p.bibNumber} ${p.subSplitKind.toUpperCase()} ${timeStr}${pacer}`;
		});
		return lines.join("\n");
	};

	const handleCopyMt63 = () => {
		navigator.clipboard.writeText(mt63Text());
		setCopiedNotice(true);
		setTimeout(() => setCopiedNotice(false), 2000);
	};

	return (
		<div class="h-dvh w-screen flex flex-col bg-background text-foreground overflow-hidden select-none font-sans">
			{/* Top Bar: Back to Race Control, Station Selector & Live Clocks */}
			<header class="h-14 border-b border-border bg-card/90 px-4 flex items-center justify-between gap-2 shrink-0">
				<div class="flex items-center gap-3">
					<Link
						to="/orgs/$slug/event-groups/$eventGroupSlug"
						params={{ slug: params().slug, eventGroupSlug: params().eventGroupSlug }}
						class={buttonVariants({
							variant: "outline",
							size: "sm",
							class: "gap-1 font-semibold text-xs h-8 px-2.5",
						})}
					>
						<span>←</span>
						<span class="hidden sm:inline">Back to</span>
						<span>Race Control</span>
					</Link>

					{/* Station Selector Dropdown */}
					<div class="flex items-center gap-1.5">
						<span class="text-xs font-semibold text-muted-foreground hidden md:inline">
							Station:
						</span>
						<select
							value={selectedStation()?.id ?? ""}
							onChange={(e) => {
								const match = stations().find(
									(s) => s.timingPoint.id === e.currentTarget.value,
								);
								if (match) setSelectedStation(match.timingPoint);
							}}
							class="rounded-md border border-input bg-surface px-2.5 py-1 text-xs font-semibold font-mono shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
						>
							<For each={stations()}>
								{(st) => (
									<option value={st.timingPoint.id}>
										{st.timingPoint.code} — {st.timingPoint.name}
									</option>
								)}
							</For>
						</select>
					</div>
				</div>

				{/* Center: Verification Banner */}
				<Show when={selectedStation()}>
					<div class="hidden xl:flex items-center gap-1.5 text-xs">
						<span class="size-2 rounded-full bg-forest animate-pulse" />
						<span class="font-bold text-foreground font-serif">
							{selectedStation()!.name}
						</span>
						<Badge variant="sage" class="text-[10px] font-mono">
							{selectedStation()!.code}
						</Badge>
					</div>
				</Show>

				{/* Right: Clock & MT63 Sync Modal Trigger */}
				<div class="flex items-center gap-3">
					{/* Live Ticker Clock */}
					<div class="text-right font-mono tabular-nums leading-tight">
						<div class="text-xs font-bold text-foreground">
							{now().toLocaleTimeString([], { hour12: false })}
						</div>
						<div class="text-[10px] text-muted-foreground hidden sm:block">
							{now().toISOString().slice(0, 10)} UTC
						</div>
					</div>

					{/* MT63 Outbox Button */}
					<button
						type="button"
						onClick={() => setMt63ModalOpen(true)}
						class={buttonVariants({
							variant: "outline",
							size: "sm",
							class: "gap-1 text-xs h-8 px-2 font-mono",
						})}
						title="Export MT63 Ham Radio Block"
					>
						<span>📻</span>
						<span class="hidden sm:inline">MT63</span>
						<Show when={recentPunches().length > 0}>
							<Badge variant="clay" class="text-[9px] py-0 px-1 font-mono">
								{recentPunches().length}
							</Badge>
						</Show>
					</button>
				</div>
			</header>

			{/* Main Logger Workstation */}
			<div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
				{/* LEFT PANE (Main Keypad & Entry HUD) */}
				<main class="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto max-w-xl mx-auto w-full justify-between space-y-4">
					{/* Display Buffer & Typo HUD */}
					<div class="space-y-2">
						{/* Active Station Banner */}
						<div class="rounded-xl bg-forest/10 border border-forest/30 px-3 py-1.5 flex items-center justify-between text-xs">
							<div class="flex items-center gap-2">
								<span class="font-bold font-mono text-forest">
									{selectedStation()?.code || "NO STATION"}
								</span>
								<span class="text-muted-foreground">—</span>
								<span class="font-semibold text-foreground">
									{selectedStation()?.name || "Select a timing checkpoint"}
								</span>
							</div>

							<Show when={activeFifoTicketId()}>
								<Badge variant="clay" class="animate-pulse text-[10px]">
									Binding to Timestamp
								</Badge>
							</Show>
						</div>

						{/* Typo-Defense HUD Banner & Chips */}
						<Show when={bibInput().trim().length > 0}>
							{/* Case 1: Damerau-Levenshtein Typo Recommendation (Distance = 1) */}
							<Show when={typoRecommendation() && typoRecommendation()!.distance === 1}>
								<div class="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 flex items-center justify-between gap-2 text-xs">
									<div class="flex items-center gap-2 text-amber-800 dark:text-amber-300">
										<span class="text-sm font-bold">⚠️ Typo Defense:</span>
										<span>
											Did you mean <strong class="font-mono underline">#{typoRecommendation()!.recommendedBib}</strong>?
										</span>
									</div>
									<button
										type="button"
										onClick={() => setBibInput(typoRecommendation()!.recommendedBib)}
										class="px-2.5 py-1 rounded-md bg-amber-600 text-white font-mono font-bold text-xs hover:bg-amber-700 cursor-pointer shadow-xs shrink-0"
									>
										Replace with #{typoRecommendation()!.recommendedBib}
									</button>
								</div>
							</Show>

							{/* Case 2: Exact Match Registered Athlete */}
							<Show when={matchedRunner()}>
								<div class="rounded-xl bg-forest/10 border border-forest/30 px-3 py-1.5 flex items-center justify-between text-xs text-forest">
									<div class="flex items-center gap-2">
										<span class="font-bold">✓ Registered:</span>
										<span class="font-semibold text-foreground">
											{matchedRunner()!.firstName} {matchedRunner()!.lastName}
										</span>
										<Badge variant="sage" class="text-[10px] font-normal">
											{matchedRunner()!.subEventName}
										</Badge>
									</div>
									<span class="font-mono text-[10px] uppercase text-muted-foreground">
										{matchedRunner()!.status}
									</span>
								</div>
							</Show>

							{/* Case 3: Unregistered Bib Warning (Distance > 1 or no close match) */}
							<Show
								when={
									candidateBibs().length > 0 &&
									isUnregisteredBib() &&
									(!typoRecommendation() || typoRecommendation()!.distance > 1)
								}
							>
								<div class="rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-1.5 flex items-center justify-between text-xs text-destructive">
									<div class="flex items-center gap-1.5">
										<span class="font-bold">⚠️ Unregistered Bib:</span>
										<span>
											Bib #{bibInput().trim()} not in registered entrant pool
										</span>
									</div>
									<Badge variant="destructive" class="text-[10px]">
										Unverified
									</Badge>
								</div>
							</Show>
						</Show>

						{/* Oversized Bib Input Display */}
						<div class="relative rounded-2xl border-2 border-border bg-card p-4 text-center shadow-xs">
							<div class="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">
								Competitor Number
							</div>
							<div class="text-5xl font-mono font-bold tracking-tight text-foreground min-h-[56px] flex items-center justify-center tabular-nums">
								{bibInput() ? (
									<span>#{bibInput()}</span>
								) : (
									<span class="text-muted-foreground/30 font-normal"># — — —</span>
								)}
							</div>

							{/* Split Kind Selector & Pacer Toggle */}
							<div class="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border/80">
								<div class="flex items-center gap-1">
									<button
										type="button"
										onClick={() => setActiveKind("in")}
										class={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
											activeKind() === "in"
												? "bg-forest text-forest-foreground shadow-xs"
												: "bg-muted/60 text-muted-foreground hover:bg-muted"
										}`}
									>
										IN
									</button>
									<button
										type="button"
										onClick={() => setActiveKind("out")}
										class={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
											activeKind() === "out"
												? "bg-forest text-forest-foreground shadow-xs"
												: "bg-muted/60 text-muted-foreground hover:bg-muted"
										}`}
									>
										OUT
									</button>
									<button
										type="button"
										onClick={() => setActiveKind("point")}
										class={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
											activeKind() === "point"
												? "bg-forest text-forest-foreground shadow-xs"
												: "bg-muted/60 text-muted-foreground hover:bg-muted"
										}`}
									>
										POINT
									</button>
								</div>

								{/* With Pacer Toggle Button */}
								<button
									type="button"
									onClick={() => setWithPacer(!withPacer())}
									class={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer ${
										withPacer()
											? "bg-forest text-forest-foreground"
											: "bg-muted/40 text-muted-foreground hover:bg-muted"
									}`}
								>
									<span>🏃‍♂️</span>
									<span>+Pacer</span>
								</button>
							</div>
						</div>
					</div>

					{/* 10-KEY KEYPAD */}
					<div class="grid grid-cols-3 gap-2.5 max-w-sm mx-auto w-full">
						<For each={["1", "2", "3", "4", "5", "6", "7", "8", "9"]}>
							{(digit) => (
								<button
									type="button"
									onClick={() => handlePressDigit(digit)}
									class="h-16 rounded-xl border border-border bg-surface text-2xl font-bold font-mono text-foreground hover:bg-muted/60 active:scale-95 transition-transform flex items-center justify-center cursor-pointer shadow-xs select-none"
								>
									{digit}
								</button>
							)}
						</For>
						<button
							type="button"
							onClick={handleClear}
							class="h-16 rounded-xl border border-border bg-muted/30 text-sm font-bold text-muted-foreground hover:bg-muted/60 active:scale-95 transition-transform flex items-center justify-center cursor-pointer shadow-xs"
						>
							CLR
						</button>
						<button
							type="button"
							onClick={() => handlePressDigit("0")}
							class="h-16 rounded-xl border border-border bg-surface text-2xl font-bold font-mono text-foreground hover:bg-muted/60 active:scale-95 transition-transform flex items-center justify-center cursor-pointer shadow-xs select-none"
						>
							0
						</button>
						<button
							type="button"
							onClick={handleBackspace}
							class="h-16 rounded-xl border border-border bg-muted/30 text-lg font-bold text-muted-foreground hover:bg-muted/60 active:scale-95 transition-transform flex items-center justify-center cursor-pointer shadow-xs"
						>
							⌫
						</button>
					</div>

					{/* Action Buttons: FIFO Stamp, Record, DNF */}
					<div class="space-y-2 max-w-sm mx-auto w-full">
						<div class="grid grid-cols-2 gap-2">
							{/* Decoupled FIFO Stamp Now Button */}
							<Button
								type="button"
								variant="outline"
								class="h-14 font-bold text-xs flex flex-col items-center justify-center leading-tight border-primary/40 text-primary hover:bg-primary/10 cursor-pointer"
								onClick={handleFifoTimestampNow}
							>
								<span>⏱️ Time Stamp</span>
								<span class="text-[10px] font-normal text-muted-foreground">
									Back-fill bib later
								</span>
							</Button>

							{/* Commit Punch Button */}
							<Button
								type="button"
								variant="forest"
								class="h-14 font-bold text-sm tracking-wide shadow-md flex items-center justify-center cursor-pointer"
								disabled={!bibInput().trim()}
								onClick={handleCommitPunch}
							>
								Record #{bibInput() || "—"}
							</Button>
						</div>

						{/* DNF / Retired on Course Button */}
						<Button
							type="button"
							variant="destructive"
							size="sm"
							class="w-full text-xs h-9 cursor-pointer"
							onClick={handleOpenDrop}
						>
							Report Drop (DNF / Retired)
						</Button>

						{/* Mobile Trigger for Recent Punches & Chute Bottom Sheet (< lg) */}
						<div class="lg:hidden pt-2">
							<Sheet open={mobileSheetOpen()} onOpenChange={setMobileSheetOpen}>
								<SheetTrigger
									class={buttonVariants({
										variant: "outline",
										size: "sm",
										class: "w-full justify-between font-mono text-xs h-10 cursor-pointer shadow-xs",
									})}
								>
									<span class="flex items-center gap-2">
										<span>📋 Recent Punches & Chute</span>
										<Show when={fifoTickets().filter((t) => !t.assignedBib).length > 0}>
											<Badge variant="clay" class="text-[9px] py-0 px-1 font-mono">
												{fifoTickets().filter((t) => !t.assignedBib).length} pending
											</Badge>
										</Show>
									</span>
									<Badge variant="outline" class="text-[10px] font-mono">
										{recentPunches().length} total
									</Badge>
								</SheetTrigger>
								<SheetContent side="bottom" class="max-h-[80vh] flex flex-col p-4 rounded-t-2xl">
									<SheetHeader class="text-left pb-2 border-b border-border">
										<SheetTitle class="text-base font-bold font-serif text-foreground">
											Recent Punches & FIFO Chute
										</SheetTitle>
										<SheetDescription class="text-xs text-muted-foreground">
											Tap unassigned tickets to bind with keypad bib entry.
										</SheetDescription>
									</SheetHeader>

									<div class="flex-1 overflow-y-auto py-3 space-y-2">
										{/* Unassigned FIFO Chute Placeholders */}
										<For each={fifoTickets().filter((t) => !t.assignedBib)}>
											{(ticket) => (
												<div
													onClick={() => {
														setActiveFifoTicketId(ticket.id);
														setMobileSheetOpen(false);
													}}
													class={`rounded-xl border p-2.5 cursor-pointer ${
														activeFifoTicketId() === ticket.id
															? "bg-primary/15 border-primary"
															: "bg-surface/80 border-dashed border-primary/40 hover:bg-surface"
													}`}
												>
													<div class="flex items-center justify-between">
														<Badge variant="clay" class="text-[10px]">
															Unassigned {ticket.subSplitKind.toUpperCase()}
														</Badge>
														<span class="text-xs font-mono font-bold text-primary">
															{ticket.timestampUtc.toLocaleTimeString([], { hour12: false })}
														</span>
													</div>
													<div class="text-xs text-muted-foreground mt-1">
														Tap to bind bib from keypad
													</div>
												</div>
											)}
										</For>

										{/* Recent Punches Feed */}
										<For each={recentPunches()}>
											{(punch) => (
												<div class="rounded-xl border border-border bg-surface p-2.5 flex items-center justify-between text-xs font-mono">
													<div>
														<span class="font-bold text-forest">#{punch.bibNumber}</span>
														<span class="text-muted-foreground ml-2">
															{punch.subSplitKind.toUpperCase()}
														</span>
														<Show when={punch.withPacer}>
															<span class="ml-1 text-[10px] text-forest">+P</span>
														</Show>
													</div>
													<div class="text-muted-foreground tabular-nums">
														{punch.recordedTimeUtc.toLocaleTimeString([], { hour12: false })}
													</div>
												</div>
											)}
										</For>

										<Show when={recentPunches().length === 0 && fifoTickets().length === 0}>
											<div class="py-12 text-center text-xs text-muted-foreground">
												No punches recorded in this session.
											</div>
										</Show>
									</div>
								</SheetContent>
							</Sheet>
						</div>
					</div>
				</main>

				{/* RIGHT PANE: DESKTOP SIDE-BY-SIDE RECENT PUNCHES & FIFO CHUTE */}
				<aside class="hidden lg:flex w-96 border-l border-border bg-card/25 flex-col overflow-hidden">
					{/* Header */}
					<div class="p-3.5 border-b border-border flex items-center justify-between">
						<div class="font-bold font-serif text-sm text-foreground">
							Recent Punches & FIFO Chute
						</div>
						<Show when={fifoTickets().length > 0}>
							<Badge variant="clay" class="text-[10px] font-mono tabular-nums">
								{fifoTickets().filter((t) => !t.assignedBib).length} pending
							</Badge>
						</Show>
					</div>

					{/* Queue list */}
					<div class="flex-1 overflow-y-auto p-3 space-y-2">
						{/* Unassigned FIFO Chute Placeholders */}
						<For each={fifoTickets().filter((t) => !t.assignedBib)}>
							{(ticket) => (
								<div
									onClick={() => {
										setActiveFifoTicketId(ticket.id);
									}}
									class={`rounded-xl border p-2.5 transition-colors cursor-pointer ${
										activeFifoTicketId() === ticket.id
											? "bg-primary/15 border-primary"
											: "bg-surface/80 border-dashed border-primary/40 hover:bg-surface"
									}`}
								>
									<div class="flex items-center justify-between">
										<Badge variant="clay" class="text-[10px]">
											Unassigned {ticket.subSplitKind.toUpperCase()}
										</Badge>
										<span class="text-xs font-mono font-bold text-primary">
											{ticket.timestampUtc.toLocaleTimeString([], { hour12: false })}
										</span>
									</div>
									<div class="text-xs text-muted-foreground mt-1">
										Click to bind bib from keypad
									</div>
								</div>
							)}
						</For>

						{/* Recent Punches Feed */}
						<For each={recentPunches()}>
							{(punch) => (
								<div class="rounded-xl border border-border bg-surface p-2.5 flex items-center justify-between text-xs font-mono">
									<div>
										<span class="font-bold text-forest">#{punch.bibNumber}</span>
										<span class="text-muted-foreground ml-2">
											{punch.subSplitKind.toUpperCase()}
										</span>
										<Show when={punch.withPacer}>
											<span class="ml-1 text-[10px] text-forest">+P</span>
										</Show>
									</div>
									<div class="text-muted-foreground tabular-nums">
										{punch.recordedTimeUtc.toLocaleTimeString([], { hour12: false })}
									</div>
								</div>
							)}
						</For>

						<Show when={recentPunches().length === 0 && fifoTickets().length === 0}>
							<div class="py-12 text-center text-xs text-muted-foreground">
								No punches recorded in this session.
							</div>
						</Show>
					</div>
				</aside>
			</div>

			{/* DNF vs ROC Modal Dialog */}
			<Dialog open={dropModalOpen()} onOpenChange={setDropModalOpen}>
				<DialogContent class="max-w-md">
					<DialogHeader>
						<DialogTitle>Report Runner Drop</DialogTitle>
						<DialogDescription>
							Accurately document runner withdrawal location for Search & Rescue accountability.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleSubmitDrop} class="space-y-4 py-2">
						<div class="space-y-1">
							<label class="text-xs font-semibold text-foreground">Bib Number</label>
							<input
								value={dropBib()}
								onInput={(e) => setDropBib(e.currentTarget.value)}
								placeholder="e.g. 142"
								class="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm font-mono font-bold"
								required
							/>
						</div>

						{/* Drop Type Selection */}
						<div class="space-y-1.5">
							<label class="text-xs font-semibold text-foreground">Drop Kind</label>
							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setDropKind("dnf")}
									class={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
										dropKind() === "dnf"
											? "border-forest bg-forest/10"
											: "border-border bg-surface hover:bg-muted/50"
									}`}
								>
									<div class="font-bold text-xs text-foreground">
										Dropped at Station (DNF)
									</div>
									<div class="text-[11px] text-muted-foreground mt-0.5">
										Safely in custody here at {selectedStation()?.name || "this station"}.
									</div>
								</button>

								<button
									type="button"
									onClick={() => setDropKind("retired")}
									class={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
										dropKind() === "retired"
											? "border-destructive bg-destructive/10"
											: "border-border bg-surface hover:bg-muted/50"
									}`}
								>
									<div class="font-bold text-xs text-destructive">
										Retired on Course (ROC)
									</div>
									<div class="text-[11px] text-muted-foreground mt-0.5">
										Withdrew between stations. Triggers Stage 2 SAR triage.
									</div>
								</button>
							</div>
						</div>

						{/* Reason */}
						<div class="space-y-1">
							<label class="text-xs font-semibold text-foreground">Reason</label>
							<select
								value={dropReason()}
								onChange={(e) => setDropReason(e.currentTarget.value)}
								class="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm"
							>
								<option value="voluntary">Voluntary / Fatigue</option>
								<option value="medical">Medical / Injury / Hypothermia</option>
								<option value="mechanical">Mechanical / Gear Failure</option>
								<option value="missed_cutoff">Missed Departure Cutoff (OTL)</option>
								<option value="other">Other</option>
							</select>
						</div>

						{/* Location narrative if retired */}
						<Show when={dropKind() === "retired"}>
							<div class="space-y-1">
								<label class="text-xs font-semibold text-destructive">
									Last Known Location on Course (SAR Critical)
								</label>
								<textarea
									value={dropLocationDesc()}
									onInput={(e) => setDropLocationDesc(e.currentTarget.value)}
									placeholder="e.g. Mile 42 near creek crossing, walking towards Twin Lakes with pacer"
									class="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm h-20"
									required
								/>
							</div>
						</Show>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setDropModalOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant={dropKind() === "retired" ? "destructive" : "forest"}
								disabled={isSubmittingDrop()}
							>
								{isSubmittingDrop() ? "Recording..." : "Confirm Drop"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* MT63 Digital Ham Radio Export Modal */}
			<Dialog open={mt63ModalOpen()} onOpenChange={setMt63ModalOpen}>
				<DialogContent class="max-w-lg">
					<DialogHeader>
						<DialogTitle>MT63 Amateur Radio Block Export</DialogTitle>
						<DialogDescription>
							Standard acoustic text bursts formatted for digital packet relay over VHF/UHF radio:
							<br />
							<code class="text-[11px] font-mono text-foreground font-bold">
								&lt;STATION&gt; &lt;BIB&gt; &lt;IN|OUT|POINT&gt; &lt;HH:MM:SS&gt; [P]
							</code>
						</DialogDescription>
					</DialogHeader>

					<div class="space-y-3 py-2">
						<textarea
							readonly
							value={mt63Text() || "# No recent punches in local buffer"}
							class="w-full h-48 rounded-xl border border-input bg-muted/40 p-3 text-xs font-mono select-all leading-relaxed"
						/>

						<div class="flex items-center justify-between">
							<span class="text-xs text-muted-foreground font-mono">
								{recentPunches().length} punch lines
							</span>

							<Button
								type="button"
								variant="forest"
								size="sm"
								class="gap-1.5"
								onClick={handleCopyMt63}
							>
								<span>📋</span>
								<span>{copiedNotice() ? "Copied to Clipboard!" : "Copy MT63 Block"}</span>
							</Button>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setMt63ModalOpen(false)}
						>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
