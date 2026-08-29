-- Rejecting a liturgy claim used to be a hard row delete: no reason recorded, nobody
-- told, and the claim silently disappeared for both the student and the parent who filed
-- it. Rejection becomes a status change, which needs somewhere to put the reason.
--
-- All three columns are nullable, so this is additive and safe on existing rows. Claims
-- rejected before this migration are already gone and cannot be recovered here.
ALTER TABLE "family_liturgies" ADD COLUMN IF NOT EXISTS "rejected_by" TEXT;
ALTER TABLE "family_liturgies" ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3);
ALTER TABLE "family_liturgies" ADD COLUMN IF NOT EXISTS "rejection_reason" VARCHAR(300);

-- Claims are looked up by (student, status) when building the student's own liturgy list,
-- and 'rejected' is now a third value that list filters on.
CREATE INDEX IF NOT EXISTS "family_liturgies_student_id_status_date_idx"
  ON "family_liturgies" ("student_id", "status", "date" DESC);
