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
import { Switch, SwitchControl, SwitchLabel } from "~/components/ui/switch";
import {
	assignStaffStationFn,
	editPartialRulesConfig,
	getDisciplineRulesAndStaff,
	removeStaffMemberFn,
	removeStaffStationFn,
	rosterStaffMemberFn,
} from "~/race-control/race-control.functions";
import type { StaffRole } from "~/db/schema";

export const Route = createFileRoute(
	"/_authed/orgs/$slug/event-groups/$eventGroupSlug/rules-staff",
)({
	loader: ({ params }) =>
		getDisciplineRulesAndStaff({
			data: { slug: params.slug, eventGroupSlug: params.eventGroupSlug },
		}),
	component: DisciplineRulesStaffMatrixTab,
});

const ROLE_BADGE_VARIANTS: Record<StaffRole, "forest" | "clay" | "sage" | "outline"> = {
	volunteer: "sage",
	checkpoint_captain: "forest",
	official: "clay",
	medical: "clay",
};

const ROLE_DISPLAY_NAMES: Record<StaffRole, string> = {
	volunteer: "Volunteer",
	checkpoint_captain: "Checkpoint Captain",
	official: "Official / Steward",
	medical: "Medical & SAR Lead",
};

function DisciplineRulesStaffMatrixTab() {
	const data = Route.useLoaderData();
	const params = Route.useParams();
	const router = useRouter();

	const group = () => data().eventGroup;
	const staff = () => data().staff;
	const timingPoints = () => data().organizationTimingPoints;
	const access = () => data().access;

	// Rules form state initialized from loaded rulesConfig
	const [timeFormat, setTimeFormat] = createSignal(group().rulesConfig.timeFormat);
	const [precision, setPrecision] = createSignal(group().rulesConfig.displayPrecisionDecimals);
	const [selfCheckIn, setSelfCheckIn] = createSignal(group().rulesConfig.allowSelfCheckIn);
	const [requirePacer, setRequirePacer] = createSignal(group().rulesConfig.requirePacerRegistration);
	const [earlyPenalty, setEarlyPenalty] = createSignal(group().rulesConfig.earlyPenaltyFactor ?? 2.0);
	const [latePenalty, setLatePenalty] = createSignal(group().rulesConfig.latePenaltyFactor ?? 1.0);
	const [gracePeriod, setGracePeriod] = createSignal(group().rulesConfig.gracePeriodSeconds ?? 0.0);
	const [yardDistance, setYardDistance] = createSignal(group().rulesConfig.yardDistanceMiles ?? 4.166667);
	const [yardTimeLimit, setYardTimeLimit] = createSignal(group().rulesConfig.yardTimeLimitSeconds ?? 3600);

	const [isSavingRules, setIsSavingRules] = createSignal(false);
	const [rulesFeedback, setRulesFeedback] = createSignal<string | null>(null);

	// Staff dialogs state
	const [rosterOpen, setRosterOpen] = createSignal(false);
	const [rosterEmail, setRosterEmail] = createSignal("");
	const [rosterFirstName, setRosterFirstName] = createSignal("");
	const [rosterLastName, setRosterLastName] = createSignal("");
	const [rosterRole, setRosterRole] = createSignal<StaffRole>("volunteer");
	const [rosterStationId, setRosterStationId] = createSignal<string>("");
	const [isRostering, setIsRostering] = createSignal(false);
	const [rosterError, setRosterError] = createSignal<string | null>(null);

	// Assign station dialog
	const [assignOpen, setAssignOpen] = createSignal(false);
	const [selectedStaffId, setSelectedStaffId] = createSignal<string | null>(null);
	const [selectedPointId, setSelectedPointId] = createSignal<string>("");

	// Copy link notification
	const [copiedCode, setCopiedCode] = createSignal<string | null>(null);

	const copyLoggerLink = (pointCode: string) => {
		const origin = typeof window !== "undefined" ? window.location.origin : "";
		const link = `${origin}/orgs/${params().slug}/event-groups/${params().eventGroupSlug}/logger?station=${pointCode}`;
		navigator.clipboard.writeText(link);
		setCopiedCode(pointCode);
		setTimeout(() => setCopiedCode(null), 2500);
	};

	const handleSaveRules = async (e: Event) => {
		e.preventDefault();
		setIsSavingRules(true);
		setRulesFeedback(null);
		try {
			await editPartialRulesConfig({
				data: {
					eventGroupId: group().id,
					timeFormat: timeFormat(),
					displayPrecisionDecimals: precision(),
					allowSelfCheckIn: selfCheckIn(),
					requirePacerRegistration: requirePacer(),
					earlyPenaltyFactor: earlyPenalty(),
					latePenaltyFactor: latePenalty(),
					gracePeriodSeconds: gracePeriod(),
					yardDistanceMiles: yardDistance(),
					yardTimeLimitSeconds: yardTimeLimit(),
				},
			});
			setRulesFeedback("Discipline rules successfully saved.");
			await router.invalidate();
		} catch (err: unknown) {
			setRulesFeedback(err instanceof Error ? err.message : "Failed to update rules.");
		} finally {
			setIsSavingRules(false);
		}
	};

	const handleRosterStaff = async (e: Event) => {
		e.preventDefault();
		if (!rosterEmail().trim()) return;
		setIsRostering(true);
		setRosterError(null);
		try {
			await rosterStaffMemberFn({
				data: {
					eventGroupId: group().id,
					email: rosterEmail().trim(),
					firstName: rosterFirstName().trim() || undefined,
					lastName: rosterLastName().trim() || undefined,
					roles: [rosterRole()],
					timingPointId: rosterStationId() || undefined,
				},
			});
			setRosterOpen(false);
			setRosterEmail("");
			setRosterFirstName("");
			setRosterLastName("");
			await router.invalidate();
		} catch (err: unknown) {
			setRosterError(err instanceof Error ? err.message : "Failed to roster staff member.");
		} finally {
			setIsRostering(false);
		}
	};

	const handleAssignStation = async (e: Event) => {
		e.preventDefault();
		const staffId = selectedStaffId();
		const pointId = selectedPointId();
		if (!staffId || !pointId) return;

		try {
			await assignStaffStationFn({
				data: {
					eventGroupId: group().id,
					staffId,
					timingPointId: pointId,
				},
			});
			setAssignOpen(false);
			setSelectedStaffId(null);
			await router.invalidate();
		} catch (err: unknown) {
			console.error(err);
		}
	};

	const handleRemoveStation = async (staffId: string, pointId: string) => {
		if (!confirm("Remove this station assignment?")) return;
		try {
			await removeStaffTimingPointFn({
				data: {
					eventGroupId: group().id,
					staffId,
					timingPointId: pointId,
				},
			});
			await router.invalidate();
		} catch (err: unknown) {
			console.error(err);
		}
	};

	const handleRemoveStaff = async (staffId: string, staffName: string) => {
		if (!confirm(`Remove ${staffName} from this event group?`)) return;
		try {
			await removeStaffMemberFn({
				data: {
					eventGroupId: group().id,
					staffId,
				},
			});
			await router.invalidate();
		} catch (err: unknown) {
			console.error(err);
		}
	};

	return (
		<div class="px-6 py-8 max-w-7xl mx-auto space-y-8">
			{/* Weekend Hub Internal Sub-Nav */}
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
						class="text-foreground border-b-2 border-forest pb-3 -mb-3.5 font-bold"
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
						class="text-muted-foreground hover:text-foreground pb-3 transition-colors"
					>
						Raw Timing Stream
					</Link>
				</div>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
				{/* Column 1: Discipline Rules Editor (5 cols) */}
				<div class="lg:col-span-5 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle class="text-lg font-bold font-serif">
								Discipline Rules & Precision
							</CardTitle>
							<CardDescription>
								Configure timing precision, athlete self check-in, and discipline-specific scoring parameters.
							</CardDescription>
						</CardHeader>

						<CardContent>
							<form onSubmit={handleSaveRules} class="space-y-4">
								<Show when={rulesFeedback()}>
									<div class="rounded-lg bg-primary/10 border border-primary/20 p-2.5 text-xs text-primary font-medium">
										{rulesFeedback()}
									</div>
								</Show>

								{/* General timing rules */}
								<div class="space-y-1">
									<label class="text-xs font-semibold text-foreground">
										Clock Time Display Format
									</label>
									<select
										value={timeFormat()}
										onChange={(e) =>
											setTimeFormat(e.currentTarget.value as "HH:MM:SS" | "HH:MM:SS.sss" | "MM:SS.sss")
										}
										class="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
									>
										<option value="HH:MM:SS">HH:MM:SS (Standard Ultra / Trail)</option>
										<option value="HH:MM:SS.sss">HH:MM:SS.sss (Sub-second Timing)</option>
										<option value="MM:SS.sss">MM:SS.sss (Short Track / Downhill)</option>
									</select>
								</div>

								<div class="space-y-1">
									<label class="text-xs font-semibold text-foreground">
										Display Precision Decimals (0–3)
									</label>
									<Input
										type="number"
										min="0"
										max="3"
										value={precision()}
										onInput={(e) => setPrecision(parseInt(e.currentTarget.value, 10) || 0)}
									/>
								</div>

								{/* Switches */}
								<div class="pt-2 border-t border-border space-y-3">
									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<div class="text-xs font-semibold text-foreground">
												Athlete Self Check-In
											</div>
											<div class="text-[11px] text-muted-foreground">
												Allow registered racers to confirm packet pickup via Account Hub
											</div>
										</div>
										<Switch checked={selfCheckIn()} onChange={setSelfCheckIn}>
											<SwitchControl />
										</Switch>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<div class="text-xs font-semibold text-foreground">
												Require Pacer Registration
											</div>
											<div class="text-[11px] text-muted-foreground">
												Enforce formal pacer bib numbers and emergency contacts
											</div>
										</div>
										<Switch checked={requirePacer()} onChange={setRequirePacer}>
											<SwitchControl />
										</Switch>
									</div>
								</div>

								{/* Discipline Specific Fields */}
								<Show when={group().discipline === "tsd_regularity"}>
									<div class="pt-3 border-t border-border space-y-3">
										<div class="text-xs font-bold text-forest uppercase tracking-wider">
											TSD Regularity Rally Penalties
										</div>
										<div class="grid grid-cols-2 gap-3">
											<div class="space-y-1">
												<label class="text-xs font-semibold text-foreground">
													Early Arrival Multiplier
												</label>
												<Input
													type="number"
													step="0.1"
													value={earlyPenalty()}
													onInput={(e) => setEarlyPenalty(parseFloat(e.currentTarget.value) || 2.0)}
												/>
												<p class="text-[10px] text-muted-foreground">Standard: 2.0x</p>
											</div>
											<div class="space-y-1">
												<label class="text-xs font-semibold text-foreground">
													Late Arrival Multiplier
												</label>
												<Input
													type="number"
													step="0.1"
													value={latePenalty()}
													onInput={(e) => setLatePenalty(parseFloat(e.currentTarget.value) || 1.0)}
												/>
												<p class="text-[10px] text-muted-foreground">Standard: 1.0x</p>
											</div>
										</div>
										<div class="space-y-1">
											<label class="text-xs font-semibold text-foreground">
												Grace Period (Seconds)
											</label>
											<Input
												type="number"
												step="0.1"
												value={gracePeriod()}
												onInput={(e) => setGracePeriod(parseFloat(e.currentTarget.value) || 0.0)}
											/>
										</div>
									</div>
								</Show>

								<Show when={group().discipline === "backyard_ultra"}>
									<div class="pt-3 border-t border-border space-y-3">
										<div class="text-xs font-bold text-forest uppercase tracking-wider">
											Backyard Ultra Standards
										</div>
										<div class="grid grid-cols-2 gap-3">
											<div class="space-y-1">
												<label class="text-xs font-semibold text-foreground">
													Yard Distance (Miles)
												</label>
												<Input
													type="number"
													step="0.000001"
													value={yardDistance()}
													onInput={(e) => setYardDistance(parseFloat(e.currentTarget.value) || 4.166667)}
												/>
												<p class="text-[10px] text-muted-foreground">Standard: 4.166667 mi</p>
											</div>
											<div class="space-y-1">
												<label class="text-xs font-semibold text-foreground">
													Yard Time Limit (Seconds)
												</label>
												<Input
													type="number"
													value={yardTimeLimit()}
													onInput={(e) => setYardTimeLimit(parseInt(e.currentTarget.value, 10) || 3600)}
												/>
												<p class="text-[10px] text-muted-foreground">Standard: 3600s (60m)</p>
											</div>
										</div>
									</div>
								</Show>

								<div class="pt-2">
									<Button
										type="submit"
										variant="forest"
										class="w-full text-xs font-semibold"
										disabled={isSavingRules() || !access().canManageStaff}
									>
										{isSavingRules() ? "Saving..." : "Save Discipline Rules"}
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
				</div>

				{/* Column 2: Staff & Station Assignment Matrix (7 cols) */}
				<div class="lg:col-span-7 space-y-6">
					<Card>
						<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-4">
							<div>
								<CardTitle class="text-lg font-bold font-serif">
									Staff & Station Assignment Matrix
								</CardTitle>
								<CardDescription>
									Roster race staff, assign station timing points, and generate 1-tap volunteer logger links.
								</CardDescription>
							</div>

							<Show when={access().canManageStaff}>
								<Button
									variant="forest"
									size="sm"
									onClick={() => setRosterOpen(true)}
									class="gap-1 text-xs font-semibold cursor-pointer"
								>
									<span>+</span>
									<span>Roster Staff</span>
								</Button>
							</Show>
						</CardHeader>

						<CardContent class="space-y-4">
							<Show
								when={staff().length > 0}
								fallback={
									<div class="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
										No staff rostered yet for this event group. Click "+ Roster Staff" to assign volunteers or captains.
									</div>
								}
							>
								<div class="space-y-3">
									<For each={staff()}>
										{(s) => {
											const fullName = `${s.person.firstName} ${s.person.lastName}`;
											return (
												<div class="rounded-xl border border-border bg-surface p-4 space-y-3">
													{/* Staff Header */}
													<div class="flex flex-wrap items-center justify-between gap-2">
														<div>
															<div class="flex items-center gap-2">
																<span class="text-sm font-bold text-foreground">
																	{fullName}
																</span>
																<For each={s.roles}>
																	{(role) => (
																		<Badge
																			variant={ROLE_BADGE_VARIANTS[role]}
																			class="text-[10px] py-0 px-1.5"
																		>
																			{ROLE_DISPLAY_NAMES[role]}
																		</Badge>
																	)}
																</For>
															</div>
															<div class="text-xs text-muted-foreground mt-0.5">
																{s.person.email ?? "No email on file"}
																{s.person.phone && ` · ${s.person.phone}`}
															</div>
														</div>

														<Show when={access().canManageStaff}>
															<div class="flex items-center gap-1.5">
																<button
																	type="button"
																	onClick={() => {
																		setSelectedStaffId(s.staffId);
																		setSelectedPointId(timingPoints()[0]?.id ?? "");
																		setAssignOpen(true);
																	}}
																	class="text-xs font-semibold text-forest hover:underline px-2 py-1"
																>
																	+ Assign Station
																</button>
																<button
																	type="button"
																	onClick={() => handleRemoveStaff(s.staffId, fullName)}
																	class="text-xs text-destructive hover:underline px-2 py-1"
																>
																	Remove
																</button>
															</div>
														</Show>
													</div>

													{/* Station assignments list */}
													<div class="pt-2 border-t border-border/60">
														<div class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
															Assigned Station Checkpoints ({s.timingPoints.length})
														</div>

														<Show
															when={s.timingPoints.length > 0}
															fallback={
																<span class="text-xs text-muted-foreground italic">
																	Unstationed / General Roster
																</span>
															}
														>
															<div class="flex flex-col gap-2">
																<For each={s.timingPoints}>
																	{(point) => {
																		const isCopied = () => copiedCode() === point.code;
																		return (
																			<div class="flex items-center justify-between gap-2 rounded-lg bg-card border border-border/80 px-3 py-1.5 text-xs">
																				<div class="flex items-center gap-2">
																					<span class="font-bold text-foreground">
																						{point.name}
																					</span>
																					<span class="rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
																						{point.code}
																					</span>
																				</div>

																				<div class="flex items-center gap-2">
																					<button
																						type="button"
																						onClick={() => copyLoggerLink(point.code)}
																						class="text-xs font-mono text-forest hover:underline inline-flex items-center gap-1 cursor-pointer"
																						title="Copy 1-tap Station Volunteer Logger Link"
																					>
																						<span>{isCopied() ? "✓ Copied!" : "📋 Copy Link"}</span>
																					</button>

																					<Show when={access().canManageStaff}>
																						<button
																							type="button"
																							onClick={() => handleRemoveStation(s.staffId, point.id)}
																							class="text-muted-foreground hover:text-destructive text-sm px-1"
																							title="Unassign timing point"
																						>
																							×
																						</button>
																					</Show>
																				</div>
																			</div>
																		);
																	}}
																</For>
															</div>
														</Show>
													</div>
												</div>
											);
										}}
									</For>
								</div>
							</Show>
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Roster Staff Modal Dialog */}
			<Dialog open={rosterOpen()} onOpenChange={setRosterOpen}>
				<DialogContent class="max-w-md">
					<DialogHeader>
						<DialogTitle>Roster Staff Member</DialogTitle>
						<DialogDescription>
							Add a volunteer, timing official, or checkpoint captain to this event group.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleRosterStaff} class="space-y-4 py-2">
						<Show when={rosterError()}>
							<div class="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
								{rosterError()}
							</div>
						</Show>

						<div class="space-y-1">
							<label class="text-xs font-semibold text-foreground">Email Address</label>
							<Input
								type="email"
								value={rosterEmail()}
								onInput={(e) => setRosterEmail(e.currentTarget.value)}
								placeholder="volunteer@example.com"
								required
							/>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1">
								<label class="text-xs font-semibold text-foreground">First Name</label>
								<Input
									value={rosterFirstName()}
									onInput={(e) => setRosterFirstName(e.currentTarget.value)}
									placeholder="Jane"
								/>
							</div>
							<div class="space-y-1">
								<label class="text-xs font-semibold text-foreground">Last Name</label>
								<Input
									value={rosterLastName()}
									onInput={(e) => setRosterLastName(e.currentTarget.value)}
									placeholder="Doe"
								/>
							</div>
						</div>

						<div class="space-y-1">
							<label class="text-xs font-semibold text-foreground">Staff Role</label>
							<select
								value={rosterRole()}
								onChange={(e) => setRosterRole(e.currentTarget.value as StaffRole)}
								class="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
								required
							>
								<option value="volunteer">Volunteer (Aid Station Logger)</option>
								<option value="checkpoint_captain">Checkpoint Captain (Station Lead)</option>
								<option value="official">Official (Timing Steward / Corrections)</option>
								<option value="medical">Medical & SAR Lead (Emergency Gated)</option>
							</select>
						</div>

						<div class="space-y-1">
							<label class="text-xs font-semibold text-foreground">
								Initial Timing Point Station (Optional)
							</label>
							<select
								value={rosterStationId()}
								onChange={(e) => setRosterStationId(e.currentTarget.value)}
								class="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
							>
								<option value="">No initial station assigned</option>
								<For each={timingPoints()}>
									{(tp) => <option value={tp.id}>{tp.name} ({tp.code})</option>}
								</For>
							</select>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setRosterOpen(false)}
								disabled={isRostering()}
							>
								Cancel
							</Button>
							<Button type="submit" variant="forest" disabled={isRostering()}>
								{isRostering() ? "Rostering..." : "Roster Staff"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Assign Station Modal Dialog */}
			<Dialog open={assignOpen()} onOpenChange={setAssignOpen}>
				<DialogContent class="max-w-sm">
					<DialogHeader>
						<DialogTitle>Assign Station Timing Point</DialogTitle>
						<DialogDescription>
							Station this staff member at a physical checkpoint.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleAssignStation} class="space-y-4 py-2">
						<div class="space-y-1">
							<label class="text-xs font-semibold text-foreground">Timing Point</label>
							<select
								value={selectedPointId()}
								onChange={(e) => setSelectedPointId(e.currentTarget.value)}
								class="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
								required
							>
								<For each={timingPoints()}>
									{(tp) => <option value={tp.id}>{tp.name} ({tp.code})</option>}
								</For>
							</select>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setAssignOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" variant="forest">
								Assign Station
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
