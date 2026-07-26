-- CreateTable
CREATE TABLE "academic_weeks" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "week_number" INTEGER NOT NULL,
    "term" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_weeks_academic_year_id_idx" ON "academic_weeks"("academic_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_weeks_academic_year_id_week_number_key" ON "academic_weeks"("academic_year_id", "week_number");

-- AddForeignKey
ALTER TABLE "academic_weeks" ADD CONSTRAINT "academic_weeks_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
