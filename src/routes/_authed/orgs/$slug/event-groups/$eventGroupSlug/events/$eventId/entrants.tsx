import { createFileRoute, useRouter } from "@tanstack/solid-router";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Switch, SwitchControl } from "~/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { uploadEntrants } from "~/entrants/entrants.functions";
import { importRowInput, type ImportRow } from "~/entrants/entrants.shared";
import { csvRecords } from "~/lib/csv";
import {
	checkInEntrantFn,
	editEntrantWorkspaceFn,
	getSubEventEntrants,
	recalculateProjectionFn,
	startGunFn,
	verifyExternalProfileFn,
} from "~/race-control/race-control.functions";
import type { ParticipantData } from "~/race-control/race-control.shared";

export const Route = createFileRoute(
	"/_authed/orgs/$slug/event-groups/$eventGroupSlug/events/$eventId/entrants",
)({
	loader: ({ params }) =>
		getSubEventEntrants({
			data: {
				slug: params.slug,
				eventGroupSlug: params.eventGroupSlug,
				eventId: params.eventId,
			},
		}),
	component: SubEventEntrantsCheckInTab,
});

function formatDurationSeconds(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const STATUS_VARIANTS: Record<string, "forest" | "clay" | "sage" | "outline" | "secondary"> = {
	registered: "secondary",
	checked_in: "forest",
	in_progress: "clay",
	finished: "forest",
	dnf: "outline",
	dns: "outline",
	retired: "outline",
};

const TIER_VARIANTS: Record<string, "forest" | "clay" | "sage" | "outline"> = {
	novice: "outline",
	intermediate: "sage",
	veteran: "forest",
	elite: "clay",
};

function orNull(value: string | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

type Preview = { line: number; row: ImportRow | null; errors: string[] };

function previewRows(text: string): Preview[] {
	if (!text.trim()) return [];
	const records = csvRecords(text);
	const bibs = records.map((r) => r.bib?.trim());
	return records.map((r, i) => {
		const result = importRowInput.safeParse({
			competitorNumber: r.bib ?? "",
			person: {
				firstName: r.first_name ?? "",
				lastName: r.last_name ?? "",
				email: orNull(r.email),
				gender: orNull(r.gender),
				birthdate: orNull(r.birthdate),
				phone: orNull(r.phone),
			},
			division: r.division || "Open",
			rfidCode: orNull(r.rfid),
			emergencyContact: r.emergency_name
				? {
						name: r.emergency_name,
						phone: orNull(r.emergency_phone),
						relationship: orNull(r.emergency_relationship),
						isOnSite: false,
					}
				: null,
		});
		const errors = result.success
			? []
			: result.error.issues.map(
					(issue) => `${issue.path.join(".")}: ${issue.message}`,
				);
		if (bibs[i] && bibs.indexOf(bibs[i]) !== i) {
			errors.push(`Bib ${bibs[i]} appears earlier in the file.`);
		}
		return {
			line: i + 2,
			row: result.success ? result.data : null,
			errors,
		};
	});
}

function SubEventEntrantsCheckInTab() {
	const data = Route.useLoaderData();
	const params = Route.useParams();
	const router = useRouter();

	const event = () => data().event;
	const siblingEvents = () => data().siblingEvents;
	const entrants = () => data().entrants;
	const access = () => data().access;

	// Mode Switcher state: "roster" vs "checkin"
	const [activeMode, setActiveMode] = createSignal<"roster" | "checkin">("roster");

	// Search & filter state
	const [searchQuery, setSearchQuery] = createSignal("");
	const [statusFilter, setStatusFilter] = createSignal<string>("all");
	const [divisionFilter, setDivisionFilter] = createSignal<string>("all");

	// Bulk CSV Import Modal state
	const [isCsvModalOpen, setIsCsvModalOpen] = createSignal(false);
	const [csvText, setCsvText] = createSignal("");
	const [isUploadingCsv, setIsUploadingCsv] = createSignal(false);
	const [csvUploadError, setCsvUploadError] = createSignal<string | null>(null);

	const parsedCsv = createMemo(() => previewRows(csvText()));
	const validCsvRows = () => parsedCsv().flatMap((p) => (p.row ? [p.row] : []));
	const invalidCsvRows = () => parsedCsv().filter((p) => p.errors.length > 0);

	const handleUploadCsv = async () => {
		setCsvUploadError(null);
		const rows = validCsvRows();
		if (rows.length === 0 || invalidCsvRows().length > 0) return;

		setIsUploadingCsv(true);
		try {
			await uploadEntrants({
				data: {
					eventId: subEvent().id,
					rows,
				},
			});
			await router.invalidate();
			setIsCsvModalOpen(false);
			setCsvText("");
		} catch (err: any) {
			setCsvUploadError(err?.message ?? "Failed to upload entrants.");
		} finally {
			setIsUploadingCsv(false);
		}
	};

	// Unique divisions
	const divisions = () => Array.from(new Set(entrants().map((e) => e.division)));

	// Filtered entrants list
	const filteredEntrants = () => {
		const q = searchQuery().trim().toLowerCase();
		return entrants().filter((e) => {
			if (statusFilter() !== "all" && e.status !== statusFilter()) return false;
			if (divisionFilter() !== "all" && e.division !== divisionFilter()) return false;
			if (!q) return true;

			const numMatch = e.competitorNumber.toLowerCase().includes(q);
			const rfidMatch = e.rfidCode?.toLowerCase().includes(q) ?? false;
			const nameMatch = `${e.person.firstName} ${e.person.lastName}`.toLowerCase().includes(q);
			return numMatch || rfidMatch || nameMatch;
		});
	};

	// Custody stats for check-in desk
	const checkInStats = () => {
		const total = entrants().length;
		const checkedIn = entrants().filter((e) => e.status === "checked_in" || e.status === "in_progress").length;
		const dns = entrants().filter((e) => e.status === "dns").length;
		const remaining = total - checkedIn - dns;
		const pct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
		return { total, checkedIn, dns, remaining, pct };
	};

	// =========================================================================
	// COMPACT 3-SECTION EDIT ENTRANT MODAL DIALOG STATE
	// =========================================================================

	type EntrantItem = ReturnType<typeof entrants>[number];
	const [editingEntrant, setEditingEntrant] = createSignal<EntrantItem | null>(null);

	// Section 1: Competitor & Division
	const [editTargetEventId, setEditTargetEventId] = createSignal("");
	const [editBib, setEditBib] = createSignal("");
	const [editRfid, setEditRfid] = createSignal("");
	const [editDivision, setEditDivision] = createSignal("");
	const [editSchedStart, setEditSchedStart] = createSignal("");
	const [editActualStart, setEditActualStart] = createSignal("");
	const [editParticipantKind, setEditParticipantKind] = createSignal<
		"solo_competitor" | "vehicle_crew" | "relay_team"
	>("solo_competitor");
	const [editMedicalNotes, setEditMedicalNotes] = createSignal("");
	const [editPacerName, setEditPacerName] = createSignal("");
	const [editTShirtSize, setEditTShirtSize] = createSignal("");
	// Vehicle Crew fields
	const [editDriverName, setEditDriverName] = createSignal("");
	const [editDriverLicense, setEditDriverLicense] = createSignal("");
	const [editVehicleMake, setEditVehicleMake] = createSignal("");
	const [editVehicleModel, setEditVehicleModel] = createSignal("");
	const [editVehicleClass, setEditVehicleClass] = createSignal("");
	// Relay Team fields
	const [editTeamName, setEditTeamName] = createSignal("");

	// Section 2: Safety & Emergency Contact
	const [editEcFirstName, setEditEcFirstName] = createSignal("");
	const [editEcLastName, setEditEcLastName] = createSignal("");
	const [editEcPhone, setEditEcPhone] = createSignal("");
	const [editEcRelationship, setEditEcRelationship] = createSignal("");
	const [editEcIsOnSite, setEditEcIsOnSite] = createSignal(false);

	const [isSavingEntrant, setIsSavingEntrant] = createSignal(false);
	const [isRecalculating, setIsRecalculating] = createSignal(false);
	const [entrantModalError, setEntrantModalError] = createSignal<string | null>(null);

	const openEditModal = (entrant: EntrantItem) => {
		setEditingEntrant(entrant);
		setEntrantModalError(null);

		// Section 1
		setEditTargetEventId(entrant.eventId);
		setEditBib(entrant.competitorNumber);
		setEditRfid(entrant.rfidCode ?? "");
		setEditDivision(entrant.division);
		setEditSchedStart(entrant.scheduledStartTime ? new Date(entrant.scheduledStartTime).toISOString().slice(0, 16) : "");
		setEditActualStart(entrant.actualStartTime ? new Date(entrant.actualStartTime).toISOString().slice(0, 16) : "");

		// Polymorphic participantData
		const pd = entrant.participantData;
		setEditParticipantKind(pd.kind);
		if (pd.kind === "solo_competitor") {
			setEditMedicalNotes(pd.medicalNotes ?? "");
			setEditPacerName(pd.pacerName ?? "");
			setEditTShirtSize(pd.tShirtSize ?? "");
		} else if (pd.kind === "vehicle_crew") {
			setEditDriverName(pd.driver.name);
			setEditDriverLicense(pd.driver.licenseNumber);
			setEditVehicleMake(pd.vehicle.make);
			setEditVehicleModel(pd.vehicle.model);
			setEditVehicleClass(pd.vehicle.vehicleClass);
		} else if (pd.kind === "relay_team") {
			setEditTeamName(pd.teamName);
		}

		// Section 2
		setEditEcFirstName(entrant.emergencyContact?.firstName ?? "");
		setEditEcLastName(entrant.emergencyContact?.lastName ?? "");
		setEditEcPhone(entrant.emergencyContact?.phone ?? "");
		setEditEcRelationship(entrant.emergencyContactRelationship ?? "");
		setEditEcIsOnSite(entrant.emergencyContactIsOnSite);
	};

	const handleSaveEntrantModal = async (e: Event) => {
		e.preventDefault();
		const current = editingEntrant();
		if (!current) return;

		setIsSavingEntrant(true);
		setEntrantModalError(null);

		let participantDataPayload: ParticipantData;
		if (editParticipantKind() === "vehicle_crew") {
			participantDataPayload = {
				kind: "vehicle_crew",
				driver: {
					name: editDriverName() || `${current.person.firstName} ${current.person.lastName}`,
					licenseNumber: editDriverLicense() || "N/A",
				},
				vehicle: {
					make: editVehicleMake() || "Rally",
					model: editVehicleModel() || "Spec",
					year: 2026,
					vehicleClass: editVehicleClass() || "Open",
				},
			};
		} else if (editParticipantKind() === "relay_team") {
			participantDataPayload = {
				kind: "relay_team",
				teamName: editTeamName() || "Team Relay",
				captainContact: {
					name: `${current.person.firstName} ${current.person.lastName}`,
					phone: current.person.phone ?? "N/A",
				},
				members: [],
			};
		} else {
			participantDataPayload = {
				kind: "solo_competitor",
				medicalNotes: editMedicalNotes() || undefined,
				pacerName: editPacerName() || undefined,
				tShirtSize: editTShirtSize() || undefined,
			};
		}

		try {
			await editEntrantWorkspaceFn({
				data: {
					entrantId: current.id,
					targetEventId: editTargetEventId() !== current.eventId ? editTargetEventId() : undefined,
					competitorNumber: editBib().trim(),
					rfidCode: editRfid().trim() || null,
					division: editDivision().trim(),
					scheduledStartTime: editSchedStart() ? new Date(editSchedStart()).toISOString() : null,
					actualStartTime: editActualStart() ? new Date(editActualStart()).toISOString() : null,
					participantData: participantDataPayload,
					emergencyContactPersonId: current.emergencyContactPersonId,
					emergencyContactFirstName: editEcFirstName().trim() || undefined,
					emergencyContactLastName: editEcLastName().trim() || undefined,
					emergencyContactPhone: editEcPhone().trim() || undefined,
					emergencyContactRelationship: editEcRelationship().trim() || null,
					emergencyContactIsOnSite: editEcIsOnSite(),
				},
			});
			setEditingEntrant(null);
			await router.invalidate();
		} catch (err: unknown) {
			setEntrantModalError(err instanceof Error ? err.message : "Failed to save entrant.");
		} finally {
			setIsSavingEntrant(false);
		}
	};

	// Steward 1-click external profile verify/reject
	const handleVerifyProfile = async (profileId: string, status: "manual_verified" | "rejected") => {
		try {
			await verifyExternalProfileFn({
				data: { externalProfileId: profileId, status },
			});
			await router.invalidate();
		} catch (err) {
			console.error(err);
		}
	};

	// 1-click recalculate pacing projections
	const handleRecalculateProjections = async () => {
		const current = editingEntrant();
		if (!current) return;
		setIsRecalculating(true);
		try {
			await recalculateProjectionFn({
				data: { entrantId: current.id },
			});
			await router.invalidate();
		} catch (err) {
			console.error(err);
		} finally {
			setIsRecalculating(false);
		}
	};

	// 1-tap check-in desk status toggle
	const handleCheckInToggle = async (entrantId: string, targetStatus: "checked_in" | "dns" | "registered") => {
		try {
			await checkInEntrantFn({
				data: { entrantId, status: targetStatus },
			});
			await router.invalidate();
		} catch (err) {
			console.error(err);
		}
	};

	const handleInlineOnSiteToggle = async (entrantId: string, currentOnSite: boolean) => {
		try {
			await checkInEntrantFn({
				data: {
					entrantId,
					status: "checked_in",
					emergencyContactIsOnSite: !currentOnSite,
				},
			});
			await router.invalidate();
		} catch (err) {
			console.error(err);
		}
	};

	return (
		<div class="px-6 py-8 max-w-7xl mx-auto space-y-6">
			{/* Mode Switcher Banner */}
			<div class="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4 print:hidden">
				<div class="flex items-center gap-1 rounded-xl bg-card border border-border p-1 shadow-xs">
					<button
						type="button"
						onClick={() => setActiveMode("roster")}
						class={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
							activeMode() === "roster"
								? "bg-forest text-paper shadow-xs"
								: "text-muted-foreground hover:text-foreground hover:bg-muted/50"
						}`}
					>
						<span>📋 Mode 1: Roster & Dossiers</span>
					</button>

					<button
						type="button"
						onClick={() => setActiveMode("checkin")}
						class={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
							activeMode() === "checkin"
								? "bg-forest text-paper shadow-xs"
								: "text-muted-foreground hover:text-foreground hover:bg-muted/50"
						}`}
					>
						<span>⚡ Mode 2: Race-Morning Check-In Desk</span>
					</button>
				</div>

				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => window.print()}
						class="text-xs font-semibold gap-1.5 cursor-pointer"
					>
						<span>🖨️</span>
						<span>Printable Check-In Sheet</span>
					</Button>
				</div>
			</div>

			{/* =================================================================== */}
			{/* MODE 1: ROSTER & CSV IMPORT VIEW */}
			{/* =================================================================== */}
			<Show when={activeMode() === "roster"}>
				<div class="space-y-4 print:hidden">
					{/* Search & Filters */}
					<div class="flex flex-wrap items-center justify-between gap-3 bg-card border border-border rounded-xl p-3">
						<div class="flex flex-wrap items-center gap-3 flex-1 max-w-xl">
							<Input
								placeholder="Search bib, name, or RFID chip..."
								value={searchQuery()}
								onInput={(e) => setSearchQuery(e.currentTarget.value)}
								class="h-9 text-xs"
							/>

							<select
								value={statusFilter()}
								onChange={(e) => setStatusFilter(e.currentTarget.value)}
								class="rounded-md border border-input bg-surface px-2.5 py-1.5 text-xs shadow-xs"
							>
								<option value="all">All Statuses ({entrants().length})</option>
								<option value="registered">Registered</option>
								<option value="checked_in">Checked In</option>
								<option value="in_progress">On Course</option>
								<option value="finished">Finished</option>
								<option value="dnf">DNF</option>
								<option value="dns">DNS</option>
							</select>

							<select
								value={divisionFilter()}
								onChange={(e) => setDivisionFilter(e.currentTarget.value)}
								class="rounded-md border border-input bg-surface px-2.5 py-1.5 text-xs shadow-xs"
							>
								<option value="all">All Divisions</option>
								<For each={divisions()}>
									{(div) => <option value={div}>{div}</option>}
								</For>
							</select>
						</div>

						<div class="flex items-center gap-3">
							<Button
								variant="outline"
								size="sm"
								class="h-9 gap-1.5 text-xs font-semibold cursor-pointer"
								onClick={() => {
									setCsvUploadError(null);
									setIsCsvModalOpen(true);
								}}
							>
								<span>📥</span>
								<span>Import CSV</span>
							</Button>

							<div class="text-xs text-muted-foreground font-mono tabular-nums">
								Showing {filteredEntrants().length} of {entrants().length} entrants
							</div>
						</div>
					</div>

					{/* Roster Table */}
					<div class="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
						<Table>
							<TableHeader>
								<TableRow class="bg-muted/40">
									<TableHead class="w-16 font-bold font-mono">Bib #</TableHead>
									<TableHead class="font-bold">Competitor Name</TableHead>
									<TableHead class="font-bold">Division</TableHead>
									<TableHead class="font-bold">Status</TableHead>
									<TableHead class="font-bold">Experience</TableHead>
									<TableHead class="font-bold font-mono">Projected Finish</TableHead>
									<TableHead class="font-bold">SAR Safety Badge</TableHead>
									<TableHead class="text-right font-bold">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<For
									each={filteredEntrants()}
									fallback={
										<TableRow>
											<TableCell colspan={8} class="text-center py-8 text-muted-foreground text-xs">
												No competitors matched your search query.
											</TableCell>
										</TableRow>
									}
								>
									{(entrant) => (
										<TableRow class="hover:bg-muted/20">
											<TableCell class="font-mono font-bold tabular-nums text-foreground">
												{entrant.competitorNumber}
											</TableCell>
											<TableCell>
												<div class="font-medium text-foreground">
													{entrant.person.firstName} {entrant.person.lastName}
												</div>
												<div class="text-[11px] text-muted-foreground font-mono">
													{entrant.rfidCode ? `RFID: ${entrant.rfidCode}` : "No RFID tag"}
												</div>
											</TableCell>
											<TableCell class="text-xs text-muted-foreground">
												{entrant.division}
											</TableCell>
											<TableCell>
												<Badge variant={STATUS_VARIANTS[entrant.status] ?? "secondary"} class="text-[10px]">
													{entrant.status.replaceAll("_", " ")}
												</Badge>
											</TableCell>
											<TableCell>
												<Show
													when={entrant.summary?.experienceTier}
													fallback={<span class="text-xs text-muted-foreground italic">Unranked</span>}
												>
													<Badge
														variant={TIER_VARIANTS[entrant.summary!.experienceTier] ?? "outline"}
														class="text-[10px] capitalize"
													>
														{entrant.summary!.experienceTier}
													</Badge>
												</Show>
											</TableCell>
											<TableCell class="font-mono tabular-nums text-xs">
												{entrant.projection?.projectedFinishSeconds
													? formatDurationSeconds(entrant.projection.projectedFinishSeconds)
													: "Pending"}
											</TableCell>
											<TableCell>
												<Show
													when={entrant.projection?.volunteersSarSafetyBadge}
													fallback={<span class="text-xs text-muted-foreground">—</span>}
												>
													<span
														class={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
															entrant.projection!.expectedCutoffRisk
																? "bg-destructive/15 text-destructive border border-destructive/30"
																: "bg-muted text-muted-foreground"
														}`}
													>
														{entrant.projection!.volunteersSarSafetyBadge}
													</span>
												</Show>
											</TableCell>
											<TableCell class="text-right">
												<Button
													variant="outline"
													size="sm"
													onClick={() => openEditModal(entrant)}
													class="h-7 text-xs font-semibold px-2.5 cursor-pointer"
												>
													Edit / Dossier
												</Button>
											</TableCell>
										</TableRow>
									)}
								</For>
							</TableBody>
						</Table>
					</div>
				</div>
			</Show>

			{/* =================================================================== */}
			{/* MODE 2: RACE-MORNING CHECK-IN DESK VIEW */}
			{/* =================================================================== */}
			<Show when={activeMode() === "checkin"}>
				<div class="space-y-4 print:hidden">
					{/* Live Custody Stats Strip */}
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card border border-border rounded-xl p-4">
						<div>
							<div class="text-[11px] font-semibold text-muted-foreground uppercase">
								Checked In Packet Pickup
							</div>
							<div class="text-2xl font-bold font-mono tabular-nums text-forest mt-0.5">
								{checkInStats().checkedIn} / {checkInStats().total}
							</div>
							<div class="text-[11px] text-muted-foreground mt-0.5">
								{checkInStats().pct}% checked in
							</div>
						</div>

						<div>
							<div class="text-[11px] font-semibold text-muted-foreground uppercase">
								Remaining to Check In
							</div>
							<div class="text-2xl font-bold font-mono tabular-nums text-primary mt-0.5">
								{checkInStats().remaining}
							</div>
							<div class="text-[11px] text-muted-foreground mt-0.5">
								Competitors awaiting bib pickup
							</div>
						</div>

						<div>
							<div class="text-[11px] font-semibold text-muted-foreground uppercase">
								Declared DNS
							</div>
							<div class="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
								{checkInStats().dns}
							</div>
							<div class="text-[11px] text-muted-foreground mt-0.5">
								Did not start
							</div>
						</div>

						<div class="flex flex-col justify-between">
							<div class="text-[11px] font-semibold text-muted-foreground uppercase">
								Race Gun Start Trigger
							</div>
							<Show
								when={!event().actualStartIso}
								fallback={
									<span class="text-xs font-bold text-forest">
										Race clock running: {new Date(event().actualStartIso!).toLocaleTimeString()}
									</span>
								}
							>
								<Button
									variant="forest"
									size="sm"
									onClick={() => startGunFn({ data: { eventId: event().id } }).then(() => router.invalidate())}
									disabled={!access().canManageRaceControl}
									class="text-xs font-bold gap-1 mt-1 cursor-pointer"
								>
									<span>🔫</span>
									<span>Quick Start Race Gun</span>
								</Button>
							</Show>
						</div>
					</div>

					{/* Fast Search Input */}
					<div class="bg-card border border-border rounded-xl p-3">
						<Input
							placeholder="🔍 Fast Scan: Type bib number or competitor name..."
							value={searchQuery()}
							onInput={(e) => setSearchQuery(e.currentTarget.value)}
							autofocus
							class="text-sm h-11 bg-surface font-mono"
						/>
					</div>

					{/* Fast Check-In Table */}
					<div class="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
						<Table>
							<TableHeader>
								<TableRow class="bg-muted/40">
									<TableHead class="w-20 font-bold font-mono">Bib #</TableHead>
									<TableHead class="font-bold">Competitor Name</TableHead>
									<TableHead class="font-bold">Division</TableHead>
									<TableHead class="font-bold font-mono">RFID Tag</TableHead>
									<TableHead class="font-bold">On-Site Contact</TableHead>
									<TableHead class="font-bold">Current Status</TableHead>
									<TableHead class="text-right font-bold">1-Tap Status Action</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<For
									each={filteredEntrants()}
									fallback={
										<TableRow>
											<TableCell colspan={7} class="text-center py-8 text-muted-foreground text-xs">
												No competitors match the search filter.
											</TableCell>
										</TableRow>
									}
								>
									{(entrant) => {
										const isCheckedIn = () =>
											entrant.status === "checked_in" || entrant.status === "in_progress";
										const isDns = () => entrant.status === "dns";

										return (
											<TableRow class="hover:bg-muted/20">
												<TableCell class="font-mono font-bold tabular-nums text-foreground text-sm">
													{entrant.competitorNumber}
												</TableCell>
												<TableCell>
													<div class="font-bold text-foreground">
														{entrant.person.firstName} {entrant.person.lastName}
													</div>
													<div class="text-[11px] text-muted-foreground">
														{entrant.emergencyContact
															? `EC: ${entrant.emergencyContact.firstName} ${entrant.emergencyContact.lastName} (${entrant.emergencyContact.phone ?? "no phone"})`
															: "No emergency contact"}
													</div>
												</TableCell>
												<TableCell class="text-xs text-muted-foreground">
													{entrant.division}
												</TableCell>
												<TableCell class="font-mono text-xs text-muted-foreground">
													{entrant.rfidCode ?? "None"}
												</TableCell>
												<TableCell>
													<button
														type="button"
														onClick={() =>
															handleInlineOnSiteToggle(
																entrant.id,
																entrant.emergencyContactIsOnSite,
															)
														}
														class={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
															entrant.emergencyContactIsOnSite
																? "bg-forest/15 border-forest/40 text-forest"
																: "bg-muted border-border text-muted-foreground hover:bg-muted/80"
														}`}
													>
														{entrant.emergencyContactIsOnSite
															? "✓ On-Site"
															: "Off-Site"}
													</button>
												</TableCell>
												<TableCell>
													<Badge
														variant={STATUS_VARIANTS[entrant.status] ?? "secondary"}
														class="text-[10px]"
													>
														{entrant.status.replaceAll("_", " ")}
													</Badge>
												</TableCell>
												<TableCell class="text-right">
													<div class="flex items-center justify-end gap-1.5">
														<Show
															when={!isCheckedIn()}
															fallback={
																<Button
																	variant="outline"
																	size="sm"
																	onClick={() => handleCheckInToggle(entrant.id, "registered")}
																	class="h-7 text-xs font-semibold px-2 text-muted-foreground"
																>
																	Undo Check-In
																</Button>
															}
														>
															<Button
																variant="forest"
																size="sm"
																onClick={() => handleCheckInToggle(entrant.id, "checked_in")}
																class="h-7 text-xs font-bold px-3 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
															>
																✓ Check In
															</Button>

															<Button
																variant="outline"
																size="sm"
																onClick={() => handleCheckInToggle(entrant.id, "dns")}
																class="h-7 text-xs font-semibold px-2 text-destructive hover:bg-destructive/10 cursor-pointer"
															>
																DNS
															</Button>
														</Show>
													</div>
												</TableCell>
											</TableRow>
										);
									}}
								</For>
							</TableBody>
						</Table>
					</div>
				</div>
			</Show>

			{/* =================================================================== */}
			{/* PRINTABLE CHECK-IN SHEET (FORMATTED FOR @media print) */}
			{/* =================================================================== */}
			<div class="hidden print:block text-black bg-white p-4 font-serif">
				<div class="border-b-2 border-black pb-2 mb-4">
					<h1 class="text-xl font-bold uppercase tracking-wider">
						Official Check-In & Packet Pickup Sheet
					</h1>
					<p class="text-xs">
						Event: <strong>{event().name}</strong> · Scheduled Start:{" "}
						{new Date(event().scheduledStartIso).toLocaleString()}
					</p>
				</div>

				<table class="w-full text-left text-xs border-collapse">
					<thead>
						<tr class="border-b border-black">
							<th class="py-1 w-12 font-bold font-mono">Bib</th>
							<th class="py-1 font-bold">Competitor Name</th>
							<th class="py-1 font-bold">Division</th>
							<th class="py-1 font-bold">Emergency Contact & Phone</th>
							<th class="py-1 w-16 font-bold text-center">On-Site?</th>
							<th class="py-1 w-24 font-bold text-center">Checked In</th>
							<th class="py-1 w-32 font-bold text-center">Athlete Signature</th>
						</tr>
					</thead>
					<tbody>
						<For each={entrants()}>
							{(entrant) => (
								<tr class="border-b border-gray-300">
									<td class="py-1 font-mono font-bold tabular-nums">
										{entrant.competitorNumber}
									</td>
									<td class="py-1 font-semibold">
										{entrant.person.firstName} {entrant.person.lastName}
									</td>
									<td class="py-1">{entrant.division}</td>
									<td class="py-1 text-[11px]">
										{entrant.emergencyContact
											? `${entrant.emergencyContact.firstName} ${entrant.emergencyContact.lastName} (${entrant.emergencyContact.phone ?? "N/A"})`
											: "None"}
									</td>
									<td class="py-1 text-center font-mono">
										{entrant.emergencyContactIsOnSite ? "[✓]" : "[ ]"}
									</td>
									<td class="py-1 text-center font-mono">
										{entrant.status === "checked_in" ? "[✓]" : "[ ]"}
									</td>
									<td class="py-1 border-b border-gray-400"></td>
								</tr>
							)}
						</For>
					</tbody>
				</table>
			</div>

			{/* =================================================================== */}
			{/* COMPACT 3-SECTION EDIT ENTRANT MODAL DIALOG */}
			{/* =================================================================== */}
			<Dialog
				open={Boolean(editingEntrant())}
				onOpenChange={(open) => !open && setEditingEntrant(null)}
			>
				<DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit Entrant & Competitor Dossier</DialogTitle>
						<DialogDescription>
							Unified competitor configuration, emergency safety details, and steward profile verification.
						</DialogDescription>
					</DialogHeader>

					<Show when={editingEntrant()}>
						{(entrant) => (
							<form onSubmit={handleSaveEntrantModal} class="space-y-6 py-2">
								<Show when={entrantModalError()}>
									<div class="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
										{entrantModalError()}
									</div>
								</Show>

								{/* SECTION 1: COMPETITOR & DIVISION */}
								<div class="rounded-xl border border-border bg-surface p-4 space-y-3">
									<div class="text-xs font-bold font-serif text-forest uppercase tracking-wider">
										1. Competitor & Division
									</div>

									<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<div class="space-y-1">
											<label class="text-xs font-semibold text-foreground">
												Competitor
											</label>
											<div class="rounded-md border border-input bg-card px-3 py-2 text-sm font-bold text-foreground">
												{entrant().person.firstName} {entrant().person.lastName}
											</div>
											<div class="text-[10px] text-muted-foreground">
												{entrant().person.email ?? "No email"} · ID: {entrant().personId.slice(0, 8)}
											</div>
										</div>

										<div class="space-y-1">
											<label class="text-xs font-semibold text-foreground">
												Distance / Sub-Event Transfer
											</label>
											<select
												value={editTargetEventId()}
												onChange={(e) => setEditTargetEventId(e.currentTarget.value)}
												class="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
											>
												<For each={siblingEvents()}>
													{(sub) => <option value={sub.id}>{sub.name}</option>}
												</For>
											</select>
										</div>

										<div class="space-y-1">
											<label class="text-xs font-semibold text-foreground">
												Bib / Plate / Car #
											</label>
											<Input
												value={editBib()}
												onInput={(e) => setEditBib(e.currentTarget.value)}
												required
											/>
										</div>

										<div class="space-y-1">
											<label class="text-xs font-semibold text-foreground">
												RFID Transponder Tag
											</label>
											<Input
												value={editRfid()}
												onInput={(e) => setEditRfid(e.currentTarget.value)}
												placeholder="e.g. EPC-99042"
											/>
										</div>

										<div class="space-y-1">
											<label class="text-xs font-semibold text-foreground">
												Competitive Division
											</label>
											<Input
												value={editDivision()}
												onInput={(e) => setEditDivision(e.currentTarget.value)}
												required
											/>
										</div>

										<div class="space-y-1">
											<label class="text-xs font-semibold text-foreground">
												Staggered Start Override
											</label>
											<Input
												type="datetime-local"
												value={editSchedStart()}
												onInput={(e) => setEditSchedStart(e.currentTarget.value)}
											/>
										</div>
									</div>

									{/* Polymorphic Participant Fields */}
									<div class="pt-2 border-t border-border/60">
										<div class="text-[11px] font-semibold text-muted-foreground uppercase mb-2">
											Participant Category: {editParticipantKind().replaceAll("_", " ")}
										</div>

										<Show when={editParticipantKind() === "solo_competitor"}>
											<div class="grid grid-cols-2 gap-3">
												<div class="space-y-1">
													<label class="text-xs font-semibold text-foreground">
														Pacer Name
													</label>
													<Input
														value={editPacerName()}
														onInput={(e) => setEditPacerName(e.currentTarget.value)}
														placeholder="Optional pacer"
													/>
												</div>
												<div class="space-y-1">
													<label class="text-xs font-semibold text-foreground">
														T-Shirt Size
													</label>
													<Input
														value={editTShirtSize()}
														onInput={(e) => setEditTShirtSize(e.currentTarget.value)}
														placeholder="M, L, XL"
													/>
												</div>
											</div>
										</Show>

										<Show when={editParticipantKind() === "vehicle_crew"}>
											<div class="grid grid-cols-2 gap-3">
												<div class="space-y-1">
													<label class="text-xs font-semibold text-foreground">
														Driver Name
													</label>
													<Input
														value={editDriverName()}
														onInput={(e) => setEditDriverName(e.currentTarget.value)}
													/>
												</div>
												<div class="space-y-1">
													<label class="text-xs font-semibold text-foreground">
														Vehicle Make & Model
													</label>
													<Input
														value={editVehicleMake()}
														onInput={(e) => setEditVehicleMake(e.currentTarget.value)}
														placeholder="Subaru WRX STI"
													/>
												</div>
											</div>
										</Show>
									</div>
								</div>

								{/* SECTION 2: SAFETY & EMERGENCY CONTACT */}
								<div class="rounded-xl border border-border bg-surface p-4 space-y-3">
									<div class="flex items-center justify-between">
										<div class="text-xs font-bold font-serif text-forest uppercase tracking-wider">
											2. Safety & Emergency Contact
										</div>

										<div class="flex items-center gap-2">
											<span class="text-xs font-semibold text-foreground">
												Contact Is On-Site
											</span>
											<Switch checked={editEcIsOnSite()} onChange={setEditEcIsOnSite}>
												<SwitchControl />
											</Switch>
										</div>
									</div>

									<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<div class="space-y-1">
											<label class="text-xs font-semibold text-foreground">
												First Name
											</label>
											<Input
												value={editEcFirstName()}
												onInput={(e) => setEditEcFirstName(e.currentTarget.value)}
												placeholder="Emergency First Name"
											/>
										</div>

										<div class="space-y-1">
											<label class="text-xs font-semibold text-foreground">
												Last Name
											</label>
											<Input
												value={editEcLastName()}
												onInput={(e) => setEditEcLastName(e.currentTarget.value)}
												placeholder="Emergency Last Name"
											/>
										</div>

										<div class="space-y-1">
											<label class="text-xs font-semibold text-foreground">
												Primary Phone Number
											</label>
											<Input
												type="tel"
												value={editEcPhone()}
												onInput={(e) => setEditEcPhone(e.currentTarget.value)}
												placeholder="555-019-2834"
											/>
										</div>

										<div class="space-y-1">
											<label class="text-xs font-semibold text-foreground">
												Relationship
											</label>
											<Input
												value={editEcRelationship()}
												onInput={(e) => setEditEcRelationship(e.currentTarget.value)}
												placeholder="Spouse, Crew Chief, Parent"
											/>
										</div>
									</div>
								</div>

								{/* SECTION 3: EXTERNAL HISTORY & PACING PROJECTIONS */}
								<div class="rounded-xl border border-border bg-surface p-4 space-y-3">
									<div class="flex items-center justify-between">
										<div class="text-xs font-bold font-serif text-forest uppercase tracking-wider">
											3. External History & Pacing Projections
										</div>

										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={handleRecalculateProjections}
											disabled={isRecalculating()}
											class="text-xs font-semibold gap-1 cursor-pointer"
										>
											<span>🔄</span>
											<span>{isRecalculating() ? "Calculating..." : "Recalculate Projections"}</span>
										</Button>
									</div>

									{/* External Profiles Steward Review */}
									<div class="space-y-2">
										<div class="text-[11px] font-semibold text-muted-foreground uppercase">
											Linked Scraped Profiles ({entrant().externalProfiles.length})
										</div>

										<Show
											when={entrant().externalProfiles.length > 0}
											fallback={
												<div class="text-xs text-muted-foreground italic">
													No external profiles linked to this competitor.
												</div>
											}
										>
											<div class="space-y-1.5">
												<For each={entrant().externalProfiles}>
													{(profile) => (
														<div class="flex items-center justify-between rounded-lg bg-card border border-border/80 px-3 py-2 text-xs">
															<div class="flex items-center gap-2">
																<Badge variant="outline" class="uppercase font-mono text-[9px]">
																	{profile.platform}
																</Badge>
																<span class="font-bold text-foreground">
																	{profile.externalIdentifier}
																</span>
																<Badge
																	variant={
																		profile.verificationStatus === "manual_verified"
																			? "forest"
																			: profile.verificationStatus === "rejected"
																				? "destructive"
																				: "clay"
																	}
																	class="text-[9px]"
																>
																	{profile.verificationStatus}
																</Badge>
															</div>

															<div class="flex items-center gap-1.5">
																<Show when={profile.verificationStatus !== "manual_verified"}>
																	<Button
																		type="button"
																		variant="forest"
																		size="sm"
																		class="h-6 text-[10px] px-2 font-bold cursor-pointer"
																		onClick={() => handleVerifyProfile(profile.id, "manual_verified")}
																	>
																		✓ Approve
																	</Button>
																</Show>

																<Show when={profile.verificationStatus !== "rejected"}>
																	<Button
																		type="button"
																		variant="outline"
																		size="sm"
																		class="h-6 text-[10px] px-2 text-destructive cursor-pointer"
																		onClick={() => handleVerifyProfile(profile.id, "rejected")}
																	>
																		Reject
																	</Button>
																</Show>
															</div>
														</div>
													)}
												</For>
											</div>
										</Show>
									</div>

									{/* Historical Summary Stats */}
									<div class="pt-2 border-t border-border/60 grid grid-cols-3 gap-2 text-center text-xs">
										<div class="rounded-lg bg-card border border-border/80 p-2">
											<div class="text-[10px] text-muted-foreground uppercase">Finishes / Races</div>
											<div class="font-bold font-mono tabular-nums text-foreground mt-0.5">
												{entrant().summary?.totalFinishes ?? 0} / {entrant().summary?.totalRaces ?? 0}
											</div>
										</div>

										<div class="rounded-lg bg-card border border-border/80 p-2">
											<div class="text-[10px] text-muted-foreground uppercase">UltraSignup Rank</div>
											<div class="font-bold font-mono tabular-nums text-foreground mt-0.5">
												{entrant().summary?.ultrasignupRank
													? `${entrant().summary!.ultrasignupRank.toFixed(1)}%`
													: "N/A"}
											</div>
										</div>

										<div class="rounded-lg bg-card border border-border/80 p-2">
											<div class="text-[10px] text-muted-foreground uppercase">ITRA Index</div>
											<div class="font-bold font-mono tabular-nums text-foreground mt-0.5">
												{entrant().summary?.itraPerformanceIndex ?? "N/A"}
											</div>
										</div>
									</div>
								</div>

								<DialogFooter>
									<Button
										type="button"
										variant="outline"
										onClick={() => setEditingEntrant(null)}
										disabled={isSavingEntrant()}
									>
										Cancel
									</Button>
									<Button type="submit" variant="forest" disabled={isSavingEntrant()}>
										{isSavingEntrant() ? "Saving..." : "Save Entrant Dossier"}
									</Button>
								</DialogFooter>
							</form>
						)}
					</Show>
				</DialogContent>
			</Dialog>

			{/* BULK CSV IMPORT MODAL */}
			<Dialog open={isCsvModalOpen()} onOpenChange={setIsCsvModalOpen}>
				<DialogContent class="max-w-2xl max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle class="font-serif font-bold text-lg">
							Bulk CSV Import Entrants
						</DialogTitle>
						<DialogDescription>
							Import race roster from CSV text or upload a .csv file. The first row must include header column names:
							<code class="block font-mono text-[11px] bg-muted/60 p-1.5 rounded-sm mt-1 text-foreground">
								bib,first_name,last_name,email,gender,birthdate,division,rfid,phone,emergency_name,emergency_phone,emergency_relationship
							</code>
						</DialogDescription>
					</DialogHeader>

					<div class="space-y-4 py-2">
						<div class="flex items-center gap-3">
							<label class="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-md border border-input bg-surface hover:bg-muted">
								Choose CSV File
								<input
									type="file"
									accept=".csv,text/csv"
									class="sr-only"
									onChange={(e) => {
										const file = e.currentTarget.files?.[0];
										if (file) {
											file.text().then(setCsvText);
										}
									}}
								/>
							</label>
							<span class="text-xs text-muted-foreground">or paste raw CSV text below:</span>
						</div>

						<textarea
							value={csvText()}
							onInput={(e) => setCsvText(e.currentTarget.value)}
							class="w-full h-36 font-mono text-xs p-3 rounded-lg border border-input bg-surface text-foreground shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
							placeholder={`bib,first_name,last_name,email,gender,birthdate,division\n101,Ada,Lovelace,ada@example.com,F,1990-12-10,Open\n102,Alan,Turing,alan@example.com,M,1985-06-23,Open`}
						/>

						<Show when={csvUploadError()}>
							<div class="p-3 text-xs bg-red-900/10 border border-red-500/30 text-red-700 rounded-lg">
								{csvUploadError()}
							</div>
						</Show>

						<Show when={parsedCsv().length > 0}>
							<div class="flex items-center justify-between text-xs font-mono tabular-nums p-2.5 rounded-lg bg-card border border-border">
								<span>Parsed: {parsedCsv().length} rows</span>
								<span class={invalidCsvRows().length > 0 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>
									{validCsvRows().length} valid / {invalidCsvRows().length} problematic
								</span>
							</div>
						</Show>

						<Show when={invalidCsvRows().length > 0}>
							<div class="rounded-lg border border-red-500/30 bg-card overflow-hidden">
								<div class="p-2 text-xs font-bold bg-red-900/10 text-red-700 border-b border-red-500/30">
									Validation Issues (fix before importing):
								</div>
								<div class="max-h-40 overflow-y-auto">
									<Table>
										<TableHeader>
											<TableRow class="bg-muted/40 text-xs">
												<TableHead class="w-16 text-right">Line</TableHead>
												<TableHead>Problem</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											<For each={invalidCsvRows()}>
												{(p) => (
													<TableRow class="text-xs">
														<TableCell class="text-right font-mono tabular-nums">{p.line}</TableCell>
														<TableCell class="text-red-600">{p.errors.join(" · ")}</TableCell>
													</TableRow>
												)}
											</For>
										</TableBody>
									</Table>
								</div>
							</div>
						</Show>

						<Show when={parsedCsv().length > 0 && invalidCsvRows().length === 0}>
							<div class="rounded-lg border border-border bg-card overflow-hidden">
								<div class="p-2 text-xs font-bold bg-muted/40 text-muted-foreground border-b border-border">
									Preview (first {Math.min(parsedCsv().length, 3)} rows):
								</div>
								<Table>
									<TableHeader>
										<TableRow class="bg-muted/20 text-xs">
											<TableHead class="w-16">Bib</TableHead>
											<TableHead>Name</TableHead>
											<TableHead>Division</TableHead>
											<TableHead>Email</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										<For each={validCsvRows().slice(0, 3)}>
											{(r) => (
												<TableRow class="text-xs">
													<TableCell class="font-mono tabular-nums font-bold">{r.competitorNumber}</TableCell>
													<TableCell>{r.person.firstName} {r.person.lastName}</TableCell>
													<TableCell>{r.division}</TableCell>
													<TableCell class="text-muted-foreground">{r.person.email ?? "—"}</TableCell>
												</TableRow>
											)}
										</For>
									</TableBody>
								</Table>
							</div>
						</Show>
					</div>

					<DialogFooter class="flex items-center justify-between gap-3">
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsCsvModalOpen(false)}
							disabled={isUploadingCsv()}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="forest"
							onClick={handleUploadCsv}
							disabled={validCsvRows().length === 0 || invalidCsvRows().length > 0 || isUploadingCsv()}
						>
							{isUploadingCsv() ? "Uploading..." : `Import ${validCsvRows().length} Entrants`}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
