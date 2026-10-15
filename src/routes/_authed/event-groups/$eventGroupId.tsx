import { createFileRoute, Link, useRouter } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { ORG_ROLE_LABELS } from "~/auth/access";
import FormSelect from "~/components/FormSelect";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "~/components/ui/text-field";
import {
	addTime,
	deleteStaff,
	getEventGroup,
	saveStaff,
} from "~/orgs/orgs.functions";
import { STAFF_ROLE_LABELS, STAFF_ROLES } from "~/orgs/orgs.shared";

export const Route = createFileRoute("/_authed/event-groups/$eventGroupId")({
	loader: ({ params }) =>
		getEventGroup({ data: { eventGroupId: params.eventGroupId } }),
	notFoundComponent: () => (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Event group</p>
			<h1 class="page-title">Not found</h1>
			<p class="page-sub">It doesn't exist, or you don't have access to it.</p>
		</main>
	),
	component: EventGroupPage,
});

type StaffRole = (typeof STAFF_ROLES)[number];

function toggle<T>(list: T[], item: T, on: boolean) {
	return on ? [...list, item] : list.filter((i) => i !== item);
}

function EventGroupPage() {
	const router = useRouter();
	const data = Route.useLoaderData();
	const group = () => data().eventGroup;
	const eventGroupId = () => group().id;
	const [error, setError] = createSignal<string>();
	const [notice, setNotice] = createSignal<string>();

	const act = async (action: () => Promise<unknown>) => {
		setError(undefined);
		setNotice(undefined);
		try {
			await action();
			await router.invalidate();
			return true;
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			return false;
		}
	};

	const myStations = () =>
		data().timingPoints.filter((p) =>
			data().access.timingPointIds.includes(p.id),
		);

	const [timingPointId, setTimingPointId] = createSignal("");
	const [bib, setBib] = createSignal("");
	const [kind, setKind] = createSignal<string>("in");
	const record = async (e: SubmitEvent) => {
		e.preventDefault();
		const ok = await act(() =>
			addTime({
				data: {
					eventGroupId: eventGroupId(),
					timingPointId: timingPointId(),
					competitorNumber: bib(),
					subSplitKind: kind() as "in" | "out" | "point",
				},
			}),
		);
		if (ok) {
			setNotice(`Recorded bib ${bib()}.`);
			setBib("");
		}
	};

	const [firstName, setFirstName] = createSignal("");
	const [lastName, setLastName] = createSignal("");
	const [email, setEmail] = createSignal("");
	const [roles, setRoles] = createSignal<StaffRole[]>(["volunteer"]);
	const [stations, setStations] = createSignal<string[]>([]);
	const addStaff = async (e: SubmitEvent) => {
		e.preventDefault();
		const ok = await act(() =>
			saveStaff({
				data: {
					eventGroupId: eventGroupId(),
					firstName: firstName(),
					lastName: lastName(),
					email: email(),
					roles: roles(),
					timingPointIds: stations(),
				},
			}),
		);
		if (ok) {
			setFirstName("");
			setLastName("");
			setEmail("");
			setStations([]);
		}
	};

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">
				<Link to="/orgs/$slug" params={{ slug: group().organizationSlug }}>
					{group().organizationName}
				</Link>
			</p>
			<h1 class="page-title">{group().name}</h1>
			<div class="mb-10 flex flex-wrap items-center gap-2">
				<span class="text-sm text-muted-foreground">Your access</span>
				<For each={data().access.orgRoles}>
					{(role) => <Badge variant="forest">{ORG_ROLE_LABELS[role]}</Badge>}
				</For>
				<For each={data().access.staffRoles}>
					{(role) => <Badge variant="sage">{STAFF_ROLE_LABELS[role]}</Badge>}
				</For>
			</div>

			<Show when={error()}>
				<Alert variant="destructive" class="mb-6">
					<AlertDescription>{error()}</AlertDescription>
				</Alert>
			</Show>
			<Show when={notice()}>
				<Alert variant="info" class="mb-6">
					<AlertDescription>{notice()}</AlertDescription>
				</Alert>
			</Show>

			<div class="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Record a time</CardTitle>
						<CardDescription>
							Volunteers can record only at the checkpoints they are stationed
							at; the server rejects anything else.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Show when={myStations().length > 0}>
							<p class="mb-4 mt-0 text-sm">
								Your station:{" "}
								<For each={myStations()}>
									{(p) => <Badge variant="sage">{p.code}</Badge>}
								</For>
							</p>
						</Show>
						<form class="grid gap-4" onSubmit={record}>
							<FormSelect
								label="Timing point"
								placeholder="Choose a checkpoint"
								value={timingPointId()}
								onChange={setTimingPointId}
								options={data().timingPoints.map((p) => ({
									value: p.id,
									label: data().can.recordAt.includes(p.id)
										? `${p.code} · ${p.name}`
										: `${p.code} · ${p.name} (not yours)`,
								}))}
							/>
							<div class="grid grid-cols-2 gap-4">
								<TextField value={bib()} onChange={setBib} required>
									<TextFieldLabel>Bib</TextFieldLabel>
									<TextFieldInput inputmode="numeric" class="tabular-nums" />
								</TextField>
								<FormSelect
									label="Kind"
									value={kind()}
									onChange={setKind}
									options={[
										{ value: "in", label: "In" },
										{ value: "out", label: "Out" },
										{ value: "point", label: "Point" },
									]}
								/>
							</div>
							<Button
								type="submit"
								class="justify-self-start"
								disabled={!timingPointId()}
							>
								Record
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Recent times</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Bib</TableHead>
									<TableHead>Point</TableHead>
									<TableHead>Time</TableHead>
									<TableHead>By</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<For each={data().recentTimes}>
									{(t) => (
										<TableRow>
											<TableCell class="tabular-nums">
												{t.competitorNumber}
											</TableCell>
											<TableCell>
												{t.timingPointCode} {t.subSplitKind}
											</TableCell>
											<TableCell class="tabular-nums">
												{new Date(t.recordedTimeUtc).toLocaleTimeString()}
											</TableCell>
											<TableCell>{t.recordedBy ?? "—"}</TableCell>
										</TableRow>
									)}
								</For>
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>

			<Show when={data().access.orgRoles.length > 0}>
				<Card class="mt-6">
					<CardHeader>
						<CardTitle>Staff</CardTitle>
						<CardDescription>
							Rostered people get access as soon as they sign in with the same
							email.
						</CardDescription>
					</CardHeader>
					<CardContent class="grid gap-6">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Roles</TableHead>
									<TableHead>Stations</TableHead>
									<TableHead>Account</TableHead>
									<Show when={data().can.manageStaff}>
										<TableHead />
									</Show>
								</TableRow>
							</TableHeader>
							<TableBody>
								<For each={data().roster}>
									{(s) => (
										<TableRow>
											<TableCell>
												<span class="block font-semibold">
													{s.firstName} {s.lastName}
												</span>
												<span class="text-xs text-muted-foreground">
													{s.email}
												</span>
											</TableCell>
											<TableCell>
												<span class="flex flex-wrap gap-1">
													<For each={s.roles}>
														{(role) => (
															<Badge variant="chip">
																{STAFF_ROLE_LABELS[role]}
															</Badge>
														)}
													</For>
												</span>
											</TableCell>
											<TableCell>
												{s.timingPointCodes.join(", ") || "—"}
											</TableCell>
											<TableCell>
												<Badge variant={s.claimed ? "sage" : "sand"}>
													{s.claimed ? "Signed up" : "Not yet"}
												</Badge>
											</TableCell>
											<Show when={data().can.manageStaff}>
												<TableCell class="text-right">
													<Button
														size="sm"
														variant="ghost"
														onClick={() =>
															act(() =>
																deleteStaff({
																	data: {
																		eventGroupId: eventGroupId(),
																		staffId: s.id,
																	},
																}),
															)
														}
													>
														Remove
													</Button>
												</TableCell>
											</Show>
										</TableRow>
									)}
								</For>
							</TableBody>
						</Table>

						<Show
							when={data().can.manageStaff}
							fallback={
								<p class="m-0 text-sm text-muted-foreground">
									Only owners, admins and race directors can change the roster.
								</p>
							}
						>
							<form
								class="grid gap-4 border-t border-border pt-6"
								onSubmit={addStaff}
							>
								<div class="grid gap-4 sm:grid-cols-3">
									<TextField
										value={firstName()}
										onChange={setFirstName}
										required
									>
										<TextFieldLabel>First name</TextFieldLabel>
										<TextFieldInput />
									</TextField>
									<TextField value={lastName()} onChange={setLastName}>
										<TextFieldLabel>Last name</TextFieldLabel>
										<TextFieldInput />
									</TextField>
									<TextField value={email()} onChange={setEmail} required>
										<TextFieldLabel>Email</TextFieldLabel>
										<TextFieldInput type="email" />
									</TextField>
								</div>
								<div class="grid gap-2">
									<span class="text-sm font-medium">Roles</span>
									<div class="flex flex-wrap gap-x-4 gap-y-2">
										<For each={STAFF_ROLES}>
											{(role) => (
												<Checkbox
													checked={roles().includes(role)}
													onChange={(on: boolean) =>
														setRoles(toggle(roles(), role, on))
													}
												>
													{STAFF_ROLE_LABELS[role]}
												</Checkbox>
											)}
										</For>
									</div>
								</div>
								<div class="grid gap-2">
									<span class="text-sm font-medium">Stations</span>
									<div class="flex flex-wrap gap-x-4 gap-y-2">
										<For
											each={data().timingPoints}
											fallback={
												<span class="text-sm text-muted-foreground">
													Add timing points on the organization page first.
												</span>
											}
										>
											{(point) => (
												<Checkbox
													checked={stations().includes(point.id)}
													onChange={(on: boolean) =>
														setStations(toggle(stations(), point.id, on))
													}
												>
													{point.code}
												</Checkbox>
											)}
										</For>
									</div>
								</div>
								<Button
									type="submit"
									class="justify-self-start"
									disabled={roles().length === 0}
								>
									Add to roster
								</Button>
							</form>
						</Show>
					</CardContent>
				</Card>
			</Show>
		</main>
	);
}
