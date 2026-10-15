import { useLiveQuery } from "@tanstack/solid-db";
import { createFileRoute } from "@tanstack/solid-router";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	on,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { getHelloDb, type HelloDb } from "../db/collections/hello";
import type { HelloRow as HelloRowData } from "../db/hello.shared";

export const Route = createFileRoute("/hello")({
	ssr: false,
	loader: async () => {
		const helloDb = await getHelloDb();
		// Not awaited: readiness needs Electric, so it would block offline.
		void helloDb.collection.preload();
		return helloDb;
	},
	component: HelloPage,
});

function HelloPage() {
	const helloDb = Route.useLoaderData();
	const query = useLiveQuery((q) => q.from({ hello: helloDb().collection }));
	// query() suspends until Electric is ready; query.state doesn't.
	const rows = createMemo(() =>
		[...query.state.values()].sort(
			(a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
		),
	);
	const [draft, setDraft] = createSignal("");

	const add = (e: SubmitEvent) => {
		e.preventDefault();
		helloDb().addHello(draft());
		setDraft("");
	};

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">TanStack DB + Electric</p>
			<h1 class="page-title">Hello World table</h1>
			<p class="page-sub">Local-first rows synced live through Electric.</p>
			<Card class="p-6">
				<SyncStatus helloDb={helloDb()} synced={query.isReady} />

				<form class="mb-6 flex gap-2" onSubmit={add}>
					<Input
						class="flex-1"
						placeholder="hello world"
						maxLength={255}
						value={draft()}
						onInput={(e) => setDraft(e.currentTarget.value)}
					/>
					<Button
						type="submit"
						class="px-5 font-semibold"
						disabled={!draft().trim()}
					>
						Add
					</Button>
				</form>

				<Show
					when={rows().length > 0}
					fallback={<p class="text-sm text-muted-foreground">No rows yet.</p>}
				>
					<ul class="m-0 list-none p-0 divide-y divide-border/60">
						<For each={rows()}>
							{(row) => (
								<HelloRow
									row={row}
									onSave={(message) =>
										helloDb().editHello({ id: row.id, message })
									}
								/>
							)}
						</For>
					</ul>
				</Show>
			</Card>
		</main>
	);
}

function SyncStatus(props: { helloDb: HelloDb; synced: boolean }) {
	const [online, setOnline] = createSignal(navigator.onLine);
	const [pending, setPending] = createSignal(0);

	onMount(() => {
		const update = () => setOnline(navigator.onLine);
		window.addEventListener("online", update);
		window.addEventListener("offline", update);
		// getPendingCount() misses writes queued offline.
		const timer = setInterval(async () => {
			setPending((await props.helloDb.executor.peekOutbox()).length);
		}, 500);
		onCleanup(() => {
			window.removeEventListener("online", update);
			window.removeEventListener("offline", update);
			clearInterval(timer);
		});
	});

	return (
		<div class="mb-5 flex flex-wrap items-center gap-2 text-xs">
			<Badge variant={online() ? "forest" : "clay"}>
				{online() ? "Online" : "Offline"}
			</Badge>
			<Badge variant={props.synced ? "forest" : "secondary"}>
				{props.synced ? "Live" : "Syncing…"}
			</Badge>
			<Badge variant="chip">{pending()} pending write(s)</Badge>
			<Badge variant="outline">
				{props.helloDb.persisted
					? "Stored in OPFS"
					: "Memory only (OPFS unavailable)"}
			</Badge>
			<Show when={props.helloDb.executor.mode === "online-only"}>
				<Badge variant="clay">Outbox storage unavailable</Badge>
			</Show>
		</div>
	);
}

function HelloRow(props: {
	row: HelloRowData;
	onSave: (message: string) => void;
}) {
	const [message, setMessage] = createSignal(props.row.message);
	// Rows update in place, so follow remote edits.
	createEffect(on(() => props.row.message, setMessage, { defer: true }));

	const save = (e: SubmitEvent) => {
		e.preventDefault();
		props.onSave(message());
	};

	return (
		<li class="py-3">
			<form class="flex w-full items-center gap-2" onSubmit={save}>
				<Input
					class="flex-1"
					maxLength={255}
					value={message()}
					onInput={(e) => setMessage(e.currentTarget.value)}
				/>
				<Button
					type="submit"
					variant="secondary"
					size="sm"
					class="font-semibold"
					disabled={!message().trim() || message() === props.row.message}
				>
					Save
				</Button>
				<span class="text-xs text-muted-foreground whitespace-nowrap">
					updated {new Date(props.row.updatedAt).toLocaleString()}
				</span>
			</form>
		</li>
	);
}
