-- Add hymn/subject-item recording fields (Task 1 of R2 recording plan)
ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "recording_url" TEXT;
ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "recording_meta" JSONB;
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "reference_recording_url" TEXT;
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "reference_recording_name" TEXT;
