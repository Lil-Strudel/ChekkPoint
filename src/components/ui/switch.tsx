import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as SwitchPrimitive from "@kobalte/core/switch";
import type { ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const Switch = SwitchPrimitive.Root;
export const SwitchInput = SwitchPrimitive.Input;
export const SwitchDescription = SwitchPrimitive.Description;
export const SwitchErrorMessage = SwitchPrimitive.ErrorMessage;

export type SwitchControlProps<T extends ValidComponent = "div"> =
	SwitchPrimitive.SwitchControlProps<T> & {
		class?: string | undefined;
	};

export const SwitchControl = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, SwitchControlProps<T>>,
) => {
	const [local, others] = splitProps(props as SwitchControlProps, ["class"]);

	return (
		<SwitchPrimitive.Control
			data-slot="switch-control"
			class={cn(
				"inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-muted transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary",
				local.class,
			)}
			{...others}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				class="pointer-events-none block size-5 rounded-full bg-surface shadow-xs transition-transform duration-200 data-[checked]:translate-x-5 data-[unchecked]:translate-x-0"
			/>
		</SwitchPrimitive.Control>
	);
};

export const SwitchThumb = SwitchPrimitive.Thumb;

export type SwitchLabelProps<T extends ValidComponent = "label"> =
	SwitchPrimitive.SwitchLabelProps<T> & {
		class?: string | undefined;
	};

export const SwitchLabel = <T extends ValidComponent = "label">(
	props: PolymorphicProps<T, SwitchLabelProps<T>>,
) => {
	const [local, others] = splitProps(props as SwitchLabelProps, ["class"]);

	return (
		<SwitchPrimitive.Label
			data-slot="switch-label"
			class={cn(
				"text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none cursor-pointer",
				local.class,
			)}
			{...others}
		/>
	);
};
