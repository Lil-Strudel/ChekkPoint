import { Link } from "@tanstack/solid-router";

export default function Header() {
	return (
		<header class="site-header px-4">
			<nav class="page-wrap nav-shell">
				<h2 class="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
					<Link to="/" class="brand-pill">
						<span class="brand-dot" />
						TanStack Start
					</Link>
				</h2>

				<div class="ml-auto flex items-center gap-2"></div>

				<div class="order-3 flex w-full flex-wrap items-center gap-y-2.5 sm:gap-x-3 md:gap-x-4 pb-1 text-sm font-semibold sm:order-2 sm:w-auto md:flex-nowrap sm:pb-0">
					<Link
						to="/"
						class="nav-link"
						activeProps={{ class: "nav-link is-active" }}
					>
						Home
					</Link>
					<Link
						to="/about"
						class="nav-link"
						activeProps={{ class: "nav-link is-active" }}
					>
						About
					</Link>
					<Link
						to="/hello"
						class="nav-link"
						activeProps={{ class: "nav-link is-active" }}
					>
						Hello DB
					</Link>
					<Link
						to="/redis"
						class="nav-link"
						activeProps={{ class: "nav-link is-active" }}
					>
						Redis
					</Link>
					<Link
						to="/manage-db"
						class="nav-link"
						activeProps={{ class: "nav-link is-active" }}
					>
						Manage DB
					</Link>
					<a
						href="https://tanstack.com/start/latest/docs/framework/solid/overview"
						target="_blank"
						rel="noreferrer"
						class="nav-link"
					>
						Docs
					</a>
				</div>
			</nav>
		</header>
	);
}
