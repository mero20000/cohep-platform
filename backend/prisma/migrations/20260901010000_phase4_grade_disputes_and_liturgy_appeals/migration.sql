-- CreateTable
CREATE TABLE "grade_disputes" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "grade_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "responded_by_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "new_score" DECIMAL(65,30),
    "response" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_liturgy_appeals" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "family_liturgy_id" TEXT NOT NULL,
    "appeal_reason" VARCHAR(500) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "responded_by_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "response" VARCHAR(500),
    "new_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_liturgy_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grade_disputes_school_id_status_idx" ON "grade_disputes"("school_id", "status");

-- CreateIndex
CREATE INDEX "grade_disputes_submission_id_idx" ON "grade_disputes"("submission_id");

-- CreateIndex
CREATE INDEX "grade_disputes_requested_by_id_idx" ON "grade_disputes"("requested_by_id");

-- CreateIndex
CREATE INDEX "student_liturgy_appeals_school_id_status_idx" ON "student_liturgy_appeals"("school_id", "status");

-- CreateIndex
CREATE INDEX "student_liturgy_appeals_student_id_status_idx" ON "student_liturgy_appeals"("student_id", "status");

-- CreateIndex
CREATE INDEX "student_liturgy_appeals_family_liturgy_id_idx" ON "student_liturgy_appeals"("family_liturgy_id");

-- AddForeignKey
ALTER TABLE "grade_disputes" ADD CONSTRAINT "grade_disputes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_disputes" ADD CONSTRAINT "grade_disputes_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "assessment_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_disputes" ADD CONSTRAINT "grade_disputes_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_disputes" ADD CONSTRAINT "grade_disputes_responded_by_id_fkey" FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_liturgy_appeals" ADD CONSTRAINT "student_liturgy_appeals_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_liturgy_appeals" ADD CONSTRAINT "student_liturgy_appeals_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_liturgy_appeals" ADD CONSTRAINT "student_liturgy_appeals_family_liturgy_id_fkey" FOREIGN KEY ("family_liturgy_id") REFERENCES "family_liturgies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_liturgy_appeals" ADD CONSTRAINT "student_liturgy_appeals_responded_by_id_fkey" FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

