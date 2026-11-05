import { Link } from "@tanstack/solid-router";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuGroupLabel,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import UserMenu from "./UserMenu";

export default function Header() {
	return (
		<header class="site-header px-4">
			<nav class="page-wrap nav-shell" aria-label="Main navigation">
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

				<div class="order-3 flex w-full flex-wrap items-center gap-y-2.5 sm:gap-x-4 md:gap-x-6 pb-1 text-sm font-semibold sm:order-2 sm:ml-auto sm:w-auto md:flex-nowrap sm:pb-0">
					<Link
						to="/"
						activeOptions={{ exact: true }}
						class="nav-link"
						activeProps={{ class: "nav-link is-active" }}
					>
						Home
					</Link>
					<Link
						to="/events"
						class="nav-link"
						activeProps={{ class: "nav-link is-active" }}
					>
						Events
					</Link>
					<Link
						to="/athletes"
						class="nav-link"
						activeProps={{ class: "nav-link is-active" }}
					>
						Athletes
					</Link>

					<DropdownMenu>
						<DropdownMenuTrigger
							as="button"
							type="button"
							class="nav-link gap-1 bg-transparent border-0 p-0 text-sm font-semibold cursor-pointer"
						>
							Platform
							<svg
								aria-hidden="true"
								viewBox="0 0 20 20"
								fill="currentColor"
								class="size-3.5 opacity-70"
							>
								<path
									fill-rule="evenodd"
									d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
									clip-rule="evenodd"
								/>
							</svg>
						</DropdownMenuTrigger>
						<DropdownMenuContent class="w-56">
							<DropdownMenuGroup>
								<DropdownMenuGroupLabel>
									Guides &amp; Roles
								</DropdownMenuGroupLabel>
								<DropdownMenuItem as={Link} to="/for-organizers">
									For Race Organizers
								</DropdownMenuItem>
								<DropdownMenuItem as={Link} to="/for-volunteers">
									For Field Volunteers
								</DropdownMenuItem>
								<DropdownMenuItem as={Link} to="/for-athletes">
									For Athletes &amp; Crews
								</DropdownMenuItem>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuItem as={Link} to="/about">
								About ChekkPoint
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<DropdownMenu>
						<DropdownMenuTrigger
							as="button"
							type="button"
							class="nav-link gap-1 bg-transparent border-0 p-0 text-sm font-semibold cursor-pointer"
						>
							Dev
							<svg
								aria-hidden="true"
								viewBox="0 0 20 20"
								fill="currentColor"
								class="size-3.5 opacity-70"
							>
								<path
									fill-rule="evenodd"
									d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
									clip-rule="evenodd"
								/>
							</svg>
						</DropdownMenuTrigger>
						<DropdownMenuContent class="w-44">
							<DropdownMenuGroup>
								<DropdownMenuGroupLabel>Diagnostics</DropdownMenuGroupLabel>
								<DropdownMenuItem as={Link} to="/manage-db">
									Manage DB
								</DropdownMenuItem>
								<DropdownMenuItem as={Link} to="/hello">
									Hello DB
								</DropdownMenuItem>
								<DropdownMenuItem as={Link} to="/redis">
									Redis Status
								</DropdownMenuItem>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</nav>
		</header>
	);
}
