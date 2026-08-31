-- Phase 5: Performance Optimization - Add Missing Indexes
-- Compound (schoolId, deletedAt) for soft-delete queries across all soft-deletable models
CREATE INDEX idx_announcement_school_deleted ON announcements(school_id, deleted_at);
CREATE INDEX idx_assessment_school_deleted ON assessments(school_id, deleted_at);
CREATE INDEX idx_event_school_deleted ON events(school_id, deleted_at);
CREATE INDEX idx_lesson_school_deleted ON lessons(school_id, deleted_at);
CREATE INDEX idx_message_school_deleted ON messages(school_id, deleted_at);
CREATE INDEX idx_notification_school_deleted ON notifications(school_id, deleted_at);
CREATE INDEX idx_resource_school_deleted ON resources(school_id, deleted_at);
CREATE INDEX idx_student_school_deleted ON students(school_id, deleted_at);
CREATE INDEX idx_user_school_deleted ON users(school_id, deleted_at);
CREATE INDEX idx_familyliturgies_school_deleted ON family_liturgies(school_id, deleted_at);
CREATE INDEX idx_familypractices_school_deleted ON family_practices(school_id, deleted_at);

-- StudentProgress: efficient year-over-year queries
CREATE INDEX idx_student_progress_student_year ON student_progress(student_id, academic_year_id);
CREATE INDEX idx_student_progress_school_year ON student_progress(school_id, academic_year_id);

-- AttendanceRecord: quick status aggregations
CREATE INDEX idx_attendance_record_session_status ON attendance_records(attendance_session_id, status);
CREATE INDEX idx_attendance_record_student_session ON attendance_records(student_id, attendance_session_id);

-- Grade: graded-but-not-returned queries
CREATE INDEX idx_grade_submission_graded ON grades(submission_id, graded_at DESC);
CREATE INDEX idx_grade_school_graded ON grades(school_id, graded_at DESC);

-- LessonProgress: single student progress queries
CREATE INDEX idx_lesson_progress_student_lesson ON lesson_progress(lesson_id, student_id);
CREATE INDEX idx_lesson_progress_student_school ON lesson_progress(student_id, school_id);

-- Assessment: query by level/subject for assessments page
CREATE INDEX idx_assessment_level ON assessments(level_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assessment_subject ON assessments(subject_id) WHERE deleted_at IS NULL;

-- AttendanceSession: efficient session lookups by date range
CREATE INDEX idx_attendance_session_school_date ON attendance_sessions(school_id, session_date DESC);
CREATE INDEX idx_attendance_session_lesson ON attendance_sessions(lesson_id);

-- User: fast lookups by school and role
CREATE INDEX idx_user_school_email ON users(school_id, email) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_school_role ON users(school_id) WHERE deleted_at IS NULL;

-- Student: lookups by level/group/grade
CREATE INDEX idx_student_level ON students(level_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_student_group ON students(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_student_parent ON students(parent_id) WHERE deleted_at IS NULL;

-- Notification: efficient unread queries
CREATE INDEX idx_notification_user_unread ON notifications(user_id, is_read, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_notification_student_unread ON notifications(student_id, is_read, created_at DESC) WHERE deleted_at IS NULL;
