import "@tanstack/solid-start/server-only";
import { createTransport } from "nodemailer";
import { env } from "../env";

type Email = { to: string; subject: string; text: string };

const transport = env.SMTP_URL ? createTransport(env.SMTP_URL) : undefined;

// Without SMTP_URL (no provider configured yet), messages are printed so links and codes can be copied from the server log.
export async function sendEmail({ to, subject, text }: Email) {
	if (!transport) {
		console.info(`\n[email] to: ${to}\n[email] subject: ${subject}\n${text}\n`);
		return;
	}
	await transport.sendMail({ from: env.EMAIL_FROM, to, subject, text });
}
