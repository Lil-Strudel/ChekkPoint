import {
	createFileRoute,
	getRouteApi,
	Link,
	useNavigate,
} from "@tanstack/solid-router";
import { createSignal, type JSX, Show } from "solid-js";
import ActionError from "~/components/ActionError";
import ConfirmButton from "~/components/ConfirmButton";
import EventGroupForm, { dayInputValue } from "~/components/EventGroupForm";
import FormField from "~/components/FormField";
import FormSelect from "~/components/FormSelect";
import OrgSection from "~/components/OrgSection";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import type { RulesConfig } from "~/db/schema";
import {
	editEventGroup,
	editRulesConfig,
	removeEventGroup,
} from "~/event-groups/event-groups.functions";
import { createOrgAction } from "~/orgs/actions";

export const Route = createFileRoute("/_authed/event-groups/$eventGroupId/")({
	component: Overview,
});

const groupRoute = getRouteApi("/_authed/event-groups/$eventGroupId");

function Overview() {
	const data = groupRoute.useLoaderData();
	const navigate = useNavigate();
	const group = () => data().eventGroup;
	const save = createOrgAction();
	const remove = createOrgAction();

	return (
		<Show
			when={data().can.updateEventGroup}
			fallback={
				<p class="text-scrim m-0 text-sm text-muted-foreground">
					Head to{" "}
					<Link
						to="/event-groups/$eventGroupId/timing"
						params={{ eventGroupId: group().id }}
						class="text-foreground underline underline-offset-4"
					>
						Timing
					</Link>{" "}
					to record times at your station.
				</p>
			}
		>
			<div class="flex flex-col gap-12">
				<OrgSection title="Details">
					<EventGroupForm
						initial={{
							name: group().name,
							discipline: group().discipline,
							startDate: dayInputValue(group().startDate),
							endDate: dayInputValue(group().endDate),
							timeZone: group().timeZone,
							location: group().location,
						}}
						submitLabel="Save details"
						error={save.error()}
						pending={save.pending()}
						onSubmit={(fields) =>
							save.run(() =>
								editEventGroup({
									data: { eventGroupId: group().id, ...fields },
								}),
							)
						}
					/>
				</OrgSection>

				<OrgSection
					title="Rules"
					description="How times are shown and scored for every event in this group."
				>
					<RulesForm
						eventGroupId={group().id}
						discipline={group().discipline}
						rules={group().rulesConfig}
					/>
				</OrgSection>

				<Show when={data().can.deleteEventGroup}>
					<OrgSection title="Danger zone">
						<Card class="flex flex-col gap-4 border-destructive/30 p-6">
							<p class="m-0 text-sm text-muted-foreground">
								Deleting the event group removes its events, entrants, staff
								roster and every recorded time. Courses and timing points stay.
							</p>
							<ActionError error={remove.error()} />
							<div>
								<ConfirmButton
									label="Delete event group"
									pending={remove.pending()}
									onConfirm={() =>
										remove.run(async () => {
											await removeEventGroup({
												data: { eventGroupId: group().id },
											});
											await navigate({
												to: "/orgs/$slug/event-groups",
												params: { slug: group().organizationSlug },
											});
										})
									}
								/>
							</div>
						</Card>
					</OrgSection>
				</Show>
			</div>
		</Show>
	);
}

function Fieldset(props: { legend: string; children: JSX.Element }) {
	return (
		<fieldset class="m-0 grid gap-4 border-0 p-0">
			<legend class="mb-2 p-0 text-sm font-semibold text-foreground">
				{props.legend}
			</legend>
			{props.children}
		</fieldset>
	);
}

