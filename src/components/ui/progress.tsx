import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as ProgressPrimitive from "@kobalte/core/progress";
import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

type ProgressRootProps<T extends ValidComponent = "div"> =
	ProgressPrimitive.ProgressRootProps<T> & { children?: JSX.Element };

const Progress = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, ProgressRootProps<T>>,
) => {
	const [local, others] = splitProps(props as ProgressRootProps, ["children"]);
	return (
		<ProgressPrimitive.Root {...others}>
			{local.children}
			<ProgressPrimitive.Track class="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
				<ProgressPrimitive.Fill class="h-full w-[var(--kb-progress-fill-width)] flex-1 rounded-full bg-primary transition-all" />
			</ProgressPrimitive.Track>
		</ProgressPrimitive.Root>
	);
};

const labelClass = "text-sm font-medium leading-none text-foreground";

type ProgressLabelProps<T extends ValidComponent = "span"> =
	ProgressPrimitive.ProgressLabelProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

const ProgressLabel = <T extends ValidComponent = "span">(
	props: PolymorphicProps<T, ProgressLabelProps<T>>,
) => {
	const [local, others] = splitProps(props as ProgressLabelProps, ["class"]);
	return (
		<ProgressPrimitive.Label class={cn(labelClass, local.class)} {...others} />
	);
};

type ProgressValueLabelProps<T extends ValidComponent = "div"> =
	ProgressPrimitive.ProgressValueLabelProps<T> & {
		class?: string | undefined;
	};

const ProgressValueLabel = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, ProgressValueLabelProps<T>>,
) => {
	const [local, others] = splitProps(props as ProgressValueLabelProps, [
		"class",
	]);
	return (
		<ProgressPrimitive.ValueLabel
			class={cn(labelClass, local.class)}
			{...others}
		/>
	);
};

export { Progress, ProgressLabel, ProgressValueLabel };
