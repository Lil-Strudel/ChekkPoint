import { createFileRoute, Link, useRouter } from "@tanstack/solid-router";
import { createSignal, For, type JSX, Show } from "solid-js";
import {
	ORG_ROLE_LABELS,
	ORG_ROLES,
	type OrgRole,
	parseOrgRoles,
} from "~/auth/access";
import { authClient } from "~/auth/client";
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
	addEventGroup,
	addTimingPoint,
	getOrganization,
} from "~/orgs/orgs.functions";
import { DISCIPLINES } from "~/orgs/orgs.shared";

export const Route = createFileRoute("/_authed/orgs/$slug/")({
	loader: ({ params }) => getOrganization({ data: { slug: params.slug } }),
	notFoundComponent: () => (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Organization</p>
			<h1 class="page-title">Not found</h1>
			<p class="page-sub">It doesn't exist, or you don't have access to it.</p>
		</main>
	),
	component: OrganizationPage,
});

const ASSIGNABLE_ROLES = ORG_ROLES.filter((r) => r !== "owner");

function errorMessage(err: unknown) {
	return err instanceof Error ? err.message : "Something went wrong";
}

function Forbidden(props: { children: JSX.Element }) {
	return <p class="m-0 text-sm text-muted-foreground">{props.children}</p>;
}

function RolePicker(props: {
	value: OrgRole[];
	onChange: (roles: OrgRole[]) => void;
}) {
	const toggle = (role: OrgRole, on: boolean) =>
		props.onChange(
			on ? [...props.value, role] : props.value.filter((r) => r !== role),
		);
	return (
		<div class="flex flex-wrap gap-x-4 gap-y-2">
			<For each={ASSIGNABLE_ROLES}>
				{(role) => (
					<Checkbox
						checked={props.value.includes(role)}
						onChange={(on: boolean) => toggle(role, on)}
					>
						{ORG_ROLE_LABELS[role]}
					</Checkbox>
				)}
			</For>
		</div>
	);
}

