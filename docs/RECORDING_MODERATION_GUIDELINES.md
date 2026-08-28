# User Recording Moderation & Privacy Guidelines

**Status**: ✅ PUBLISHED (Implementation Ready)

**Last Updated**: 2026-08-28

**Scope**: Defines retention, privacy, visibility, moderation workflow, and self-hosting responsibilities for learner practice recordings.

---

## Privacy & Data Protection

### Who Can Access Recordings?

| Actor | Access | Conditions |
|-------|--------|-----------|
| **Learner** | ✅ Full (view, play, delete own recordings) | Always |
| **Learner's Parent** | ✅ Limited (view progress, not raw recording) | Via parent portal; learner must be linked |
| **Servant/Teacher** | ✅ Limited (review for feedback only) | Within their group only |
| **Clergy/Admin** | ✅ Aggregate stats only | No individual recording access |
| **Other Learners** | ❌ NO access | Strict privacy boundary |
| **Public/Web** | ❌ NO access | Never published or shared |

### Data Retention & Deletion

#### Automatic Retention

- **Default**: 90 days after recording
- **After 90 days**: Recording is deleted automatically; no recovery possible
- **Self-Hosted**: Church admin can configure retention period (14–365 days)

#### Manual Deletion

- **By Learner**: Can delete any recording immediately (accessible in "My Practice" history)
- **By Parent**: Can request bulk deletion of their child's recordings (submitted via support form)
- **By Servant**: Cannot delete; can only flag for admin review if off-topic or inappropriate
- **By Admin**: Can delete flagged or policy-violating recordings

#### Deletion Process

1. Learner/parent requests deletion
2. Recording marked as `deletedAt` (soft delete, visible to admin for 30 days)
3. After 30 days: hard delete (permanent removal)
4. Learner receives confirmation email

### GDPR & COPPA Compliance

#### For EU-Based Users (GDPR)

- Learner/parent has **right to access** all recordings (can request export)
- Learner/parent has **right to deletion** (can request immediate hard delete, no 30-day grace period)
- Data processing basis: **Legitimate interest** (educational formation) OR **Parental consent** (for minors)
- Consent is **explicit** (checkbox: "COHEP may store my child's practice recordings for learning analysis")
- Retention policy is **transparent** (shown in onboarding)

#### For US-Based Users <13 (COPPA)

- Parental **verifiable consent** is required before storing any recording
- Parent receives **clear notice** of collection, use, and retention
- Parent has **right to request deletion** at any time
- Data is **not shared** with third parties (except service providers: S3, Cloudinary, etc.)
- Data is **deleted** when child turns 13 or on parent request (whichever comes first)

#### For Self-Hosted Churches

- **Church is the data controller** (not COHEP); must comply with local laws
- Church must **display privacy policy** (required by GDPR/COPPA if applicable)
- Church must **designate a DPA** (Data Protection Authority contact)
- Church must **document consent** (show that parents agreed to recording storage)
- Church must **log deletions** (audit trail for compliance)

---

## Recording Storage & Infrastructure

### Storage Locations

| Medium | Provider | Access | Use |
|--------|----------|--------|-----|
| **Uploads (FormData)** | Express static (local) | Learner + servant + admin | Practice for feedback |
| **S3 (Backup)** | AWS S3 | Admin only | Cold storage, archival |
| **Cloudinary** | Cloudinary CDN | Learner + authenticated users | Serving recordings to learner/parent portal |
| **Self-Host** | Local file system | Admin only | No external dependency |

### File Specifications

- **Format**: `.webm` audio (captured by browser `MediaRecorder`)
- **Max Size**: 50 MB per recording (enforced by upload endpoint)
- **Metadata**: Student ID, Lesson ID, timestamp, duration, self-rating
- **No PII in filename**: Filenames are randomized (e.g., `practice-<lessonId>-<timestamp>.webm`, never contain name/email)

### Encryption

- **In Transit**: TLS 1.3 (HTTPS enforced)
- **At Rest**: S3 encryption enabled (AES-256); self-hosted storage encrypted on disk
- **Not encrypted in app**: Browser-local recording is unencrypted (learner device responsibility)

