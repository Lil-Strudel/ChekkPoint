import { Show } from "solid-js";
import { Alert, AlertDescription } from "~/components/ui/alert";

export default function ActionError(props: { error: string | undefined }) {
	return (
		<Show when={props.error}>
			<Alert variant="destructive">
				<AlertDescription>{props.error}</AlertDescription>
			</Alert>
		</Show>
	);
}
