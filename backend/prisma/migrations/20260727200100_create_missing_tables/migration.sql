-- Create missing tables (subject_items, subject_item_levels, calendar_events)
-- that exist in schema.prisma but were never created by any migration.
-- Also safely re-add all columns from the failed 20260727200000 migration.

-- subject_items
CREATE TABLE IF NOT EXISTS "subject_items" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "when_label" TEXT,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "name_coptic" TEXT,
    "description_ar" TEXT,
    "sessions_group1" INTEGER NOT NULL DEFAULT 0,
    "sessions_group2" INTEGER NOT NULL DEFAULT 0,
    "sessions_group3" INTEGER NOT NULL DEFAULT 0,
    "sessions_group4" INTEGER NOT NULL DEFAULT 0,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "presentation_url" TEXT,
    "presentation_data" JSONB,
    "hazzat" TEXT,
    "education_languages" JSONB,
    "metadata" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "subject_items_subject_id_idx" ON "subject_items"("subject_id");

-- subject_item_levels
CREATE TABLE IF NOT EXISTS "subject_item_levels" (
    "id" TEXT NOT NULL,
    "subject_item_id" TEXT NOT NULL,
    "level_number" INTEGER NOT NULL,

    CONSTRAINT "subject_item_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subject_item_levels_subject_item_id_level_number_key" ON "subject_item_levels"("subject_item_id", "level_number");

-- calendar_events
CREATE TABLE IF NOT EXISTS "calendar_events" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'event',
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "calendar_events_academic_year_id_idx" ON "calendar_events"("academic_year_id");

-- Now safely add all remaining columns from the failed migration (IF NOT EXISTS)
-- academic_years
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "active_days" JSONB;

-- students
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "parent_email" TEXT;

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

-- Foreign keys for subject_items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subject_items_subject_id_fkey') THEN
    ALTER TABLE "subject_items" ADD CONSTRAINT "subject_items_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Foreign keys for subject_item_levels
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subject_item_levels_subject_item_id_fkey') THEN
    ALTER TABLE "subject_item_levels" ADD CONSTRAINT "subject_item_levels_subject_item_id_fkey" FOREIGN KEY ("subject_item_id") REFERENCES "subject_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Foreign keys for calendar_events
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_academic_year_id_fkey') THEN
    ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
