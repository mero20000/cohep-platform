# Phase 1 Deployment Guide

## Status: SCHEMA READY FOR TESTING

All Prisma schema changes have been applied to `backend/prisma/schema.prisma`. This guide shows how to deploy Phase 1 to development, staging, and production.

## What Changed in the Schema

### New Model
- **Conversation**: Two-party messaging model with threading support

### New Relations (20 FK + 5 multi-tenancy fixes)
- Lesson.creator (createdBy → User)
- Resource.uploader (uploadedBy → User)
- Assessment.creator (already exists, updated onDelete)
- Event.creator (createdBy → User)
- FileUpload.uploader (uploadedBy → User)
- MedicalNote.creator (createdBy → User)
- StudentSubjectPass.revoker (revokedBy → User)
- HymnPracticeSession.reviewer (reviewedBy → User)
- FamilyLiturgy.noted, verified, rejected (notedBy, verifiedBy, rejectedBy → User)
- LessonProgress.clergy (clergyId → User)
- PromotionRecord.approver (approvedBy → User)
- StudentBadge.awarder (awardedBy → User)
- UserRole.assigner (assignedBy → User)
- Notification.user (userId → User)
- PushSubscription.user (userId → User)
- Message.conversation (conversationId → Conversation)
- Message.parentMessage (self-relation for threading)
- Certificate.revoker (revokedBy → User)

### Multi-tenancy Hardening
- FamilyPractice.schoolId (added, NOT NULL)
- FamilyLiturgy.schoolId (added, NOT NULL)
- PushSubscription.schoolId (added, NOT NULL)
- Badge.schoolId (made NOT NULL, added FK)
- HymnPracticeSession.schoolId (made NOT NULL)
- AuditLog.schoolId (made NOT NULL, added FK)
- SystemConfig.schoolId (made NOT NULL, added FK)
- AppSession.schoolId (made NOT NULL, added FK)
- AnalyticsEvent.schoolId (made NOT NULL, added FK)

## Deployment Steps

### 1. LOCAL TESTING (Development)

```bash
cd backend

# Check schema validity
npx prisma validate

# Generate Prisma client with new schema
npx prisma generate

# Create migration in interactive mode
# (Must be run in interactive terminal - not this script)
# npx prisma migrate dev --name phase_1_data_model_normalization

# For now, test with db push
npx prisma db push

# Run tests
npm test

# Check queries still work
npm run start:dev
```

### 2. STAGING DEPLOYMENT

Before staging, follow these steps:

#### 2a. Generate Migration Manually
```bash
# In an interactive terminal:
cd backend
npx prisma migrate dev --name phase_1_data_model_normalization

# This will:
# 1. Detect schema changes
# 2. Generate SQL migration
# 3. Apply to local DB
# 4. Create migration file in prisma/migrations/
```

#### 2b. Review Generated Migration
```bash
# Check the generated SQL
cat prisma/migrations/*/migration.sql

# Verify it includes:
# - CREATE TABLE conversations
# - ALTER TABLE [model] ADD [column]
# - CREATE INDEX for new relations
# - FK constraint additions
```

#### 2c. Commit & Push
```bash
git add backend/prisma/
git commit -m "phase-1: add 20 FK relations, fix multi-tenancy scoping"
git push origin main
```

#### 2d. Deploy to Staging
- Trigger Vercel/Render deployment from main
- On Render backend deploy:
  - Runs `prisma migrate deploy` automatically
  - Applies all pending migrations
  - Starts application with new schema

#### 2e. Test Staging
```bash
# Verify all relations work
curl https://staging-api.cohep.platform/api/health

# Check specific endpoints that use new relations
- GET /api/lessons/:id (includes creator.firstName)
- GET /api/assessments/:id (includes creator)
- GET /api/messages/:id (includes conversation)
- POST /api/messages (links to conversation)
```

### 3. PRODUCTION DEPLOYMENT

#### 3a. Backup Production Database
```bash
# Render dashboard:
# - Go to Database → Backups
# - Click "Create Backup"
# - Wait for "Backup created successfully"

# Verify backup
# - Should show latest backup with timestamp
```

#### 3b. Schedule Maintenance Window
- 30 minutes recommended (peak traffic)
- 2:00-2:30 AM UTC (minimal active users)
- Announce in Slack: "#ops" channel

