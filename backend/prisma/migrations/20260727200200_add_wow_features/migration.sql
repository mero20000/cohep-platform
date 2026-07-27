-- Add FamilyPractice and FamilyLiturgy tables for WOW features
CREATE TABLE IF NOT EXISTS "family_practices" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "practiced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_minutes" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'parent',

    CONSTRAINT "family_practices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "family_practices_student_id_practiced_at_idx" ON "family_practices"("student_id", "practiced_at");

CREATE TABLE IF NOT EXISTS "family_liturgies" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "noted_by" TEXT NOT NULL,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_liturgies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "family_liturgies_student_id_date_key" ON "family_liturgies"("student_id", "date");
CREATE INDEX IF NOT EXISTS "family_liturgies_student_id_status_idx" ON "family_liturgies"("student_id", "status");

-- Foreign keys
ALTER TABLE "family_practices" ADD CONSTRAINT "family_practices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "family_practices" ADD CONSTRAINT "family_practices_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_liturgies" ADD CONSTRAINT "family_liturgies_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
