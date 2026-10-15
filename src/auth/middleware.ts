import { createMiddleware } from "@tanstack/solid-start";
import { loadViewer } from "./session.server";

export const authMiddleware = createMiddleware({ type: "function" }).server(
	async ({ next }) => {
		const viewer = await loadViewer();
		if (!viewer) throw new Error("Sign in required");
		return next({ context: { viewer } });
	},
);
