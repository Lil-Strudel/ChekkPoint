import "@tanstack/solid-start/server-only";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
	admin,
	emailOTP,
	type GenericOAuthConfig,
	genericOAuth,
	magicLink,
	organization,
} from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start/solid";
import { db } from "../db";
import {
	accounts,
	organizationInvitations,
	organizationMembers,
	organizations,
	passkeys,
	sessions,
	users,
	verifications,
} from "../db/schema";
import { env } from "../env";
import { ac, roles } from "./access";
import { sendEmail } from "./email.server";
import { ensurePersonForUser } from "./people.server";

const DAY = 60 * 60 * 24;

type StravaAthlete = {
	id: number;
	firstname?: string;
	lastname?: string;
	profile?: string;
};

// Strava never shares an email, so it can only be linked to an existing user, not used to sign in.
const strava: GenericOAuthConfig[] =
	env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET
		? [
				{
					providerId: "strava",
					name: "Strava",
					clientId: env.STRAVA_CLIENT_ID,
					clientSecret: env.STRAVA_CLIENT_SECRET,
					authorizationUrl: "https://www.strava.com/oauth/authorize",
					tokenUrl: "https://www.strava.com/oauth/token",
					scopes: ["read"],
					pkce: false,
					disableSignUp: true,
					async getUserInfo(tokens) {
						const res = await fetch("https://www.strava.com/api/v3/athlete", {
							headers: { Authorization: `Bearer ${tokens.accessToken}` },
						});
						if (!res.ok) return null;
						const athlete: StravaAthlete = await res.json();
						return {
							id: String(athlete.id),
							name: [athlete.firstname, athlete.lastname]
								.filter(Boolean)
								.join(" "),
							image: athlete.profile,
							emailVerified: false,
						};
					},
				},
			]
		: [];

export const auth = betterAuth({
	appName: "ChekkPoint",
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: users,
			session: sessions,
			account: accounts,
			verification: verifications,
			passkey: passkeys,
			organization: organizations,
			member: organizationMembers,
			invitation: organizationInvitations,
		},
	}),
	advanced: { database: { generateId: "uuid" } },
	session: { expiresIn: 30 * DAY, updateAge: DAY, freshAge: DAY },
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		async sendResetPassword({ user, url }) {
			await sendEmail({
				to: user.email,
				subject: "Reset your ChekkPoint password",
				text: `Reset your password: ${url}`,
			});
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		async sendVerificationEmail({ user, url }) {
			await sendEmail({
				to: user.email,
				subject: "Verify your ChekkPoint email",
				text: `Verify your email: ${url}`,
			});
		},
	},
	socialProviders:
		env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: env.GOOGLE_CLIENT_ID,
						clientSecret: env.GOOGLE_CLIENT_SECRET,
					},
				}
			: {},
	account: {
		accountLinking: {
			trustedProviders: ["google", "strava"],
			allowDifferentEmails: true,
		},
	},
	databaseHooks: {
		user: {
			create: {
				// Email-code and magic-link sign-ups arrive without a name.
				async before(user) {
					if (user.name.trim()) return;
					return { data: { ...user, name: user.email.split("@")[0] } };
				},
				async after(user) {
					if (user.emailVerified) await ensurePersonForUser(user);
				},
			},
			update: {
				async after(user) {
					if (user.emailVerified) await ensurePersonForUser(user);
				},
			},
		},
	},
	plugins: [
		emailOTP({
			async sendVerificationOTP({ email, otp, type }) {
				await sendEmail({
					to: email,
					subject: `Your ChekkPoint code: ${otp}`,
					text: `Your ${type} code is ${otp}. It expires in 5 minutes.`,
				});
			},
		}),
		magicLink({
			async sendMagicLink({ email, url }) {
				await sendEmail({
					to: email,
					subject: "Sign in to ChekkPoint",
					text: `Sign in: ${url}`,
				});
			},
		}),
		passkey({
			rpID: new URL(env.BETTER_AUTH_URL).hostname,
			rpName: "ChekkPoint",
			origin: new URL(env.BETTER_AUTH_URL).origin,
		}),
		genericOAuth({ config: strava }),
		organization({
			ac,
			roles,
			allowUserToCreateOrganization: true,
			async sendInvitationEmail({ id, email, organization, inviter, role }) {
				await sendEmail({
					to: email,
					subject: `Join ${organization.name} on ChekkPoint`,
					text: `${inviter.user.name} invited you to ${organization.name} as ${role}.\nAccept: ${env.BETTER_AUTH_URL}/accept-invitation/${id}`,
				});
			},
		}),
		admin(),
		tanstackStartCookies(),
	],
});

export type AuthSession = typeof auth.$Infer.Session;
