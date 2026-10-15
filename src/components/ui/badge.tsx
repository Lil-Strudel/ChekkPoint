import * as BadgePrimitive from "@kobalte/core/badge";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import { cva, type VariantProps } from "class-variance-authority";
import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const badgeVariants = cva(
	"inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 transition-colors gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-primary text-primary-foreground shadow-xs",
				secondary:
					"border-border bg-secondary text-secondary-foreground shadow-xs",
				destructive: "border-destructive/30 bg-destructive/15 text-destructive",
				outline: "border-border text-foreground bg-white/40 backdrop-blur-xs",
				forest: "border-forest/30 bg-forest/15 text-forest font-semibold",
				sage: "border-sage/40 bg-sage/20 text-forest-deep font-semibold",
				clay: "border-clay/30 bg-clay/15 text-clay font-semibold",
				sand: "border-sand bg-sand/40 text-muted-foreground",
				amber:
					"border-amber-500/30 bg-amber-500/15 text-amber-800 font-semibold",
				purple:
					"border-purple-500/30 bg-purple-500/15 text-purple-800 font-semibold",
				chip: "border-border/80 bg-surface text-muted-foreground font-medium",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export type BadgeProps<T extends ValidComponent = "span"> =
	BadgePrimitive.BadgeRootProps<T> &
		VariantProps<typeof badgeVariants> & {
			class?: string | undefined;
			children?: JSX.Element;
		};

export const Badge = <T extends ValidComponent = "span">(
	props: PolymorphicProps<T, BadgeProps<T>>,
) => {
	const [local, others] = splitProps(props as BadgeProps, ["class", "variant"]);

	return (
		<BadgePrimitive.Root
			data-slot="badge"
			class={cn(badgeVariants({ variant: local.variant }), local.class)}
			{...others}
		/>
	);
};
