import {
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea,
} from "~/components/ui/text-field";

type FormFieldProps = {
	label: string;
	value: string;
	onChange: (value: string) => void;
	type?: "text" | "email" | "number" | "date" | "datetime-local" | "tel";
	placeholder?: string;
	description?: string;
	required?: boolean;
	multiline?: boolean;
	step?: string;
	list?: string;
	class?: string;
};

export default function FormField(props: FormFieldProps) {
	return (
		<TextField
			class={props.class}
			value={props.value}
			onChange={props.onChange}
			required={props.required}
		>
			<TextFieldLabel>{props.label}</TextFieldLabel>
			{props.multiline ? (
				<TextFieldTextArea placeholder={props.placeholder} />
			) : (
				<TextFieldInput
					type={props.type ?? "text"}
					step={props.step ?? (props.type === "number" ? "any" : undefined)}
					placeholder={props.placeholder}
					list={props.list}
				/>
			)}
			{props.description && (
				<TextFieldDescription>{props.description}</TextFieldDescription>
			)}
		</TextField>
	);
}
