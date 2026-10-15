import { createFileRoute, getRouteApi } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import {
	ORG_ROLE_LABELS,
	ORG_ROLES,
	type OrgRole,
	parseOrgRoles,
} from "~/auth/access";
import { authClient } from "~/auth/client";
import OrgSection from "~/components/OrgSection";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
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
import { createOrgAction } from "~/orgs/actions";

export const Route = createFileRoute("/_authed/orgs/$slug/members")({
	component: Members,
});

const orgRoute = getRouteApi("/_authed/orgs/$slug");

const ASSIGNABLE_ROLES = ORG_ROLES.filter((r) => r !== "owner");

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

function RoleBadges(props: { role: string }) {
	return (
		<span class="flex flex-wrap gap-1">
			<For each={parseOrgRoles(props.role)}>
				{(role) => <Badge variant="chip">{ORG_ROLE_LABELS[role]}</Badge>}
			</For>
		</span>
	);
}

function Members() {
	const data = orgRoute.useLoaderData();
	const organizationId = () => data().organization.id;
	const action = createOrgAction();
	const [inviting, setInviting] = createSignal(false);

	const [editing, setEditing] = createSignal<string>();
	const [editRoles, setEditRoles] = createSignal<OrgRole[]>([]);
	const saveRoles = async (memberId: string) => {
		const ok = await action.runAuth(() =>
			authClient.organization.updateMemberRole({
				organizationId: organizationId(),
				memberId,
				role: editRoles(),
			}),
		);
		if (ok) setEditing(undefined);
	};

	return (
		<div class="flex flex-col gap-16">
			<OrgSection
				title="Members"
				description="Organization roles apply to every event group it runs."
				action={
					<Show when={data().can.invite && !inviting()}>
						<Button onClick={() => setInviting(true)}>Invite member</Button>
					</Show>
				}
			>
				<div class="flex flex-col gap-6">
					<Show when={inviting()}>
						<InviteMember
							organizationId={organizationId()}
							onDone={() => setInviting(false)}
						/>
					</Show>

					<Show when={action.error()}>
						<Alert variant="destructive">
							<AlertDescription>{action.error()}</AlertDescription>
						</Alert>
					</Show>

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
										<TableCell class="text-muted-foreground">
											{member.email}
										</TableCell>
										<TableCell>
											<Show
												when={editing() === member.id}
												fallback={<RoleBadges role={member.role} />}
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
													<div class="flex justify-end gap-2">
														<Button
															size="sm"
															variant="ghost"
															onClick={() => setEditing(undefined)}
														>
															Cancel
														</Button>
														<Button
															size="sm"
															disabled={
																action.pending() || editRoles().length === 0
															}
															onClick={() => saveRoles(member.id)}
														>
															Save
														</Button>
													</div>
												</Show>
											</TableCell>
										</Show>
									</TableRow>
								)}
							</For>
						</TableBody>
					</Table>
				</div>
			</OrgSection>

			<Show when={data().invitations.length > 0}>
				<OrgSection title="Pending invitations">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Email</TableHead>
								<TableHead>Roles</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={data().invitations}>
								{(invitation) => (
									<TableRow>
										<TableCell>{invitation.email}</TableCell>
										<TableCell>
											<RoleBadges role={invitation.role ?? "member"} />
										</TableCell>
										<TableCell class="text-right">
											<Button
												size="sm"
												variant="ghost"
												disabled={action.pending()}
												onClick={() =>
													action.runAuth(() =>
														authClient.organization.cancelInvitation({
															invitationId: invitation.id,
														}),
													)
												}
											>
												Cancel invitation
											</Button>
										</TableCell>
									</TableRow>
								)}
							</For>
						</TableBody>
					</Table>
				</OrgSection>
			</Show>
		</div>
	);
}

function InviteMember(props: { organizationId: string; onDone: () => void }) {
	const action = createOrgAction();
	const [email, setEmail] = createSignal("");
	const [roles, setRoles] = createSignal<OrgRole[]>(["member"]);

	const submit = async (e: SubmitEvent) => {
		e.preventDefault();
		const ok = await action.runAuth(() =>
			authClient.organization.inviteMember({
				organizationId: props.organizationId,
				email: email(),
				role: roles(),
			}),
		);
		if (ok) props.onDone();
	};

	return (
		<Card class="max-w-xl p-6">
			<form class="grid gap-6" onSubmit={submit}>
				<TextField value={email()} onChange={setEmail} required>
					<TextFieldLabel>Email</TextFieldLabel>
					<TextFieldInput type="email" />
				</TextField>
				<div class="grid gap-3">
					<p class="m-0 text-sm font-medium">Roles</p>
					<RolePicker value={roles()} onChange={setRoles} />
				</div>
				<Show when={action.error()}>
					<Alert variant="destructive">
						<AlertDescription>{action.error()}</AlertDescription>
					</Alert>
				</Show>
				<div class="flex flex-wrap gap-3">
					<Button
						type="submit"
						disabled={action.pending() || roles().length === 0}
					>
						Send invitation
					</Button>
					<Button variant="ghost" onClick={props.onDone}>
						Cancel
					</Button>
				</div>
			</form>
		</Card>
	);
}
