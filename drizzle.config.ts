import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Vite, so read process.env directly rather than src/env.ts
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (add it to .env)");

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: { url },
});
