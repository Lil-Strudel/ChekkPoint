import { Link } from "@tanstack/solid-router";
import UserMenu from "./UserMenu";

export default function Header() {
	return (
		<header class="site-header px-4">
			<nav class="page-wrap nav-shell">
				<h2 class="m-0 flex-shrink-0">
					<Link to="/" class="brand-pill">
						<svg class="brand-mark" viewBox="0 0 38 30" aria-hidden="true">
							<path
								d="M0 30 L13 6 L21 20 L26 12 L38 30 Z"
								fill="currentColor"
							/>
							<circle cx="22" cy="4" r="3" fill="var(--clay)" />
						</svg>
						ChekkPoint
					</Link>
				</h2>

				<div class="ml-auto flex items-center gap-2 sm:order-3 sm:ml-0">
					<UserMenu />
				</div>

				<div class="order-3 flex w-full flex-wrap items-center gap-y-2.5 sm:gap-x-3 md:gap-x-4 pb-1 text-sm font-semibold sm:order-2 sm:ml-auto sm:w-auto md:flex-nowrap sm:pb-0">
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
						to="/manage-db"
						class="nav-link"
						activeProps={{ class: "nav-link is-active" }}
					>
						Manage DB
					</Link>
				</div>
			</nav>
		</header>
	);
}
