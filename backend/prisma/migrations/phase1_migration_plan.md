# Phase 1: Data Model Normalization - Migration Plan

## Overview
This document outlines the 6-stage migration for Phase 1, with backfill strategies and validation queries.

## Schema Changes Applied

### New Models
1. **Conversation** - bridges messaging system, enables message threading
   - participant1Id, participant2Id (two-party messaging)
   - schoolId scoping
   - indexes for efficient queries

### Updated Models (20 FK additions + Multi-tenancy fixes)

#### Stage 1: Create Conversation Model
- ✅ New model in schema
- Backfill: Create conversations from existing Message pairs
- Index: (schoolId, lastMessageAt), (participant1Id, createdAt), (participant2Id, createdAt)

#### Stage 2: Core FK Relations (8 fields)
1. Lesson.createdBy → User (creator relation, onDelete: Restrict)
2. Resource.uploadedBy → User (uploader relation, onDelete: Restrict)
3. Assessment.createdBy → User (creator relation, already has relation, updated onDelete: Restrict)
4. Announcement.createdBy → User (creator relation, already has relation, updated onDelete: Restrict)
5. Event.createdBy → User (creator relation, onDelete: Restrict)
6. FileUpload.uploadedBy → User (uploader relation, onDelete: Restrict)
7. MedicalNote.createdBy → User (creator relation, onDelete: Restrict)
8. Certificate.issuedBy → User (already has relation, updated onDelete: Restrict)

#### Stage 3: Optional/Revocation FKs (6 fields)
9. Certificate.revokedBy → User (revoker relation, onDelete: SetNull)
10. StudentSubjectPass.revokedBy → User (revoker relation, onDelete: SetNull)
11. HymnPracticeSession.reviewedBy → User (reviewer relation, onDelete: SetNull)
12. FamilyLiturgy.notedBy → User (noted relation, onDelete: Restrict)
13. FamilyLiturgy.verifiedBy → User (verified relation, onDelete: SetNull)
14. FamilyLiturgy.rejectedBy → User (rejected relation, onDelete: SetNull)

#### Stage 4: Message Model Relations (3 fields)
15. Message.conversationId → Conversation (FK, onDelete: Cascade)
16. Message.parentMessageId → Message (self-relation, onDelete: SetNull)
17. LessonProgress.clergyId → User (clergy relation, onDelete: SetNull)

#### Stage 5: Audit & Award Relations (4 fields)
18. PromotionRecord.approvedBy → User (approver relation, onDelete: SetNull)
19. StudentBadge.awardedBy → User (awarder relation, onDelete: SetNull)
20. UserRole.assignedBy → User (assigner relation, onDelete: SetNull)
21. Notification.userId → User (user relation, onDelete: Cascade)
22. PushSubscription.userId → User (user relation, onDelete: Cascade)

#### Stage 6: Multi-tenancy Hardening (7 models + 5 models)
- **Make NOT NULL**: Badge.schoolId, HymnPracticeSession.schoolId, AuditLog.schoolId, SystemConfig.schoolId, AppSession.schoolId, AnalyticsEvent.schoolId
- **Add schoolId**: FamilyPractice.schoolId, FamilyLiturgy.schoolId, PushSubscription.schoolId
- **Add FK relations**: All added with CASCADE or SET NULL as appropriate

## Migration Execution Order

```sql
-- STAGE 1: Create Conversation Model
-- Generated automatically by Prisma migrate

-- STAGE 2-5: Add FK Relations
-- All field additions and relation definitions

-- STAGE 6: Multi-tenancy Hardening
-- Add schoolId where missing, make NOT NULL

-- STAGE 7: Add CHECK Constraints (separate migration)
```

## Backfill Strategies

### Conversation Model
```sql
-- Create conversations from existing Message pairs
INSERT INTO conversations (id, school_id, participant1_id, participant2_id, last_message_at, created_at)
  SELECT 
    md5(school_id || '::' || LEAST(sender_id, recipient_id) || '::' || GREATEST(sender_id, recipient_id))::uuid,
    school_id,
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    MAX(created_at),
    MIN(created_at)
  FROM messages
  WHERE deleted_at IS NULL
  GROUP BY school_id, LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id)
  ON CONFLICT DO NOTHING;

-- Link messages to conversations
UPDATE messages m
  SET conversation_id = (
    SELECT c.id FROM conversations c
    WHERE c.school_id = m.school_id
      AND c.participant1_id = LEAST(m.sender_id, m.recipient_id)
      AND c.participant2_id = GREATEST(m.sender_id, m.recipient_id)
  )
  WHERE m.conversation_id IS NULL AND m.deleted_at IS NULL;
```

### Lesson.createdBy
```sql
-- Find orphaned createdBy values
SELECT COUNT(*) FROM lessons WHERE created_by NOT IN (SELECT id FROM users);

-- Backfill with school-scoped servant
UPDATE lessons l
  SET created_by = (
    SELECT u.id FROM users u
    INNER JOIN levels lv ON lv.school_id = u.school_id
    WHERE lv.id = l.level_id
    AND u.is_active = true
    LIMIT 1
  )
  WHERE l.created_by NOT IN (SELECT id FROM users);

-- Validation
SELECT COUNT(*) FROM lessons WHERE created_by NOT IN (SELECT id FROM users); -- should be 0
```

