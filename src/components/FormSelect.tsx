import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";

type Option = { value: string; label: string };

type FormSelectProps = {
	label: string;
	options: Option[];
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	class?: string;
};

export default function FormSelect(props: FormSelectProps) {
	const selected = () => props.options.find((o) => o.value === props.value);

	return (
		<Select<Option>
			class={props.class ?? "grid gap-2"}
			options={props.options}
			optionValue="value"
			optionTextValue="label"
			value={selected()}
			onChange={(option) => option && props.onChange(option.value)}
			placeholder={props.placeholder}
			itemComponent={(item) => (
				<SelectItem item={item.item}>{item.item.rawValue.label}</SelectItem>
			)}
		>
			<SelectLabel class="p-0 text-sm font-medium text-foreground">
				{props.label}
			</SelectLabel>
			<SelectTrigger>
				<SelectValue<Option>>
					{(state) => state.selectedOption().label}
				</SelectValue>
			</SelectTrigger>
			<SelectContent />
		</Select>
	);
}