---

## Moderation Workflow

### Flagging System

#### By Learner

- **How**: "Report this recording" button in practice history
- **Reasons**: 
  - "I recorded something off-topic" (e.g., singing off-key, not the hymn)
  - "Privacy concern" (e.g., family in background)
  - "Technical issue" (e.g., distorted audio, inaudible)
- **Effect**: Recording marked `flagged = true` + reason stored

#### By Servant

- **How**: "Flag for review" option in servant feedback interface
- **Reasons**:
  - "Off-topic content" (singing something other than the assigned hymn)
  - "Inappropriate language or disrespect"
  - "Poor audio quality" (makes learning impossible)
- **Effect**: Recording flagged + notification sent to admin

### Review Process

| Step | Actor | Timeline | Action |
|------|-------|----------|--------|
| 1 | Learner or Servant | Anytime | Flag recording with reason |
| 2 | Admin notified | Within 24h | Email alert: "New flagged recording" |
| 3 | Admin reviews | Within 3 business days | Listen, assess reason, make decision |
| 4 | Admin decides | Within 5 business days | Approve, keep as-is, delete, or contact learner |
| 5 | Learner notified | Within 24h of decision | Email: "Your recording was [kept/deleted]" + reason |

### Moderation Quality Standards

#### ✅ Approve (Keep Recording)

- Audio is intelligible (learner voice is audible, not drowned out)
- Learner is genuinely attempting the assigned hymn (not singing something off-topic)
- Recording is complete (≥10 seconds, not fragmented)
- No offensive language or disrespect

#### ❌ Delete (Remove Recording)

- Off-topic content (singing a different hymn, joke, unrelated song)
- Offensive language or disrespect toward Church, teachers, God
- Severely distorted audio (impossible to assess learning)
- Privacy violation (names, family details, or personal information clearly audible)
- Duplicate (learner recorded same hymn multiple times; keep best version)

#### ⚠️ Contact Learner (Keep, But Address)

- Audio quality is borderline (learner might re-record for better feedback)
- Servant's feedback suggests misunderstanding (teacher can clarify in-app)
- Technical issue fixable by learner (e.g., "record in a quieter place")
- Message: "Hi [Student], your recording was kept, but here's how we can improve it…"

### Escalation

#### To Clergy/Admin If:

- Recording contains concerning content (safety risk, harassment, etc.)
- Parent/guardian requests special review
- Learner disputes a deletion decision

#### Actions:

- Escalation flagged in system
- Clergy/admin reviews within 2 business days
- Decision is final; learner is notified with reason

---

## Self-Hosting Responsibilities

### For Churches Running COHEP On-Premise

You become the **data controller** and must:

#### 1. **Designate a Moderator**
   - Usually a servant, admin, or priest
   - Responsible for reviewing flagged recordings
   - Must be trained on moderation guidelines

#### 2. **Document Consent**
   - Before parents/learners upload recordings, display and collect written consent
   - Consent form must include: what we collect, how long we keep it, who can see it, deletion rights
   - Keep signed forms (digital or paper) for audit

#### 3. **Publish Privacy Policy**
   - Tell parents/learners clearly: "We store practice recordings for X days, then delete them"
   - Explain: "Your servant can listen to give feedback, but other learners cannot"
   - Provide: deletion request process, contact info for questions

#### 4. **Maintain Audit Log**
   - Track all deletions: who deleted, when, why
   - Track all accesses: when servant reviewed, what feedback was given
   - Review quarterly for compliance

#### 5. **Secure Storage**
   - Encrypt files on disk (`openssl` or OS-level encryption)
   - Restrict file system access (only moderator + admin can access `/uploads`)
   - Regular backups (but include same encryption + retention limits)

#### 6. **Comply with Local Laws**
   - EU (GDPR): Appoint DPA, get explicit consent, honor right to deletion
   - UK (Age-Appropriate Design Code): Ensure recordings are only for educational use
   - US (COPPA): Get parental consent if learner <13, delete when they turn 13
   - Other jurisdictions: Check local privacy laws; update policy accordingly