### FamilyLiturgy Multi-Tenancy
```sql
-- Add schoolId from Student
ALTER TABLE family_liturgies ADD COLUMN school_id UUID;

UPDATE family_liturgies fl
  SET school_id = s.school_id
  FROM students s
  WHERE fl.student_id = s.id;

ALTER TABLE family_liturgies ALTER COLUMN school_id SET NOT NULL;

-- Backfill notedBy
UPDATE family_liturgies fl
  SET noted_by = (
    SELECT u.id FROM users u
    WHERE u.school_id = fl.school_id AND u.is_active = true
    LIMIT 1
  )
  WHERE fl.noted_by NOT IN (SELECT id FROM users);

-- Validation
SELECT COUNT(*) FROM family_liturgies WHERE noted_by NOT IN (SELECT id FROM users); -- should be 0
```

### PushSubscription Multi-Tenancy
```sql
-- Add schoolId from User
ALTER TABLE push_subscriptions ADD COLUMN school_id UUID;

UPDATE push_subscriptions ps
  SET school_id = u.school_id
  FROM users u
  WHERE ps.user_id = u.id;

ALTER TABLE push_subscriptions ALTER COLUMN school_id SET NOT NULL;
```

### Badge.schoolId
```sql
-- Option 1: Create system school for global badges
INSERT INTO schools (id, church_id, name, slug, is_active, created_at)
  VALUES ('00000000-0000-0000-0000-000000000000', (SELECT id FROM churches LIMIT 1), 'System', 'system', true, now())
  ON CONFLICT DO NOTHING;

-- Option 2: Assign NULL badges to first school (conservative)
UPDATE badges
  SET school_id = (SELECT id FROM schools LIMIT 1)
  WHERE school_id IS NULL;

ALTER TABLE badges ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE badges ADD CONSTRAINT badges_school_fk 
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
```

### AuditLog.schoolId
```sql
-- Make NOT NULL (set default for any missing)
UPDATE audit_logs
  SET school_id = (SELECT id FROM schools WHERE is_active = true LIMIT 1)
  WHERE school_id IS NULL;

ALTER TABLE audit_logs ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_school_fk 
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
```

## Validation Queries

Run after each stage to verify data integrity:

```sql
-- Check for orphaned createdBy fields
SELECT 'Lesson.createdBy' as field, COUNT(*) as orphaned 
FROM lessons WHERE created_by NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'Assessment.createdBy', COUNT(*) 
FROM assessments WHERE created_by NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'Announcement.createdBy', COUNT(*) 
FROM announcements WHERE created_by NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'Event.createdBy', COUNT(*) 
FROM events WHERE created_by NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'Resource.uploadedBy', COUNT(*) 
FROM resources WHERE uploaded_by NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'FileUpload.uploadedBy', COUNT(*) 
FROM file_uploads WHERE uploaded_by NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'MedicalNote.createdBy', COUNT(*) 
FROM medical_notes WHERE created_by NOT IN (SELECT id FROM users);

-- Check multi-tenancy coverage
SELECT 'Badge.schoolId' as model, COUNT(*) as null_count 
FROM badges WHERE school_id IS NULL
UNION ALL
SELECT 'HymnPracticeSession.schoolId', COUNT(*) 
FROM hymn_practice_sessions WHERE school_id IS NULL
UNION ALL
SELECT 'AuditLog.schoolId', COUNT(*) 
FROM audit_logs WHERE school_id IS NULL
UNION ALL
SELECT 'SystemConfig.schoolId', COUNT(*) 
FROM system_configs WHERE school_id IS NULL
UNION ALL
SELECT 'AppSession.schoolId', COUNT(*) 
FROM app_sessions WHERE school_id IS NULL
UNION ALL
SELECT 'AnalyticsEvent.schoolId', COUNT(*) 
FROM analytics_events WHERE school_id IS NULL;

-- Verify Conversation model integrity
SELECT COUNT(*) as conversation_count FROM conversations;
SELECT COUNT(*) as message_count, COUNT(DISTINCT conversation_id) as unique_conversations FROM messages;
SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END as message_missing_conversation
FROM messages WHERE conversation_id IS NULL AND deleted_at IS NULL;
```

## Rollback Strategy

Each migration file includes down() method to revert:

```prisma
// All relations marked with @relation so Prisma can auto-generate DOWN
// If manual rollback needed:
// 1. Drop new foreign key constraints
// 2. Drop new indexes
// 3. Set schema back to previous version
// 4. prisma db push --force-reset (staging only)
```

## Deployment Timeline

- **Staging**: 1 day (test all migrations, validate data)
- **Production**: 1 day (maintenance window, 30 min downtime expected)
  - Pre-migration: Full backup
  - Migration: Run all 6 stages sequentially
  - Post-migration: Validation queries, spot-check UI
  - Post-deploy: Monitor Sentry/logs for FK violations

## Success Criteria

✅ All FK constraints in place
✅ No orphaned records (createdBy, revokedBy, etc.)
✅ Multi-tenancy: 100% schoolId coverage
✅ Conversation model working (messages linked to conversations)
✅ Message threading: parentMessage self-relations working
✅ Application queries updated to load new relations
✅ Tests passing (unit + integration)
✅ Production deployment successful with zero FK violations

