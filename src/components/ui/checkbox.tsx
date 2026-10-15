import * as CheckboxPrimitive from "@kobalte/core/checkbox";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { JSX, ValidComponent } from "solid-js";
import { Match, Show, Switch, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export type CheckboxProps<T extends ValidComponent = "div"> =
	CheckboxPrimitive.CheckboxRootProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

export const Checkbox = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, CheckboxProps<T>>,
) => {
	const [local, others] = splitProps(props as CheckboxProps, [
		"class",
		"children",
	]);
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			class={cn("group relative flex items-center gap-2", local.class)}
			{...others}
		>
			<CheckboxPrimitive.Input class="peer" />
			<CheckboxPrimitive.Control class="size-4 shrink-0 rounded-sm border border-forest bg-surface cursor-pointer transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 peer-focus-visible:outline-hidden peer-focus-visible:ring-ring/40 peer-focus-visible:ring-3 data-[checked]:border-primary data-[indeterminate]:border-primary data-[checked]:bg-primary data-[indeterminate]:bg-primary data-[checked]:text-primary-foreground data-[indeterminate]:text-primary-foreground">
				<CheckboxPrimitive.Indicator>
					<Switch>
						<Match when={!others.indeterminate}>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="size-4"
								aria-hidden="true"
							>
								<path d="M5 12l5 5l10 -10" />
							</svg>
						</Match>
						<Match when={others.indeterminate}>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="size-4"
								aria-hidden="true"
							>
								<path d="M5 12l14 0" />
							</svg>
						</Match>
					</Switch>
				</CheckboxPrimitive.Indicator>
			</CheckboxPrimitive.Control>
			<Show when={local.children}>
				<CheckboxPrimitive.Label class="text-sm select-none cursor-pointer data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50">
					{local.children}
				</CheckboxPrimitive.Label>
			</Show>
		</CheckboxPrimitive.Root>
	);
};
