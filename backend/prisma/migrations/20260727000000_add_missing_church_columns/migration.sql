-- Add missing columns to churches table that exist in schema but were never migrated
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "school_name_en" TEXT;
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "school_name_coptic" TEXT;

-- Add missing columns to schools table
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "education_language" TEXT;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "registration_status" TEXT NOT NULL DEFAULT 'approved';