function OrganizationPage() {
	const router = useRouter();
	const data = Route.useLoaderData();
	const org = () => data().organization;
	const [error, setError] = createSignal<string>();

	const act = async (action: () => Promise<unknown>) => {
		setError(undefined);
		try {
			await action();
			await router.invalidate();
			return true;
		} catch (err) {
			setError(errorMessage(err));
			return false;
		}
	};

	const authAct = (
		action: () => Promise<{ error: { message?: string } | null }>,
	) =>
		act(async () => {
			const { error } = await action();
			if (error) throw new Error(error.message);
		});

	const [inviteEmail, setInviteEmail] = createSignal("");
	const [inviteRoles, setInviteRoles] = createSignal<OrgRole[]>(["member"]);
	const invite = async (e: SubmitEvent) => {
		e.preventDefault();
		const ok = await authAct(() =>
			authClient.organization.inviteMember({
				organizationId: org().id,
				email: inviteEmail(),
				role: inviteRoles(),
			}),
		);
		if (ok) setInviteEmail("");
	};

	const [editing, setEditing] = createSignal<string>();
	const [editRoles, setEditRoles] = createSignal<OrgRole[]>([]);
	const saveRoles = async (memberId: string) => {
		const ok = await authAct(() =>
			authClient.organization.updateMemberRole({
				organizationId: org().id,
				memberId,
				role: editRoles(),
			}),
		);
		if (ok) setEditing(undefined);
	};

	const [groupName, setGroupName] = createSignal("");
	const [discipline, setDiscipline] = createSignal<string>("trail_ultra");
	const [startDate, setStartDate] = createSignal("");
	const [endDate, setEndDate] = createSignal("");
	const createGroup = async (e: SubmitEvent) => {
		e.preventDefault();
		const ok = await act(() =>
			addEventGroup({
				data: {
					organizationId: org().id,
					name: groupName(),
					discipline: discipline() as (typeof DISCIPLINES)[number],
					startDate: startDate(),
					endDate: endDate() || startDate(),
				},
			}),
		);
		if (ok) setGroupName("");
	};

	const [pointName, setPointName] = createSignal("");
	const [pointCode, setPointCode] = createSignal("");
	const createPoint = async (e: SubmitEvent) => {
		e.preventDefault();
		const ok = await act(() =>
			addTimingPoint({
				data: {
					organizationId: org().id,
					name: pointName(),
					code: pointCode(),
				},
			}),
		);
		if (ok) {
			setPointName("");
			setPointCode("");
		}
	};

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Organization</p>
			<h1 class="page-title">{org().name}</h1>
			<div class="mb-10 flex flex-wrap items-center gap-2">
				<span class="text-sm text-muted-foreground">Your roles</span>
				<For each={data().myRoles}>
					{(role) => <Badge variant="forest">{ORG_ROLE_LABELS[role]}</Badge>}
				</For>
			</div>

			<Show when={error()}>
				<Alert variant="destructive" class="mb-6">
					<AlertDescription>{error()}</AlertDescription>
				</Alert>
			</Show>

			<div class="grid gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Members</CardTitle>
						<CardDescription>
							Owners and admins manage members. Everyone else can only look.
						</CardDescription>
					</CardHeader>
					<CardContent class="grid gap-6">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Roles</TableHead>
									<Show when={data().can.updateMembers}>
										<TableHead />
									</Show>
								</TableRow>
							</TableHeader>
							<TableBody>
								<For each={data().members}>
									{(member) => (
										<TableRow>
											<TableCell class="font-semibold">{member.name}</TableCell>
											<TableCell>{member.email}</TableCell>
											<TableCell>
												<Show
													when={editing() === member.id}
													fallback={
														<span class="flex flex-wrap gap-1">
															<For each={parseOrgRoles(member.role)}>
																{(role) => (
																	<Badge variant="chip">
																		{ORG_ROLE_LABELS[role]}
																	</Badge>
																)}
															</For>
														</span>
													}
												>
													<RolePicker
														value={editRoles()}
														onChange={setEditRoles}
													/>
												</Show>
											</TableCell>
											<Show when={data().can.updateMembers}>
												<TableCell class="text-right">
													<Show
														when={editing() === member.id}
														fallback={
															<Show when={!member.role.includes("owner")}>
																<Button
																	size="sm"
																	variant="ghost"
																	onClick={() => {
																		setEditRoles(parseOrgRoles(member.role));
																		setEditing(member.id);
																	}}
																>
																	Edit roles
																</Button>
															</Show>
														}
													>
														<Button
															size="sm"
															onClick={() => saveRoles(member.id)}
														>
															Save
														</Button>
													</Show>
												</TableCell>
											</Show>
										</TableRow>
									)}
								</For>
							</TableBody>
						</Table>

						<Show
							when={data().can.invite}
							fallback={
								<Forbidden>
									Only owners and admins can invite members.
								</Forbidden>
							}
						>
							<form class="grid gap-4" onSubmit={invite}>
								<TextField
									value={inviteEmail()}
									onChange={setInviteEmail}
									required
									class="max-w-sm"
								>
									<TextFieldLabel>Invite by email</TextFieldLabel>
									<TextFieldInput type="email" />
								</TextField>
								<RolePicker value={inviteRoles()} onChange={setInviteRoles} />
								<Button
									type="submit"
									class="justify-self-start"
									disabled={inviteRoles().length === 0}
								>
									Send invitation
								</Button>
							</form>
							<Show when={data().invitations.length > 0}>
								<div class="grid gap-2">
									<p class="page-label m-0">Pending invitations</p>
									<For each={data().invitations}>
										{(inv) => (
											<div class="flex items-center justify-between gap-3 text-sm">
												<span>
													{inv.email}{" "}
													<span class="text-muted-foreground">
														({inv.role})
													</span>
												</span>
												<Button
													size="sm"
													variant="ghost"
													onClick={() =>
														authAct(() =>
															authClient.organization.cancelInvitation({
																invitationId: inv.id,
															}),
														)
													}
												>
													Cancel
												</Button>
											</div>
										)}
									</For>
								</div>
							</Show>
						</Show>
					</CardContent>
				</Card>

				<div class="grid gap-6 md:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle>Event groups</CardTitle>
						</CardHeader>
						<CardContent class="grid gap-4">
							<For
								each={data().eventGroups}
								fallback={<Forbidden>No event groups yet.</Forbidden>}
							>
								{(group) => (
									<Link
										to="/event-groups/$eventGroupId"
										params={{ eventGroupId: group.id }}
										class="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 hover:bg-accent"
									>
										<span class="font-semibold">{group.name}</span>
										<span class="text-xs text-muted-foreground tabular-nums">
											{new Date(group.startDate).toLocaleDateString()}
										</span>
									</Link>
								)}
							</For>
							<Show
								when={data().can.createEventGroup}
								fallback={
									<Forbidden>
										Only owners, admins and race directors can create event
										groups.
									</Forbidden>
								}
							>
								<form
									class="grid gap-4 border-t border-border pt-4"
									onSubmit={createGroup}
								>
									<TextField
										value={groupName()}
										onChange={setGroupName}
										required
									>
										<TextFieldLabel>Name</TextFieldLabel>
										<TextFieldInput placeholder="Bear 100 2026" />
									</TextField>
									<FormSelect
										label="Discipline"
										value={discipline()}
										onChange={setDiscipline}
										options={DISCIPLINES.map((d) => ({
											value: d,
											label: d.replaceAll("_", " "),
										}))}
									/>
									<div class="grid grid-cols-2 gap-4">
										<TextField
											value={startDate()}
											onChange={setStartDate}
											required
										>
											<TextFieldLabel>Starts</TextFieldLabel>
											<TextFieldInput type="date" />
										</TextField>
										<TextField value={endDate()} onChange={setEndDate}>
											<TextFieldLabel>Ends</TextFieldLabel>
											<TextFieldInput type="date" />
										</TextField>
									</div>
									<Button type="submit" class="justify-self-start">
										Create event group
									</Button>
								</form>
							</Show>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Timing points</CardTitle>
							<CardDescription>
								Physical checkpoints volunteers are stationed at.
							</CardDescription>
						</CardHeader>
						<CardContent class="grid gap-4">
							<div class="flex flex-wrap gap-2">
								<For
									each={data().timingPoints}
									fallback={<Forbidden>No timing points yet.</Forbidden>}
								>
									{(point) => (
										<Badge variant="sand">
											{point.code} · {point.name}
										</Badge>
									)}
								</For>
							</div>
							<Show
								when={data().can.createTimingPoint}
								fallback={
									<Forbidden>
										Only owners, admins and race directors can add timing
										points.
									</Forbidden>
								}
							>
								<form
									class="grid gap-4 border-t border-border pt-4"
									onSubmit={createPoint}
								>
									<TextField
										value={pointName()}
										onChange={setPointName}
										required
									>
										<TextFieldLabel>Name</TextFieldLabel>
										<TextFieldInput placeholder="Twin Lakes aid station" />
									</TextField>
									<TextField
										value={pointCode()}
										onChange={setPointCode}
										required
									>
										<TextFieldLabel>Code</TextFieldLabel>
										<TextFieldInput placeholder="TWIN_LAKES" />
									</TextField>
									<Button type="submit" class="justify-self-start">
										Add timing point
									</Button>
								</form>
							</Show>
						</CardContent>
					</Card>
				</div>
			</div>
		</main>
	);
}
