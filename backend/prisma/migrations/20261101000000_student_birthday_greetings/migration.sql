-- Servant birthday flow (additive): one greeting record per student per birthday year.

CREATE TABLE "student_birthday_greetings" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "servant_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "note" VARCHAR(500),
    "greeted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_birthday_greetings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_birthday_greetings_student_id_year_key" ON "student_birthday_greetings"("student_id", "year");
CREATE INDEX "student_birthday_greetings_school_id_idx" ON "student_birthday_greetings"("school_id");

ALTER TABLE "student_birthday_greetings" ADD CONSTRAINT "student_birthday_greetings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_birthday_greetings" ADD CONSTRAINT "student_birthday_greetings_servant_id_fkey" FOREIGN KEY ("servant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
