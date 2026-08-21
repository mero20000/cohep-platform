-- Link an attendance session to the subject item it delivers (Start Class flow)
ALTER TABLE "attendance_sessions" ADD COLUMN IF NOT EXISTS "subject_item_id" TEXT;
CREATE INDEX IF NOT EXISTS "attendance_sessions_subject_item_id_idx" ON "attendance_sessions" ("subject_item_id");
