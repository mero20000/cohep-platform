-- CreateIndex
CREATE UNIQUE INDEX "student_badges_studentId_badgeId_key" ON "student_badges"("student_id", "badge_id");

-- CreateIndex
CREATE INDEX "student_badges_badgeId_idx" ON "student_badges"("badge_id");
