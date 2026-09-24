import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
	resolve: { tsconfigPaths: true },
	optimizeDeps: {
		// Pre-bundling breaks the OPFS worker's import.meta.url path.
		exclude: ["@tanstack/browser-db-sqlite-persistence"],
	},
	plugins: [
		devtools(),
		nitro(),
		tailwindcss(),
		tanstackStart(),
		solidPlugin({ ssr: true }),
	],
});
