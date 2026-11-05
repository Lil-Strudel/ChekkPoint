import { createFileRoute, getRouteApi } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import ActionError from "~/components/ActionError";
import ConfirmButton from "~/components/ConfirmButton";
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
import { createOrgAction } from "~/orgs/actions";
import { deleteStaff, saveStaff } from "~/orgs/orgs.functions";
import { STAFF_ROLE_LABELS, STAFF_ROLES } from "~/orgs/orgs.shared";

export const Route = createFileRoute(
	"/_authed/event-groups/$eventGroupId/staff",
)({ component: Staff });

const groupRoute = getRouteApi("/_authed/event-groups/$eventGroupId");

type StaffRole = (typeof STAFF_ROLES)[number];

function toggle<T>(list: T[], item: T, on: boolean) {
	return on ? [...list, item] : list.filter((i) => i !== item);
}

function Staff() {
	const data = groupRoute.useLoaderData();
	const eventGroupId = () => data().eventGroup.id;
	const action = createOrgAction();

	const [firstName, setFirstName] = createSignal("");
	const [lastName, setLastName] = createSignal("");
	const [email, setEmail] = createSignal("");
	const [roles, setRoles] = createSignal<StaffRole[]>(["volunteer"]);
	const [stations, setStations] = createSignal<string[]>([]);
	const addStaff = async (e: SubmitEvent) => {
		e.preventDefault();
		const ok = await action.run(() =>
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
		<Card>
			<CardHeader>
				<CardTitle>Staff</CardTitle>
				<CardDescription>
					Rostered people get access as soon as they sign in with the same
					email. Adding someone already on the roster updates their roles and
					stations.
				</CardDescription>
			</CardHeader>
			<CardContent class="grid gap-6">
				<ActionError error={action.error()} />
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
										<span class="text-xs text-muted-foreground">{s.email}</span>
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
									<TableCell>{s.timingPointCodes.join(", ") || "—"}</TableCell>
									<TableCell>
										<Badge variant={s.claimed ? "sage" : "sand"}>
											{s.claimed ? "Signed up" : "Not yet"}
										</Badge>
									</TableCell>
									<Show when={data().can.manageStaff}>
										<TableCell class="text-right">
											<ConfirmButton
												label="Remove"
												pending={action.pending()}
												onConfirm={() =>
													action.run(() =>
														deleteStaff({
															data: {
																eventGroupId: eventGroupId(),
																staffId: s.id,
															},
														}),
													)
												}
											/>
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
							<TextField value={firstName()} onChange={setFirstName} required>
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
							disabled={roles().length === 0 || action.pending()}
						>
							Add to roster
						</Button>
					</form>
				</Show>
			</CardContent>
		</Card>
	);
}
