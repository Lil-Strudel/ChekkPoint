import { createFileRoute, useRouter } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'
import { asc, eq } from 'drizzle-orm'
import { createSignal, For, Show } from 'solid-js'
import * as z from 'zod'
import { db } from '../db'
import { helloWorld } from '../db/schema'

const listHellos = createServerFn({ method: 'GET' }).handler(async () => {
  return db.select().from(helloWorld).orderBy(asc(helloWorld.id))
})

const createHello = createServerFn({ method: 'POST' })
  .validator(z.object({ message: z.string().trim().min(1).max(255) }))
  .handler(async ({ data }) => {
    const [row] = await db.insert(helloWorld).values(data).returning()
    return row
  })

const updateHello = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.number().int(),
      message: z.string().trim().min(1).max(255),
    }),
  )
  .handler(async ({ data }) => {
    const [row] = await db
      .update(helloWorld)
      .set({ message: data.message })
      .where(eq(helloWorld.id, data.id))
      .returning()
    return row
  })

export const Route = createFileRoute('/hello')({
  loader: () => listHellos(),
  component: HelloPage,
})

function HelloPage() {
  const router = useRouter()
  const rows = Route.useLoaderData()
  const [draft, setDraft] = createSignal('')

  const add = async (e: SubmitEvent) => {
    e.preventDefault()
    await createHello({ data: { message: draft() } })
    setDraft('')
    await router.invalidate()
  }

  return (
    <main class="page-wrap px-4 pb-8 pt-14">
      <section class="island-shell rounded-2xl p-6">
        <p class="island-kicker mb-2">Drizzle + Postgres</p>
        <h1 class="mb-4 text-2xl font-bold text-[var(--sea-ink)]">
          Hello World table
        </h1>

        <form class="mb-6 flex gap-2" onSubmit={add}>
          <input
            class="flex-1 rounded-lg border px-3 py-2"
            placeholder="hello world"
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
          fallback={<p class="text-sm text-[var(--sea-ink-soft)]">No rows yet.</p>}
        >
          <ul class="m-0 list-none space-y-2 p-0">
            <For each={rows()}>
              {(row) => <HelloRow row={row} onSaved={() => router.invalidate()} />}
            </For>
          </ul>
        </Show>
      </section>
    </main>
  )
}

function HelloRow(props: {
  row: typeof helloWorld.$inferSelect
  onSaved: () => Promise<void>
}) {
  const [message, setMessage] = createSignal(props.row.message)

  const save = async (e: SubmitEvent) => {
    e.preventDefault()
    await updateHello({ data: { id: props.row.id, message: message() } })
    await props.onSaved()
  }

  return (
    <li>
      <form class="flex items-center gap-2" onSubmit={save}>
        <span class="w-8 text-sm text-[var(--sea-ink-soft)]">#{props.row.id}</span>
        <input
          class="flex-1 rounded-lg border px-3 py-1.5"
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
  )
}
