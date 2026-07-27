-- Comprehensive migration: add all status and missing columns that exist in
-- schema.prisma but were never included in any previous migration.
-- Every statement uses IF NOT EXISTS so this is safe to re-run.

-- academic_years
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

-- students
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

-- levels
ALTER TABLE "levels" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "levels" ADD COLUMN IF NOT EXISTS "sessions_per_lesson" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "levels" ADD COLUMN IF NOT EXISTS "min_attendance_percent" DECIMAL(65,30) NOT NULL DEFAULT 80;
ALTER TABLE "levels" ADD COLUMN IF NOT EXISTS "min_assessment_score" DECIMAL(65,30) NOT NULL DEFAULT 70;

-- groups
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

-- subjects
ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

-- lessons
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- attendance_sessions
ALTER TABLE "attendance_sessions" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'scheduled';

-- attendance_records
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "homework_status" TEXT NOT NULL DEFAULT 'not_assigned';
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "attended_liturgy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "is_private_note" BOOLEAN NOT NULL DEFAULT false;

-- assessments
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "grading_type" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "allow_late_submission" BOOLEAN NOT NULL DEFAULT false;

-- assessment_submissions
ALTER TABLE "assessment_submissions" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'submitted';
ALTER TABLE "assessment_submissions" ADD COLUMN IF NOT EXISTS "is_late" BOOLEAN NOT NULL DEFAULT false;

-- lesson_progress
ALTER TABLE "lesson_progress" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'not_started';
ALTER TABLE "lesson_progress" ADD COLUMN IF NOT EXISTS "progress_percent" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "lesson_progress" ADD COLUMN IF NOT EXISTS "sessions_completed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lesson_progress" ADD COLUMN IF NOT EXISTS "total_sessions" INTEGER NOT NULL DEFAULT 0;

-- promotion_records
ALTER TABLE "promotion_records" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';

-- certificates
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

-- announcements
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false;

-- messages
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'sent';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_read" BOOLEAN NOT NULL DEFAULT false;

-- notifications
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "is_read" BOOLEAN NOT NULL DEFAULT false;

-- events
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "is_all_day" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "rsvp_required" BOOLEAN NOT NULL DEFAULT false;

-- curriculum_allocations
ALTER TABLE "curriculum_allocations" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';

-- academic_weeks
ALTER TABLE "academic_weeks" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'available';
ALTER TABLE "academic_weeks" ADD COLUMN IF NOT EXISTS "is_available" BOOLEAN NOT NULL DEFAULT true;

-- resources
ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'supplementary';
ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "is_downloadable" BOOLEAN NOT NULL DEFAULT true;

-- badges
ALTER TABLE "badges" ADD COLUMN IF NOT EXISTS "is_secret" BOOLEAN NOT NULL DEFAULT false;

-- system_configs
ALTER TABLE "system_configs" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN NOT NULL DEFAULT false;
