-- Align student_subject_passes with Prisma schema: status/note/revoked columns,
-- passed_by NOT NULL + FK to users, new unique index allowing history via NULL revoked_at.
-- Idempotent: prod already has base table + session_id from 20260823000000.
ALTER TABLE "student_subject_passes" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'passed';
ALTER TABLE "student_subject_passes" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "student_subject_passes" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMP(3);
ALTER TABLE "student_subject_passes" ADD COLUMN IF NOT EXISTS "revoked_by" TEXT;
ALTER TABLE "student_subject_passes" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "student_subject_passes" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: existing rows must have a passer before making passed_by NOT NULL
UPDATE "student_subject_passes" SET "passed_by" = COALESCE("passed_by", '') WHERE "passed_by" IS NULL;
-- Attach orphaned passes to a school super admin so the FK is satisfiable
DO $$
DECLARE admin_id TEXT;
BEGIN
  SELECT u.id INTO admin_id FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id AND r.name = 'super_admin'
  LIMIT 1;
  IF admin_id IS NULL THEN
    SELECT id INTO admin_id FROM users ORDER BY "created_at" LIMIT 1;
  END IF;
  UPDATE "student_subject_passes" SET "passed_by" = admin_id WHERE "passed_by" = '';
END $$;

ALTER TABLE "student_subject_passes" ALTER COLUMN "passed_by" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "student_subject_passes"
    ADD CONSTRAINT "student_subject_passes_passed_by_fkey"
    FOREIGN KEY ("passed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Replace old pair-unique with history-aware unique (NULL revokedAt allowed multiple times in PG,
-- application layer enforces single active pass; this index keeps the Prisma contract valid)
DROP INDEX IF EXISTS "student_subject_passes_student_id_subject_item_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "student_subject_passes_student_id_subject_item_id_revoked_at_key"
  ON "student_subject_passes"("student_id", "subject_item_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "student_subject_passes_student_id_idx" ON "student_subject_passes"("student_id");
