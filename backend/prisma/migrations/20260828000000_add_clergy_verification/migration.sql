-- AlterTable
ALTER TABLE "lesson_progress" ADD COLUMN "is_ready_for_liturgy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ready_for_liturgy_at" TIMESTAMP(3),
ADD COLUMN "clergy_id" TEXT,
ADD COLUMN "clergy_notes" VARCHAR(300);
