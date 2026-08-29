-- Make schoolId optional in hymn_practice_sessions with onDelete SetNull
-- This fixes P2022 errors when School record doesn't exist

ALTER TABLE "hymn_practice_sessions" 
  ALTER COLUMN "school_id" DROP NOT NULL;

ALTER TABLE "hymn_practice_sessions"
  DROP CONSTRAINT "hymn_practice_sessions_school_id_fkey";

ALTER TABLE "hymn_practice_sessions"
  ADD CONSTRAINT "hymn_practice_sessions_school_id_fkey" 
  FOREIGN KEY ("school_id") 
  REFERENCES "schools"("id") 
  ON DELETE SET NULL;
