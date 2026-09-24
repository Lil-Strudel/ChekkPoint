Welcome to your new TanStack Start app!

# Getting Started

To run this application:

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Local services

Postgres, Redis and Electric run in Docker via `compose.yaml`, using the credentials in `.env.example`. `pnpm dev` starts them automatically (and waits until they're healthy). They keep running after the dev server stops, so the next start is fast.

Postgres runs with `wal_level=logical` so [Electric](https://electric-sql.com) can stream changes. Electric listens on `localhost:3001`; the browser never talks to it directly, only through the app's shape proxy (`src/electric/proxy.ts`).

```bash
pnpm db:migrate      # apply migrations (services must be up)
pnpm services:up     # start Postgres, Redis + Electric without the dev server
pnpm services:down   # stop them (data is kept)
pnpm services:reset  # wipe all data and start fresh
pnpm services:logs   # follow container logs
```

# Building For Production

To build this application for production:

```bash
pnpm build
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`


## Deploy with Nitro

This project uses Nitro as a generic server adapter, so it can run on any Node-compatible host.

```bash
npm run build
node dist/server/index.mjs
```

The build output is a self-contained Node server. To deploy, push the `dist/` directory to your host (Render, Fly.io, your own VPS, etc.) and run the server command above.

For host-specific presets (Vercel, Netlify, Cloudflare, AWS Lambda, etc.) and tuning, see https://v3.nitro.build/deploy.

## Railway: Electric sync

The `/hello` page syncs through Electric, which needs one-time setup on Railway.

1. **Enable logical replication on Postgres.** Connect (`railway connect Postgres`, or `psql` with the public URL), then:

   ```sql
   ALTER SYSTEM SET wal_level = 'logical';
   ```

   Restart the Postgres service and check that `SHOW wal_level;` returns `logical`. If the setting doesn't survive a restart, set the service's start command to:

   ```
   /usr/bin/tini -g -- /usr/local/bin/wrapper.sh postgres -p 5432 -c listen_addresses=* -c wal_level=logical
   ```

2. **Add an Electric service** from the Docker image `electricsql/electric:1.8.1` (keep this in step with `compose.yaml`). Give it these variables:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (direct connection, not a pooler) |
   | `ELECTRIC_SECRET` | a long random string |
   | `ELECTRIC_STORAGE_DIR` | `/var/lib/electric/persistent` |
   | `ELECTRIC_DATABASE_USE_IPV6` | `true` |
   | `ELECTRIC_LISTEN_ON_IPV6` | `true` |

   Attach a volume at `/var/lib/electric/persistent`, set the healthcheck path to `/v1/health`, and don't give it a public domain.

3. **Point the app at Electric** by adding these to the app service:

   | Variable | Value |
   | --- | --- |
   | `ELECTRIC_URL` | `http://${{Electric.RAILWAY_PRIVATE_DOMAIN}}:3000` |
   | `ELECTRIC_SECRET` | `${{Electric.ELECTRIC_SECRET}}` |

4. **Apply migrations** against Railway Postgres: `DATABASE_URL=<public url> pnpm db:migrate`.



## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/solid-router`.

```tsx
import { Link } from "@tanstack/solid-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/solid/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes.

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/solid/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/solid-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      <For each={data().results}>
        {(person) => <li>{person.name}</li>}
      </For>
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/solid/guide/data-loading#loader-parameters).


# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.



## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting. The following scripts are available:


```bash
pnpm lint
pnpm format
pnpm check
```


# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
