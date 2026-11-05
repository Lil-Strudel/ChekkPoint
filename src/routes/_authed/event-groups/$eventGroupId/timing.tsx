import { createFileRoute, getRouteApi } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import ActionError from "~/components/ActionError";
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
import { addTime } from "~/orgs/orgs.functions";

export const Route = createFileRoute(
	"/_authed/event-groups/$eventGroupId/timing",
)({ component: Timing });

const groupRoute = getRouteApi("/_authed/event-groups/$eventGroupId");

function Timing() {
	const data = groupRoute.useLoaderData();
	const action = createOrgAction();
	const [notice, setNotice] = createSignal<string>();

	const myStations = () =>
		data().timingPoints.filter((p) =>
			data().access.timingPointIds.includes(p.id),
		);

	const [timingPointId, setTimingPointId] = createSignal("");
	const [bib, setBib] = createSignal("");
	const [kind, setKind] = createSignal<string>("in");
	const record = async (e: SubmitEvent) => {
		e.preventDefault();
		setNotice(undefined);
		const ok = await action.run(() =>
			addTime({
				data: {
					eventGroupId: data().eventGroup.id,
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

	return (
		<div class="grid gap-6 md:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle>Record a time</CardTitle>
					<CardDescription>
						Volunteers can record only at the checkpoints they are stationed at;
						the server rejects anything else.
					</CardDescription>
				</CardHeader>
				<CardContent class="grid gap-4">
					<Show when={myStations().length > 0}>
						<p class="m-0 text-sm">
							Your station:{" "}
							<For each={myStations()}>
								{(p) => <Badge variant="sage">{p.code}</Badge>}
							</For>
						</p>
					</Show>
					<ActionError error={action.error()} />
					<Show when={notice()}>
						<Alert variant="info">
							<AlertDescription>{notice()}</AlertDescription>
						</Alert>
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
							disabled={!timingPointId() || action.pending()}
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
	);
}
