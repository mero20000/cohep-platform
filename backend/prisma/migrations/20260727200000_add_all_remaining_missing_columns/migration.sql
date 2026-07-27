-- Final comprehensive migration: all remaining columns in schema.prisma
-- not present in any previous migration. Safe to re-run (IF NOT EXISTS).

-- academic_years
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "active_days" JSONB;

-- students
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "parent_email" TEXT;

-- subject_items (table may not exist yet — it's created in the next migration)
-- Wrap in DO block so shadow DB doesn't fail
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subject_items' AND schemaname = 'public') THEN
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "subject_id" TEXT;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "when_label" TEXT;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "name" TEXT;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "name_ar" TEXT;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "name_coptic" TEXT;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "description_ar" TEXT;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "sessions_group1" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "sessions_group2" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "sessions_group3" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "sessions_group4" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "optional" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "order_index" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "presentation_url" TEXT;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "presentation_data" JSONB;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "hazzat" TEXT;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "education_languages" JSONB;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "subject_items" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- subject_item_levels
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subject_item_levels' AND schemaname = 'public') THEN
    ALTER TABLE "subject_item_levels" ADD COLUMN IF NOT EXISTS "subject_item_id" TEXT;
    ALTER TABLE "subject_item_levels" ADD COLUMN IF NOT EXISTS "level_number" INTEGER;
  END IF;
END $$;

-- lessons
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "presentation_url" TEXT;
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "subject_item_id" TEXT;

-- attendance_records
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "behavior" INTEGER;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "participation" INTEGER;

-- assessments
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "group_id" TEXT;

-- curriculum_allocations
ALTER TABLE "curriculum_allocations" ADD COLUMN IF NOT EXISTS "group_number" INTEGER NOT NULL DEFAULT 1;

-- calendar_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'calendar_events' AND schemaname = 'public') THEN
    ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "academic_year_id" TEXT;
    ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3);
    ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "label" TEXT;
    ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'event';
    ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "description" TEXT;
    ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
    ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
