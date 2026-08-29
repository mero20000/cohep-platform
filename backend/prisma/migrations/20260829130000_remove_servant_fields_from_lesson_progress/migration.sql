-- Remove unused servant fields from lesson_progress table
-- These fields were removed from the domain logic and don't exist in production

ALTER TABLE "lesson_progress" 
  DROP COLUMN IF EXISTS "servant_feedback";

ALTER TABLE "lesson_progress"
  DROP COLUMN IF EXISTS "servant_feedback_at";

ALTER TABLE "lesson_progress"
  DROP COLUMN IF EXISTS "servant_id";
