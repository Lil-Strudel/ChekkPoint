import { createMemo, createSignal, type JSX } from "solid-js";
import * as z from "zod";
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
} from "~/lib/organizations";

type Validation = {
	name?: string;
	slug?: string;
	data?: OrganizationInput;
};

export default function OrgForm(props: {
	initial?: OrganizationInput;
	submitLabel: string;
	submitDisabled?: boolean;
	isSlugTaken: (slug: string) => boolean;
	onSubmit: (org: OrganizationInput) => void;
	children?: JSX.Element;
}) {
	const [name, setName] = createSignal(props.initial?.name ?? "");
	const [slug, setSlug] = createSignal(props.initial?.slug ?? "");
	const [slugEdited, setSlugEdited] = createSignal(props.initial !== undefined);
	const [submitted, setSubmitted] = createSignal(false);

	const validation = createMemo((): Validation => {
		const result = organizationInput.safeParse({ name: name(), slug: slug() });
		if (!result.success) {
			const { fieldErrors } = z.flattenError(result.error);
			return { name: fieldErrors.name?.[0], slug: fieldErrors.slug?.[0] };
		}
		if (
			result.data.slug !== props.initial?.slug &&
			props.isSlugTaken(result.data.slug)
		) {
			return { slug: "Another organization already uses this address." };
		}
		return { data: result.data };
	});

	const stateOf = (error: string | undefined) =>
		submitted() && error ? "invalid" : "valid";

	const changeName = (value: string) => {
		setName(value);
		if (!slugEdited()) setSlug(slugify(value));
	};

	// Clearing the slug hands it back to the name.
	const changeSlug = (value: string) => {
		setSlugEdited(value !== "");
		setSlug(value === "" ? slugify(name()) : value.toLowerCase());
	};

	const submit = (e: SubmitEvent) => {
		e.preventDefault();
		setSubmitted(true);
		const { data } = validation();
		if (data) props.onSubmit(data);
	};

	return (
		<form class="grid gap-6" novalidate onSubmit={submit}>
			<TextField
				value={name()}
				onChange={changeName}
				validationState={stateOf(validation().name)}
			>
				<TextFieldLabel>Name</TextFieldLabel>
				<TextFieldInput placeholder="Wasatch Trail Runners" maxLength={80} />
				<TextFieldErrorMessage>{validation().name}</TextFieldErrorMessage>
			</TextField>

			<TextField
				value={slug()}
				onChange={changeSlug}
				validationState={stateOf(validation().slug)}
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
				<TextFieldErrorMessage>{validation().slug}</TextFieldErrorMessage>
			</TextField>

			<div class="flex flex-wrap gap-3">
				<Button type="submit" disabled={props.submitDisabled}>
					{props.submitLabel}
				</Button>
				{props.children}
			</div>
		</form>
	);
}
