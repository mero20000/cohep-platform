-- Phase 1: Data Model Normalization
-- Adds 20 FK relations + multi-tenancy fixes

-- Backfill NULL schoolId values first (before adding NOT NULL constraint)
UPDATE app_sessions SET school_id = (SELECT id FROM schools LIMIT 1) WHERE school_id IS NULL;
UPDATE analytics_events SET school_id = (SELECT id FROM schools LIMIT 1) WHERE school_id IS NULL;

-- Now alter columns to NOT NULL
ALTER TABLE app_sessions ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE analytics_events ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE badges ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE hymn_practice_sessions ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE system_configs ALTER COLUMN school_id SET NOT NULL;

-- Add missing columns
ALTER TABLE family_practices ADD COLUMN school_id UUID NOT NULL DEFAULT (SELECT id FROM schools LIMIT 1);
ALTER TABLE family_liturgies ADD COLUMN school_id UUID NOT NULL DEFAULT (SELECT id FROM schools LIMIT 1);
ALTER TABLE push_subscriptions ADD COLUMN school_id UUID NOT NULL DEFAULT (SELECT id FROM schools LIMIT 1);

-- Add foreign keys
ALTER TABLE app_sessions ADD CONSTRAINT app_sessions_school_id_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE analytics_events ADD CONSTRAINT analytics_events_school_id_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_school_id_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE badges ADD CONSTRAINT badges_school_id_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE system_configs ADD CONSTRAINT system_configs_school_id_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE family_practices ADD CONSTRAINT family_practices_school_id_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE family_liturgies ADD CONSTRAINT family_liturgies_school_id_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_school_id_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- Add FK relations for audit fields
ALTER TABLE lessons ADD CONSTRAINT lessons_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE resources ADD CONSTRAINT resources_uploaded_by_fk FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE events ADD CONSTRAINT events_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE file_uploads ADD CONSTRAINT file_uploads_uploaded_by_fk FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE medical_notes ADD CONSTRAINT medical_notes_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;

-- Add FK for announcements
ALTER TABLE announcements ADD CONSTRAINT announcements_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;

-- Add FK relations for FamilyLiturgy
ALTER TABLE family_liturgies ADD CONSTRAINT family_liturgies_noted_by_fk FOREIGN KEY (noted_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE family_liturgies ADD CONSTRAINT family_liturgies_verified_by_fk FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE family_liturgies ADD CONSTRAINT family_liturgies_rejected_by_fk FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL;

-- Add FK relations for awards/approvals
ALTER TABLE student_badges ADD CONSTRAINT student_badges_awarded_by_fk FOREIGN KEY (awarded_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE promotion_records ADD CONSTRAINT promotion_records_approved_by_fk FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE certificates ADD CONSTRAINT certificates_revoked_by_fk FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL;

-- Add FK relations for other audit fields
ALTER TABLE student_subject_passes ADD CONSTRAINT student_subject_passes_revoked_by_fk FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE hymn_practice_sessions ADD CONSTRAINT hymn_practice_sessions_reviewed_by_fk FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_clergy_id_fk FOREIGN KEY (clergy_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add FK relations for Conversation and Message threading
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  participant1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255),
  last_message_at TIMESTAMP,
  archived_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, participant1_id, participant2_id)
);

CREATE INDEX conversations_school_last_message_at ON conversations(school_id, last_message_at);
CREATE INDEX conversations_participant1_created_at ON conversations(participant1_id, created_at);
CREATE INDEX conversations_participant2_created_at ON conversations(participant2_id, created_at);

-- Link existing messages to conversations
INSERT INTO conversations (school_id, participant1_id, participant2_id, last_message_at, created_at)
  SELECT DISTINCT 
    m.school_id,
    LEAST(m.sender_id::text, m.recipient_id::text)::uuid,
    GREATEST(m.sender_id::text, m.recipient_id::text)::uuid,
    MAX(m.created_at),
    MIN(m.created_at)
  FROM messages m
  WHERE m.deleted_at IS NULL
  GROUP BY m.school_id, LEAST(m.sender_id::text, m.recipient_id::text)::uuid, GREATEST(m.sender_id::text, m.recipient_id::text)::uuid
  ON CONFLICT DO NOTHING;

-- Update messages to link to conversations
UPDATE messages m
  SET conversation_id = c.id
  FROM conversations c
  WHERE c.school_id = m.school_id
    AND c.participant1_id = LEAST(m.sender_id, m.recipient_id)
    AND c.participant2_id = GREATEST(m.sender_id, m.recipient_id)
    AND m.conversation_id IS NULL AND m.deleted_at IS NULL;

-- Add message threading
ALTER TABLE messages ADD CONSTRAINT messages_parent_message_id_fk FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fk FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- Add FK for Notification.user
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add FK for PushSubscription.user
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add FK for UserRole.assignedBy
ALTER TABLE user_roles ADD CONSTRAINT user_roles_assigned_by_fk FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;
