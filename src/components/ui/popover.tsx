import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as PopoverPrimitive from "@kobalte/core/popover";
import type { ComponentProps, JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverPortal = PopoverPrimitive.Portal;

export type PopoverContentProps<T extends ValidComponent = "div"> =
	PopoverPrimitive.PopoverContentProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

export const PopoverContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, PopoverContentProps<T>>,
) => {
	const [local, others] = splitProps(props as PopoverContentProps, [
		"class",
		"children",
	]);

	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Content
				data-slot="popover-content"
				class={cn(
					"z-50 w-72 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-md outline-hidden duration-150 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95",
					local.class,
				)}
				{...others}
			>
				{local.children}
			</PopoverPrimitive.Content>
		</PopoverPrimitive.Portal>
	);
};

export type PopoverTitleProps<T extends ValidComponent = "h3"> =
	PopoverPrimitive.PopoverTitleProps<T> & {
		class?: string | undefined;
	};

export const PopoverTitle = <T extends ValidComponent = "h3">(
	props: PolymorphicProps<T, PopoverTitleProps<T>>,
) => {
	const [local, others] = splitProps(props as PopoverTitleProps, ["class"]);

	return (
		<PopoverPrimitive.Title
			data-slot="popover-title"
			class={cn("font-medium leading-none tracking-tight text-foreground", local.class)}
			{...others}
		/>
	);
};

export type PopoverDescriptionProps<T extends ValidComponent = "p"> =
	PopoverPrimitive.PopoverDescriptionProps<T> & {
		class?: string | undefined;
	};

export const PopoverDescription = <T extends ValidComponent = "p">(
	props: PolymorphicProps<T, PopoverDescriptionProps<T>>,
) => {
	const [local, others] = splitProps(props as PopoverDescriptionProps, [
		"class",
	]);

	return (
		<PopoverPrimitive.Description
			data-slot="popover-description"
			class={cn("text-sm text-muted-foreground", local.class)}
			{...others}
		/>
	);
};

export const PopoverCloseButton = PopoverPrimitive.CloseButton;
