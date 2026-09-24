import { createFileRoute } from "@tanstack/solid-router";
import { proxyShape } from "../../../electric/proxy";

export const Route = createFileRoute("/api/shapes/hello-world")({
	server: {
		handlers: {
			GET: ({ request }) => proxyShape(request, "hello_world"),
		},
	},
});
