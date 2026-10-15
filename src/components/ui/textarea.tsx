import type { ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export type TextareaProps = ComponentProps<"textarea">;

export const Textarea = (props: TextareaProps) => {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<textarea
			data-slot="textarea"
			class={cn(
				"border-input bg-surface text-foreground placeholder:text-muted-foreground flex min-h-28 w-full rounded-xl border px-3 py-2 text-sm shadow-xs transition-colors outline-hidden focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
				local.class,
			)}
			{...others}
		/>
	);
};
