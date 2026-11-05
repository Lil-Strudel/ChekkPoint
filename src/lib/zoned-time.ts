const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(date: Date, timeZone: string) {
	let formatter = partsFormatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		partsFormatters.set(timeZone, formatter);
	}
	const parts = Object.fromEntries(
		formatter.formatToParts(date).map((p) => [p.type, p.value]),
	);
	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		hour: Number(parts.hour),
		minute: Number(parts.minute),
		second: Number(parts.second),
	};
}

function offsetMs(date: Date, timeZone: string) {
	const p = zonedParts(date, timeZone);
	const asUtc = Date.UTC(
		p.year,
		p.month - 1,
		p.day,
		p.hour,
		p.minute,
		p.second,
	);
	return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function isTimeZone(value: string) {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

// Turns a `datetime-local` value ("2027-06-12T05:00") read as wall-clock time
// in `timeZone` into the instant it names.
export function zonedLocalToUtc(local: string, timeZone: string) {
	const [date, time = "00:00"] = local.split("T");
	const [year, month, day] = date.split("-").map(Number);
	const [hour, minute, second = 0] = time.split(":").map(Number);
	const wall = Date.UTC(year, month - 1, day, hour, minute, second);
	const guess = wall - offsetMs(new Date(wall), timeZone);
	// The offset at the guess can differ from the offset at the wall time
	// across a DST change, so correct once with the offset at the guess.
	return new Date(wall - offsetMs(new Date(guess), timeZone));
}

export function utcToZonedLocal(date: Date, timeZone: string) {
	const p = zonedParts(date, timeZone);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