#### 3c. Run Migration on Production
```bash
# Option 1: Automatic (Recommended)
git push origin main
# Vercel + Render auto-deploy
# Render runs: prisma migrate deploy
# (Database comes back online after migration)

# Option 2: Manual (If auto-deploy has issues)
# SSH into Render container and run:
npx prisma migrate deploy
```

#### 3d. Verify Production
```bash
# Check health endpoint
curl https://api.cohep.platform/api/health

# Verify new relations in logs
# - Should see no FK constraint errors
# - Check Sentry for any runtime errors

# Spot-check a few endpoints
- GET /api/lessons (verify includes creator data)
- GET /api/messages (verify includes conversation)
```

#### 3e. Monitor Post-Deployment
- Watch Sentry for 1 hour
- Watch response times
- Watch database query logs
- Alert on-call if issues

### 4. ROLLBACK (If Needed)

**Before you start:**
- Only do this in first 15 minutes after deployment
- Confirm the issue is schema-related, not app-related

```bash
# Option 1: Render Dashboard Rollback
# - Go to Deploys → Previous Deploy
# - Click "Re-Deploy"
# - This restarts with previous code + schema

# Option 2: Manual Rollback
git revert <commit-with-phase1>
git push origin main
# Trigger re-deploy (auto or manual)
# Render will run: prisma migrate resolve --rolled-back <migration-name>

# Verify rollback
curl https://api.cohep.platform/api/health
```

## Testing Checklist

Before calling Phase 1 complete, verify:

### Schema Validation
- [ ] `npx prisma validate` passes
- [ ] All 20 FK relations defined in schema
- [ ] All 9 models have schoolId with proper FK
- [ ] Conversation model exists with correct fields

### Data Integrity
- [ ] No orphaned createdBy / revokedBy / etc.
- [ ] All lessons have creator User
- [ ] All family liturgies have noted_by User
- [ ] Message-Conversation linking 100%
- [ ] schoolId populated for all multi-tenancy models

### Application Tests
- [ ] Unit tests pass: `npm test`
- [ ] Integration tests pass: `npm run test:e2e`
- [ ] API endpoints return include relations:
  ```bash
  # Lesson with creator
  GET /api/lessons/[id]
  # Returns: { id, title, creator: { id, firstName, ... } }

  # Message with conversation
  GET /api/messages/[id]
  # Returns: { id, content, conversation: { id, participant1, participant2 } }

  # FamilyLiturgy with noted/verified/rejected users
  GET /api/family-liturgies/[id]
  # Returns: { id, status, noted: { id, firstName }, verified: {...}, rejected: {...} }
  ```

### Performance
- [ ] Response times < 200ms (p95)
- [ ] Database queries < 1s
- [ ] No N+1 query patterns with new relations

### Production Readiness
- [ ] Backup strategy confirmed
- [ ] Rollback plan tested (in staging)
- [ ] On-call runbook updated
- [ ] Team trained on new data model

## Troubleshooting

### Migration Fails with "Foreign key constraint violation"
**Cause:** Orphaned records in createdBy / revokedBy fields

**Solution:**
```bash
# Find orphaned records
SELECT * FROM lessons WHERE created_by NOT IN (SELECT id FROM users);

# Assign to default user
UPDATE lessons SET created_by = (SELECT id FROM users LIMIT 1) 
WHERE created_by NOT IN (SELECT id FROM users);

# Retry migration
npx prisma migrate deploy
```

### "Unique constraint violation" on Conversation creation
**Cause:** Duplicate (participant1, participant2) pairs

**Solution:**
```sql
-- Check for duplicates
SELECT COUNT(*) FROM conversations 
GROUP BY school_id, participant1_id, participant2_id 
HAVING COUNT(*) > 1;

-- If any duplicates, merge them
-- (Manual process, coordinate with team)
```

### Application won't start after migration
**Cause:** Schema out of sync with generated Prisma client

**Solution:**
```bash
# Regenerate Prisma client
npx prisma generate

# Check for TypeScript errors
npm run build

# Restart application
npm run start:prod
```

## Next Steps After Phase 1

1. **Phase 2**: Notification system unification (1 week)
2. **Phase 3**: Schema denormalization cleanup (1 week)
3. **Phase 4**: UI/UX feature completion (2 weeks)
4. **Phase 5**: Performance optimization (2 weeks)

See [COHEP Platform Audit Plan](./COHEP%20Platform%20Comprehensive%20Audit%20%26%20Execution%20Plan.md) for full roadmap.

