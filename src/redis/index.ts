import "@tanstack/solid-start/server-only";
import { createClient } from "redis";
import { env } from "../env";

const client = createClient({ url: env.REDIS_URL }).on("error", (err) =>
	console.error("Redis Client Error", err),
);

let connecting: Promise<typeof client> | undefined;

// Connect once on first use and reuse the client for every request after that.
export function getRedis() {
	connecting ??= client.connect().catch((err) => {
		connecting = undefined;
		throw err;
	});
	return connecting;
}
