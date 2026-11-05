// RFC 4180: quoted fields may hold commas, newlines and doubled quotes.
export function parseCsv(text: string) {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;

	const endRow = () => {
		row.push(field);
		if (row.some((f) => f.trim() !== "")) rows.push(row);
		row = [];
		field = "";
	};

	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c !== '"') field += c;
			else if (text[i + 1] === '"') {
				field += '"';
				i++;
			} else quoted = false;
		} else if (c === '"') quoted = true;
		else if (c === ",") {
			row.push(field);
			field = "";
		} else if (c === "\n") endRow();
		else if (c !== "\r") field += c;
	}
	endRow();
	return rows;
}

export function csvRecords(text: string) {
	const [header = [], ...rows] = parseCsv(text);
	const keys = header.map((h) => h.trim().toLowerCase());
	return rows.map((row) =>
		Object.fromEntries(keys.map((key, i) => [key, row[i]?.trim() ?? ""])),
	);
}
