import { integer, snakeCase, timestamp, varchar } from "drizzle-orm/pg-core";

export const helloWorld = snakeCase.table("hello_world", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	message: varchar({ length: 255 }).notNull(),
	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp()
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});
