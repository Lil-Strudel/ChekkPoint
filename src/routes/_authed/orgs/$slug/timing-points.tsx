import { createFileRoute, getRouteApi } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import EmptyState from "~/components/EmptyState";
import OrgSection from "~/components/OrgSection";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
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
import { formatFeet } from "~/orgs/format";
import { addTimingPoint } from "~/orgs/orgs.functions";

export const Route = createFileRoute("/_authed/orgs/$slug/timing-points")({
	component: TimingPoints,
});

const orgRoute = getRouteApi("/_authed/orgs/$slug");

function TimingPoints() {
	const data = orgRoute.useLoaderData();
	const [creating, setCreating] = createSignal(false);

	return (
		<OrgSection
			title="Timing points"
			description="Physical places where times are logged. A course can pass one more than once."
			action={
				<Show when={data().can.createTimingPoint && !creating()}>
					<Button onClick={() => setCreating(true)}>New timing point</Button>
				</Show>
			}
		>
			<div class="flex flex-col gap-6">
				<Show when={creating()}>
					<NewTimingPoint
						organizationId={data().organization.id}
						onDone={() => setCreating(false)}
					/>
				</Show>

				<Show
					when={data().timingPoints.length > 0}
					fallback={
						<Show when={!creating()}>
							<EmptyState
								title="No timing points yet"
								description="Add the aid stations, crossings and finish lines where your volunteers will sit."
							/>
						</Show>
					}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Code</TableHead>
								<TableHead class="text-right">Elevation</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={data().timingPoints}>
								{(point) => (
									<TableRow>
										<TableCell class="font-semibold">{point.name}</TableCell>
										<TableCell>
											<Badge variant="chip">{point.code}</Badge>
										</TableCell>
										<TableCell class="text-right tabular-nums text-muted-foreground">
											{point.elevationMeters === null
												? "—"
												: formatFeet(point.elevationMeters)}
										</TableCell>
									</TableRow>
								)}
							</For>
						</TableBody>
					</Table>
				</Show>
			</div>
		</OrgSection>
	);
}

function NewTimingPoint(props: { organizationId: string; onDone: () => void }) {
	const action = createOrgAction();
	const [name, setName] = createSignal("");
	const [code, setCode] = createSignal("");

	const submit = async (e: SubmitEvent) => {
		e.preventDefault();
		const ok = await action.run(() =>
			addTimingPoint({
				data: {
					organizationId: props.organizationId,
					name: name(),
					code: code(),
				},
			}),
		);
		if (ok) props.onDone();
	};

	return (
		<Card class="max-w-xl p-6">
			<form class="grid gap-6" onSubmit={submit}>
				<TextField value={name()} onChange={setName} required>
					<TextFieldLabel>Name</TextFieldLabel>
					<TextFieldInput placeholder="Twin Lakes aid station" />
				</TextField>
				<TextField value={code()} onChange={setCode} required>
					<TextFieldLabel>Code</TextFieldLabel>
					<TextFieldInput
						placeholder="TWIN_LAKES"
						autocapitalize="characters"
					/>
				</TextField>
				<Show when={action.error()}>
					<Alert variant="destructive">
						<AlertDescription>{action.error()}</AlertDescription>
					</Alert>
				</Show>
				<div class="flex flex-wrap gap-3">
					<Button type="submit" disabled={action.pending()}>
						Add timing point
					</Button>
					<Button variant="ghost" onClick={props.onDone}>
						Cancel
					</Button>
				</div>
			</form>
		</Card>
	);
}
