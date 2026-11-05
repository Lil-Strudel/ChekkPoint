import { createSignal, Show } from "solid-js";
import { Button } from "~/components/ui/button";

export default function ConfirmButton(props: {
	label: string;
	confirmLabel?: string;
	pending?: boolean;
	onConfirm: () => void;
}) {
	const [confirming, setConfirming] = createSignal(false);

	return (
		<span class="inline-flex flex-wrap gap-2">
			<Show
				when={confirming()}
				fallback={
					<Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
						{props.label}
					</Button>
				}
			>
				<Button
					variant="destructive"
					size="sm"
					disabled={props.pending}
					onClick={() => {
						setConfirming(false);
						props.onConfirm();
					}}
				>
					{props.confirmLabel ?? `${props.label} for good`}
				</Button>
				<Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
					Keep it
				</Button>
			</Show>
		</span>
	);
}
