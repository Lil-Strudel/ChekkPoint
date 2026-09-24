CREATE TYPE "data_status" AS ENUM('provisional', 'valid', 'questionable', 'bad', 'confirmed');--> statement-breakpoint
CREATE TYPE "discipline" AS ENUM('trail_ultra', 'road_marathon', 'backyard_ultra', 'fixed_time_loop', 'downhill_mtb', 'xco_cycling', 'tsd_regularity');--> statement-breakpoint
CREATE TYPE "entrant_status" AS ENUM('registered', 'checked_in', 'dns', 'in_progress', 'finished', 'dnf', 'retired', 'dq', 'otl');--> statement-breakpoint
CREATE TYPE "raw_timing_status" AS ENUM('unprocessed', 'matched', 'duplicate_subordinate', 'rejected_invalid', 'flagged_discrepancy');--> statement-breakpoint
CREATE TYPE "sub_split_kind" AS ENUM('in', 'out', 'point');--> statement-breakpoint
CREATE TYPE "timing_source" AS ENUM('rfid_transponder', 'optical_photocell', 'manual_web_entry', 'mobile_offline_app', 'mt63_ham_radio', 'api_webhook');--> statement-breakpoint
CREATE TABLE "course_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"course_id" uuid NOT NULL,
	"timing_point_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sequence_order" integer NOT NULL,
	"distance_from_start_meters" double precision NOT NULL,
	"sub_split_bitmap" integer DEFAULT 1 NOT NULL,
	"cutoff_duration_seconds" integer,
	"tsd_ideal_duration_seconds" double precision,
	"is_secret_checkpoint" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"distance_meters" double precision NOT NULL,
	"elevation_gain_meters" integer,
	"gpx_route_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entrants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"competitor_number" text NOT NULL,
	"rfid_code" text,
	"status" "entrant_status" DEFAULT 'registered'::"entrant_status" NOT NULL,
	"division" text NOT NULL,
	"participant_data" jsonb NOT NULL,
	"scheduled_start_time" timestamp with time zone,
	"actual_start_time" timestamp with time zone,
	"dropped_split_id" uuid,
	"drop_reason" text,
	"drop_location_description" text,
	"comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"discipline" "discipline" NOT NULL,
	"rules_config" jsonb NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_group_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"laps_required" integer DEFAULT 1 NOT NULL,
	"scheduled_start" timestamp with time zone NOT NULL,
	"actual_start" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"gender" text,
	"birthdate" text,
	"email" text,
	"phone" text,
	"address" jsonb,
	"roles" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_timing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_group_id" uuid NOT NULL,
	"competitor_number" text NOT NULL,
	"timing_point_code" text NOT NULL,
	"sub_split_kind" "sub_split_kind" NOT NULL,
	"recorded_time_utc" timestamp(3) with time zone NOT NULL,
	"source" "timing_source" NOT NULL,
	"source_device_id" text,
	"source_operator" text,
	"sync_batch_id" uuid,
	"with_pacer" boolean DEFAULT false NOT NULL,
	"raw_payload" jsonb,
	"status" "raw_timing_status" DEFAULT 'unprocessed'::"raw_timing_status" NOT NULL,
	"audit_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scored_split_times" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"entrant_id" uuid NOT NULL,
	"course_split_id" uuid NOT NULL,
	"lap" integer DEFAULT 1 NOT NULL,
	"sub_split_kind" "sub_split_kind" NOT NULL,
	"absolute_time_utc" timestamp(3) with time zone NOT NULL,
	"elapsed_seconds" double precision NOT NULL,
	"dwell_seconds" integer,
	"segment_pace_seconds_per_km" double precision,
	"tsd_deviation_seconds" double precision,
	"penalty_points" double precision DEFAULT 0 NOT NULL,
	"stopped_here" boolean DEFAULT false NOT NULL,
	"data_status" "data_status" DEFAULT 'valid'::"data_status" NOT NULL,
	"governing_raw_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "split_time_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"split_time_id" uuid NOT NULL,
	"action" text NOT NULL,
	"previous_state" jsonb,
	"new_state" jsonb,
	"changed_by" text NOT NULL,
	"change_reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_allowances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"entrant_id" uuid NOT NULL,
	"split_id" uuid NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"duration_seconds" integer NOT NULL,
	"reason" text NOT NULL,
	"authorized_by" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timing_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"elevation_meters" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "course_splits_order_idx" ON "course_splits" ("course_id","sequence_order");--> statement-breakpoint
