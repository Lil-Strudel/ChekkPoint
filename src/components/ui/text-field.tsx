import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as TextFieldPrimitive from "@kobalte/core/text-field";
import type { JSX, ValidComponent } from "solid-js";
import { For, Match, Switch, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export type TextFieldProps<T extends ValidComponent = "div"> =
	TextFieldPrimitive.TextFieldRootProps<T> & {
		class?: string | undefined;
	};

export const TextField = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, TextFieldProps<T>>,
) => {
	const [local, others] = splitProps(props as TextFieldProps, ["class"]);

	return (
		<TextFieldPrimitive.Root
			data-slot="text-field"
			class={cn("grid w-full gap-2", local.class)}
			{...others}
		/>
	);
};

export type TextFieldInputProps<T extends ValidComponent = "input"> =
	TextFieldPrimitive.TextFieldInputProps<T> & {
		class?: string | undefined;
	};

export const TextFieldInput = <T extends ValidComponent = "input">(
	props: PolymorphicProps<T, TextFieldInputProps<T>>,
) => {
	const [local, others] = splitProps(props as TextFieldInputProps, ["class"]);

	return (
		<TextFieldPrimitive.Input
			data-slot="text-field-input"
			class={cn(
				"border-input bg-surface text-foreground placeholder:text-muted-foreground flex h-9 w-full rounded-xl border px-3 py-1.5 text-sm shadow-xs transition-colors outline-hidden focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
				local.class,
			)}
			{...others}
		/>
	);
};

export type TextFieldTextAreaProps<T extends ValidComponent = "textarea"> =
	TextFieldPrimitive.TextFieldTextAreaProps<T> & {
		class?: string | undefined;
	};

export const TextFieldTextArea = <T extends ValidComponent = "textarea">(
	props: PolymorphicProps<T, TextFieldTextAreaProps<T>>,
) => {
	const [local, others] = splitProps(props as TextFieldTextAreaProps, [
		"class",
	]);

	return (
		<TextFieldPrimitive.TextArea
			data-slot="text-field-textarea"
			class={cn(
				"border-input bg-surface text-foreground placeholder:text-muted-foreground flex min-h-28 w-full rounded-xl border px-3 py-2 text-sm shadow-xs transition-colors outline-hidden focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
				local.class,
			)}
			{...others}
		/>
	);
};

export type TextFieldLabelProps<T extends ValidComponent = "label"> =
	TextFieldPrimitive.TextFieldLabelProps<T> & {
		class?: string | undefined;
	};

export const TextFieldLabel = <T extends ValidComponent = "label">(
	props: PolymorphicProps<T, TextFieldLabelProps<T>>,
) => {
	const [local, others] = splitProps(props as TextFieldLabelProps, ["class"]);

	return (
		<TextFieldPrimitive.Label
			data-slot="text-field-label"
			class={cn(
				"text-sm font-medium select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[invalid]:text-destructive",
				local.class,
			)}
			{...others}
		/>
	);
};

export type TextFieldErrorMessageProps<T extends ValidComponent = "div"> =
	TextFieldPrimitive.TextFieldErrorMessageProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
		errors?: ({ message?: string } | undefined)[];
	};

export const TextFieldErrorMessage = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, TextFieldErrorMessageProps<T>>,
) => {
	const [local, others] = splitProps(props as TextFieldErrorMessageProps, [
		"class",
		"errors",
		"children",
	]);

	const uniqueErrors = () => [
		...new Map(local.errors?.map((error) => [error?.message, error])).values(),
	];

	return (
		<TextFieldPrimitive.ErrorMessage
			data-slot="text-field-error-message"
			class={cn("text-destructive text-sm", local.class)}
			{...others}
		>
			<Switch
				fallback={
					<ul class="ml-4 flex list-disc flex-col gap-1">
						<For each={uniqueErrors()}>
							{(error) => <li>{error?.message}</li>}
						</For>
					</ul>
				}
			>
				<Match when={local.children}>{local.children}</Match>
				<Match when={!local.errors?.length}>{null}</Match>
				<Match when={uniqueErrors().length === 1}>
					{uniqueErrors()[0]?.message}
				</Match>
			</Switch>
		</TextFieldPrimitive.ErrorMessage>
	);
};

export type TextFieldDescriptionProps<T extends ValidComponent = "div"> =
	TextFieldPrimitive.TextFieldDescriptionProps<T> & {
		class?: string | undefined;
	};

export const TextFieldDescription = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, TextFieldDescriptionProps<T>>,
) => {
	const [local, others] = splitProps(props as TextFieldDescriptionProps, [
		"class",
	]);

	return (
		<TextFieldPrimitive.Description
			data-slot="text-field-description"
			class={cn("text-muted-foreground text-sm", local.class)}
			{...others}
		/>
	);
};
