import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as DialogPrimitive from "@kobalte/core/dialog";
import type { ComponentProps, JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;

export type DialogOverlayProps<T extends ValidComponent = "div"> =
	DialogPrimitive.DialogOverlayProps<T> & {
		class?: string | undefined;
	};

export const DialogOverlay = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, DialogOverlayProps<T>>,
) => {
	const [local, others] = splitProps(props as DialogOverlayProps, ["class"]);

	return (
		<DialogPrimitive.Overlay
			data-slot="dialog-overlay"
			class={cn(
				"fixed inset-0 z-50 bg-ink/40 duration-200 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0",
				local.class,
			)}
			{...others}
		/>
	);
};

export type DialogContentProps<T extends ValidComponent = "div"> =
	DialogPrimitive.DialogContentProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

export const DialogContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, DialogContentProps<T>>,
) => {
	const [local, others] = splitProps(props as DialogContentProps, [
		"class",
		"children",
	]);

	return (
		<DialogPrimitive.Portal>
			<DialogOverlay />
			<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
				<DialogPrimitive.Content
					data-slot="dialog-content"
					class={cn(
						"relative w-full max-w-lg rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-glass duration-200 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 outline-hidden",
						local.class,
					)}
					{...others}
				>
					{local.children}
					<DialogPrimitive.CloseButton
						aria-label="Close"
						class="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring cursor-pointer"
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
			</div>
		</DialogPrimitive.Portal>
	);
};

export type DialogHeaderProps = ComponentProps<"div">;

export const DialogHeader = (props: DialogHeaderProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<div
			data-slot="dialog-header"
			class={cn("flex flex-col space-y-1.5 text-left", local.class)}
			{...others}
		/>
	);
};

export type DialogFooterProps = ComponentProps<"div">;

export const DialogFooter = (props: DialogFooterProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<div
			data-slot="dialog-footer"
			class={cn(
				"flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4",
				local.class,
			)}
			{...others}
		/>
	);
};

export type DialogTitleProps<T extends ValidComponent = "h2"> =
	DialogPrimitive.DialogTitleProps<T> & {
		class?: string | undefined;
	};

export const DialogTitle = <T extends ValidComponent = "h2">(
	props: PolymorphicProps<T, DialogTitleProps<T>>,
) => {
	const [local, others] = splitProps(props as DialogTitleProps, ["class"]);

	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			class={cn(
				"text-lg font-bold leading-none tracking-tight text-foreground font-serif",
				local.class,
			)}
			{...others}
		/>
	);
};

export type DialogDescriptionProps<T extends ValidComponent = "p"> =
	DialogPrimitive.DialogDescriptionProps<T> & {
		class?: string | undefined;
	};

export const DialogDescription = <T extends ValidComponent = "p">(
	props: PolymorphicProps<T, DialogDescriptionProps<T>>,
) => {
	const [local, others] = splitProps(props as DialogDescriptionProps, [
		"class",
	]);

	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			class={cn("text-sm text-muted-foreground leading-relaxed", local.class)}
			{...others}
		/>
	);
};

export const DialogCloseButton = DialogPrimitive.CloseButton;
