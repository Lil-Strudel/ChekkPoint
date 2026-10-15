import { createFileRoute, useRouter } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { Show } from "solid-js";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
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
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">node-redis</p>
			<h1 class="page-title">Redis connection check</h1>
			<p class="page-sub">Live PING, latency and server version.</p>
			<Card class="p-6">
				<Show
					when={result().ok && result()}
					fallback={
						<Alert variant="destructive" class="mb-5">
							<AlertTitle>Not connected to Redis</AlertTitle>
							<AlertDescription>
								{(result() as { error?: string }).error ?? "unknown error"}
							</AlertDescription>
						</Alert>
					}
				>
					{(r) => (
						<dl class="mb-5 grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 text-sm">
							<dt class="font-semibold text-foreground">Status</dt>
							<dd class="m-0">
								<Badge variant="forest">Connected</Badge>
							</dd>
							<dt class="font-semibold text-foreground">PING</dt>
							<dd class="m-0 text-muted-foreground font-mono">
								{r().pong} ({r().latencyMs} ms)
							</dd>
							<dt class="font-semibold text-foreground">Server version</dt>
							<dd class="m-0 text-muted-foreground font-mono">{r().version}</dd>
							<dt class="font-semibold text-foreground">Page checks (INCR)</dt>
							<dd class="m-0 text-muted-foreground font-mono">{r().hits}</dd>
						</dl>
					)}
				</Show>

				<Button
					type="button"
					variant="outline"
					class="font-semibold"
					onClick={() => router.invalidate()}
				>
					Check again
				</Button>
			</Card>
		</main>
	);
}
