import { dateParts } from "~/lib/events";

export default function DateBlock(props: { date: Date; timeZone: string }) {
	const parts = () => dateParts(props.date, props.timeZone);

	return (
		<time
			datetime={props.date.toISOString()}
			class="flex w-14 shrink-0 flex-col items-center rounded-xl border border-border bg-surface py-2"
		>
			<span class="text-xs font-semibold uppercase tracking-widest text-forest">
				{parts().month}
			</span>
			<span class="font-display text-3xl leading-none tabular-nums text-foreground">
				{parts().day}
			</span>
		</time>
	);
}
