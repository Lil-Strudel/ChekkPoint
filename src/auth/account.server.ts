import "@tanstack/solid-start/server-only";
import { getRequestHeaders } from "@tanstack/solid-start/server";
import { auth } from "./auth.server";
import { loadAuthOptions } from "./session.server";

export async function loadAccountOverview() {
	const headers = getRequestHeaders();
	const [passkeys, accounts, sessions] = await Promise.all([
		auth.api.listPasskeys({ headers }),
		auth.api.listUserAccounts({ headers }),
		auth.api.listSessions({ headers }),
	]);
	return {
		providers: loadAuthOptions(),
		passkeys: passkeys.map((p) => ({
			id: p.id,
			name: p.name ?? null,
			createdAt: p.createdAt,
		})),
		accounts: accounts.map((a) => ({ id: a.id, providerId: a.providerId })),
		sessions: sessions.map((s) => ({
			token: s.token,
			userAgent: s.userAgent ?? null,
			createdAt: s.createdAt,
		})),
	};
}
