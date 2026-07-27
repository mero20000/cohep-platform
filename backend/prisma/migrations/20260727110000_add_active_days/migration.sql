-- Add active_days column to academic_years (missed in previous migration)
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "active_days" JSONB;
