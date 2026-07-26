-- AlterTable
ALTER TABLE "curriculum_allocations" ADD COLUMN     "week_id" TEXT;

-- AddForeignKey
ALTER TABLE "curriculum_allocations" ADD CONSTRAINT "curriculum_allocations_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "academic_weeks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
