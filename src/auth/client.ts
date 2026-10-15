import { passkeyClient } from "@better-auth/passkey/client";
import {
	adminClient,
	emailOTPClient,
	magicLinkClient,
	organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/solid";
import { ac, roles } from "./access";

export const authClient = createAuthClient({
	plugins: [
		emailOTPClient(),
		magicLinkClient(),
		passkeyClient(),
		organizationClient({ ac, roles }),
		adminClient(),
	],
});
