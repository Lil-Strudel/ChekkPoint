import type { Register } from "@tanstack/solid-router";
import {
	createServerEntry,
	createStartHandler,
	defaultStreamHandler,
} from "@tanstack/solid-start/server";

const startHandler = createStartHandler(defaultStreamHandler);

// Start rethrows the abort reason when the client disconnects, then logs it as
// an unhandled error. Leaving /hello mid long-poll is enough to trigger it.
export default createServerEntry<Register>({
	async fetch(request, opts) {
		try {
			return await startHandler(request, opts);
		} catch (error) {
			if (request.signal.aborted && error === request.signal.reason) {
				return new Response(null, { status: 499 });
			}
			throw error;
		}
	},
});
