-- Add unguessable per-student portal access key (replaces enumerable student_code as the portal credential)
ALTER TABLE "students" ADD COLUMN "portal_access_key" TEXT;

-- Backfill existing students with random UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE "students" SET "portal_access_key" = gen_random_uuid()::text WHERE "portal_access_key" IS NULL;

ALTER TABLE "students" ALTER COLUMN "portal_access_key" SET NOT NULL;

CREATE UNIQUE INDEX "students_portal_access_key_key" ON "students"("portal_access_key");
