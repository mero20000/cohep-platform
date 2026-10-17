-- Attendance session types, phase 1 (additive foundation).
--
-- Safety contract:
--   * No existing row is deleted and no existing column value is changed.
--   * attendance_records is not touched at all.
--   * The only data write to existing rows is setting the NEW "type" column to
--     'liturgy' for sessions whose notes are exactly 'liturgy' (everything else
--     keeps the default 'class'). updated_at is deliberately not modified.
--   * Every existing session gets one audience row copied from its own
--     group/level/grade (and gender filter), so nothing is lost or reinterpreted.

-- AlterTable: new descriptive columns (all have a default or are nullable)
ALTER TABLE "attendance_sessions" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'class';
ALTER TABLE "attendance_sessions" ADD COLUMN "title" TEXT;
ALTER TABLE "attendance_sessions" ADD COLUMN "title_ar" TEXT;
ALTER TABLE "attendance_sessions" ADD COLUMN "location" TEXT;
ALTER TABLE "attendance_sessions" ADD COLUMN "all_groups" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: multi-group liturgy/event sessions have no single primary group
ALTER TABLE "attendance_sessions" ALTER COLUMN "group_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "attendance_session_targets" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "level_id" TEXT,
    "grade_id" TEXT,
    "gender" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_session_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_sessions_school_id_type_scheduled_date_idx" ON "attendance_sessions"("school_id", "type", "scheduled_date");
CREATE INDEX "attendance_session_targets_session_id_idx" ON "attendance_session_targets"("session_id");
CREATE INDEX "attendance_session_targets_group_id_idx" ON "attendance_session_targets"("group_id");

-- AddForeignKey
ALTER TABLE "attendance_session_targets" ADD CONSTRAINT "attendance_session_targets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_session_targets" ADD CONSTRAINT "attendance_session_targets_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_session_targets" ADD CONSTRAINT "attendance_session_targets_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_session_targets" ADD CONSTRAINT "attendance_session_targets_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "school_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill 1/2: existing liturgy sessions were identified only by their notes text.
UPDATE "attendance_sessions" SET "type" = 'liturgy' WHERE "notes" = 'liturgy';

-- Backfill 2/2: one audience row per existing session, mirroring its own columns.
INSERT INTO "attendance_session_targets" ("id", "session_id", "group_id", "level_id", "grade_id", "gender")
SELECT gen_random_uuid()::text, s."id", s."group_id", s."level_id", s."grade_id",
       NULLIF(NULLIF(s."metadata"->>'genderFilter', ''), 'both')
FROM "attendance_sessions" s
WHERE s."group_id" IS NOT NULL;
