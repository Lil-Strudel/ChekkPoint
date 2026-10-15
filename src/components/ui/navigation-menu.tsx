import * as NavigationMenuPrimitive from "@kobalte/core/navigation-menu";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const NavigationMenuPortal = NavigationMenuPrimitive.Portal;

export type NavigationMenuProps<T extends ValidComponent = "ul"> =
	NavigationMenuPrimitive.NavigationMenuRootProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

export const NavigationMenu = <T extends ValidComponent = "ul">(
	props: PolymorphicProps<T, NavigationMenuProps<T>>,
) => {
	const [local, others] = splitProps(props as NavigationMenuProps, [
		"class",
		"children",
	]);

	return (
		<NavigationMenuPrimitive.Root
			data-slot="navigation-menu"
			class={cn(
				"relative flex max-w-max flex-1 items-center justify-center",
				local.class,
			)}
			{...others}
		>
			{local.children}
			<NavigationMenuPrimitive.Viewport class="origin-top relative mt-1.5 h-[var(--kb-navigation-menu-viewport-height)] w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg backdrop-blur-md transition-[width,height] duration-300" />
		</NavigationMenuPrimitive.Root>
	);
};

export type NavigationMenuListProps =
	NavigationMenuPrimitive.NavigationMenuMenuProps & {
		class?: string | undefined;
		children?: JSX.Element;
	};

export const NavigationMenuList = (props: NavigationMenuListProps) => {
	const [local, others] = splitProps(props, ["class", "children"]);

	return (
		<NavigationMenuPrimitive.Menu {...others}>
			<div
				class={cn(
					"group flex flex-1 list-none items-center justify-center space-x-1",
					local.class,
				)}
			>
				{local.children}
			</div>
		</NavigationMenuPrimitive.Menu>
	);
};

export type NavigationMenuItemProps<T extends ValidComponent = "a"> =
	NavigationMenuPrimitive.NavigationMenuItemProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

export const NavigationMenuItem = <T extends ValidComponent = "a">(
	props: PolymorphicProps<T, NavigationMenuItemProps<T>>,
) => {
	const [local, others] = splitProps(props as NavigationMenuItemProps, [
		"class",
	]);

	return (
		<NavigationMenuPrimitive.Item
			data-slot="navigation-menu-item"
			class={cn("relative", local.class)}
			{...others}
		/>
	);
};

export type NavigationMenuTriggerProps<T extends ValidComponent = "button"> =
	NavigationMenuPrimitive.NavigationMenuTriggerProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

export const NavigationMenuTrigger = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, NavigationMenuTriggerProps<T>>,
) => {
	const [local, others] = splitProps(props as NavigationMenuTriggerProps, [
		"class",
		"children",
	]);

	return (
		<NavigationMenuPrimitive.Trigger
			data-slot="navigation-menu-trigger"
			class={cn(
				"group inline-flex h-9 w-max items-center justify-center rounded-xl bg-transparent px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-hidden disabled:pointer-events-none disabled:opacity-50",
				local.class,
			)}
			{...others}
		>
			{local.children}
			<NavigationMenuPrimitive.Icon class="size-3 transition duration-200 group-data-[expanded]:rotate-180">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="size-3"
					aria-hidden="true"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</NavigationMenuPrimitive.Icon>
		</NavigationMenuPrimitive.Trigger>
	);
};

export type NavigationMenuContentProps<T extends ValidComponent = "ul"> =
	NavigationMenuPrimitive.NavigationMenuContentProps<T> & {
		class?: string | undefined;
	};

export const NavigationMenuContent = <T extends ValidComponent = "ul">(
	props: PolymorphicProps<T, NavigationMenuContentProps<T>>,
) => {
	const [local, others] = splitProps(props as NavigationMenuContentProps, [
		"class",
	]);

	return (
		<NavigationMenuPrimitive.Portal>
			<NavigationMenuPrimitive.Content
				data-slot="navigation-menu-content"
				class={cn("left-0 top-0 w-full p-4 md:absolute md:w-auto", local.class)}
				{...others}
			/>
		</NavigationMenuPrimitive.Portal>
	);
};
