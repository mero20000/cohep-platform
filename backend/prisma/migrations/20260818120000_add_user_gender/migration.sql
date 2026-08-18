-- Add gender column (nullable first, then backfill — required at the API layer)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" TEXT;
UPDATE "users" SET "gender" = 'male' WHERE "gender" IS NULL;
ALTER TABLE "users" ALTER COLUMN "gender" SET NOT NULL;