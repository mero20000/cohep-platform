-- Per-assessment re-take cap. NULL means unlimited, which is the pre-existing behaviour.
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "max_attempts" INTEGER;

-- 1-based attempt counter so the live submission is identifiable without relying on
-- insertion order. Existing rows are all first attempts.
ALTER TABLE "assessment_submissions" ADD COLUMN IF NOT EXISTS "attempt_number" INTEGER NOT NULL DEFAULT 1;

-- Backfill attempt_number for any student who already has multiple submissions on the
-- same assessment, oldest first, and archive every attempt but the newest as superseded.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "assessment_id", "student_id"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS rn,
    COUNT(*) OVER (PARTITION BY "assessment_id", "student_id") AS total
  FROM "assessment_submissions"
)
UPDATE "assessment_submissions" s
SET
  "attempt_number" = r.rn,
  "status" = CASE WHEN r.rn < r.total THEN 'superseded' ELSE s."status" END
FROM ranked r
WHERE s."id" = r."id" AND r.total > 1;

-- The live-row lookup orders by attempt_number within (assessment, student).
CREATE INDEX IF NOT EXISTS "assessment_submissions_assessment_id_student_id_attempt_number_idx"
  ON "assessment_submissions" ("assessment_id", "student_id", "attempt_number" DESC);
