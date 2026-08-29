-- A student could not be addressed as a notification recipient at the schema level:
-- Notification.user_id references users, and students have no user row — a student is an
-- access key, not an account. Rather than creating credentialed accounts for children,
-- this is a second, student-scoped feed keyed directly on student_id.
--
-- Pull-only. There is no push transport behind it.
CREATE TABLE IF NOT EXISTS "student_notifications" (
  "id"             TEXT         NOT NULL,
  "student_id"     TEXT         NOT NULL,
  "type"           TEXT         NOT NULL,
  "title"          TEXT         NOT NULL,
  "title_ar"       TEXT,
  "body"           VARCHAR(500),
  "body_ar"        VARCHAR(500),
  "link_path"      TEXT,
  "reference_type" TEXT,
  "reference_id"   TEXT,
  "read_at"        TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "student_notifications_pkey" PRIMARY KEY ("id")
);

-- Deleting a student takes their notifications with them.
DO $$
BEGIN
  ALTER TABLE "student_notifications"
    ADD CONSTRAINT "student_notifications_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Makes emitting idempotent: a servant re-saving the same review must not stack
-- duplicates. Postgres treats NULLs as distinct, so rows with no reference_id are never
-- deduped by this — which is what one-off messages want.
CREATE UNIQUE INDEX IF NOT EXISTS "student_notifications_student_id_type_reference_id_key"
  ON "student_notifications" ("student_id", "type", "reference_id");

-- The unread badge counts on (student, read_at); the feed lists by recency.
CREATE INDEX IF NOT EXISTS "student_notifications_student_id_read_at_idx"
  ON "student_notifications" ("student_id", "read_at");
CREATE INDEX IF NOT EXISTS "student_notifications_student_id_created_at_idx"
  ON "student_notifications" ("student_id", "created_at");
