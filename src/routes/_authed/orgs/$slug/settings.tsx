import {
	createFileRoute,
	getRouteApi,
	useNavigate,
	useRouter,
} from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import ActionError from "~/components/ActionError";
import EmptyState from "~/components/EmptyState";
import OrgSection from "~/components/OrgSection";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { createOrgAction } from "~/orgs/actions";
import { authClient } from "~/auth/client";
import { editOrganizationDetails } from "~/orgs/orgs.functions";

export const Route = createFileRoute("/_authed/orgs/$slug/settings")({
	component: Settings,
});

const orgRoute = getRouteApi("/_authed/orgs/$slug");

const zones = Intl.supportedValuesOf("timeZone");
const timeZones = zones.includes("UTC") ? zones : ["UTC", ...zones];

function Settings() {
	const data = orgRoute.useLoaderData();
	const navigate = useNavigate();
	const router = useRouter();
	const org = () => data().organization;
	const meta = () => org().parsedMeta;

	const [name, setName] = createSignal(org().name);
	const [slug, setSlug] = createSignal(org().slug);
	const [logo, setLogo] = createSignal(org().logo ?? "");
	const [location, setLocation] = createSignal(meta()?.location ?? "");
	const [timeZone, setTimeZone] = createSignal(
		meta()?.timeZone ??
			Intl.DateTimeFormat().resolvedOptions().timeZone ??
			"UTC",
	);
	const [website, setWebsite] = createSignal(meta()?.website ?? "");
	const [establishedYear, setEstablishedYear] = createSignal(
		meta()?.establishedYear ? String(meta().establishedYear) : "",
	);
	const [description, setDescription] = createSignal(meta()?.description ?? "");

	const [saveSuccess, setSaveSuccess] = createSignal(false);
	const saveAction = createOrgAction();

	const handleSave = async (e: SubmitEvent) => {
		e.preventDefault();
		setSaveSuccess(false);

		const yearNum = establishedYear().trim()
			? Number.parseInt(establishedYear().trim(), 10)
			: null;

		const ok = await saveAction.run(() =>
			editOrganizationDetails({
				data: {
					organizationId: org().id,
					name: name().trim(),
					slug: slug().trim(),
					logo: logo().trim() || null,
					location: location().trim() || undefined,
					timeZone: timeZone().trim(),
					website: website().trim() || null,
					establishedYear:
						yearNum && !Number.isNaN(yearNum) ? yearNum : undefined,
					description: description().trim() || undefined,
				},
			}),
		);

		if (ok) {
			setSaveSuccess(true);
			if (slug().trim() !== org().slug) {
				await navigate({
					to: "/orgs/$slug/settings",
					params: { slug: slug().trim() },
				});
			} else {
				await router.invalidate();
			}
		}
	};

	return (
		<Show
			when={data().can.updateOrganization || data().can.deleteOrganization}
			fallback={
				<EmptyState
					title="Settings are for organization owners and admins"
					description="Ask an organizer admin if details or public profile configurations need to be changed."
				/>
			}
		>
			<div class="flex max-w-2xl flex-col gap-12">
				<Show when={data().can.updateOrganization}>
					<OrgSection
						title="Organization Profile"
						description="Identity, public landing page details, and default time zones."
					>
						<Card class="p-6">
							<Show when={saveSuccess()}>
								<Alert variant="default" class="mb-5 border-forest/40 bg-forest/10 text-forest-deep">
									<AlertTitle>Saved</AlertTitle>
									<AlertDescription>
										Organization details have been updated successfully.
									</AlertDescription>
								</Alert>
							</Show>

							<Show when={saveAction.error()}>
								<div class="mb-5">
									<ActionError error={saveAction.error()} />
								</div>
							</Show>

							<form onSubmit={handleSave} class="space-y-5">
								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div class="space-y-1.5">
										<Label for="orgName">Organization Name</Label>
										<Input
											id="orgName"
											value={name()}
											onInput={(e) => setName(e.currentTarget.value)}
											placeholder="e.g. Rainshadow Running"
											required
										/>
									</div>

									<div class="space-y-1.5">
										<Label for="orgSlug">URL Slug</Label>
										<Input
											id="orgSlug"
											value={slug()}
											onInput={(e) => setSlug(e.currentTarget.value)}
											placeholder="rainshadow-running"
											required
										/>
										<p class="text-[11px] text-muted-foreground">
											Public storefront at /organizers/{slug() || "slug"}
										</p>
									</div>
								</div>

								<div class="space-y-1.5">
									<Label for="orgLogo">Logo URL</Label>
									<Input
										id="orgLogo"
										type="url"
										value={logo()}
										onInput={(e) => setLogo(e.currentTarget.value)}
										placeholder="https://example.com/logo.png"
									/>
									<p class="text-[11px] text-muted-foreground">
										Direct link to an image file (PNG, SVG, or WEBP).
									</p>
								</div>

								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div class="space-y-1.5">
										<Label for="orgLocation">Headquarters / Location</Label>
										<Input
											id="orgLocation"
											value={location()}
											onInput={(e) => setLocation(e.currentTarget.value)}
											placeholder="e.g. Bellingham, WA"
										/>
									</div>

									<div class="space-y-1.5">
										<Label for="orgTimeZone">Default Time Zone</Label>
										<Input
											id="orgTimeZone"
											value={timeZone()}
											onInput={(e) => setTimeZone(e.currentTarget.value)}
											list="org-tz-list"
											required
										/>
										<datalist id="org-tz-list">
											<For each={timeZones}>
												{(zone) => <option value={zone} />}
											</For>
										</datalist>
									</div>
								</div>

								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div class="space-y-1.5">
										<Label for="orgWebsite">Website</Label>
										<Input
											id="orgWebsite"
											type="url"
											value={website()}
											onInput={(e) => setWebsite(e.currentTarget.value)}
											placeholder="https://rainshadowrunning.com"
										/>
									</div>

									<div class="space-y-1.5">
										<Label for="orgYear">Established Year</Label>
										<Input
											id="orgYear"
											type="number"
											min="1900"
											max="2100"
											value={establishedYear()}
											onInput={(e) => setEstablishedYear(e.currentTarget.value)}
											placeholder="e.g. 2010"
										/>
									</div>
								</div>

								<div class="space-y-1.5">
									<Label for="orgDesc">About / Description</Label>
									<Textarea
										id="orgDesc"
										rows={4}
										value={description()}
										onInput={(e) => setDescription(e.currentTarget.value)}
										placeholder="Describe your organization, history, mission, or trail community..."
									/>
								</div>

								<div class="pt-2">
									<Button type="submit" disabled={saveAction.pending()}>
										{saveAction.pending() ? "Saving..." : "Save Changes"}
									</Button>
								</div>
							</form>
						</Card>
					</OrgSection>
				</Show>

				<Show when={data().can.deleteOrganization}>
					<DeleteOrganization organizationId={org().id} name={org().name} />
				</Show>
			</div>
		</Show>
	);
}

