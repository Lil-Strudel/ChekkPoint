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
		<main class="page-wrap px-4 pb-8 pt-14">
			<section class="island-shell rounded-2xl p-6">
				<p class="island-kicker mb-2">TanStack DB + Electric</p>
				<h1 class="mb-2 text-2xl font-bold text-[var(--sea-ink)]">
					Hello World table
				</h1>
				<SyncStatus helloDb={helloDb()} synced={query.isReady} />

				<form class="mb-6 flex gap-2" onSubmit={add}>
					<input
						class="flex-1 rounded-lg border px-3 py-2"
						placeholder="hello world"
						maxLength={255}
						value={draft()}
						onInput={(e) => setDraft(e.currentTarget.value)}
					/>
					<button
						type="submit"
						class="rounded-lg border px-4 py-2 font-semibold"
						disabled={!draft().trim()}
					>
						Add
					</button>
				</form>

				<Show
					when={rows().length > 0}
					fallback={
						<p class="text-sm text-[var(--sea-ink-soft)]">No rows yet.</p>
					}
				>
					<ul class="m-0 list-none space-y-2 p-0">
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
			</section>
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
		<p class="mb-4 flex flex-wrap gap-x-4 text-xs text-[var(--sea-ink-soft)]">
			<span class={online() ? "text-green-600" : "text-red-600"}>
				{online() ? "Online" : "Offline"}
			</span>
			<span>{props.synced ? "Live" : "Syncing…"}</span>
			<span>{pending()} pending write(s)</span>
			<span>
				{props.helloDb.persisted
					? "Stored in OPFS"
					: "Memory only (OPFS unavailable)"}
			</span>
			<Show when={props.helloDb.executor.mode === "online-only"}>
				<span class="text-red-600">Outbox storage unavailable</span>
			</Show>
		</p>
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
		<li>
			<form class="flex items-center gap-2" onSubmit={save}>
				<input
					class="flex-1 rounded-lg border px-3 py-1.5"
					maxLength={255}
					value={message()}
					onInput={(e) => setMessage(e.currentTarget.value)}
				/>
				<button
					type="submit"
					class="rounded-lg border px-3 py-1.5 text-sm font-semibold"
					disabled={!message().trim() || message() === props.row.message}
				>
					Save
				</button>
				<span class="text-xs text-[var(--sea-ink-soft)]">
					updated {new Date(props.row.updatedAt).toLocaleString()}
				</span>
			</form>
		</li>
	);
}
