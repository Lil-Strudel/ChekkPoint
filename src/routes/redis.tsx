import { createFileRoute, useRouter } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { Show } from "solid-js";
import { getRedis } from "../redis";

const HITS_KEY = "chekkpoint:redis-check:hits";

const checkRedis = createServerFn({ method: "GET" }).handler(async () => {
	try {
		const redis = await getRedis();
		const start = performance.now();
		const pong = await redis.ping();
		const latencyMs = Math.round((performance.now() - start) * 10) / 10;
		const hits = await redis.incr(HITS_KEY);
		const info = await redis.info("server");
		const version = info.match(/redis_version:(\S+)/)?.[1] ?? "unknown";
		return { ok: true as const, pong, latencyMs, hits, version };
	} catch (err) {
		return {
			ok: false as const,
			error: err instanceof Error ? err.message : String(err),
		};
	}
});

export const Route = createFileRoute("/redis")({
	loader: () => checkRedis(),
	component: RedisPage,
});

function RedisPage() {
	const router = useRouter();
	const result = Route.useLoaderData();

	return (
		<main class="page-wrap px-4 pb-8 pt-14">
			<section class="island-shell rounded-2xl p-6">
				<p class="island-kicker mb-2">node-redis</p>
				<h1 class="mb-4 text-2xl font-bold text-[var(--sea-ink)]">
					Redis connection check
				</h1>

				<Show
					when={result().ok && result()}
					fallback={
						<p class="mb-4 font-semibold text-red-600">
							Not connected:{" "}
							{(result() as { error?: string }).error ?? "unknown error"}
						</p>
					}
				>
					{(r) => (
						<dl class="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
							<dt class="font-semibold">Status</dt>
							<dd class="m-0 font-semibold text-green-600">Connected</dd>
							<dt class="font-semibold">PING</dt>
							<dd class="m-0">
								{r().pong} ({r().latencyMs} ms)
							</dd>
							<dt class="font-semibold">Server version</dt>
							<dd class="m-0">{r().version}</dd>
							<dt class="font-semibold">Page checks (INCR)</dt>
							<dd class="m-0">{r().hits}</dd>
						</dl>
					)}
				</Show>

				<button
					type="button"
					class="rounded-lg border px-4 py-2 font-semibold"
					onClick={() => router.invalidate()}
				>
					Check again
				</button>
			</section>
		</main>
	);
}
