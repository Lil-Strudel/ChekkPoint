import * as AlertPrimitive from "@kobalte/core/alert";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import { cva, type VariantProps } from "class-variance-authority";
import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const alertVariants = cva(
	"relative w-full rounded-2xl border p-4 text-sm transition-all overflow-hidden",
	{
		variants: {
			variant: {
				default: "border-border bg-card/85 text-card-foreground shadow-xs",
				destructive:
					"border-destructive/30 bg-destructive/10 text-destructive-foreground dark:border-destructive/40",
				warning: "border-clay/35 bg-clay/10 text-foreground",
				info: "border-forest/35 bg-forest/10 text-foreground",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export type AlertProps<T extends ValidComponent = "div"> =
	AlertPrimitive.AlertRootProps<T> &
		VariantProps<typeof alertVariants> & {
			class?: string | undefined;
			children?: JSX.Element;
		};

export const Alert = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, AlertProps<T>>,
) => {
	const [local, others] = splitProps(props as AlertProps, ["class", "variant"]);

	return (
		<AlertPrimitive.Root
			data-slot="alert"
			class={cn(alertVariants({ variant: local.variant }), local.class)}
			{...others}
		/>
	);
};

export type AlertTitleProps = ComponentProps<"h5">;

import type { ComponentProps } from "solid-js";

export const AlertTitle = (props: AlertTitleProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<h5
			data-slot="alert-title"
			class={cn(
				"mb-1 font-bold leading-tight tracking-tight text-foreground",
				local.class,
			)}
			{...others}
		/>
	);
};

export type AlertDescriptionProps = ComponentProps<"div">;

export const AlertDescription = (props: AlertDescriptionProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<div
			data-slot="alert-description"
			class={cn("text-sm text-muted-foreground leading-relaxed", local.class)}
			{...others}
		/>
	);
};
