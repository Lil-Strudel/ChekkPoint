import ebGaramondFont from "@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2?url";
import manropeFont from "@fontsource/manrope/files/manrope-latin-500-normal.woff2?url";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/solid-router";
import { TanStackRouterDevtools } from "@tanstack/solid-router-devtools";
import { Suspense } from "solid-js";
import { HydrationScript } from "solid-js/web";
import Header from "../components/Header";
import styleCss from "../styles.css?url";

export const Route = createRootRouteWithContext()({
	head: () => ({
		links: [
			{
				rel: "preload",
				href: ebGaramondFont,
				as: "font",
				type: "font/woff2",
				crossorigin: "anonymous",
			},
			{
				rel: "preload",
				href: manropeFont,
				as: "font",
				type: "font/woff2",
				crossorigin: "anonymous",
			},
			{ rel: "stylesheet", href: styleCss },
		],
	}),
	shellComponent: RootComponent,
});

function RootComponent() {
	return (
		<html lang="en">
			<head>
				<HydrationScript />
				<HeadContent />
			</head>
			<body>
				<Suspense>
					<Header />
					<Outlet />
					<TanStackRouterDevtools />
				</Suspense>
				<Scripts />
			</body>
		</html>
	);
}
