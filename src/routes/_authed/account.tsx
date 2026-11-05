import { createFileRoute, Link, useRouter } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import {
	getAccountOverview,
	linkMyExternalProfile,
	selfCheckInAction,
	unlinkMyExternalProfile,
	updateMyProfile,
} from "~/auth/account.functions";
import { authClient } from "~/auth/client";
import EmptyState from "~/components/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "~/components/ui/tabs";
import { formatDay } from "~/orgs/format";

export const Route = createFileRoute("/_authed/account")({
	loader: () => getAccountOverview(),
	component: Account,
});

const PROVIDER_LABELS: Record<string, string> = {
	credential: "Email & password",
	google: "Google",
	strava: "Strava",
};

const EXTERNAL_PLATFORMS = [
	{ value: "ultrasignup", label: "UltraSignup" },
	{ value: "itra", label: "ITRA" },
	{ value: "strava", label: "Strava" },
	{ value: "duv", label: "DUV Ultra Marathon" },
	{ value: "athlinks", label: "Athlinks" },
] as const;

type ExternalPlatform = (typeof EXTERNAL_PLATFORMS)[number]["value"];

async function unwrap<T>(
	request: Promise<{ data: T | null; error: { message?: string } | null }>,
) {
	const { data, error } = await request;
	if (error) throw new Error(error.message ?? "Request failed");
	return data;
}

