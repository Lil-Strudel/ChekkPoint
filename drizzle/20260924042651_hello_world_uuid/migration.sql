-- Hand-edited: integer ids can't be cast to uuid, so recreate.
DROP TABLE "hello_world";--> statement-breakpoint
CREATE TABLE "hello_world" (
	"id" uuid PRIMARY KEY,
	"message" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "hello_world" REPLICA IDENTITY FULL;
