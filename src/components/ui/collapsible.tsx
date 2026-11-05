import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as CollapsiblePrimitive from "@kobalte/core/collapsible";
import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const Collapsible = CollapsiblePrimitive.Root;
export const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

export type CollapsibleContentProps<T extends ValidComponent = "div"> =
	CollapsiblePrimitive.CollapsibleContentProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

export const CollapsibleContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, CollapsibleContentProps<T>>,
) => {
	const [local, others] = splitProps(props as CollapsibleContentProps, [
		"class",
		"children",
	]);

	return (
		<CollapsiblePrimitive.Content
			data-slot="collapsible-content"
			class={cn(
				"overflow-hidden data-[expanded]:animate-collapsible-down data-[closed]:animate-collapsible-up",
				local.class,
			)}
			{...others}
		>
			{local.children}
		</CollapsiblePrimitive.Content>
	);
};
