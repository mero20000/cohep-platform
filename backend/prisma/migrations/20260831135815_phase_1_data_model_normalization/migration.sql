/*
  Warnings:

  - You are about to drop the column `user_agent` on the `push_subscriptions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[academic_year_id,level_id,subject_id,lesson_id,group_number,term,week_number]` on the table `curriculum_allocations` will be added. If there are existing duplicate values, this will fail.
  - Made the column `school_id` on table `analytics_events` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `app_sessions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `audit_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `badges` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `calendar_events` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `calendar_events` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `school_id` to the `family_liturgies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `school_id` to the `family_practices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `school_id` to the `push_subscriptions` table without a default value. This is not possible if the table is not empty.
  - Made the column `created_at` on table `subject_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `subject_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `system_configs` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_school_id_fkey";

-- DropForeignKey
ALTER TABLE "grades" DROP CONSTRAINT "grades_graded_by_fkey";

-- DropForeignKey
ALTER TABLE "hymn_practice_sessions" DROP CONSTRAINT "hymn_practice_sessions_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "hymn_practice_sessions" DROP CONSTRAINT "hymn_practice_sessions_progress_id_fkey";

-- DropForeignKey
ALTER TABLE "hymn_practice_sessions" DROP CONSTRAINT "hymn_practice_sessions_school_id_fkey";

-- DropForeignKey
ALTER TABLE "hymn_practice_sessions" DROP CONSTRAINT "hymn_practice_sessions_student_id_fkey";

-- DropForeignKey
ALTER TABLE "student_subject_passes" DROP CONSTRAINT "student_subject_passes_student_id_fkey";

-- DropForeignKey
ALTER TABLE "student_subject_passes" DROP CONSTRAINT "student_subject_passes_subject_item_id_fkey";

-- DropIndex
DROP INDEX "app_sessions_started_at_idx";

-- DropIndex
DROP INDEX "assessment_submissions_assessment_id_student_id_attempt_number_";

-- DropIndex
DROP INDEX "audit_logs_entity_type_entity_id_idx";

-- DropIndex
DROP INDEX "curriculum_allocations_academic_year_id_level_id_subject_id_key";

-- DropIndex
DROP INDEX "family_liturgies_student_id_status_date_idx";

-- BACKFILL NULL values before setting NOT NULL
UPDATE "analytics_events" SET "school_id" = (SELECT "id" FROM "schools" LIMIT 1) WHERE "school_id" IS NULL;
UPDATE "app_sessions" SET "school_id" = (SELECT "id" FROM "schools" LIMIT 1) WHERE "school_id" IS NULL;
UPDATE "audit_logs" SET "school_id" = (SELECT "id" FROM "schools" LIMIT 1) WHERE "school_id" IS NULL;
UPDATE "badges" SET "school_id" = (SELECT "id" FROM "schools" LIMIT 1) WHERE "school_id" IS NULL;
UPDATE "system_configs" SET "school_id" = (SELECT "id" FROM "schools" LIMIT 1) WHERE "school_id" IS NULL;

-- AlterTable
ALTER TABLE "academic_weeks" ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "analytics_events" ALTER COLUMN "school_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "app_sessions" ALTER COLUMN "school_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "attendance_records" ALTER COLUMN "attended_liturgy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "school_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "badges" ALTER COLUMN "school_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "calendar_events" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable: First backfill family_liturgies and family_practices schoolId, then add constraint
ALTER TABLE "family_liturgies" ADD COLUMN "school_id" TEXT;
UPDATE "family_liturgies" SET "school_id" = (SELECT "school_id" FROM "students" WHERE "students"."id" = "family_liturgies"."student_id" LIMIT 1);
UPDATE "family_liturgies" SET "school_id" = (SELECT "id" FROM "schools" LIMIT 1) WHERE "school_id" IS NULL;
ALTER TABLE "family_liturgies" ALTER COLUMN "school_id" SET NOT NULL;

-- AlterTable: First backfill family_practices schoolId, then add constraint
ALTER TABLE "family_practices" ADD COLUMN "school_id" TEXT;
UPDATE "family_practices" SET "school_id" = (SELECT "school_id" FROM "students" WHERE "students"."id" = "family_practices"."student_id" LIMIT 1);
UPDATE "family_practices" SET "school_id" = (SELECT "id" FROM "schools" LIMIT 1) WHERE "school_id" IS NULL;
ALTER TABLE "family_practices" ALTER COLUMN "school_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "hymn_practice_sessions" ALTER COLUMN "servant_reviewed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lesson_progress" ALTER COLUMN "next_review_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable: First backfill push_subscriptions schoolId, then add constraint
ALTER TABLE "push_subscriptions" DROP COLUMN "user_agent";
ALTER TABLE "push_subscriptions" ADD COLUMN "school_id" TEXT;
UPDATE "push_subscriptions" SET "school_id" = (SELECT "school_id" FROM "users" WHERE "users"."id" = "push_subscriptions"."user_id" LIMIT 1);
UPDATE "push_subscriptions" SET "school_id" = (SELECT "id" FROM "schools" LIMIT 1) WHERE "school_id" IS NULL;
ALTER TABLE "push_subscriptions" ALTER COLUMN "school_id" SET NOT NULL;
ALTER TABLE "push_subscriptions" ADD COLUMN "userAgent" TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "student_subject_passes" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "subject_items" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "system_configs" ALTER COLUMN "school_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "gender" SET DEFAULT 'male';

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "participant1_id" TEXT NOT NULL,
    "participant2_id" TEXT NOT NULL,
    "subject" TEXT,
    "last_message_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_school_id_last_message_at_idx" ON "conversations"("school_id", "last_message_at");

-- CreateIndex
CREATE INDEX "conversations_participant1_id_created_at_idx" ON "conversations"("participant1_id", "created_at");

-- CreateIndex
CREATE INDEX "conversations_participant2_id_created_at_idx" ON "conversations"("participant2_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_school_id_participant1_id_participant2_id_key" ON "conversations"("school_id", "participant1_id", "participant2_id");

-- CreateIndex
CREATE INDEX "analytics_events_school_id_name_created_at_idx" ON "analytics_events"("school_id", "name", "created_at");

-- CreateIndex
CREATE INDEX "app_sessions_school_id_started_at_idx" ON "app_sessions"("school_id", "started_at");

-- CreateIndex
CREATE INDEX "assessment_submissions_assessment_id_student_id_attempt_num_idx" ON "assessment_submissions"("assessment_id", "student_id", "attempt_number");

-- CreateIndex
CREATE INDEX "audit_logs_school_id_entity_type_entity_id_idx" ON "audit_logs"("school_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_school_id_created_at_idx" ON "audit_logs"("school_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_allocations_academic_year_id_level_id_subject_id_key" ON "curriculum_allocations"("academic_year_id", "level_id", "subject_id", "lesson_id", "group_number", "term", "week_number");

-- CreateIndex
CREATE INDEX "family_liturgies_student_id_status_date_idx" ON "family_liturgies"("student_id", "status", "date");

-- CreateIndex
CREATE INDEX "messages_parent_message_id_idx" ON "messages"("parent_message_id");

-- CreateIndex
CREATE INDEX "push_subscriptions_school_id_idx" ON "push_subscriptions"("school_id");

-- CreateIndex
CREATE INDEX "students_parent_email_idx" ON "students"("parent_email");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant1_id_fkey" FOREIGN KEY ("participant1_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant2_id_fkey" FOREIGN KEY ("participant2_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_notes" ADD CONSTRAINT "medical_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subject_passes" ADD CONSTRAINT "student_subject_passes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subject_passes" ADD CONSTRAINT "student_subject_passes_subject_item_id_fkey" FOREIGN KEY ("subject_item_id") REFERENCES "subject_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subject_passes" ADD CONSTRAINT "student_subject_passes_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_subject_item_id_fkey" FOREIGN KEY ("subject_item_id") REFERENCES "subject_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_clergy_id_fkey" FOREIGN KEY ("clergy_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_records" ADD CONSTRAINT "promotion_records_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_awarded_by_fkey" FOREIGN KEY ("awarded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hymn_practice_sessions" ADD CONSTRAINT "hymn_practice_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hymn_practice_sessions" ADD CONSTRAINT "hymn_practice_sessions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hymn_practice_sessions" ADD CONSTRAINT "hymn_practice_sessions_progress_id_fkey" FOREIGN KEY ("progress_id") REFERENCES "lesson_progress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hymn_practice_sessions" ADD CONSTRAINT "hymn_practice_sessions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hymn_practice_sessions" ADD CONSTRAINT "hymn_practice_sessions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_practices" ADD CONSTRAINT "family_practices_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_liturgies" ADD CONSTRAINT "family_liturgies_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_liturgies" ADD CONSTRAINT "family_liturgies_noted_by_fkey" FOREIGN KEY ("noted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_liturgies" ADD CONSTRAINT "family_liturgies_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_liturgies" ADD CONSTRAINT "family_liturgies_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_sessions" ADD CONSTRAINT "app_sessions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "student_badges_badgeId_idx" RENAME TO "student_badges_badge_id_idx";

-- RenameIndex
ALTER INDEX "student_badges_studentId_badgeId_key" RENAME TO "student_badges_student_id_badge_id_key";

-- RenameIndex
ALTER INDEX "student_subject_passes_student_id_subject_item_id_revoked_at_ke" RENAME TO "student_subject_passes_student_id_subject_item_id_revoked_a_key";
