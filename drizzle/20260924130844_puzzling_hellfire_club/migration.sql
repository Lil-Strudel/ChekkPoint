ALTER TABLE "courses" ADD COLUMN "copied_from_course_id" uuid;--> statement-breakpoint
CREATE INDEX "courses_copied_from_idx" ON "courses" ("copied_from_course_id");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_copied_from_course_id_courses_id_fkey" FOREIGN KEY ("copied_from_course_id") REFERENCES "courses"("id") ON DELETE SET NULL;