-- The session_id column already exists in prod (added manually); keep migration idempotent.
ALTER TABLE "student_subject_passes" ADD COLUMN IF NOT EXISTS "session_id" TEXT;
CREATE INDEX IF NOT EXISTS "student_subject_passes_session_id_idx" ON "student_subject_passes"("session_id");
