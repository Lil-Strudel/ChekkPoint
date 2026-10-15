import pg from "pg";

const email = process.argv[2];
if (!email) {
	console.error("usage: pnpm auth:make-admin <email>");
	process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rowCount } = await client.query(
	"update users set role = 'admin' where lower(email) = lower($1)",
	[email],
);
await client.end();

if (rowCount === 0) {
	console.error(`No user with email ${email}. Sign up first.`);
	process.exit(1);
}
console.log(`${email} is now a platform admin.`);
