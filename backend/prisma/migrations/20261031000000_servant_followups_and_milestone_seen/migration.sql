-- Servant journey enrichment (additive).
--   * servant_milestones.seen_at: null = milestone not yet celebrated. Existing
--     milestones are backfilled as seen so servants are not flooded on deploy.
--   * servant_follow_ups: persisted follow-up checklist, one row per servant + student.

ALTER TABLE "servant_milestones" ADD COLUMN "seen_at" TIMESTAMP(3);
UPDATE "servant_milestones" SET "seen_at" = CURRENT_TIMESTAMP WHERE "seen_at" IS NULL;

CREATE TABLE "servant_follow_ups" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "servant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "note" VARCHAR(500),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servant_follow_ups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "servant_follow_ups_servant_id_student_id_key" ON "servant_follow_ups"("servant_id", "student_id");
CREATE INDEX "servant_follow_ups_school_id_idx" ON "servant_follow_ups"("school_id");

ALTER TABLE "servant_follow_ups" ADD CONSTRAINT "servant_follow_ups_servant_id_fkey" FOREIGN KEY ("servant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "servant_follow_ups" ADD CONSTRAINT "servant_follow_ups_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
