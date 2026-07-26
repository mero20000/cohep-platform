-- CreateTable
CREATE TABLE "curriculum_allocations" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "level_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "term" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL DEFAULT 0,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "scheduled_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculum_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "curriculum_allocations_academic_year_id_level_id_idx" ON "curriculum_allocations"("academic_year_id", "level_id");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_allocations_academic_year_id_level_id_subject_id_key" ON "curriculum_allocations"("academic_year_id", "level_id", "subject_id", "lesson_id", "term");

-- AddForeignKey
ALTER TABLE "curriculum_allocations" ADD CONSTRAINT "curriculum_allocations_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_allocations" ADD CONSTRAINT "curriculum_allocations_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_allocations" ADD CONSTRAINT "curriculum_allocations_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_allocations" ADD CONSTRAINT "curriculum_allocations_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
