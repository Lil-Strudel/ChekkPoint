CREATE TYPE "experience_tier" AS ENUM('novice', 'intermediate', 'veteran', 'elite');--> statement-breakpoint
CREATE TYPE "external_platform" AS ENUM('ultrasignup', 'strava', 'duv', 'itra', 'athlinks', 'custom');--> statement-breakpoint
CREATE TYPE "profile_verification_status" AS ENUM('unverified', 'candidate_matched', 'auto_verified', 'manual_verified', 'rejected', 'conflict');--> statement-breakpoint
CREATE TYPE "race_history_status" AS ENUM('finished', 'dnf', 'dns', 'dq', 'in_progress', 'unknown');--> statement-breakpoint
CREATE TYPE "scrape_status" AS ENUM('pending', 'queued', 'in_progress', 'succeeded', 'failed', 'rate_limited', 'stale');--> statement-breakpoint
CREATE TABLE "entrant_historical_projections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"entrant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"projected_finish_seconds" integer,
	"projected_pace_seconds_per_km" double precision,
	"projected_arrival_times" jsonb,
	"confidence_band_low_seconds" integer,
	"confidence_band_high_seconds" integer,
	"expected_cutoff_risk" boolean DEFAULT false NOT NULL,
	"volunteers_sar_safety_badge" text,
	"projection_method" text DEFAULT 'historical_pacing' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_external_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"person_id" uuid NOT NULL,
	"platform" "external_platform" NOT NULL,
	"external_identifier" text NOT NULL,
	"profile_url" text,
	"verification_status" "profile_verification_status" DEFAULT 'unverified'::"profile_verification_status" NOT NULL,
	"match_confidence" double precision,
	"match_metadata" jsonb,
	"scrape_status" "scrape_status" DEFAULT 'pending'::"scrape_status" NOT NULL,
	"last_scraped_at" timestamp with time zone,
	"raw_payload" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_historical_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"person_id" uuid NOT NULL,
	"total_races" integer DEFAULT 0 NOT NULL,
	"total_finishes" integer DEFAULT 0 NOT NULL,
	"total_dnfs" integer DEFAULT 0 NOT NULL,
	"dnf_rate" double precision DEFAULT 0 NOT NULL,
	"max_distance_meters" double precision DEFAULT 0 NOT NULL,
	"max_elevation_gain_meters" double precision DEFAULT 0 NOT NULL,
	"avg_pace_seconds_per_km" double precision,
	"experience_tier" "experience_tier" DEFAULT 'novice'::"experience_tier" NOT NULL,
	"ultrasignup_rank" double precision,
	"itra_performance_index" integer,
	"last_race_date" text,
	"confidence_score" double precision DEFAULT 1 NOT NULL,
	"safety_triage_notes" text,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_race_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"person_id" uuid NOT NULL,
	"external_profile_id" uuid,
	"platform" "external_platform" NOT NULL,
	"race_name" text NOT NULL,
	"race_date" text NOT NULL,
	"distance_meters" double precision,
	"distance_label" text,
	"elevation_gain_meters" double precision,
	"elapsed_seconds" integer,
	"finish_time_formatted" text,
	"overall_place" integer,
	"gender_place" integer,
	"category_place" integer,
	"total_finishers" integer,
	"status" "race_history_status" DEFAULT 'finished'::"race_history_status" NOT NULL,
	"source_url" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "entrant_emergency_contacts";--> statement-breakpoint
ALTER TABLE "entrants" ADD COLUMN "emergency_contact_person_id" uuid;--> statement-breakpoint
ALTER TABLE "entrants" ADD COLUMN "emergency_contact_relationship" text;--> statement-breakpoint
ALTER TABLE "entrants" ADD COLUMN "emergency_contact_is_on_site" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "entrant_historical_projections_entrant_idx" ON "entrant_historical_projections" ("entrant_id");--> statement-breakpoint
CREATE INDEX "entrant_historical_projections_person_idx" ON "entrant_historical_projections" ("person_id");--> statement-breakpoint
CREATE INDEX "entrant_historical_projections_cutoff_risk_idx" ON "entrant_historical_projections" ("expected_cutoff_risk");--> statement-breakpoint
CREATE INDEX "entrants_emergency_contact_person_idx" ON "entrants" ("emergency_contact_person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_external_profiles_platform_identifier_idx" ON "person_external_profiles" ("platform","external_identifier");--> statement-breakpoint
CREATE INDEX "person_external_profiles_person_idx" ON "person_external_profiles" ("person_id");--> statement-breakpoint
CREATE INDEX "person_external_profiles_scrape_status_idx" ON "person_external_profiles" ("scrape_status");--> statement-breakpoint
CREATE UNIQUE INDEX "person_historical_summaries_person_idx" ON "person_historical_summaries" ("person_id");--> statement-breakpoint
CREATE INDEX "person_historical_summaries_tier_idx" ON "person_historical_summaries" ("experience_tier");--> statement-breakpoint
CREATE INDEX "person_race_history_person_idx" ON "person_race_history" ("person_id");--> statement-breakpoint
CREATE INDEX "person_race_history_date_idx" ON "person_race_history" ("race_date");--> statement-breakpoint
CREATE INDEX "person_race_history_distance_idx" ON "person_race_history" ("distance_meters");--> statement-breakpoint
ALTER TABLE "entrant_historical_projections" ADD CONSTRAINT "entrant_historical_projections_entrant_id_entrants_id_fkey" FOREIGN KEY ("entrant_id") REFERENCES "entrants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "entrant_historical_projections" ADD CONSTRAINT "entrant_historical_projections_person_id_people_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_emergency_contact_person_id_people_id_fkey" FOREIGN KEY ("emergency_contact_person_id") REFERENCES "people"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "person_external_profiles" ADD CONSTRAINT "person_external_profiles_person_id_people_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "person_historical_summaries" ADD CONSTRAINT "person_historical_summaries_person_id_people_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "person_race_history" ADD CONSTRAINT "person_race_history_person_id_people_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "person_race_history" ADD CONSTRAINT "person_race_history_H6mkeb7QIAi1_fkey" FOREIGN KEY ("external_profile_id") REFERENCES "person_external_profiles"("id") ON DELETE SET NULL;