function DeleteOrganization(props: { organizationId: string; name: string }) {
	const navigate = useNavigate();
	const [confirming, setConfirming] = createSignal(false);
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal<string>();

	const remove = async () => {
		setPending(true);
		setError(undefined);
		try {
			const result = await authClient.organization.delete({
				organizationId: props.organizationId,
			});
			if (result.error) {
				setError(result.error.message || "Failed to delete organization");
				return;
			}
			await navigate({ to: "/orgs" });
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setPending(false);
		}
	};

	return (
		<OrgSection title="Danger Zone">
			<Card class="border-destructive/30 p-6">
				<h3 class="m-0 text-sm font-semibold text-foreground">
					Delete this organization
				</h3>
				<p class="m-0 mt-1 text-sm text-muted-foreground">
					Permanently deletes this organization along with all associated courses,
					event groups, timing points, and athlete results. This action cannot be
					undone.
				</p>
				<Show when={error()}>
					<Alert variant="destructive" class="mt-4">
						<AlertTitle>Cannot Delete Organization</AlertTitle>
						<AlertDescription>{error()}</AlertDescription>
					</Alert>
				</Show>
				<div class="mt-5 flex flex-wrap gap-3">
					<Show
						when={confirming()}
						fallback={
							<Button variant="destructive" onClick={() => setConfirming(true)}>
								Delete organization
							</Button>
						}
					>
						<Button
							variant="destructive"
							disabled={pending()}
							onClick={remove}
						>
							{pending() ? "Deleting..." : `Permanently Delete ${props.name}`}
						</Button>
						<Button variant="ghost" onClick={() => setConfirming(false)}>
							Cancel
						</Button>
					</Show>
				</div>
			</Card>
		</OrgSection>
	);
}
