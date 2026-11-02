-- AlterTable: assessment review / recording / retry flags (additive, backfilled by defaults)
ALTER TABLE "assessments" ADD COLUMN "require_review" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "assessments" ADD COLUMN "require_recording" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "assessments" ADD COLUMN "allow_retry" BOOLEAN NOT NULL DEFAULT false;
