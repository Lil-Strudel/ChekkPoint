import type { ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export type InputProps = ComponentProps<"input">;

export const Input = (props: InputProps) => {
	const [local, others] = splitProps(props, ["class", "type"]);

	return (
		<input
			type={local.type ?? "text"}
			data-slot="input"
			class={cn(
				"border-input bg-surface text-foreground placeholder:text-muted-foreground flex h-9 w-full rounded-xl border px-3 py-1.5 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
				local.class,
			)}
			{...others}
		/>
	);
};
