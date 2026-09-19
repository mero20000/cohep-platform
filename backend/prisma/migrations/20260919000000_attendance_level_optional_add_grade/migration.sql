-- AlterTable: make level_id optional on attendance_sessions
ALTER TABLE "attendance_sessions" ALTER COLUMN "level_id" DROP NOT NULL;

-- AlterTable: add optional grade_id to attendance_sessions
ALTER TABLE "attendance_sessions" ADD COLUMN "grade_id" TEXT;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "school_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
