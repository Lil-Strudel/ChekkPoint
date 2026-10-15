import { createMemo, createSignal, type JSX, Show } from "solid-js";
import * as z from "zod";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	TextField,
	TextFieldDescription,
	TextFieldErrorMessage,
	TextFieldInput,
	TextFieldLabel,
} from "~/components/ui/text-field";
import {
	type OrganizationInput,
	organizationInput,
	slugify,
} from "~/orgs/orgs.shared";

export type OrgFormErrors = { name?: string; slug?: string; form?: string };

const SLUG_TAKEN_CODES = new Set([
	"ORGANIZATION_ALREADY_EXISTS",
	"ORGANIZATION_SLUG_ALREADY_TAKEN",
]);

type Validation = {
	data?: OrganizationInput;
	name?: string;
	slug?: string;
};

export function orgFormErrors(error: {
	code?: string;
	message?: string;
}): OrgFormErrors {
	if (error.code && SLUG_TAKEN_CODES.has(error.code)) {
		return { slug: "Another organization already uses this address." };
	}
	return { form: error.message ?? "Something went wrong" };
}

export default function OrgForm(props: {
	initial?: OrganizationInput;
	submitLabel: string;
	onSubmit: (org: OrganizationInput) => Promise<OrgFormErrors | undefined>;
	children?: JSX.Element;
}) {
	const [name, setName] = createSignal(props.initial?.name ?? "");
	const [slug, setSlug] = createSignal(props.initial?.slug ?? "");
	const [slugEdited, setSlugEdited] = createSignal(props.initial !== undefined);
	const [submitted, setSubmitted] = createSignal(false);
	const [pending, setPending] = createSignal(false);
	const [serverErrors, setServerErrors] = createSignal<OrgFormErrors>({});

	const validation = createMemo((): Validation => {
		const result = organizationInput.safeParse({ name: name(), slug: slug() });
		if (result.success) return { data: result.data };
		const { fieldErrors } = z.flattenError(result.error);
		return { name: fieldErrors.name?.[0], slug: fieldErrors.slug?.[0] };
	});

	const errorFor = (field: "name" | "slug") =>
		submitted() ? (validation()[field] ?? serverErrors()[field]) : undefined;

	const changeName = (value: string) => {
		setName(value);
		setServerErrors({});
		if (!slugEdited()) setSlug(slugify(value));
	};

	// Clearing the slug hands it back to the name.
	const changeSlug = (value: string) => {
		setServerErrors({});
		setSlugEdited(value !== "");
		setSlug(value === "" ? slugify(name()) : value.toLowerCase());
	};

	const submit = async (e: SubmitEvent) => {
		e.preventDefault();
		setSubmitted(true);
		const { data } = validation();
		if (!data) return;
		setPending(true);
		setServerErrors((await props.onSubmit(data)) ?? {});
		setPending(false);
	};

	return (
		<form class="grid gap-6" novalidate onSubmit={submit}>
			<TextField
				value={name()}
				onChange={changeName}
				validationState={errorFor("name") ? "invalid" : "valid"}
			>
				<TextFieldLabel>Name</TextFieldLabel>
				<TextFieldInput placeholder="Wasatch Trail Runners" maxLength={80} />
				<TextFieldErrorMessage>{errorFor("name")}</TextFieldErrorMessage>
			</TextField>

			<TextField
				value={slug()}
				onChange={changeSlug}
				validationState={errorFor("slug") ? "invalid" : "valid"}
			>
				<TextFieldLabel>Address</TextFieldLabel>
				<TextFieldInput
					placeholder="wasatch-trail-runners"
					maxLength={48}
					autocapitalize="none"
					spellcheck={false}
				/>
				<TextFieldDescription>
					/orgs/{slug() || "your-organization"}
				</TextFieldDescription>
				<TextFieldErrorMessage>{errorFor("slug")}</TextFieldErrorMessage>
			</TextField>

			<Show when={serverErrors().form}>
				<Alert variant="destructive">
					<AlertDescription>{serverErrors().form}</AlertDescription>
				</Alert>
			</Show>

			<div class="flex flex-wrap gap-3">
				<Button type="submit" disabled={pending()}>
					{props.submitLabel}
				</Button>
				{props.children}
			</div>
		</form>
	);
}
