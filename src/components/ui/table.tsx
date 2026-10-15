import type { ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export type TableProps = ComponentProps<"table"> & {
	containerClass?: string;
};

export const Table = (props: TableProps) => {
	const [local, others] = splitProps(props, ["class", "containerClass"]);

	return (
		<div
			data-slot="table-container"
			class={cn(
				"relative w-full overflow-x-auto rounded-2xl border border-border bg-card/60 backdrop-blur-xs",
				local.containerClass,
			)}
		>
			<table
				data-slot="table"
				class={cn(
					"w-full caption-bottom text-sm tabular-nums border-collapse",
					local.class,
				)}
				{...others}
			/>
		</div>
	);
};

export type TableHeaderProps = ComponentProps<"thead">;

export const TableHeader = (props: TableHeaderProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<thead
			data-slot="table-header"
			class={cn("[&_tr]:border-b [&_tr]:border-border", local.class)}
			{...others}
		/>
	);
};

export type TableBodyProps = ComponentProps<"tbody">;

export const TableBody = (props: TableBodyProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<tbody
			data-slot="table-body"
			class={cn("[&_tr:last-child]:border-0", local.class)}
			{...others}
		/>
	);
};

export type TableFooterProps = ComponentProps<"tfoot">;

export const TableFooter = (props: TableFooterProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<tfoot
			data-slot="table-footer"
			class={cn(
				"bg-muted/50 border-t border-border font-medium [&>tr]:last:border-b-0",
				local.class,
			)}
			{...others}
		/>
	);
};

export type TableRowProps = ComponentProps<"tr">;

export const TableRow = (props: TableRowProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<tr
			data-slot="table-row"
			class={cn(
				"border-b border-border/70 transition-colors hover:bg-accent/50 data-[state=selected]:bg-muted",
				local.class,
			)}
			{...others}
		/>
	);
};

export type TableHeadProps = ComponentProps<"th">;

export const TableHead = (props: TableHeadProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<th
			data-slot="table-head"
			class={cn(
				"h-10 px-4 py-3 text-left align-middle text-xs font-bold uppercase tracking-widest text-forest whitespace-nowrap bg-muted/30",
				local.class,
			)}
			{...others}
		/>
	);
};

export type TableCellProps = ComponentProps<"td">;

export const TableCell = (props: TableCellProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<td
			data-slot="table-cell"
			class={cn("px-4 py-3 align-middle text-foreground", local.class)}
			{...others}
		/>
	);
};

export type TableCaptionProps = ComponentProps<"caption">;

export const TableCaption = (props: TableCaptionProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<caption
			data-slot="table-caption"
			class={cn("text-muted-foreground mt-4 text-xs", local.class)}
			{...others}
		/>
	);
};
