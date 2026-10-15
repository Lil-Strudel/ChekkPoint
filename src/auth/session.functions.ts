import { createServerFn } from "@tanstack/solid-start";
import { loadAuthOptions, loadViewer } from "./session.server";

export const getViewer = createServerFn({ method: "GET" }).handler(() =>
	loadViewer(),
);

export const getAuthOptions = createServerFn({ method: "GET" }).handler(() =>
	loadAuthOptions(),
);
