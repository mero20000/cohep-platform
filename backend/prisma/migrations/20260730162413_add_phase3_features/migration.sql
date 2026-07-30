-- Add liturgical tags to lessons
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "liturgical_tags" JSONB;

-- Add spaced repetition fields to lesson_progress
ALTER TABLE "lesson_progress" ADD COLUMN IF NOT EXISTS "mastery_status" TEXT NOT NULL DEFAULT 'not_started';
ALTER TABLE "lesson_progress" ADD COLUMN IF NOT EXISTS "sr_ease_factor" DOUBLE PRECISION NOT NULL DEFAULT 2.5;
ALTER TABLE "lesson_progress" ADD COLUMN IF NOT EXISTS "sr_interval" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "lesson_progress" ADD COLUMN IF NOT EXISTS "sr_repetitions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lesson_progress" ADD COLUMN IF NOT EXISTS "next_review_at" TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "lesson_progress_student_id_next_review_at_idx" ON "lesson_progress" ("student_id", "next_review_at");

-- Push subscriptions table
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_user_id_endpoint_key" ON "push_subscriptions" ("user_id", "endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions" ("user_id");

-- Hymn practice sessions table
CREATE TABLE IF NOT EXISTS "hymn_practice_sessions" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "progress_id" TEXT,
    "school_id" TEXT NOT NULL,
    "recording_url" TEXT,
    "duration_sec" INTEGER,
    "self_rating" INTEGER,
    "servant_note" TEXT,
    "servant_reviewed_at" TIMESTAMPTZ,
    "reviewed_by" TEXT,
    "servant_rating" INTEGER,
    "sr_quality" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hymn_practice_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "hymn_practice_sessions_student_id_lesson_id_idx" ON "hymn_practice_sessions" ("student_id", "lesson_id");
CREATE INDEX IF NOT EXISTS "hymn_practice_sessions_student_id_created_at_idx" ON "hymn_practice_sessions" ("student_id", "created_at");
CREATE INDEX IF NOT EXISTS "hymn_practice_sessions_reviewed_by_idx" ON "hymn_practice_sessions" ("reviewed_by");

DO $$ BEGIN
  ALTER TABLE "hymn_practice_sessions" ADD CONSTRAINT "hymn_practice_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hymn_practice_sessions" ADD CONSTRAINT "hymn_practice_sessions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hymn_practice_sessions" ADD CONSTRAINT "hymn_practice_sessions_progress_id_fkey" FOREIGN KEY ("progress_id") REFERENCES "lesson_progress"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hymn_practice_sessions" ADD CONSTRAINT "hymn_practice_sessions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
