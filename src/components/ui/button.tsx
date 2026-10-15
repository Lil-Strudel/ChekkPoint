import * as ButtonPrimitive from "@kobalte/core/button";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import { cva, type VariantProps } from "class-variance-authority";
import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-hidden focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground hover:bg-forest-deep active:bg-forest-deep/90 shadow-xs",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs",
				outline:
					"border border-border bg-background/60 text-foreground hover:bg-accent hover:text-accent-foreground backdrop-blur-xs shadow-xs",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border shadow-xs",
				ghost:
					"hover:bg-accent hover:text-accent-foreground text-muted-foreground hover:text-foreground",
				link: "text-primary underline-offset-4 hover:underline",
				pill: "rounded-full bg-primary text-primary-foreground hover:bg-forest-deep shadow-xs",
			},
			size: {
				default: "h-9 px-4 py-2",
				sm: "h-8 rounded-lg px-3 text-xs",
				lg: "h-11 rounded-xl px-8 text-base",
				icon: "h-9 w-9 p-0",
				pill: "h-9 rounded-full px-5 text-sm",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export type ButtonProps<T extends ValidComponent = "button"> =
	ButtonPrimitive.ButtonRootProps<T> &
		VariantProps<typeof buttonVariants> & {
			class?: string | undefined;
			children?: JSX.Element;
		};

export const Button = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, ButtonProps<T>>,
) => {
	const [local, others] = splitProps(props as ButtonProps, [
		"class",
		"variant",
		"size",
	]);

	return (
		<ButtonPrimitive.Root
			class={cn(
				buttonVariants({ variant: local.variant, size: local.size }),
				local.class,
			)}
			{...others}
		/>
	);
};

export type { ButtonProps as ButtonComponentProps };
