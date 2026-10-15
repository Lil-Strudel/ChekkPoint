import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as SeparatorPrimitive from "@kobalte/core/separator";
import type { ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export type SeparatorProps<T extends ValidComponent = "hr"> =
	SeparatorPrimitive.SeparatorRootProps<T> & {
		class?: string | undefined;
	};

export const Separator = <T extends ValidComponent = "hr">(
	props: PolymorphicProps<T, SeparatorProps<T>>,
) => {
	const [local, others] = splitProps(props as SeparatorProps, [
		"class",
		"orientation",
	]);

	return (
		<SeparatorPrimitive.Root
			data-slot="separator"
			orientation={local.orientation ?? "horizontal"}
			class={cn(
				"bg-border shrink-0 border-none data-[orientation=horizontal]:h-[1px] data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-[1px]",
				local.class,
			)}
			{...others}
		/>
	);
};
