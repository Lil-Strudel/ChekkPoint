import { snakeCase, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const helloWorld = snakeCase.table("hello_world", {
	id: uuid().primaryKey(),
	message: varchar({ length: 255 }).notNull(),
	createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp({ withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});
