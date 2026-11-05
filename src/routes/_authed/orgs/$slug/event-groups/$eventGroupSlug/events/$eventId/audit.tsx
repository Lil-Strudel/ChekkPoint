import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import {
	certifyOfficialResultsFn,
	confirmScoredSplitFn,
	createTimeAllowanceFn,
	deleteScoredSplitFn,
	deleteTimeAllowanceFn,
	editScoredSplitFn,
	establishDropsFn,
	exportResultsFn,
	getForensicWorkstation,
	insertScoredSplitFn,
	reassignRawTimingEventFn,
	rebuildSplitsFn,
} from "~/audit/audit.functions";

export const Route = createFileRoute(
	"/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/audit",
)({
	loader: ({ params }) =>
		getForensicWorkstation({
			data: {
				slug: params.slug,
				eventGroupSlug: params.eventGroupSlug,
				eventId: params.eventId,
			},
		}),
	component: ForensicAuditPage,
});

function ForensicAuditPage() {
	const initialData = Route.useLoaderData();
	const params = Route.useParams();
	const navigate = useNavigate();

	const [data, setData] = createSignal(initialData());
	const [activeTab, setActiveTab] = createSignal<"forensic" | "closeout">("forensic");
	const [selectedEntrantId, setSelectedEntrantId] = createSignal<string>(
		initialData().selectedEntrant?.id ?? "",
	);
	const [inspectorView, setInspectorView] = createSignal<
		"splits" | "raw" | "allowances" | "audit"
	>("splits");

	// Search & Queue Filter
	const [searchQuery, setSearchQuery] = createSignal("");
	const [queueFilter, setQueueFilter] = createSignal<
		"all" | "bad_split" | "questionable_split" | "flagged_discrepancy" | "unaccounted_drop"
	>("all");

	// Modals State
	const [isEditSplitOpen, setIsEditSplitOpen] = createSignal(false);
	const [editingSplit, setEditingSplit] = createSignal<any>(null);
	const [editElapsedSeconds, setEditElapsedSeconds] = createSignal("");
	const [editDataStatus, setEditDataStatus] = createSignal("valid");
	const [editChangeReason, setEditChangeReason] = createSignal("");

	const [isInsertSplitOpen, setIsInsertSplitOpen] = createSignal(false);
	const [insertCourseSplitId, setInsertCourseSplitId] = createSignal("");
	const [insertSubSplitKind, setInsertSubSplitKind] = createSignal<"in" | "out" | "point">("point");
	const [insertElapsedSeconds, setInsertElapsedSeconds] = createSignal("");
	const [insertTimeOfDay, setInsertTimeOfDay] = createSignal("");
	const [insertChangeReason, setInsertChangeReason] = createSignal("");

	const [isGrantAllowanceOpen, setIsGrantAllowanceOpen] = createSignal(false);
	const [allowanceSplitId, setAllowanceSplitId] = createSignal("");
	const [allowanceReason, setAllowanceReason] = createSignal("medical_hold");
	const [allowanceDurationSeconds, setAllowanceDurationSeconds] = createSignal("2700");
	const [allowanceNotes, setAllowanceNotes] = createSignal("");

	const [isRebuildOpen, setIsRebuildOpen] = createSignal(false);
	const [rebuildScope, setRebuildScope] = createSignal<"runner" | "event">("runner");
	const [rebuildChangeReason, setRebuildChangeReason] = createSignal("");

	const [actionError, setActionError] = createSignal<string | null>(null);
	const [isSubmitting, setIsSubmitting] = createSignal(false);

	// Refresh workstation data
	const refreshData = async (newSelectedId?: string) => {
		try {
			const res = await getForensicWorkstation({
				data: {
					slug: params().slug,
					eventGroupSlug: params().eventGroupSlug,
					eventId: params().eventId,
					selectedEntrantId: newSelectedId ?? selectedEntrantId(),
				},
			});
			setData(res);
			if (newSelectedId) {
				setSelectedEntrantId(newSelectedId);
			} else if (res.selectedEntrant?.id) {
				setSelectedEntrantId(res.selectedEntrant.id);
			}
		} catch (err: any) {
			console.error("Failed to refresh workstation data:", err);
		}
	};

	// Select runner
	const handleSelectRunner = async (entrantId: string) => {
		setSelectedEntrantId(entrantId);
		await refreshData(entrantId);
	};

	// Filtered problem queue
	const filteredQueue = () => {
		const q = searchQuery().trim().toLowerCase();
		const k = queueFilter();
		return data().problemQueue.filter((item) => {
			if (k !== "all" && !item.issues.some((i) => i.kind === k)) return false;
			if (q) {
				const hay = `${item.bibNumber} ${item.athleteName} ${item.division}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			return true;
		});
	};

	// All entrants for bib quick search
	const filteredRoster = () => {
		const q = searchQuery().trim().toLowerCase();
		if (!q) return [];
		return data().roster.filter((r) => {
			const hay = `${r.bibNumber} ${r.displayName} ${r.division}`.toLowerCase();
			return hay.includes(q);
		});
	};

	// --------------------------------------------------------------------------
	// ACTION HANDLERS
	// --------------------------------------------------------------------------

	const handleConfirmSplit = async (splitTimeId: string) => {
		try {
			setIsSubmitting(true);
			await confirmScoredSplitFn({
				data: {
					splitTimeId,
					changeReason: "Verified by timing steward on workstation",
				},
			});
			await refreshData();
		} catch (err: any) {
			setActionError(err.message || "Failed to confirm split");
		} finally {
			setIsSubmitting(false);
		}
	};

	const openEditSplitModal = (split: any) => {
		setEditingSplit(split);
		setEditElapsedSeconds(String(split.elapsedSeconds));
		setEditDataStatus(split.dataStatus);
		setEditChangeReason("");
		setActionError(null);
		setIsEditSplitOpen(true);
	};

	const handleSaveSplitEdit = async () => {
		const split = editingSplit();
		if (!split) return;
		if (!editChangeReason().trim() || editChangeReason().trim().length < 3) {
			setActionError("Change reason must be at least 3 characters");
			return;
		}

		try {
			setIsSubmitting(true);
			await editScoredSplitFn({
				data: {
					splitTimeId: split.id,
					elapsedSeconds: Number(editElapsedSeconds()),
					dataStatus: editDataStatus() as any,
					changeReason: editChangeReason().trim(),
				},
			});
			setIsEditSplitOpen(false);
			await refreshData();
		} catch (err: any) {
			setActionError(err.message || "Failed to edit split");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteSplit = async (splitTimeId: string) => {
		const reason = window.prompt("Mandatory change reason for deleting this split:");
		if (!reason || reason.trim().length < 3) {
			alert("Change reason must be at least 3 characters");
			return;
		}

		try {
			setIsSubmitting(true);
			await deleteScoredSplitFn({
				data: { splitTimeId, changeReason: reason.trim() },
			});
			await refreshData();
		} catch (err: any) {
			alert(err.message || "Failed to delete split");
		} finally {
			setIsSubmitting(false);
		}
	};

	const openInsertSplitModal = () => {
		setInsertCourseSplitId(data().courseSplits[0]?.id ?? "");
		setInsertSubSplitKind("point");
		setInsertElapsedSeconds("");
		setInsertTimeOfDay(new Date().toISOString());
		setInsertChangeReason("");
		setActionError(null);
		setIsInsertSplitOpen(true);
	};

	const handleSaveInsertSplit = async () => {
		const entrant = data().selectedEntrant;
		if (!entrant) return;
		if (!insertChangeReason().trim() || insertChangeReason().trim().length < 3) {
			setActionError("Change reason must be at least 3 characters");
			return;
		}

		try {
			setIsSubmitting(true);
			await insertScoredSplitFn({
				data: {
					entrantId: entrant.id,
					courseSplitId: insertCourseSplitId(),
					lap: 1,
					subSplitKind: insertSubSplitKind(),
					absoluteTimeUtc: insertTimeOfDay() || new Date().toISOString(),
					elapsedSeconds: Number(insertElapsedSeconds()) || 0,
					changeReason: insertChangeReason().trim(),
				},
			});
			setIsInsertSplitOpen(false);
			await refreshData();
		} catch (err: any) {
			setActionError(err.message || "Failed to insert split");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handlePromoteRawEvent = async (rawEventId: string) => {
		const reason = window.prompt(
			"Mandatory change reason for promoting raw event to matched:",
			"Alternate timing mat pulse verified",
		);
		if (!reason || reason.trim().length < 3) {
			alert("Change reason must be at least 3 characters");
			return;
		}

		try {
			setIsSubmitting(true);
			await reassignRawTimingEventFn({
				data: {
					eventId: params().eventId,
					rawEventId,
					promoteToMatched: true,
					changeReason: reason.trim(),
				},
			});
			await refreshData();
		} catch (err: any) {
			alert(err.message || "Failed to promote raw event");
		} finally {
			setIsSubmitting(false);
		}
	};

	const openGrantAllowanceModal = () => {
		setAllowanceSplitId(data().courseSplits[0]?.id ?? "");
		setAllowanceReason("medical_hold");
		setAllowanceDurationSeconds("2700");
		setAllowanceNotes("");
		setActionError(null);
		setIsGrantAllowanceOpen(true);
	};

	const handleSaveGrantAllowance = async () => {
		const entrant = data().selectedEntrant;
		if (!entrant) return;
		const dur = Number(allowanceDurationSeconds());
		if (dur <= 0) {
			setActionError("Duration must be greater than zero");
			return;
		}

		try {
			setIsSubmitting(true);
			const now = new Date();
			const start = new Date(now.getTime() - dur * 1000);

			await createTimeAllowanceFn({
				data: {
					entrantId: entrant.id,
					splitId: allowanceSplitId(),
					startTime: start.toISOString(),
					endTime: now.toISOString(),
					durationSeconds: dur,
					reason: allowanceReason(),
					notes: allowanceNotes() || undefined,
				},
			});
			setIsGrantAllowanceOpen(false);
			await refreshData();
		} catch (err: any) {
			setActionError(err.message || "Failed to grant time allowance");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteAllowance = async (allowanceId: string) => {
		if (!confirm("Are you sure you want to revoke this time allowance?")) return;
		try {
			setIsSubmitting(true);
			await deleteTimeAllowanceFn({ data: { allowanceId } });
			await refreshData();
		} catch (err: any) {
			alert(err.message || "Failed to revoke time allowance");
		} finally {
			setIsSubmitting(false);
		}
	};

	const openRebuildModal = (scope: "runner" | "event") => {
		setRebuildScope(scope);
		setRebuildChangeReason("");
		setActionError(null);
		setIsRebuildOpen(true);
	};

	const handleExecuteRebuild = async () => {
		if (!rebuildChangeReason().trim() || rebuildChangeReason().trim().length < 3) {
			setActionError("Change reason must be at least 3 characters");
			return;
		}

		try {
			setIsSubmitting(true);
			const scope = rebuildScope();
			const entrantId = scope === "runner" ? data().selectedEntrant?.id : undefined;

			await rebuildSplitsFn({
				data: {
					eventId: params().eventId,
					entrantId,
					changeReason: rebuildChangeReason().trim(),
				},
			});
			setIsRebuildOpen(false);
			await refreshData();
			alert("Splits successfully re-evaluated and projected from raw timing stream.");
		} catch (err: any) {
			setActionError(err.message || "Failed to rebuild splits");
		} finally {
			setIsSubmitting(false);
		}
	};

	// Post-race closeout sweeps & certification
	const handleEstablishDrops = async () => {
		if (
			!confirm(
				"Sweep remaining in-progress and unaccounted retired entrants to DNF status?",
			)
		) {
			return;
		}

		try {
			setIsSubmitting(true);
			const res = await establishDropsFn({
				data: { eventId: params().eventId, defaultStatus: "dnf" },
			});
			await refreshData();
			alert(`Successfully swept ${res.sweptCount} entrant(s) to DNF.`);
		} catch (err: any) {
			alert(err.message || "Failed to establish drops");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCertifyResults = async () => {
		if (
			!confirm(
				"Certify official results? This will lock all splits to confirmed, append race history, and update career intelligence rollups.",
			)
		) {
			return;
		}

		try {
			setIsSubmitting(true);
			await certifyOfficialResultsFn({
				data: { eventId: params().eventId },
			});
			await refreshData();
			alert("Official results certified! Race standings are locked.");
		} catch (err: any) {
			alert(err.message || "Failed to certify results");
		} finally {
			setIsSubmitting(false);
		}
	};

	// CSV Export trigger
	const handleExport = async (format: "ultrasignup" | "itra" | "standard") => {
		try {
			setIsSubmitting(true);
			const res = await exportResultsFn({
				data: { eventId: params().eventId, format },
			});

			const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.setAttribute("href", url);
			link.setAttribute("download", res.filename);
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} catch (err: any) {
			alert(err.message || "Failed to generate CSV export");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div class="flex flex-col gap-6 p-6">
			{/* Top Bar with Mode Switcher */}
			<div class="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
				<div class="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setActiveTab("forensic")}
						class={`px-4 py-2 text-xs font-semibold rounded-lg border ${
							activeTab() === "forensic"
								? "bg-forest text-white border-forest shadow-sm"
								: "bg-card text-muted-foreground border-border hover:text-foreground"
						}`}
					>
						🔍 Split-Pane Forensic Workstation
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("closeout")}
						class={`px-4 py-2 text-xs font-semibold rounded-lg border ${
							activeTab() === "closeout"
								? "bg-forest text-white border-forest shadow-sm"
								: "bg-card text-muted-foreground border-border hover:text-foreground"
						}`}
					>
						📋 Post-Race Closeout & Official Exports
					</button>
				</div>

				<div class="flex items-center gap-3 text-xs font-mono tabular-nums">
					<div class="flex items-center gap-1.5">
						<span class="text-muted-foreground">Problem Efforts:</span>
						<Badge
							variant={data().problemQueue.length > 0 ? "clay" : "forest"}
							class="text-[11px]"
						>
							{data().problemQueue.length}
						</Badge>
					</div>

					<div class="flex items-center gap-1.5">
						<span class="text-muted-foreground">Ready to Certify:</span>
						<Badge
							variant={data().readiness.readyToCertify ? "forest" : "outline"}
							class="text-[11px]"
						>
							{data().readiness.readyToCertify ? "YES" : "NO"}
						</Badge>
					</div>
				</div>
			</div>

			{/* ================================================================= */}
			{/* MODE 1: SPLIT-PANE FORENSIC WORKSTATION                           */}
			{/* ================================================================= */}
			<Show when={activeTab() === "forensic"}>
				<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
					{/* Left Pane: Problem Efforts & Discrepancies Queue */}
					<div class="lg:col-span-4 flex flex-col gap-4">
						<Card class="p-4 flex flex-col gap-3">
							<div class="flex items-center justify-between">
								<h3 class="text-sm font-bold text-foreground">
									Problem Efforts & Queue
								</h3>
								<span class="text-xs font-mono tabular-nums text-muted-foreground">
									{filteredQueue().length} of {data().problemQueue.length}
								</span>
							</div>

							<Input
								type="search"
								placeholder="Search bib # or name..."
								value={searchQuery()}
								onInput={(e) => setSearchQuery(e.currentTarget.value)}
								class="text-xs h-8"
							/>

							{/* Queue Filter Badges */}
							<div class="flex flex-wrap gap-1.5 text-[11px]">
								<button
									type="button"
									onClick={() => setQueueFilter("all")}
									class={`px-2 py-0.5 rounded border text-[10px] font-medium ${
										queueFilter() === "all"
											? "bg-foreground text-background border-foreground"
											: "bg-muted text-muted-foreground border-border hover:text-foreground"
									}`}
								>
									All ({data().problemQueue.length})
								</button>
								<button
									type="button"
									onClick={() => setQueueFilter("bad_split")}
									class={`px-2 py-0.5 rounded border text-[10px] font-medium ${
										queueFilter() === "bad_split"
											? "bg-clay text-white border-clay"
											: "bg-muted text-muted-foreground border-border hover:text-foreground"
									}`}
								>
									Bad ({data().readiness.badSplitsCount})
								</button>
								<button
									type="button"
									onClick={() => setQueueFilter("questionable_split")}
									class={`px-2 py-0.5 rounded border text-[10px] font-medium ${
										queueFilter() === "questionable_split"
											? "bg-amber-600 text-white border-amber-600"
											: "bg-muted text-muted-foreground border-border hover:text-foreground"
									}`}
								>
									Questionable ({data().readiness.questionableSplitsCount})
								</button>
								<button
									type="button"
									onClick={() => setQueueFilter("flagged_discrepancy")}
									class={`px-2 py-0.5 rounded border text-[10px] font-medium ${
										queueFilter() === "flagged_discrepancy"
											? "bg-purple-700 text-white border-purple-700"
											: "bg-muted text-muted-foreground border-border hover:text-foreground"
									}`}
								>
									Discrepancy
								</button>
								<button
									type="button"
									onClick={() => setQueueFilter("unaccounted_drop")}
									class={`px-2 py-0.5 rounded border text-[10px] font-medium ${
										queueFilter() === "unaccounted_drop"
											? "bg-red-700 text-white border-red-700"
											: "bg-muted text-muted-foreground border-border hover:text-foreground"
									}`}
								>
									Unaccounted ({data().readiness.unaccountedRetiredCount})
								</button>
							</div>

							{/* Search Roster Dropdown if Searching */}
							<Show when={searchQuery().trim() && filteredRoster().length > 0}>
								<div class="border border-border rounded-lg p-2 bg-muted/40 max-h-36 overflow-y-auto">
									<div class="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
										Quick Inspect Any Competitor:
									</div>
									<For each={filteredRoster()}>
										{(r) => (
											<button
												type="button"
												onClick={() => handleSelectRunner(r.id)}
												class="w-full text-left px-2 py-1 text-xs rounded hover:bg-forest/10 flex items-center justify-between"
											>
												<span class="font-mono font-bold tabular-nums">
													#{r.bibNumber} {r.displayName}
												</span>
												<Badge variant="outline" class="text-[9px]">
													{r.status}
												</Badge>
											</button>
										)}
									</For>
								</div>
							</Show>

							{/* Problem Efforts List */}
							<div class="flex flex-col gap-2 max-h-[620px] overflow-y-auto pr-1">
								<Show
									when={filteredQueue().length > 0}
									fallback={
										<div class="p-6 text-center text-xs text-muted-foreground">
											No problem efforts matching the selected filter.
										</div>
									}
								>
									<For each={filteredQueue()}>
										{(item) => {
											const isSelected = item.entrantId === selectedEntrantId();
											return (
												<button
													type="button"
													onClick={() => handleSelectRunner(item.entrantId)}
													class={`w-full text-left p-3 rounded-lg border text-xs cursor-pointer ${
														isSelected
															? "border-forest bg-forest/10 ring-1 ring-forest"
															: "border-border bg-card/40 hover:bg-card hover:border-foreground/40"
													}`}
												>
													<div class="flex items-center justify-between mb-1.5">
														<div class="flex items-center gap-1.5 font-bold">
															<span class="font-mono text-forest tabular-nums">
																#{item.bibNumber}
															</span>
															<span class="text-foreground truncate max-w-[140px]">
																{item.athleteName}
															</span>
														</div>
														<Badge variant="outline" class="text-[9px]">
															{item.status}
														</Badge>
													</div>

													<div class="flex flex-wrap gap-1 mb-2">
														<For each={item.issues}>
															{(iss) => (
																<Badge
																	variant={
																		iss.kind === "bad_split"
																			? "clay"
																			: iss.kind === "questionable_split"
																				? "clay"
																				: "outline"
																	}
																	class="text-[9px] py-0 px-1"
																>
																	{iss.label}
																</Badge>
															)}
														</For>
													</div>

													<div class="flex items-center justify-between text-[11px] text-muted-foreground font-mono tabular-nums">
														<span>{item.lastSplitName}</span>
														<span>{item.lastElapsedFormatted}</span>
													</div>
												</button>
											);
										}}
									</For>
								</Show>
							</div>
						</Card>
					</div>

					{/* Right Pane: Selected Runner Split Timeline & Raw Event Inspector */}
					<div class="lg:col-span-8 flex flex-col gap-4">
						<Show
							when={data().selectedEntrant}
							fallback={
								<Card class="p-12 text-center text-muted-foreground">
									Select a competitor from the queue on the left to inspect splits
									and raw timing telemetry.
								</Card>
							}
						>
							{/* Competitor Hero Bar */}
							<Card class="p-4 flex flex-wrap items-center justify-between gap-4 bg-card/60">
								<div>
									<div class="flex items-center gap-2 mb-1">
										<span class="text-xl font-bold font-mono text-forest tabular-nums">
											#{data().selectedEntrant!.bibNumber}
										</span>
										<h2 class="text-lg font-bold text-foreground">
											{data().selectedEntrant!.displayName}
										</h2>
										<Badge variant="outline" class="text-xs">
											{data().selectedEntrant!.division}
										</Badge>
										<Badge variant="clay" class="text-xs">
											{data().selectedEntrant!.status}
										</Badge>
									</div>
									<div class="text-xs text-muted-foreground font-mono tabular-nums">
										Start Time: {data().selectedEntrant!.actualStartTime ?? "Scheduled Gun Start"}
									</div>
								</div>

								<div class="flex flex-wrap items-center gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={openInsertSplitModal}
										class="text-xs"
									>
										+ Insert Split
									</Button>
									<Button
										size="sm"
										variant="outline"
										onClick={openGrantAllowanceModal}
										class="text-xs"
									>
										+ Time Allowance
									</Button>
									<Button
										size="sm"
										variant="forest"
										onClick={() => openRebuildModal("runner")}
										class="text-xs font-semibold"
									>
										⚡ Rebuild Splits
									</Button>
								</div>
							</Card>

							{/* Inspector Sub-Tabs */}
							<div class="flex items-center gap-2 border-b border-border pb-1 text-xs font-semibold">
								<button
									type="button"
									onClick={() => setInspectorView("splits")}
									class={`px-3 py-1.5 rounded-t cursor-pointer ${
										inspectorView() === "splits"
											? "border-b-2 border-forest text-foreground font-bold"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Course Splits ({data().scoredSplits.length})
								</button>
								<button
									type="button"
									onClick={() => setInspectorView("raw")}
									class={`px-3 py-1.5 rounded-t cursor-pointer ${
										inspectorView() === "raw"
											? "border-b-2 border-forest text-foreground font-bold"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Raw Timing Pulses ({data().rawTimingEvents.length})
								</button>
								<button
									type="button"
									onClick={() => setInspectorView("allowances")}
									class={`px-3 py-1.5 rounded-t cursor-pointer ${
										inspectorView() === "allowances"
											? "border-b-2 border-forest text-foreground font-bold"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Time Allowances ({data().timeAllowances.length})
								</button>
								<button
									type="button"
									onClick={() => setInspectorView("audit")}
									class={`px-3 py-1.5 rounded-t cursor-pointer ${
										inspectorView() === "audit"
											? "border-b-2 border-forest text-foreground font-bold"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Audit Ledger ({data().auditLog.length})
								</button>
							</div>

							{/* SUB-VIEW 1: COURSE SPLITS */}
							<Show when={inspectorView() === "splits"}>
								<Card class="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead class="w-12">Seq</TableHead>
												<TableHead>Station / Split</TableHead>
												<TableHead>Time of Day</TableHead>
												<TableHead>Elapsed</TableHead>
												<TableHead>Pace</TableHead>
												<TableHead>Dwell</TableHead>
												<TableHead>Status</TableHead>
												<TableHead class="text-right">Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											<For each={data().scoredSplits}>
												{(sp) => (
													<TableRow>
														<TableCell class="font-mono tabular-nums text-muted-foreground">
															{sp.sequenceOrder}
														</TableCell>
														<TableCell class="font-bold text-foreground">
															<div>{sp.splitName}</div>
															<div class="text-[10px] font-mono text-muted-foreground">
																{sp.subSplitKind.toUpperCase()} · Lap {sp.lap}
															</div>
														</TableCell>
														<TableCell class="font-mono tabular-nums text-xs">
															{sp.timeOfDayFormatted}
														</TableCell>
														<TableCell class="font-mono font-bold tabular-nums">
															{sp.elapsedFormatted}
														</TableCell>
														<TableCell class="font-mono tabular-nums text-xs">
															{sp.paceFormatted}
														</TableCell>
														<TableCell class="font-mono tabular-nums text-xs">
															{sp.dwellFormatted}
														</TableCell>
														<TableCell>
															<Badge
																variant={
																	sp.dataStatus === "confirmed"
																		? "forest"
																		: sp.dataStatus === "bad"
																			? "clay"
																			: sp.dataStatus === "questionable"
																				? "clay"
																				: "outline"
																}
																class="text-[10px]"
															>
																{sp.dataStatus}
															</Badge>
														</TableCell>
														<TableCell class="text-right">
															<div class="flex items-center justify-end gap-1.5">
																<Show when={sp.dataStatus !== "confirmed"}>
																	<Button
																		size="sm"
																		variant="forest"
																		onClick={() => handleConfirmSplit(sp.id)}
																		class="h-7 px-2 text-[11px]"
																	>
																		Confirm
																	</Button>
																</Show>
																<Button
																	size="sm"
																	variant="outline"
																	onClick={() => openEditSplitModal(sp)}
																	class="h-7 px-2 text-[11px]"
																>
																	Edit
																</Button>
																<Button
																	size="sm"
																	variant="destructive"
																	onClick={() => handleDeleteSplit(sp.id)}
																	class="h-7 px-2 text-[11px]"
																>
																	Delete
																</Button>
															</div>
														</TableCell>
													</TableRow>
												)}
											</For>
										</TableBody>
									</Table>
								</Card>
							</Show>

							{/* SUB-VIEW 2: RAW TIMING PULSES */}
							<Show when={inspectorView() === "raw"}>
								<Card class="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Point Code</TableHead>
												<TableHead>Kind</TableHead>
												<TableHead>Recorded UTC</TableHead>
												<TableHead>Source / Device</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Audit Note</TableHead>
												<TableHead class="text-right">Action</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											<For each={data().rawTimingEvents}>
												{(raw) => (
													<TableRow>
														<TableCell class="font-mono font-bold text-forest">
															{raw.timingPointCode}
														</TableCell>
														<TableCell class="font-mono uppercase text-xs">
															{raw.subSplitKind}
														</TableCell>
														<TableCell class="font-mono tabular-nums text-xs">
															{raw.recordedTimeUtc.replace("T", " ").substring(0, 19)}
														</TableCell>
														<TableCell class="text-xs text-muted-foreground">
															{raw.source} ({raw.sourceDeviceId || "direct"})
														</TableCell>
														<TableCell>
															<Badge
																variant={
																	raw.status === "matched"
																		? "forest"
																		: raw.status === "flagged_discrepancy"
																			? "clay"
																			: "outline"
																}
																class="text-[10px]"
															>
																{raw.status}
															</Badge>
														</TableCell>
														<TableCell class="text-xs text-muted-foreground truncate max-w-[150px]">
															{raw.auditNote || "—"}
														</TableCell>
														<TableCell class="text-right">
															<Show when={raw.status !== "matched"}>
																<Button
																	size="sm"
																	variant="outline"
																	onClick={() => handlePromoteRawEvent(raw.id)}
																	class="h-7 px-2 text-[11px]"
																>
																	Promote to Matched
																</Button>
															</Show>
														</TableCell>
													</TableRow>
												)}
											</For>
										</TableBody>
									</Table>
								</Card>
							</Show>

							{/* SUB-VIEW 3: TIME ALLOWANCES */}
							<Show when={inspectorView() === "allowances"}>
								<Card class="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Checkpoint</TableHead>
												<TableHead>Reason</TableHead>
												<TableHead>Duration</TableHead>
												<TableHead>Authorized By</TableHead>
												<TableHead>Notes</TableHead>
												<TableHead class="text-right">Action</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											<For each={data().timeAllowances}>
												{(al) => (
													<TableRow>
														<TableCell class="font-bold">{al.splitName}</TableCell>
														<TableCell>
															<Badge variant="outline" class="text-xs">
																{al.reason}
															</Badge>
														</TableCell>
														<TableCell class="font-mono font-bold tabular-nums text-forest">
															+{Math.floor(al.durationSeconds / 60)}m{" "}
															{al.durationSeconds % 60}s
														</TableCell>
														<TableCell class="text-xs">{al.authorizedByName}</TableCell>
														<TableCell class="text-xs text-muted-foreground">
															{al.notes || "—"}
														</TableCell>
														<TableCell class="text-right">
															<Button
																size="sm"
																variant="destructive"
																onClick={() => handleDeleteAllowance(al.id)}
																class="h-7 px-2 text-[11px]"
															>
																Revoke
															</Button>
														</TableCell>
													</TableRow>
												)}
											</For>
										</TableBody>
									</Table>
								</Card>
							</Show>

							{/* SUB-VIEW 4: AUDIT LEDGER */}
							<Show when={inspectorView() === "audit"}>
								<Card class="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Action</TableHead>
												<TableHead>Changed By</TableHead>
												<TableHead>Reason</TableHead>
												<TableHead class="text-right">Timestamp</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											<For each={data().auditLog}>
												{(au) => (
													<TableRow>
														<TableCell>
															<Badge
																variant={
																	au.action === "CONFIRMED"
																		? "forest"
																		: au.action === "REBUILT"
																			? "clay"
																			: "outline"
																}
																class="text-[10px] font-mono"
															>
																{au.action}
															</Badge>
														</TableCell>
														<TableCell class="font-medium text-xs">
															{au.changedByName}
														</TableCell>
														<TableCell class="text-xs text-foreground font-semibold">
															{au.changeReason}
														</TableCell>
														<TableCell class="text-right font-mono tabular-nums text-xs text-muted-foreground">
															{au.createdAt.replace("T", " ").substring(0, 19)}
														</TableCell>
													</TableRow>
												)}
											</For>
										</TableBody>
									</Table>
								</Card>
							</Show>
						</Show>
					</div>
				</div>
			</Show>

			{/* ================================================================= */}
			{/* MODE 2: POST-RACE CLOSEOUT & OFFICIAL EXPORTS                     */}
			{/* ================================================================= */}
			<Show when={activeTab() === "closeout"}>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
					{/* Card 1: Readiness Checklist */}
					<Card class="p-6 flex flex-col gap-4 border-forest/30">
						<h3 class="text-base font-bold text-foreground">
							1. Closeout Readiness Checklist
						</h3>
						<p class="text-xs text-muted-foreground">
							Verifies all competitors are safely off the course and split
							anomalies are resolved before certification.
						</p>

						<div class="flex flex-col gap-2.5 text-xs font-mono tabular-nums">
							<div class="flex items-center justify-between p-2 rounded bg-muted/40">
								<span>In-Progress on Course:</span>
								<Badge
									variant={data().readiness.inProgressCount === 0 ? "forest" : "clay"}
								>
									{data().readiness.inProgressCount}
								</Badge>
							</div>

							<div class="flex items-center justify-between p-2 rounded bg-muted/40">
								<span>Bad / Questionable Splits:</span>
								<Badge
									variant={data().readiness.problemSplitsCount === 0 ? "forest" : "clay"}
								>
									{data().readiness.problemSplitsCount}
								</Badge>
							</div>

							<div class="flex items-center justify-between p-2 rounded bg-muted/40">
								<span>Unaccounted Retired Entrants:</span>
								<Badge
									variant={
										data().readiness.unaccountedRetiredCount === 0
											? "forest"
											: "clay"
									}
								>
									{data().readiness.unaccountedRetiredCount}
								</Badge>
							</div>

							<div class="flex items-center justify-between p-2 rounded bg-muted/40">
								<span>Official Finishers:</span>
								<span class="font-bold text-foreground">
									{data().readiness.finishersCount}
								</span>
							</div>

							<div class="flex items-center justify-between p-2 rounded bg-muted/40">
								<span>Total DNF Drops:</span>
								<span class="font-bold text-foreground">
									{data().readiness.dnfCount}
								</span>
							</div>
						</div>
					</Card>

					{/* Card 2: 1-Click Operations */}
					<Card class="p-6 flex flex-col gap-4 border-forest/30">
						<h3 class="text-base font-bold text-foreground">
							2. Sweep Drops & Certification
						</h3>
						<p class="text-xs text-muted-foreground">
							Sweep remaining active runners to DNF status and seal official
							results into athlete career histories.
						</p>

						<div class="flex flex-col gap-3 mt-auto">
							<Button
								variant="outline"
								onClick={handleEstablishDrops}
								disabled={isSubmitting()}
								class="text-xs font-semibold w-full"
							>
								Sweep In-Progress & Retired to DNF
							</Button>

							<Button
								variant="forest"
								onClick={handleCertifyResults}
								disabled={isSubmitting() || !data().readiness.readyToCertify}
								class="text-xs font-semibold w-full"
							>
								Certify Official Results
							</Button>

							<Button
								variant="outline"
								onClick={() => openRebuildModal("event")}
								disabled={isSubmitting()}
								class="text-xs font-semibold w-full"
							>
								⚡ Rebuild Entire Sub-Event Splits
							</Button>
						</div>
					</Card>

					{/* Card 3: Multi-Format CSV Exports */}
					<Card class="p-6 flex flex-col gap-4 border-forest/30">
						<h3 class="text-base font-bold text-foreground">
							3. Multi-Format RFC 4180 Exports
						</h3>
						<p class="text-xs text-muted-foreground">
							Download compliant official results packages ready for federation
							submission and publishing.
						</p>

						<div class="flex flex-col gap-3 mt-auto">
							<Button
								variant="outline"
								onClick={() => handleExport("ultrasignup")}
								disabled={isSubmitting()}
								class="text-xs font-semibold w-full flex items-center justify-between"
							>
								<span>UltraSignup CSV</span>
								<span class="text-muted-foreground">↓</span>
							</Button>

							<Button
								variant="outline"
								onClick={() => handleExport("itra")}
								disabled={isSubmitting()}
								class="text-xs font-semibold w-full flex items-center justify-between"
							>
								<span>ITRA / UTMB CSV</span>
								<span class="text-muted-foreground">↓</span>
							</Button>

							<Button
								variant="outline"
								onClick={() => handleExport("standard")}
								disabled={isSubmitting()}
								class="text-xs font-semibold w-full flex items-center justify-between"
							>
								<span>Standard ChekkPoint CSV</span>
								<span class="text-muted-foreground">↓</span>
							</Button>
						</div>
					</Card>
				</div>
			</Show>

			{/* ================================================================= */}
			{/* MODALS & DIALOGS                                                  */}
			{/* ================================================================= */}

			{/* 1. Edit Scored Split Modal */}
			<Dialog open={isEditSplitOpen()} onOpenChange={setIsEditSplitOpen}>
				<DialogContent class="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Edit Scored Split</DialogTitle>
						<DialogDescription>
							Modify split duration or verification status. A mandatory change
							reason will be written to the immutable audit ledger.
						</DialogDescription>
					</DialogHeader>

					<div class="flex flex-col gap-3 py-2 text-xs">
						<Show when={actionError()}>
							<div class="p-2 rounded bg-clay/20 text-clay font-medium text-xs">
								{actionError()}
							</div>
						</Show>

						<div class="flex flex-col gap-1">
							<label class="font-medium text-foreground">Elapsed Seconds</label>
							<Input
								type="number"
								value={editElapsedSeconds()}
								onInput={(e) => setEditElapsedSeconds(e.currentTarget.value)}
								class="text-xs font-mono"
							/>
						</div>

						<div class="flex flex-col gap-1">
							<label class="font-medium text-foreground">Data Status</label>
							<select
								value={editDataStatus()}
								onChange={(e) => setEditDataStatus(e.currentTarget.value)}
								class="h-9 px-3 text-xs rounded-md border border-input bg-background"
							>
								<option value="valid">Valid</option>
								<option value="confirmed">Confirmed</option>
								<option value="questionable">Questionable</option>
								<option value="bad">Bad</option>
								<option value="provisional">Provisional</option>
							</select>
						</div>

						<div class="flex flex-col gap-1">
							<label class="font-medium text-foreground">
								Mandatory Change Reason *
							</label>
							<Input
								type="text"
								placeholder="e.g. Verified with backup chute log"
								value={editChangeReason()}
								onInput={(e) => setEditChangeReason(e.currentTarget.value)}
								class="text-xs"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsEditSplitOpen(false)}
							class="text-xs"
						>
							Cancel
						</Button>
						<Button
							variant="forest"
							onClick={handleSaveSplitEdit}
							disabled={isSubmitting()}
							class="text-xs font-semibold"
						>
							Save & Audit
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* 2. Insert Manual Split Modal */}
			<Dialog open={isInsertSplitOpen()} onOpenChange={setIsInsertSplitOpen}>
				<DialogContent class="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Insert Manual Split</DialogTitle>
						<DialogDescription>
							Manually insert a recorded checkpoint split for this competitor.
						</DialogDescription>
					</DialogHeader>

					<div class="flex flex-col gap-3 py-2 text-xs">
						<Show when={actionError()}>
							<div class="p-2 rounded bg-clay/20 text-clay font-medium text-xs">
								{actionError()}
							</div>
						</Show>

						<div class="flex flex-col gap-1">
							<label class="font-medium text-foreground">Course Checkpoint</label>
							<select
								value={insertCourseSplitId()}
								onChange={(e) => setInsertCourseSplitId(e.currentTarget.value)}
								class="h-9 px-3 text-xs rounded-md border border-input bg-background"
							>
								<For each={data().courseSplits}>
									{(cs) => <option value={cs.id}>{cs.name}</option>}
								</For>
							</select>
						</div>

						<div class="flex flex-col gap-1">
							<label class="font-medium text-foreground">Sub Split Kind</label>
							<select
								value={insertSubSplitKind()}
								onChange={(e) => setInsertSubSplitKind(e.currentTarget.value as any)}
								class="h-9 px-3 text-xs rounded-md border border-input bg-background"
							>
								<option value="point">POINT</option>
								<option value="in">IN (Arrival)</option>
								<option value="out">OUT (Departure)</option>
							</select>
						</div>

						<div class="flex flex-col gap-1">
							<label class="font-medium text-foreground">Elapsed Seconds</label>
							<Input
								type="number"
								placeholder="e.g. 5400"
								value={insertElapsedSeconds()}
								onInput={(e) => setInsertElapsedSeconds(e.currentTarget.value)}
								class="text-xs font-mono"
							/>
						</div>

						<div class="flex flex-col gap-1">
							<label class="font-medium text-foreground">
								Mandatory Change Reason *
							</label>
							<Input
								type="text"
								placeholder="e.g. Transcribed from paper volunteer chute sheet"
								value={insertChangeReason()}
								onInput={(e) => setInsertChangeReason(e.currentTarget.value)}
								class="text-xs"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsInsertSplitOpen(false)}
							class="text-xs"
						>
							Cancel
						</Button>
						<Button
							variant="forest"
							onClick={handleSaveInsertSplit}
							disabled={isSubmitting()}
							class="text-xs font-semibold"
						>
							Insert Split
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* 3. Grant Time Allowance Modal */}
			<Dialog open={isGrantAllowanceOpen()} onOpenChange={setIsGrantAllowanceOpen}>
				<DialogContent class="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Grant Time Allowance</DialogTitle>
						<DialogDescription>
							Credit net elapsed time and extend aid station cutoffs for
							authorized holds.
						</DialogDescription>
					</DialogHeader>

					<div class="flex flex-col gap-3 py-2 text-xs">
						<Show when={actionError()}>
							<div class="p-2 rounded bg-clay/20 text-clay font-medium text-xs">
								{actionError()}
							</div>
						</Show>

						<div class="flex flex-col gap-1">
							<label class="font-medium text-foreground">Checkpoint Station</label>
							<select
								value={allowanceSplitId()}
								onChange={(e) => setAllowanceSplitId(e.currentTarget.value)}
								class="h-9 px-3 text-xs rounded-md border border-input bg-background"
							>
								<For each={data().courseSplits}>
									{(cs) => <option value={cs.id}>{cs.name}</option>}
								</For>
							</select>
						</div>

						<div class="flex flex-col gap-1">
							<label class="font-medium text-foreground">Hold Reason</label>
							<select
								value={allowanceReason()}
								onChange={(e) => setAllowanceReason(e.currentTarget.value)}
								class="h-9 px-3 text-xs rounded-md border border-input bg-background"
							>
								<option value="medical_hold">Medical Evaluation Hold</option>
								<option value="hazard_hold">Severe Weather / Trail Hazard Hold</option>
								<option value="gear_check">Mandatory Gear Inspection Hold</option>
							</select>
						</div>

						<div class="flex flex-col gap-1">
							<label class="font-medium text-foreground">Duration (Seconds)</label>
							<Input
								type="number"
								value={allowanceDurationSeconds()}
								onInput={(e) => setAllowanceDurationSeconds(e.currentTarget.value)}
								class="text-xs font-mono"
							/>
						</div>

						<div class="flex flex-col gap-1">
							<label class="font-medium text-foreground">Operational Notes</label>
							<Input
								type="text"
								placeholder="e.g. Physician approved 45-min hydration hold"
								value={allowanceNotes()}
								onInput={(e) => setAllowanceNotes(e.currentTarget.value)}
								class="text-xs"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsGrantAllowanceOpen(false)}
							class="text-xs"
						>
							Cancel
						</Button>
						<Button
							variant="forest"
							onClick={handleSaveGrantAllowance}
							disabled={isSubmitting()}
							class="text-xs font-semibold"
						>
							Grant Allowance
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* 4. Rebuild Splits Confirmation Modal */}
			<Dialog open={isRebuildOpen()} onOpenChange={setIsRebuildOpen}>
				<DialogContent class="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{rebuildScope() === "runner"
								? `Rebuild Splits: #${data().selectedEntrant?.bibNumber}`
								: "Rebuild Entire Sub-Event Splits"}
						</DialogTitle>
						<DialogDescription>
							Replays all raw timing pulses in chronological order to
							deterministically recalculate elapsed times, paces, and dwell
							metrics.
						</DialogDescription>
					</DialogHeader>

					<div class="flex flex-col gap-3 py-2 text-xs">
						<Show when={actionError()}>
							<div class="p-2 rounded bg-clay/20 text-clay font-medium text-xs">
								{actionError()}
							</div>
						</Show>

						<div class="flex flex-col gap-1">
							<label class="font-medium text-foreground">
								Mandatory Rebuild Reason *
							</label>
							<Input
								type="text"
								placeholder="e.g. Replaying raw timing stream post RFID clock sync"
								value={rebuildChangeReason()}
								onInput={(e) => setRebuildChangeReason(e.currentTarget.value)}
								class="text-xs"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsRebuildOpen(false)}
							class="text-xs"
						>
							Cancel
						</Button>
						<Button
							variant="forest"
							onClick={handleExecuteRebuild}
							disabled={isSubmitting()}
							class="text-xs font-semibold"
						>
							Execute Deterministic Rebuild
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
