import "@tanstack/solid-start/server-only";

type Email = { to: string; subject: string; text: string };

// No email provider yet: messages are printed so links and codes can be copied from the dev server log.
export async function sendEmail({ to, subject, text }: Email) {
	console.info(`\n[email] to: ${to}\n[email] subject: ${subject}\n${text}\n`);
}
