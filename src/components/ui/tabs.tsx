import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as TabsPrimitive from "@kobalte/core/tabs";
import type { ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const Tabs = TabsPrimitive.Root;

export type TabsListProps<T extends ValidComponent = "div"> =
	TabsPrimitive.TabsListProps<T> & {
		class?: string | undefined;
	};

export const TabsList = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, TabsListProps<T>>,
) => {
	const [local, others] = splitProps(props as TabsListProps, ["class"]);
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			class={cn(
				"inline-flex h-10 items-center justify-center rounded-xl border border-border bg-muted p-1 text-muted-foreground",
				local.class,
			)}
			{...others}
		/>
	);
};

export type TabsTriggerProps<T extends ValidComponent = "button"> =
	TabsPrimitive.TabsTriggerProps<T> & {
		class?: string | undefined;
	};

export const TabsTrigger = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, TabsTriggerProps<T>>,
) => {
	const [local, others] = splitProps(props as TabsTriggerProps, ["class"]);
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			class={cn(
				"inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-ring/40 focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 hover:text-foreground data-[selected]:bg-surface data-[selected]:text-foreground data-[selected]:shadow-xs",
				local.class,
			)}
			{...others}
		/>
	);
};

export type TabsContentProps<T extends ValidComponent = "div"> =
	TabsPrimitive.TabsContentProps<T> & {
		class?: string | undefined;
	};

export const TabsContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, TabsContentProps<T>>,
) => {
	const [local, others] = splitProps(props as TabsContentProps, ["class"]);
	return (
		<TabsPrimitive.Content
			data-slot="tabs-content"
			class={cn(
				"mt-4 focus-visible:outline-hidden focus-visible:ring-ring/40 focus-visible:ring-3",
				local.class,
			)}
			{...others}
		/>
	);
};

export type TabsIndicatorProps<T extends ValidComponent = "div"> =
	TabsPrimitive.TabsIndicatorProps<T> & {
		class?: string | undefined;
	};

export const TabsIndicator = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, TabsIndicatorProps<T>>,
) => {
	const [local, others] = splitProps(props as TabsIndicatorProps, ["class"]);
	return (
		<TabsPrimitive.Indicator
			data-slot="tabs-indicator"
			class={cn(
				"absolute bg-forest transition-all duration-200 data-[orientation=horizontal]:-bottom-px data-[orientation=vertical]:-right-px data-[orientation=horizontal]:h-0.5 data-[orientation=vertical]:w-0.5",
				local.class,
			)}
			{...others}
		/>
	);
};
