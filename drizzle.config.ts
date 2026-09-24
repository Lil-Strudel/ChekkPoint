import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit runs outside Vite, so read process.env directly rather than src/env.ts
export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
