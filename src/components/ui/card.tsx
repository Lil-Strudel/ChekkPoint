import type { ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export type CardProps = ComponentProps<"div">;

export const Card = (props: CardProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<div
			data-slot="card"
			class={cn(
				"bg-card text-card-foreground rounded-[20px] border border-border shadow-[0_12px_32px_-18px_rgba(52,70,52,0.22)] backdrop-blur-[14px] saturate-[1.1] transition-all relative overflow-hidden",
				local.class,
			)}
			{...others}
		/>
	);
};

export type CardHeaderProps = ComponentProps<"div">;

export const CardHeader = (props: CardHeaderProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<div
			data-slot="card-header"
			class={cn("flex flex-col space-y-1.5 p-6", local.class)}
			{...others}
		/>
	);
};

export type CardTitleProps = ComponentProps<"h3">;

export const CardTitle = (props: CardTitleProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<h3
			data-slot="card-title"
			class={cn(
				"font-display text-xl font-normal leading-none tracking-tight text-foreground",
				local.class,
			)}
			{...others}
		/>
	);
};

export type CardDescriptionProps = ComponentProps<"p">;

export const CardDescription = (props: CardDescriptionProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<p
			data-slot="card-description"
			class={cn("text-muted-foreground text-sm leading-relaxed", local.class)}
			{...others}
		/>
	);
};

export type CardContentProps = ComponentProps<"div">;

export const CardContent = (props: CardContentProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<div
			data-slot="card-content"
			class={cn("p-6 pt-0", local.class)}
			{...others}
		/>
	);
};

export type CardFooterProps = ComponentProps<"div">;

export const CardFooter = (props: CardFooterProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<div
			data-slot="card-footer"
			class={cn(
				"flex items-center p-6 pt-0 border-t border-border",
				local.class,
			)}
			{...others}
		/>
	);
};

export type CardActionProps = ComponentProps<"div">;

export const CardAction = (props: CardActionProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<div
			data-slot="card-action"
			class={cn("self-start justify-self-end", local.class)}
			{...others}
		/>
	);
};
