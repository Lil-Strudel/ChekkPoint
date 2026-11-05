import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as DialogPrimitive from "@kobalte/core/dialog";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetPortal = DialogPrimitive.Portal;
export const SheetCloseButton = DialogPrimitive.CloseButton;

export type SheetOverlayProps<T extends ValidComponent = "div"> =
	DialogPrimitive.DialogOverlayProps<T> & {
		class?: string | undefined;
	};

export const SheetOverlay = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, SheetOverlayProps<T>>,
) => {
	const [local, others] = splitProps(props as SheetOverlayProps, ["class"]);

	return (
		<DialogPrimitive.Overlay
			data-slot="sheet-overlay"
			class={cn(
				"fixed inset-0 z-50 bg-ink/40 duration-200 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0",
				local.class,
			)}
			{...others}
		/>
	);
};

export const sheetVariants = cva(
	"fixed z-50 gap-4 bg-popover p-6 shadow-xl border-border duration-200 ease-in-out data-[expanded]:animate-in data-[closed]:animate-out outline-hidden",
	{
		variants: {
			side: {
				top: "inset-x-0 top-0 border-b data-[closed]:slide-out-to-top data-[expanded]:slide-in-from-top",
				bottom:
					"inset-x-0 bottom-0 border-t data-[closed]:slide-out-to-bottom data-[expanded]:slide-in-from-bottom",
				left: "inset-y-0 left-0 h-full w-3/4 border-r data-[closed]:slide-out-to-left data-[expanded]:slide-in-from-left sm:max-w-sm",
				right:
					"inset-y-0 right-0 h-full w-3/4 border-l data-[closed]:slide-out-to-right data-[expanded]:slide-in-from-right sm:max-w-md",
			},
		},
		defaultVariants: {
			side: "right",
		},
	},
);

export type SheetContentProps<T extends ValidComponent = "div"> =
	DialogPrimitive.DialogContentProps<T> &
		VariantProps<typeof sheetVariants> & {
			class?: string | undefined;
			children?: JSX.Element;
		};

export const SheetContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, SheetContentProps<T>>,
) => {
	const [local, others] = splitProps(props as SheetContentProps, [
		"class",
		"children",
		"side",
	]);

	return (
		<DialogPrimitive.Portal>
			<SheetOverlay />
			<DialogPrimitive.Content
				data-slot="sheet-content"
				class={cn(sheetVariants({ side: local.side ?? "right" }), local.class)}
				{...others}
			>
				{local.children}
				<DialogPrimitive.CloseButton
					aria-label="Close"
					class="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground opacity-70 hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring cursor-pointer"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="size-4"
					>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</DialogPrimitive.CloseButton>
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	);
};

export type SheetHeaderProps = ComponentProps<"div">;

export const SheetHeader = (props: SheetHeaderProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<div
			data-slot="sheet-header"
			class={cn("flex flex-col space-y-2 text-left", local.class)}
			{...others}
		/>
	);
};

export type SheetFooterProps = ComponentProps<"div">;

export const SheetFooter = (props: SheetFooterProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<div
			data-slot="sheet-footer"
			class={cn(
				"flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4",
				local.class,
			)}
			{...others}
		/>
	);
};

export type SheetTitleProps<T extends ValidComponent = "h2"> =
	DialogPrimitive.DialogTitleProps<T> & {
		class?: string | undefined;
	};

export const SheetTitle = <T extends ValidComponent = "h2">(
	props: PolymorphicProps<T, SheetTitleProps<T>>,
) => {
	const [local, others] = splitProps(props as SheetTitleProps, ["class"]);

	return (
		<DialogPrimitive.Title
			data-slot="sheet-title"
			class={cn(
				"text-lg font-bold leading-none tracking-tight text-foreground font-serif",
				local.class,
			)}
			{...others}
		/>
	);
};

export type SheetDescriptionProps<T extends ValidComponent = "p"> =
	DialogPrimitive.DialogDescriptionProps<T> & {
		class?: string | undefined;
	};

export const SheetDescription = <T extends ValidComponent = "p">(
	props: PolymorphicProps<T, SheetDescriptionProps<T>>,
) => {
	const [local, others] = splitProps(props as SheetDescriptionProps, ["class"]);

	return (
		<DialogPrimitive.Description
			data-slot="sheet-description"
			class={cn("text-sm text-muted-foreground leading-relaxed", local.class)}
			{...others}
		/>
	);
};
