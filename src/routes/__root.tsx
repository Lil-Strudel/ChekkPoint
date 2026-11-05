import ebGaramondFont from "@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2?url";
import manropeFont from "@fontsource/manrope/files/manrope-latin-500-normal.woff2?url";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Scripts,
	useRouter,
	useLocation,
} from "@tanstack/solid-router";
import { type JSX, Suspense } from "solid-js";
import { HydrationScript } from "solid-js/web";
import { getViewer } from "../auth/session.functions";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { Button, buttonVariants } from "../components/ui/button";
import styleCss from "../styles.css?url";

export const Route = createRootRouteWithContext()({
	beforeLoad: async () => ({ viewer: await getViewer() }),
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
	errorComponent: RootError,
	notFoundComponent: RootNotFound,
	onCatch: (error) => console.error(error),
});

function RootComponent(props: { children: JSX.Element }) {
	const location = useLocation();
	const isLogger = () =>
		location.pathname.endsWith("/logger") ||
		location.pathname.endsWith("/logger/");

	return (
		<html lang="en">
			<head>
				<HydrationScript />
				<HeadContent />
			</head>
			<body>
				<Suspense>
					{!isLogger() && <Header />}
					{props.children}
					{!isLogger() && <Footer />}
				</Suspense>
				<Scripts />
			</body>
		</html>
	);
}

function RootError() {
	const router = useRouter();

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Error</p>
			<h1 class="page-title">Something went wrong</h1>
			<p class="page-sub">This page didn't load. Try again in a moment.</p>
			<Button variant="outline" onClick={() => router.invalidate()}>
				Try again
			</Button>
		</main>
	);
}

function RootNotFound() {
	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Not found</p>
			<h1 class="page-title">Nothing here</h1>
			<p class="page-sub">There's no page at this address.</p>
			<Link to="/" class={buttonVariants({ variant: "outline" })}>
				Home
			</Link>
		</main>
	);
}