function RulesForm(props: {
	eventGroupId: string;
	discipline: string;
	rules: RulesConfig;
}) {
	const action = createOrgAction();
	const [timeFormat, setTimeFormat] = createSignal(props.rules.timeFormat);
	const [precision, setPrecision] = createSignal(
		String(props.rules.displayPrecisionDecimals),
	);
	const [selfCheckIn, setSelfCheckIn] = createSignal(
		props.rules.allowSelfCheckIn,
	);
	const [requirePacer, setRequirePacer] = createSignal(
		props.rules.requirePacerRegistration,
	);
	const [early, setEarly] = createSignal(
		String(props.rules.earlyPenaltyFactor),
	);
	const [late, setLate] = createSignal(String(props.rules.latePenaltyFactor));
	const [grace, setGrace] = createSignal(
		String(props.rules.gracePeriodSeconds),
	);
	const [yardMiles, setYardMiles] = createSignal(
		String(props.rules.yardDistanceMiles),
	);
	const [yardMinutes, setYardMinutes] = createSignal(
		String(props.rules.yardTimeLimitSeconds / 60),
	);

	const submit = (e: SubmitEvent) => {
		e.preventDefault();
		action.run(() =>
			editRulesConfig({
				data: {
					eventGroupId: props.eventGroupId,
					rulesConfig: {
						timeFormat: timeFormat(),
						displayPrecisionDecimals: Number(precision()),
						allowSelfCheckIn: selfCheckIn(),
						requirePacerRegistration: requirePacer(),
						earlyPenaltyFactor: Number(early()),
						latePenaltyFactor: Number(late()),
						gracePeriodSeconds: Number(grace()),
						yardDistanceMiles: Number(yardMiles()),
						yardTimeLimitSeconds: Number(yardMinutes()) * 60,
					},
				},
			}),
		);
	};

	return (
		<Card class="max-w-xl p-6">
			<form class="grid gap-8" onSubmit={submit}>
				<Fieldset legend="Display">
					<div class="grid grid-cols-2 gap-4">
						<FormSelect
							label="Time format"
							value={timeFormat()}
							onChange={(v) => setTimeFormat(v as RulesConfig["timeFormat"])}
							options={[
								{ value: "HH:MM:SS", label: "HH:MM:SS" },
								{ value: "HH:MM:SS.sss", label: "HH:MM:SS.sss" },
								{ value: "MM:SS.sss", label: "MM:SS.sss" },
							]}
						/>
						<FormField
							label="Decimal places"
							type="number"
							step="1"
							value={precision()}
							onChange={setPrecision}
						/>
					</div>
				</Fieldset>
				<Fieldset legend="Entrants">
					<Checkbox checked={selfCheckIn()} onChange={setSelfCheckIn}>
						Entrants can check themselves in
					</Checkbox>
					<Checkbox checked={requirePacer()} onChange={setRequirePacer}>
						Pacers must be registered
					</Checkbox>
				</Fieldset>
				<Show when={props.discipline === "tsd_regularity"}>
					<Fieldset legend="Regularity penalties">
						<div class="grid grid-cols-3 gap-4">
							<FormField
								label="Early factor"
								type="number"
								value={early()}
								onChange={setEarly}
							/>
							<FormField
								label="Late factor"
								type="number"
								value={late()}
								onChange={setLate}
							/>
							<FormField
								label="Grace (s)"
								type="number"
								value={grace()}
								onChange={setGrace}
							/>
						</div>
					</Fieldset>
				</Show>
				<Show when={props.discipline === "backyard_ultra"}>
					<Fieldset legend="Backyard yard">
						<div class="grid grid-cols-2 gap-4">
							<FormField
								label="Distance (mi)"
								type="number"
								value={yardMiles()}
								onChange={setYardMiles}
							/>
							<FormField
								label="Time limit (min)"
								type="number"
								value={yardMinutes()}
								onChange={setYardMinutes}
							/>
						</div>
					</Fieldset>
				</Show>
				<ActionError error={action.error()} />
				<Button
					type="submit"
					class="justify-self-start"
					disabled={action.pending()}
				>
					Save rules
				</Button>
			</form>
		</Card>
	);
}
