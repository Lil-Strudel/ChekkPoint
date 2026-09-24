import "@tanstack/solid-start/server-only";
import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from "@electric-sql/client";
import { env } from "../env";

// Only protocol params come from the client; the server picks the table.
export async function proxyShape(request: Request, table: string) {
	const url = new URL(request.url);
	const origin = new URL("/v1/shape", env.ELECTRIC_URL);

	url.searchParams.forEach((value, key) => {
		if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
			origin.searchParams.set(key, value);
		}
	});
	origin.searchParams.set("table", table);
	if (env.ELECTRIC_SECRET) {
		origin.searchParams.set("secret", env.ELECTRIC_SECRET);
	}

	let response: Response;
	try {
		response = await fetch(origin, { signal: request.signal });
	} catch {
		return new Response("Electric unavailable", { status: 502 });
	}

	// fetch() already decompressed the body.
	const headers = new Headers(response.headers);
	headers.delete("content-encoding");
	headers.delete("content-length");

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