CREATE INDEX "course_splits_course_dist_idx" ON "course_splits" ("course_id","distance_from_start_meters");--> statement-breakpoint
CREATE INDEX "courses_org_idx" ON "courses" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entrants_event_competitor_idx" ON "entrants" ("event_id","competitor_number");--> statement-breakpoint
CREATE INDEX "entrants_transponder_idx" ON "entrants" ("rfid_code");--> statement-breakpoint
CREATE INDEX "entrants_status_idx" ON "entrants" ("event_id","status");--> statement-breakpoint
CREATE INDEX "event_groups_org_idx" ON "event_groups" ("organization_id");--> statement-breakpoint
CREATE INDEX "event_groups_slug_idx" ON "event_groups" ("slug");--> statement-breakpoint
CREATE INDEX "events_group_idx" ON "events" ("event_group_id");--> statement-breakpoint
CREATE INDEX "events_course_idx" ON "events" ("course_id");--> statement-breakpoint
CREATE INDEX "people_email_idx" ON "people" ("email");--> statement-breakpoint
CREATE INDEX "people_name_idx" ON "people" ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "raw_events_eg_comp_idx" ON "raw_timing_events" ("event_group_id","competitor_number");--> statement-breakpoint
CREATE INDEX "raw_events_time_idx" ON "raw_timing_events" ("recorded_time_utc");--> statement-breakpoint
CREATE INDEX "raw_events_batch_idx" ON "raw_timing_events" ("sync_batch_id");--> statement-breakpoint
CREATE INDEX "raw_events_status_idx" ON "raw_timing_events" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "scored_split_unique_idx" ON "scored_split_times" ("entrant_id","course_split_id","lap","sub_split_kind");--> statement-breakpoint
CREATE INDEX "scored_split_elapsed_idx" ON "scored_split_times" ("course_split_id","elapsed_seconds");--> statement-breakpoint
CREATE INDEX "scored_split_entrant_idx" ON "scored_split_times" ("entrant_id");--> statement-breakpoint
CREATE INDEX "split_time_audits_split_idx" ON "split_time_audits" ("split_time_id");--> statement-breakpoint
CREATE INDEX "time_allowances_entrant_idx" ON "time_allowances" ("entrant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "timing_points_org_code_idx" ON "timing_points" ("organization_id","code");--> statement-breakpoint
ALTER TABLE "course_splits" ADD CONSTRAINT "course_splits_course_id_courses_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "course_splits" ADD CONSTRAINT "course_splits_timing_point_id_timing_points_id_fkey" FOREIGN KEY ("timing_point_id") REFERENCES "timing_points"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_person_id_people_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_dropped_split_id_course_splits_id_fkey" FOREIGN KEY ("dropped_split_id") REFERENCES "course_splits"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event_groups" ADD CONSTRAINT "event_groups_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_event_group_id_event_groups_id_fkey" FOREIGN KEY ("event_group_id") REFERENCES "event_groups"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_course_id_courses_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "raw_timing_events" ADD CONSTRAINT "raw_timing_events_event_group_id_event_groups_id_fkey" FOREIGN KEY ("event_group_id") REFERENCES "event_groups"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scored_split_times" ADD CONSTRAINT "scored_split_times_entrant_id_entrants_id_fkey" FOREIGN KEY ("entrant_id") REFERENCES "entrants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scored_split_times" ADD CONSTRAINT "scored_split_times_course_split_id_course_splits_id_fkey" FOREIGN KEY ("course_split_id") REFERENCES "course_splits"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scored_split_times" ADD CONSTRAINT "scored_split_times_VUIT8cLvUYIW_fkey" FOREIGN KEY ("governing_raw_event_id") REFERENCES "raw_timing_events"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "split_time_audits" ADD CONSTRAINT "split_time_audits_split_time_id_scored_split_times_id_fkey" FOREIGN KEY ("split_time_id") REFERENCES "scored_split_times"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "time_allowances" ADD CONSTRAINT "time_allowances_entrant_id_entrants_id_fkey" FOREIGN KEY ("entrant_id") REFERENCES "entrants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "time_allowances" ADD CONSTRAINT "time_allowances_split_id_course_splits_id_fkey" FOREIGN KEY ("split_id") REFERENCES "course_splits"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "timing_points" ADD CONSTRAINT "timing_points_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;