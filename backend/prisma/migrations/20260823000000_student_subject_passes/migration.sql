-- Manual per-student subject-item passes awarded by servants
CREATE TABLE IF NOT EXISTS "student_subject_passes" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "subject_item_id" TEXT NOT NULL,
    "session_id" TEXT,
    "passed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passed_by" TEXT,
    CONSTRAINT "student_subject_passes_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "student_subject_passes"
    ADD CONSTRAINT "student_subject_passes_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "student_subject_passes"
    ADD CONSTRAINT "student_subject_passes_subject_item_id_fkey"
    FOREIGN KEY ("subject_item_id") REFERENCES "subject_items"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "student_subject_passes_student_id_subject_item_id_key"
  ON "student_subject_passes"("student_id", "subject_item_id");
CREATE INDEX IF NOT EXISTS "student_subject_passes_subject_item_id_idx"
  ON "student_subject_passes"("subject_item_id");