#### 7. **Handle Data Breaches**
   - If recordings are exposed/leaked:
     - Notify affected families within 24 hours
     - Notify church leadership
     - Document incident: what happened, when, how you responded
     - If GDPR applies: notify regulators within 72 hours

---

## Learner-Facing Privacy & Deletion

### In the Student Portal

**Practice History View**:
```
Recent Practice
─────────────────────────
Nov 28 | ⭐⭐⭐ | [Play] [Delete]
Nov 27 | ⭐⭐⭐⭐ | [Play] [Delete]
Nov 25 | ⭐⭐ | [Play] [Delete]

All recordings are deleted automatically 90 days after recording.
You can delete any recording anytime.
```

**Delete Flow**:
1. Learner clicks [Delete]
2. Confirmation: "Are you sure? This will be permanently removed."
3. After delete: "Deleted ✓ — It will be fully removed in 30 days, but you won't see it anymore."

### In Parent Portal

**Parent View**:
```
[Child]'s Practice Summary
─────────────────────────
Practiced 4 times this week
Mastered Tasbeha Kiahk (3/3 attempts recorded)

💬 Servant Feedback: "Great clarity! One more time on the ending."

[Request deletion of all recordings]
```

**On [Request Deletion]**:
```
Request Deletion

You can ask us to delete all recordings right now.
We'll do it within 24 hours.
After deletion, they cannot be recovered.

[Confirm Deletion Request]
```

---

## Teacher/Servant Responsibilities

### What Servants CAN Do

- ✅ Listen to student recordings for feedback
- ✅ Leave text feedback (short note, constructive)
- ✅ Flag concerning recordings for admin review
- ✅ See dates, ratings, duration of attempts
- ✅ Communicate with learner via feedback system

### What Servants CANNOT Do

- ❌ Share recordings with other teachers/servants (except group lead)
- ❌ Download or save recordings (must use in-app playback only)
- ❌ Play recordings to others (not a teaching tool for group practice)
- ❌ Delete recordings (only admin can do that)
- ❌ Use recordings for any purpose other than feedback

### Servant Training

Before servants can access recordings, they must:

1. **Read** this moderation guideline (5 min)
2. **Agree** to privacy commitment: "I will only use recordings to help this learner, and I will not share them"
3. **Sign** digital acknowledgement (stored in system)

Checkbox: "I understand recordings are private and I am accountable for protecting learner privacy."

---

## FAQ: Recording Privacy

### Q: Can learners share their recordings with friends?
**A**: No. Recordings are private to the learner and their teacher. There's no "share" button. Learners can describe their progress, but not share the actual recording.

### Q: What if a learner wants to delete a recording their teacher is reviewing?
**A**: They can delete it anytime. The servant's feedback (text) remains, but the audio is deleted. If the servant hasn't reviewed yet, they'll see "Recording was deleted" + the date.

### Q: How long do we keep recordings if we self-host?
**A**: Default is 90 days. You can change it in settings (14–365 days), but must tell parents/learners upfront in your privacy policy.

### Q: What if a parent (not in the same household) wants access to recordings?
**A**: Learner must explicitly link them as "parent" in the portal. Then they get summary access (progress, not raw recordings). Raw recordings are only visible to the learner + their linked family.

### Q: Can clergy listen to recordings to assess learners?
**A**: Not directly. Clergy can see aggregate statistics ("X learners practiced Tasbeha Kiahk, Y reached mastery"), but cannot access individual recordings. If a specific learner's progress is concerning, the servant can voluntarily share summary feedback (text), not the recording.

### Q: What if we're concerned about a learner's safety/welfare based on a recording?
**A**: Escalate to admin immediately. If anything concerning is heard (abuse indicators, self-harm references, etc.), follow mandatory reporting protocols per your local church/country laws.

---

## Document Control

| Version | Date | Change | Owner |
|---------|------|--------|-------|
| 1.0 | 2026-08-28 | Initial publication | Product Lead |

---

## Related Documents

- [[BADGE_GOVERNANCE.md]] — Badges & XP framework
- Privacy Policy (parent-facing) — TBD
- Self-Hosting Playbook — TBD
- Incident Response Plan — TBD