function Account() {
	const router = useRouter();
	const context = Route.useRouteContext();
	const data = Route.useLoaderData();
	const viewer = () => context().viewer;

	const [globalError, setGlobalError] = createSignal<string>();
	const [globalSuccess, setGlobalSuccess] = createSignal<string>();

	const act = async (action: () => Promise<unknown>, successMsg?: string) => {
		setGlobalError(undefined);
		setGlobalSuccess(undefined);
		try {
			await action();
			await router.invalidate();
			if (successMsg) setGlobalSuccess(successMsg);
		} catch (err) {
			setGlobalError(
				err instanceof Error ? err.message : "Something went wrong",
			);
		}
	};

	// Tab 1: Profile form state
	const person = () => data().person;
	const [firstName, setFirstName] = createSignal(
		person()?.firstName ?? viewer().person?.firstName ?? "",
	);
	const [lastName, setLastName] = createSignal(
		person()?.lastName ?? viewer().person?.lastName ?? "",
	);
	const [gender, setGender] = createSignal(person()?.gender ?? "");
	const [birthdate, setBirthdate] = createSignal(
		person()?.birthdate ? person()!.birthdate!.slice(0, 10) : "",
	);
	const [phone, setPhone] = createSignal(person()?.phone ?? "");
	const [city, setCity] = createSignal(person()?.address?.city ?? "");
	const [state, setState] = createSignal(person()?.address?.state ?? "");
	const [country, setCountry] = createSignal(
		person()?.address?.country ?? "USA",
	);

	const [savingProfile, setSavingProfile] = createSignal(false);
	const handleSaveProfile = async (e: SubmitEvent) => {
		e.preventDefault();
		setSavingProfile(true);
		await act(
			() =>
				updateMyProfile({
					data: {
						firstName: firstName().trim(),
						lastName: lastName().trim(),
						gender: gender().trim() || null,
						birthdate: birthdate() || null,
						phone: phone().trim() || null,
						city: city().trim() || null,
						state: state().trim() || null,
						country: country().trim() || null,
					},
				}),
			"Athlete profile details saved.",
		);
		setSavingProfile(false);
	};

	// External profile linking state
	const [linkModalOpen, setLinkModalOpen] = createSignal(false);
	const [linkPlatform, setLinkPlatform] =
		createSignal<ExternalPlatform>("ultrasignup");
	const [linkIdentifier, setLinkIdentifier] = createSignal("");
	const [linkUrl, setLinkUrl] = createSignal("");
	const [linkingPending, setLinkingPending] = createSignal(false);

	const handleAddExternalProfile = async (e: SubmitEvent) => {
		e.preventDefault();
		setLinkingPending(true);
		await act(
			() =>
				linkMyExternalProfile({
					data: {
						platform: linkPlatform(),
						externalIdentifier: linkIdentifier().trim(),
						profileUrl: linkUrl().trim() || null,
					},
				}),
			"External athletic profile linked successfully.",
		);
		setLinkingPending(false);
		if (!globalError()) {
			setLinkModalOpen(false);
			setLinkIdentifier("");
			setLinkUrl("");
		}
	};

	// Self check-in state
	const [checkingInId, setCheckingInId] = createSignal<string | null>(null);
	const handleSelfCheckIn = async (entrantId: string) => {
		setCheckingInId(entrantId);
		await act(
			() => selfCheckInAction({ data: { entrantId } }),
			"Self check-in completed! Have a fantastic race.",
		);
		setCheckingInId(null);
	};

	// Security helpers
	const linked = (providerId: string) =>
		data().accounts.some((a) => a.providerId === providerId);

	const link = (provider: "google" | "strava") =>
		act(() =>
			unwrap(authClient.linkSocial({ provider, callbackURL: "/account" })),
		);

	return (
		<main class="page-wrap pb-24 pt-16">
			<div class="mb-8">
				<p class="page-label">Account Hub</p>
				<h1 class="page-title">
					{firstName() || lastName()
						? `${firstName()} ${lastName()}`.trim()
						: viewer().user.name || viewer().user.email}
				</h1>
				<p class="page-sub">{viewer().user.email}</p>
			</div>

			<Show when={globalError()}>
				<Alert variant="destructive" class="mb-6">
					<AlertTitle>Action Failed</AlertTitle>
					<AlertDescription>{globalError()}</AlertDescription>
				</Alert>
			</Show>

			<Show when={globalSuccess()}>
				<Alert
					variant="default"
					class="mb-6 border-forest/40 bg-forest/10 text-forest-deep"
				>
					<AlertTitle>Success</AlertTitle>
					<AlertDescription>{globalSuccess()}</AlertDescription>
				</Alert>
			</Show>

			{/* 3-Tab Workspace */}
			<Tabs defaultValue="athlete" class="w-full">
				<TabsList class="grid w-full grid-cols-3 max-w-xl mb-8">
					<TabsTrigger value="athlete">Athlete Profile</TabsTrigger>
					<TabsTrigger value="races">Races & Shifts</TabsTrigger>
					<TabsTrigger value="security">Security</TabsTrigger>
				</TabsList>

				{/* TAB 1: Athlete Profile & External Profiles */}
				<TabsContent value="athlete" class="space-y-8">
					<div class="grid gap-8 lg:grid-cols-3">
						{/* Demographics Card */}
						<Card class="lg:col-span-2">
							<CardHeader>
								<CardTitle>Demographics & Athlete Bio</CardTitle>
								<CardDescription>
									Personal info used for event registrations, age categories, and
									safety check-in.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<form onSubmit={handleSaveProfile} class="space-y-4">
									<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div class="space-y-1.5">
											<Label for="acctFirstName">First Name</Label>
											<Input
												id="acctFirstName"
												value={firstName()}
												onInput={(e) => setFirstName(e.currentTarget.value)}
												required
												autocomplete="given-name"
											/>
										</div>
										<div class="space-y-1.5">
											<Label for="acctLastName">Last Name</Label>
											<Input
												id="acctLastName"
												value={lastName()}
												onInput={(e) => setLastName(e.currentTarget.value)}
												required
												autocomplete="family-name"
											/>
										</div>
									</div>

									<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
										<div class="space-y-1.5">
											<Label for="acctGender">Gender</Label>
											<Input
												id="acctGender"
												value={gender()}
												onInput={(e) => setGender(e.currentTarget.value)}
												placeholder="M / F / Non-binary"
											/>
										</div>
										<div class="space-y-1.5">
											<Label for="acctBirthdate">Birthdate</Label>
											<Input
												id="acctBirthdate"
												type="date"
												value={birthdate()}
												onInput={(e) => setBirthdate(e.currentTarget.value)}
											/>
										</div>
										<div class="space-y-1.5">
											<Label for="acctPhone">Phone Number</Label>
											<Input
												id="acctPhone"
												type="tel"
												value={phone()}
												onInput={(e) => setPhone(e.currentTarget.value)}
												placeholder="+1 (555) 000-0000"
												autocomplete="tel"
											/>
										</div>
									</div>

									<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
										<div class="space-y-1.5">
											<Label for="acctCity">City</Label>
											<Input
												id="acctCity"
												value={city()}
												onInput={(e) => setCity(e.currentTarget.value)}
												placeholder="Seattle"
												autocomplete="address-level2"
											/>
										</div>
										<div class="space-y-1.5">
											<Label for="acctState">State / Region</Label>
											<Input
												id="acctState"
												value={state()}
												onInput={(e) => setState(e.currentTarget.value)}
												placeholder="WA"
												autocomplete="address-level1"
											/>
										</div>
										<div class="space-y-1.5">
											<Label for="acctCountry">Country</Label>
											<Input
												id="acctCountry"
												value={country()}
												onInput={(e) => setCountry(e.currentTarget.value)}
												placeholder="USA"
												autocomplete="country-name"
											/>
										</div>
									</div>

									<div class="pt-2">
										<Button type="submit" disabled={savingProfile()}>
											{savingProfile() ? "Saving..." : "Save Demographics"}
										</Button>
									</div>
								</form>
							</CardContent>
						</Card>

						{/* Public Profile Card */}
						<Card class="flex flex-col justify-between">
							<CardHeader>
								<CardTitle>Public Athlete Profile</CardTitle>
								<CardDescription>
									Your ChekkPoint racing history, career finishes, and pace stats.
								</CardDescription>
							</CardHeader>
							<CardContent class="space-y-4">
								<div class="rounded-lg border border-border bg-muted/40 p-4">
									<p class="text-xs text-muted-foreground mb-1">
										Verified Identifier
									</p>
									<p class="font-mono text-xs font-semibold text-foreground truncate">
										{viewer().person?.id ?? "No athlete ID"}
									</p>
								</div>
								<Show when={viewer().person?.id}>
									<Link
										to="/athletes/$personId"
										params={{ personId: viewer().person!.id }}
										target="_blank"
										class="inline-flex w-full items-center justify-center rounded-md border border-border bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors gap-1.5"
									>
										<span>View Public Results Page</span>
										<span>↗</span>
									</Link>
								</Show>
							</CardContent>
						</Card>
					</div>

					{/* External Profiles Table */}
					<Card>
						<CardHeader class="flex flex-row items-center justify-between">
							<div>
								<CardTitle>External Athletic Profiles</CardTitle>
								<CardDescription>
									Link your UltraSignup, ITRA, Strava, or DUV profiles to
									consolidate race histories.
								</CardDescription>
							</div>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setLinkModalOpen(true)}
							>
								+ Link Profile
							</Button>
						</CardHeader>
						<CardContent>
							<Show
								when={data().externalProfiles.length > 0}
								fallback={
									<EmptyState
										title="No external profiles linked"
										description="Connect your UltraSignup, ITRA, or Strava account to verify past results."
									/>
								}
							>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Platform</TableHead>
											<TableHead>Account / Identifier</TableHead>
											<TableHead>Verification</TableHead>
											<TableHead class="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										<For each={data().externalProfiles}>
											{(ext) => (
												<TableRow>
													<TableCell class="font-semibold capitalize">
														<Badge variant="outline">{ext.platform}</Badge>
													</TableCell>
													<TableCell class="font-mono text-sm">
														<Show
															when={ext.profileUrl}
															fallback={ext.externalIdentifier}
														>
															<a
																href={ext.profileUrl!}
																target="_blank"
																rel="noopener noreferrer"
																class="text-foreground underline-offset-4 hover:underline"
															>
																{ext.externalIdentifier} ↗
															</a>
														</Show>
													</TableCell>
													<TableCell>
														<Badge
															variant={
																ext.verificationStatus === "verified"
																	? "forest"
																	: "secondary"
															}
															class="capitalize text-xs"
														>
															{ext.verificationStatus}
														</Badge>
													</TableCell>
													<TableCell class="text-right">
														<Button
															variant="ghost"
															size="sm"
															class="text-destructive hover:bg-destructive/10 text-xs h-7 px-2"
															onClick={() =>
																act(
																	() =>
																		unlinkMyExternalProfile({
																			data: { profileId: ext.id },
																		}),
																	"Profile unlinked.",
																)
															}
														>
															Unlink
														</Button>
													</TableCell>
												</TableRow>
											)}
										</For>
									</TableBody>
								</Table>
							</Show>
						</CardContent>
					</Card>
				</TabsContent>

				{/* TAB 2: My Races & Volunteer Shifts */}
				<TabsContent value="races" class="space-y-8">
					{/* Registered Races */}
					<Card>
						<CardHeader>
							<CardTitle>My Registered Races</CardTitle>
							<CardDescription>
								Events you are competing in, with instant bib check-in on race
								morning.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Show
								when={data().myRaces.length > 0}
								fallback={
									<EmptyState
										title="No race entries yet"
										description="When you register for races organized on ChekkPoint, your bib number and schedule will appear here."
									/>
								}
							>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Bib #</TableHead>
											<TableHead>Race / Division</TableHead>
											<TableHead>Event Group</TableHead>
											<TableHead>Scheduled Start</TableHead>
											<TableHead>Status</TableHead>
											<TableHead class="text-right">Check-In</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										<For each={data().myRaces}>
											{(race) => (
												<TableRow>
													<TableCell class="font-mono font-bold text-base tabular-nums">
														{race.competitorNumber
															? `#${race.competitorNumber}`
															: "—"}
													</TableCell>
													<TableCell class="font-semibold text-foreground">
														{race.eventName}
													</TableCell>
													<TableCell class="text-muted-foreground text-sm">
														{race.eventGroupName}
													</TableCell>
													<TableCell class="whitespace-nowrap tabular-nums text-sm text-muted-foreground">
														{formatDay(race.scheduledStart)}
													</TableCell>
													<TableCell>
														<Badge
															variant={
																race.status === "finished"
																	? "forest"
																	: race.status === "started"
																		? "clay"
																		: "secondary"
															}
															class="capitalize text-xs"
														>
															{race.status}
														</Badge>
													</TableCell>
													<TableCell class="text-right whitespace-nowrap">
														<Show
															when={race.checkedInAt}
															fallback={
																<Show
																	when={
																		race.allowSelfCheckIn &&
																		race.status === "registered"
																	}
																	fallback={
																		<span class="text-xs text-muted-foreground">
																			Staff check-in
																		</span>
																	}
																>
																	<Button
																		size="sm"
																		class="h-7 px-3 text-xs"
																		disabled={checkingInId() === race.id}
																		onClick={() => handleSelfCheckIn(race.id)}
																	>
																		{checkingInId() === race.id
																			? "Checking in..."
																			: "Self Check-In"}
																	</Button>
																</Show>
															}
														>
															<span class="text-xs font-medium text-forest">
																✓ Checked In
															</span>
														</Show>
													</TableCell>
												</TableRow>
											)}
										</For>
									</TableBody>
								</Table>
							</Show>
						</CardContent>
					</Card>

					{/* Volunteer Shifts */}
					<Card>
						<CardHeader>
							<CardTitle>My Volunteer & Staff Shifts</CardTitle>
							<CardDescription>
								Aid station and checkpoint timing assignments with direct 1-click
								station logger access.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Show
								when={data().myVolunteerShifts.length > 0}
								fallback={
									<EmptyState
										title="No volunteer shifts assigned"
										description="When an event director assigns you to staff a timing station, it will appear here."
									/>
								}
							>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Event Group</TableHead>
											<TableHead>Organization</TableHead>
											<TableHead>Date</TableHead>
											<TableHead>Assigned Stations</TableHead>
											<TableHead class="text-right">Field Logger</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										<For each={data().myVolunteerShifts}>
											{(shift) => (
												<TableRow>
													<TableCell class="font-semibold text-foreground">
														{shift.eventGroupName}
													</TableCell>
													<TableCell class="text-sm text-muted-foreground">
														{shift.organizationName}
													</TableCell>
													<TableCell class="whitespace-nowrap tabular-nums text-sm text-muted-foreground">
														{formatDay(shift.startDate)}
													</TableCell>
													<TableCell>
														<div class="flex flex-wrap gap-1">
															<For each={shift.timingPoints}>
																{(tp) => (
																	<Badge
																		variant="chip"
																		class="text-xs font-mono"
																	>
																		{tp.name} ({tp.code})
																	</Badge>
																)}
															</For>
															<Show when={shift.timingPoints.length === 0}>
																<span class="text-xs text-muted-foreground italic">
																	All stations (Roaming)
																</span>
															</Show>
														</div>
													</TableCell>
													<TableCell class="text-right whitespace-nowrap">
														<div class="flex items-center justify-end gap-1.5">
															<For each={shift.timingPoints}>
																{(tp) => (
																	<a
																		href={`/orgs/${shift.organizationSlug}/event-groups/${shift.eventGroupSlug}`}
																		class="inline-flex items-center rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
																	>
																		Log {tp.code} ↗
																	</a>
																)}
															</For>
															<Show when={shift.timingPoints.length === 0}>
																<a
																	href={`/orgs/${shift.organizationSlug}/event-groups/${shift.eventGroupSlug}`}
																	class="inline-flex items-center rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
																>
																	Open Logger ↗
																</a>
															</Show>
														</div>
													</TableCell>
												</TableRow>
											)}
										</For>
									</TableBody>
								</Table>
							</Show>
						</CardContent>
					</Card>
				</TabsContent>

				{/* TAB 3: Security & Connected Accounts */}
				<TabsContent value="security" class="space-y-8">
					<div class="grid gap-6 md:grid-cols-2">
						{/* Passkeys */}
						<Card>
							<CardHeader>
								<CardTitle>Passkeys</CardTitle>
								<CardDescription>
									Sign in at remote aid stations or check-in tents using TouchID,
									FaceID, or security keys.
								</CardDescription>
							</CardHeader>
							<CardContent class="grid gap-3">
								<For
									each={data().passkeys}
									fallback={
										<p class="m-0 text-sm text-muted-foreground">
											No passkeys registered yet.
										</p>
									}
								>
									{(key) => (
										<div class="flex items-center justify-between gap-3 text-sm">
											<span>
												{key.name || "Hardware Key"}{" "}
												<span class="text-muted-foreground text-xs">
													added {new Date(key.createdAt).toLocaleDateString()}
												</span>
											</span>
											<Button
												size="sm"
												variant="ghost"
												class="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
												onClick={() =>
													act(() =>
														unwrap(
															authClient.passkey.deletePasskey({
																id: key.id,
															}),
														),
													)
												}
											>
												Remove
											</Button>
										</div>
									)}
								</For>
								<div class="pt-2">
									<Button
										onClick={() =>
											act(() => unwrap(authClient.passkey.addPasskey()))
										}
									>
										+ Add Passkey
									</Button>
								</div>
							</CardContent>
						</Card>

						{/* Linked Social Accounts */}
						<Card>
							<CardHeader>
								<CardTitle>Connected Auth Accounts</CardTitle>
								<CardDescription>
									Third-party authentication providers linked to your login.
								</CardDescription>
							</CardHeader>
							<CardContent class="grid gap-3">
								<For each={data().accounts}>
									{(account) => (
										<div class="flex items-center justify-between gap-3 text-sm">
											<Badge variant="chip">
												{PROVIDER_LABELS[account.providerId] ??
													account.providerId}
											</Badge>
											<Show when={account.providerId !== "credential"}>
												<Button
													size="sm"
													variant="ghost"
													class="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
													onClick={() =>
														act(() =>
															unwrap(
																authClient.unlinkAccount({
																	accountId: account.id,
																}),
															),
														)
													}
												>
													Unlink
												</Button>
											</Show>
										</div>
									)}
								</For>
								<div class="flex flex-wrap gap-2 pt-2">
									<Show when={data().providers.google && !linked("google")}>
										<Button variant="outline" onClick={() => link("google")}>
											Link Google
										</Button>
									</Show>
									<Show when={data().providers.strava && !linked("strava")}>
										<Button variant="outline" onClick={() => link("strava")}>
											Link Strava
										</Button>
									</Show>
								</div>
							</CardContent>
						</Card>

						{/* Signed-in Devices */}
						<Card class="md:col-span-2">
							<CardHeader>
								<CardTitle>Active Devices & Sessions</CardTitle>
								<CardDescription>
									Manage your active browser and field logger sessions.
								</CardDescription>
							</CardHeader>
							<CardContent class="grid gap-3">
								<For each={data().sessions}>
									{(session) => (
										<div class="flex items-center justify-between gap-3 text-sm border-b border-border/40 pb-2">
											<span class="min-w-0 truncate text-muted-foreground font-mono text-xs">
												{session.userAgent ?? "Web Client"}
											</span>
											<Button
												size="sm"
												variant="ghost"
												class="h-7 px-2 text-xs"
												onClick={() =>
													act(() =>
														unwrap(
															authClient.revokeSession({
																token: session.token,
															}),
														),
													)
												}
											>
												Revoke
											</Button>
										</div>
									)}
								</For>
								<div class="pt-2">
									<Button
										variant="outline"
										onClick={() =>
											act(() => unwrap(authClient.revokeOtherSessions()))
										}
									>
										Sign out everywhere else
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>

			{/* Link External Profile Modal */}
			<Dialog open={linkModalOpen()} onOpenChange={setLinkModalOpen}>
				<DialogContent class="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Link Athletic Profile</DialogTitle>
						<DialogDescription>
							Connect your profile from race databases or fitness platforms.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleAddExternalProfile} class="space-y-4 py-3">
						<div class="space-y-1.5">
							<Label for="linkPlatformSelect">Platform</Label>
							<select
								id="linkPlatformSelect"
								value={linkPlatform()}
								onChange={(e) =>
									setLinkPlatform(e.currentTarget.value as ExternalPlatform)
								}
								class="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
							>
								<For each={EXTERNAL_PLATFORMS}>
									{(plat) => (
										<option value={plat.value}>{plat.label}</option>
									)}
								</For>
							</select>
						</div>

						<div class="space-y-1.5">
							<Label for="linkIdentInput">External Runner ID / Username</Label>
							<Input
								id="linkIdentInput"
								value={linkIdentifier()}
								onInput={(e) => setLinkIdentifier(e.currentTarget.value)}
								placeholder="e.g. 104829 or 'kilian-jornet'"
								required
								autofocus
							/>
						</div>

						<div class="space-y-1.5">
							<Label for="linkUrlInput">Profile URL (Optional)</Label>
							<Input
								id="linkUrlInput"
								type="url"
								value={linkUrl()}
								onInput={(e) => setLinkUrl(e.currentTarget.value)}
								placeholder="https://ultrasignup.com/results_participant.aspx?fname=..."
							/>
						</div>

						<DialogFooter class="pt-3">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setLinkModalOpen(false)}
								disabled={linkingPending()}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={linkingPending() || !linkIdentifier().trim()}
							>
								{linkingPending() ? "Linking..." : "Link Profile"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</main>
	);
}
