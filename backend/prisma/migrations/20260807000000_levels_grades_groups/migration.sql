-- CreateTable
CREATE TABLE "school_grades" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "group_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_grades_pkey" PRIMARY KEY ("id")
);

-- Group becomes school-scoped: add nullable school_id, backfill it from the owning level, then enforce NOT NULL.
ALTER TABLE "groups" ADD COLUMN "school_id" TEXT;

UPDATE "groups" SET "school_id" = (SELECT "school_id" FROM "levels" WHERE "levels"."id" = "groups"."level_id");

ALTER TABLE "groups" ALTER COLUMN "school_id" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "groups" DROP CONSTRAINT "groups_level_id_fkey";

-- DropIndex
DROP INDEX "groups_level_id_idx";

-- AlterTable: groups no longer belongs to a level
ALTER TABLE "groups" DROP COLUMN "level_id";

-- AlterTable: students get a nullable grade_id (legacy students without a mapped grade survive)
ALTER TABLE "students" ADD COLUMN "grade_id" TEXT;

-- CreateIndex
CREATE INDEX "groups_school_id_idx" ON "groups"("school_id");

-- CreateIndex
CREATE INDEX "school_grades_school_id_idx" ON "school_grades"("school_id");

-- CreateIndex
CREATE INDEX "school_grades_group_id_idx" ON "school_grades"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "school_grades_school_id_name_key" ON "school_grades"("school_id", "name");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "school_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_grades" ADD CONSTRAINT "school_grades_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_grades" ADD CONSTRAINT "school_grades_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
