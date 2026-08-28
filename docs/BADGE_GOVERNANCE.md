# Badge & XP Governance Framework

**Status**: 🔴 UNDER REVIEW — Awaiting Clergy Decision

**Last Updated**: 2026-08-28

**Purpose**: Define when, why, and how badges are awarded. Identify theological risks. Establish governance process for new badges.

---

## Current Badge System

### Implemented Badges

| Badge ID | Name | Awarded When | Purpose | Theological Risk | Status |
|----------|------|--------------|---------|------------------|--------|
| `first-recording` | First Practice | Student records their first hymn | Encourages initial engagement | **LOW** — celebrates trying | ✅ Active |
| `mastery-reach` | Mastery Milestone | SM-2 reaches "mastered" state (5★ + 3+ repetitions) | Celebrates learning achievement | **MEDIUM** — validates self-rating as "mastery" | ⚠️ Under Review |
| `group-milestone-5` | Group Learner | Student's group learns 5 hymns | Celebrates collective participation | **LOW** — no individual ranking | ✅ Active |
| `liturgy-lead` | Liturgy Leader | Student leads hymn at church (clergy-verified) | Recognizes real Church service | **LOW** — pastoral, not gamified | ✅ Active |

**Note**: Additional badges may exist in the database. This audit is incomplete until a full database query is run. See [Audit TODO](#audit-todos) below.

---

## XP System

### Current Implementation

- **Awarded**: 1 XP per practice session logged (regardless of rating)
- **Display**: Shown as total accumulation in student portal header
- **Purpose**: Track engagement; visual feedback on "effort invested"
- **Concerns**:
  - No ceiling or goal (XP accumulates indefinitely)
  - No connection to spiritual growth or Church participation
  - Risk of comparison between peers ("Why does he have more XP?")
  - Terminology unclear to learners ("What is XP?")

---

## Theological & Pastoral Concerns

### Red Flag: Mastery ≠ Liturgical Readiness

**Issue**: The "mastery" badge is awarded automatically by SM-2 algorithm when:
- Student rates themselves 5★ AND
- They've practiced 3+ times

**Problem**: Self-rating does NOT guarantee liturgical readiness:
- Student might rate 5★ out of enthusiasm, not accuracy
- No clergy/servant verification that the hymn is sung correctly in Church context
- Badges imply authority ("You've mastered it!") when only practice time is measured

**Pastoral Risk**: Learner might feel confident leading at Church, but disappoint the congregation if their singing is unclear or inaccurate.

**Mitigation**: Separate badges for:
- ✅ **Practice Progression** (auto-awarded by SM-2): "You've practiced 3 times"
- ⚠️ **Liturgical Readiness** (clergy-verified): "You led this hymn at Church"

---

### Red Flag: Individual Achievement in a Communal Faith

**Issue**: XP and individual badges emphasize personal progress:
- Leaderboards (if added later) would rank learners against each other
- XP meter focuses on "my growth," not "our Church's worship"
- Risk of shame for slower learners or those with fewer practice opportunities

**Pastoral Risk**: Formation becomes about individual achievement, not participation in the Church's living heritage.

**Mitigation**: 
- Emphasize group milestones over individual rank (e.g., "Our group learned 5 hymns this month" instead of "Top learners this week")
- Frame badges as "readiness signals" for Church roles, not prestige markers
- No leaderboards; no public ranking

---

### Red Flag: Gamification Without Spiritual Framing

**Issue**: XP and badges are presented as abstract reward mechanics, divorced from spiritual meaning:
- "You earned 5 XP" — but why? What does that mean for your faith?
- "Mastery Badge" — but who verified? Are you really ready to lead worship?
- "Group Milestone" — but what's the spiritual significance?

**Pastoral Risk**: Learners optimize for badges, not for real learning or Church participation. Formation becomes superficial.

**Mitigation**: Every badge and XP notification should connect to spiritual/liturgical meaning:
- "You've practiced 3 times — you're ready to lead this at liturgy"
- "Your group learned 5 Kiahk hymns — together you're preparing for Kiahk worship"
- No abstract "You earned X points" messages

---

## Governance Decision Required: Clergy Review

### Questions for Clergy (Bishops, Priests, Cantors, Theologians)

1. **Is celebrating individual "mastery" spiritually appropriate?**
   - Or should progress be framed only as "readiness to serve" (clergy-verified)?
   - Should self-rating badges be removed entirely?

2. **Should XP exist at all?**
   - Does it motivate learners helpfully, or create unhealthy comparison?
   - If kept, should it be reframed as "hours practiced" or "practice streaks" (effort) instead of abstract "points"?

3. **Should group achievements be celebrated more than individual?**
   - Would emphasizing collective milestones ("Our group learned X hymns") better serve spiritual formation?

4. **What's the role of badges in Church service?**
   - Should badges only be awarded after verified liturgical participation (clergy-verified)?
   - Or is practice-stage progression also appropriate to celebrate?

5. **How do we avoid trivializing sacred content?**
   - Should badges reference specific liturgical contexts (e.g., "Led Tasbeha Kiahk at Church")?
   - Should celebration language be reverent, not game-like?

---

## Proposed Governance Framework

### New Badge Criteria

Any new badge must answer ALL of these:

- **Spiritual Appropriateness**: Does this celebrate learning/service in a way that strengthens faith, or trivialize it?
- **Clarity**: Is it obvious to the learner *why* they earned this badge? Does it connect to Church participation?
- **Verification**: Is it auto-awarded by algorithm, or clergy-verified?
- **Collectivity**: Does it emphasize personal achievement or group participation?
- **Longevity**: Is this a milestone, or ongoing status? (Don't award the same badge repeatedly.)

### Approval Process

1. **Propose**: Developer or clergy member submits badge idea + motivation
2. **Design**: Include: name, when awarded, why it matters, spiritual appropriateness
3. **Clergy Review**: Priest/bishop + theologian review for spiritual alignment
4. **Test**: Pilot with 1–2 churches for 4 weeks; gather feedback
5. **Decide**: Keep, modify, or reject based on feedback

---

## Recommended Actions (DECISION PENDING)

### Option A: Keep Current System (if approved by clergy)

- Clarify badge criteria in a learner-facing help page
- Add clergy approval workflow for new badges
- Reframe XP as "practice hours" (more honest than abstract points)
- Deprecate leaderboards; emphasize group milestones

### Option B: Simplify to Liturgical Verification Only

- Remove practice-stage badges (first-recording, mastery-reach, group-milestone)
- Keep only clergy-verified badges (liturgy-lead, church-service)
- Track engagement via "practice streaks" or "hours invested," not XP
- Celebration becomes: "You led this hymn at Church — thank you for serving"

### Option C: Remove Badges & XP Entirely

- Focus on mastery states + "ready to lead" signal (clergy-verified)
- Celebration is liturgical participation + parent/teacher affirmation, not badges
- Simple clear UI: "You're ready to lead at Church" (binary decision)
- No complexity, no risk of gamification

---

## Audit TODOs

- [ ] **Database audit**: Query all badges currently awarded; count by type and learner
- [ ] **UX audit**: Screenshot badge displays; assess how gamified they feel
- [ ] **User research**: Interview 10–15 learners: Do badges motivate or frustrate? Do they care about them?
- [ ] **Clergy meeting**: Present findings; get decision on A/B/C above
- [ ] **Implementation**: Execute chosen approach

---

## Decision Timeline

| Week | Action | Owner |
|------|--------|-------|
| Week 1 | Conduct database audit | Backend dev |
| Week 2 | Present findings to clergy | Product lead |
| Week 2–3 | Clergy discusses + decides | Clergy |
| Week 4 | Implement chosen approach | Dev + Product |

---

## References

- **Related Issue**: Gamification Under Review (Section 0 of Strategic Analysis)
- **Context**: Student Learning Journey — Strategic Analysis
- **Next Step**: [[#6 Post-Liturgy Verification]] (clergy-verified readiness pathway)

