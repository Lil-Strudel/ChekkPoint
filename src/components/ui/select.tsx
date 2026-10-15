import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as SelectPrimitive from "@kobalte/core/select";
import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectDescription = SelectPrimitive.Description;
export const SelectErrorMessage = SelectPrimitive.ErrorMessage;
export const SelectItemLabel = SelectPrimitive.ItemLabel;
export const SelectSection = SelectPrimitive.Section;

export type SelectTriggerProps<T extends ValidComponent = "button"> =
	SelectPrimitive.SelectTriggerProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

export const SelectTrigger = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, SelectTriggerProps<T>>,
) => {
	const [local, others] = splitProps(props as SelectTriggerProps, [
		"class",
		"children",
	]);

	return (
		<SelectPrimitive.Trigger
			data-slot="select-trigger"
			class={cn(
				"border-input bg-surface text-foreground flex h-9 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm shadow-xs transition-colors outline-hidden focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
				local.class,
			)}
			{...others}
		>
			{local.children}
			<SelectPrimitive.Icon class="size-4 opacity-50">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="size-4"
					aria-hidden="true"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	);
};

export type SelectContentProps<T extends ValidComponent = "div"> =
	SelectPrimitive.SelectContentProps<T> & {
		class?: string | undefined;
	};

export const SelectContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, SelectContentProps<T>>,
) => {
	const [local, others] = splitProps(props as SelectContentProps, ["class"]);

	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Content
				data-slot="select-content"
				class={cn(
					"bg-popover text-popover-foreground relative z-50 min-w-32 overflow-hidden rounded-xl border border-border shadow-lg backdrop-blur-md animate-in fade-in-80",
					local.class,
				)}
				{...others}
			>
				<SelectPrimitive.Listbox class="p-1 outline-hidden" />
			</SelectPrimitive.Content>
		</SelectPrimitive.Portal>
	);
};

export type SelectItemProps<T extends ValidComponent = "li"> =
	SelectPrimitive.SelectItemProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

export const SelectItem = <T extends ValidComponent = "li">(
	props: PolymorphicProps<T, SelectItemProps<T>>,
) => {
	const [local, others] = splitProps(props as SelectItemProps, [
		"class",
		"children",
	]);

	return (
		<SelectPrimitive.Item
			data-slot="select-item"
			class={cn(
				"focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				local.class,
			)}
			{...others}
		>
			<SelectPrimitive.ItemLabel>{local.children}</SelectPrimitive.ItemLabel>
			<SelectPrimitive.ItemIndicator class="size-3.5 text-forest">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="size-3.5"
					aria-hidden="true"
				>
					<path d="M20 6 9 17l-5-5" />
				</svg>
			</SelectPrimitive.ItemIndicator>
		</SelectPrimitive.Item>
	);
};

export type SelectLabelProps<T extends ValidComponent = "label"> =
	SelectPrimitive.SelectLabelProps<T> & {
		class?: string | undefined;
	};

export const SelectLabel = <T extends ValidComponent = "label">(
	props: PolymorphicProps<T, SelectLabelProps<T>>,
) => {
	const [local, others] = splitProps(props as SelectLabelProps, ["class"]);

	return (
		<SelectPrimitive.Label
			data-slot="select-label"
			class={cn(
				"text-xs font-semibold text-muted-foreground px-2 py-1.5",
				local.class,
			)}
			{...others}
		/>
	);
};
