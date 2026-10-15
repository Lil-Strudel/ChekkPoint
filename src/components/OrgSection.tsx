import type { JSX } from "solid-js";

export default function OrgSection(props: {
	title: string;
	description?: string;
	action?: JSX.Element;
	children: JSX.Element;
}) {
	return (
		<section>
			<div class="mb-5 flex flex-wrap items-end justify-between gap-4">
				<div>
					<h2 class="font-display text-scrim m-0 text-3xl font-normal text-foreground">
						{props.title}
					</h2>
					{props.description && (
						<p class="text-scrim m-0 mt-1 text-sm text-muted-foreground">
							{props.description}
						</p>
					)}
				</div>
				{props.action}
			</div>
			{props.children}
		</section>
	);
}
