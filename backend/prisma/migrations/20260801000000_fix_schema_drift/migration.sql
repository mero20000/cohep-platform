-- Fix schema drift found during QA record-creation testing.
-- 1) attendance_sessions.lesson_id was NOT NULL in the init migration but was
--    removed from the Prisma model (no migration dropped the column), so every
--    attendance session INSERT failed with P2011 (null constraint violation).
-- 2) grades.graded_by references users(id) with a NOT NULL constraint, but
--    auto-graded submissions use a "system" sentinel that can never satisfy
--    the FK. Making the column nullable lets auto-grades store a real user id
--    or NULL instead.

ALTER TABLE "attendance_sessions" DROP COLUMN IF EXISTS "lesson_id";

ALTER TABLE "grades" ALTER COLUMN "graded_by" DROP NOT NULL;
