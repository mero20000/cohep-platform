-- Phase 5: Performance Optimization - Add Missing Indexes

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

-- AttendanceSession: efficient session lookups by date range
CREATE INDEX idx_attendance_session_school_date ON attendance_sessions(school_id, session_date DESC);
CREATE INDEX idx_attendance_session_lesson ON attendance_sessions(lesson_id);

-- User: fast lookups by school and role
CREATE INDEX idx_user_school_email ON users(school_id, email);
CREATE INDEX idx_user_school ON users(school_id);

-- Student: lookups by level/group/grade
CREATE INDEX idx_student_level ON students(level_id);
CREATE INDEX idx_student_group ON students(group_id);
CREATE INDEX idx_student_parent ON students(parent_id);

-- Notification: efficient unread queries
CREATE INDEX idx_notification_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notification_student_unread ON notifications(student_id, is_read, created_at DESC);
