-- AlterTable
ALTER TABLE "curriculum_allocations" ADD COLUMN "updated_by" TEXT;

-- AlterTable
ALTER TABLE "app_sessions" DROP CONSTRAINT "app_sessions_school_id_fkey",
ADD CONSTRAINT "app_sessions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "analytics_events" DROP CONSTRAINT "analytics_events_school_id_fkey",
ADD CONSTRAINT "analytics_events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
