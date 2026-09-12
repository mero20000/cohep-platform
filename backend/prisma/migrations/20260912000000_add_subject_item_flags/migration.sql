-- AlterTable: per-item assessment + pass-required flags (additive, backfilled by defaults)
ALTER TABLE "subject_items" ADD COLUMN "is_assessment_item" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "subject_items" ADD COLUMN "pass_required" BOOLEAN NOT NULL DEFAULT false;
