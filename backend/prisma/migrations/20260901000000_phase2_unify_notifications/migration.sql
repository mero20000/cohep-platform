/*
  Warnings:

  - You are about to drop the table `student_notifications` if it exists. All the data in this table will be lost.
  - Made the column `user_id` on table `notifications` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "student_notifications" DROP CONSTRAINT "student_notifications_student_id_fkey" CASCADE;

-- AlterTable: Add new columns to notifications
ALTER TABLE "notifications" ADD COLUMN "student_id" TEXT,
ADD COLUMN "channel" TEXT DEFAULT 'in_app',
ADD COLUMN "link_path" TEXT,
ADD COLUMN "reference_type" TEXT,
ADD COLUMN "reference_id" TEXT;

-- Migrate data from student_notifications to notifications
INSERT INTO "notifications" (id, "school_id", "student_id", type, title, "title_ar", body, "body_ar", channel, "link_path", "reference_type", "reference_id", "is_read", "read_at", "created_at")
SELECT
  id,
  (SELECT "school_id" FROM "students" WHERE "id" = "student_notifications"."student_id" LIMIT 1),
  "student_id",
  type,
  title,
  "title_ar",
  COALESCE(body, ''),
  "body_ar",
  'in_app',
  "link_path",
  "reference_type",
  "reference_id",
  FALSE,
  "read_at",
  "created_at"
FROM "student_notifications"
ON CONFLICT DO NOTHING;

-- DropTable
DROP TABLE "student_notifications";

-- AlterTable: Make user_id optional (was required before)
ALTER TABLE "notifications" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable: Ensure body is varchar(500)
ALTER TABLE "notifications" ALTER COLUMN body TYPE VARCHAR(500);

-- Add foreign key for student_id
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old indexes and recreate with new ones
DROP INDEX IF EXISTS "notifications_user_id_is_read_created_at_idx";
DROP INDEX IF EXISTS "notifications_school_id_idx";

-- Create new indexes
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");
CREATE INDEX "notifications_student_id_is_read_created_at_idx" ON "notifications"("student_id", "is_read", "created_at");
CREATE INDEX "notifications_school_id_created_at_idx" ON "notifications"("school_id", "created_at");

-- Add unique constraints (must handle NULLs properly in Postgres)
CREATE UNIQUE INDEX "notifications_user_id_type_reference_id_key" ON "notifications"("school_id", "user_id", type, "reference_id") WHERE "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "notifications_student_id_type_reference_id_key" ON "notifications"("school_id", "student_id", type, "reference_id") WHERE "student_id" IS NOT NULL;
