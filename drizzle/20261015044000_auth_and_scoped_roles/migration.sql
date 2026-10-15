CREATE TYPE "staff_role" AS ENUM('volunteer', 'checkpoint_captain', 'official', 'medical');--> statement-breakpoint
CREATE TABLE "event_group_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_group_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"roles" "staff_role"[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_group_staff_timing_points" (
	"staff_id" uuid,
	"timing_point_id" uuid,
	CONSTRAINT "event_group_staff_timing_points_pkey" PRIMARY KEY("staff_id","timing_point_id")
);
--> statement-breakpoint
CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"inviter_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"aaguid" text,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"token" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"active_organization_id" text,
	"impersonated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "metadata" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "raw_timing_events" ADD COLUMN "recorded_by_person_id" uuid;--> statement-breakpoint
ALTER TABLE "split_time_audits" ADD COLUMN "changed_by_person_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "time_allowances" ADD COLUMN "authorized_by_person_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN "roles";--> statement-breakpoint
ALTER TABLE "raw_timing_events" DROP COLUMN "source_operator";--> statement-breakpoint
ALTER TABLE "split_time_audits" DROP COLUMN "changed_by";--> statement-breakpoint
ALTER TABLE "time_allowances" DROP COLUMN "authorized_by";--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_key" UNIQUE("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_group_staff_group_person_idx" ON "event_group_staff" ("event_group_id","person_id");--> statement-breakpoint
CREATE INDEX "event_group_staff_person_idx" ON "event_group_staff" ("person_id");--> statement-breakpoint
CREATE INDEX "event_group_staff_timing_points_tp_idx" ON "event_group_staff_timing_points" ("timing_point_id");--> statement-breakpoint
CREATE INDEX "organization_invitations_org_idx" ON "organization_invitations" ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_idx" ON "organization_members" ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" ("user_id");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" ("user_id");--> statement-breakpoint
CREATE INDEX "passkeys_user_idx" ON "passkeys" ("user_id");--> statement-breakpoint
CREATE INDEX "passkeys_credential_idx" ON "passkeys" ("credential_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" ("identifier");--> statement-breakpoint
ALTER TABLE "event_group_staff" ADD CONSTRAINT "event_group_staff_event_group_id_event_groups_id_fkey" FOREIGN KEY ("event_group_id") REFERENCES "event_groups"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_group_staff" ADD CONSTRAINT "event_group_staff_person_id_people_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_group_staff_timing_points" ADD CONSTRAINT "event_group_staff_timing_points_vfNroUXU7ZM9_fkey" FOREIGN KEY ("staff_id") REFERENCES "event_group_staff"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_group_staff_timing_points" ADD CONSTRAINT "event_group_staff_timing_points_zjrPn6HagO09_fkey" FOREIGN KEY ("timing_point_id") REFERENCES "timing_points"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_inviter_id_users_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "raw_timing_events" ADD CONSTRAINT "raw_timing_events_recorded_by_person_id_people_id_fkey" FOREIGN KEY ("recorded_by_person_id") REFERENCES "people"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "split_time_audits" ADD CONSTRAINT "split_time_audits_changed_by_person_id_people_id_fkey" FOREIGN KEY ("changed_by_person_id") REFERENCES "people"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "time_allowances" ADD CONSTRAINT "time_allowances_authorized_by_person_id_people_id_fkey" FOREIGN KEY ("authorized_by_person_id") REFERENCES "people"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;