-- CreateTable
CREATE TABLE "registration_applications" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "hymn_choice" TEXT NOT NULL,
    "voice_recording_url" TEXT,
    "voice_recording_meta" JSONB,
    "student_data" JSONB NOT NULL,
    "submitted_by_email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "registration_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registration_applications_school_id_status_idx" ON "registration_applications"("school_id", "status");

-- AddForeignKey
ALTER TABLE "registration_applications" ADD CONSTRAINT "registration_applications_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_applications" ADD CONSTRAINT "registration_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
