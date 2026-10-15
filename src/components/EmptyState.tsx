import { children, type JSX, Show } from "solid-js";
import { Card } from "~/components/ui/card";

export default function EmptyState(props: {
	title: string;
	description: string;
	children?: JSX.Element;
}) {
	const action = children(() => props.children);

	return (
		<Card class="flex flex-col items-center gap-2 px-6 py-12 text-center">
			<h3 class="font-display m-0 text-2xl font-normal text-foreground">
				{props.title}
			</h3>
			<p class="m-0 max-w-md text-sm text-muted-foreground">
				{props.description}
			</p>
			<Show when={action()}>
				<div class="mt-4">{action()}</div>
			</Show>
		</Card>
	);
}
