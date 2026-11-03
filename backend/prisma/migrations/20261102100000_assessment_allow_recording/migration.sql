-- AlterTable: allow-recording flag (additive; existing assessments keep recording available)
ALTER TABLE "assessments" ADD COLUMN "allow_recording" BOOLEAN NOT NULL DEFAULT true;
