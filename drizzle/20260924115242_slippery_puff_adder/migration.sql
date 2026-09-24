CREATE TABLE "entrant_emergency_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"entrant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"relationship" text NOT NULL,
	"is_on_site" boolean DEFAULT false NOT NULL,
	"priority_order" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "entrant_emergency_contacts_unique_idx" ON "entrant_emergency_contacts" ("entrant_id","person_id");--> statement-breakpoint
CREATE INDEX "entrant_emergency_contacts_person_idx" ON "entrant_emergency_contacts" ("person_id");--> statement-breakpoint
ALTER TABLE "entrant_emergency_contacts" ADD CONSTRAINT "entrant_emergency_contacts_entrant_id_entrants_id_fkey" FOREIGN KEY ("entrant_id") REFERENCES "entrants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "entrant_emergency_contacts" ADD CONSTRAINT "entrant_emergency_contacts_person_id_people_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE RESTRICT;