ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "audio_url" TEXT;
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "audio_original_name" TEXT;
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "audio_duration" INTEGER;

ALTER TABLE "lesson_progress" ADD COLUMN IF NOT EXISTS "milestone_photo_url" TEXT;
ALTER TABLE "lesson_progress" ADD COLUMN IF NOT EXISTS "milestone_caption" TEXT;

ALTER TABLE "family_liturgies" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
ALTER TABLE "family_liturgies" ADD COLUMN IF NOT EXISTS "servant_note" TEXT;
