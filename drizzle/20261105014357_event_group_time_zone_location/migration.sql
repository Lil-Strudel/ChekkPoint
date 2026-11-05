ALTER TABLE "event_groups" ADD COLUMN "time_zone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_groups" ADD COLUMN "location" text;