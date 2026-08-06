// Gamification module tests — full coverage
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()
  const tsSuffix = String(ts).slice(-6)
  let badgeId = null

  // G-1: leaderboard
  const lb = await api('GET', `/gamification/leaderboard?schoolId=${SCHOOL_ID}`)
  if (lb.ok) pass('G-1 Leaderboard read', 'ok')
  else fail('G-1 Leaderboard read', `status=${lb.status} ${JSON.stringify(lb.data).slice(0, 200)}`)

  // G-2: seasonal status + create
  const seasonal = await api('GET', `/gamification/seasonal?schoolId=${SCHOOL_ID}`)
  if (seasonal.ok) pass('G-2 Seasonal badge status read', 'ok')
  else fail('G-2 Seasonal badge status read', `status=${seasonal.status} ${JSON.stringify(seasonal.data).slice(0, 200)}`)

  const seasonalCreate = await api('POST', `/gamification/seasonal/create?schoolId=${SCHOOL_ID}`)
  if (seasonalCreate.ok) pass('G-3 Create seasonal badge', 'ok (may already exist)')
  else fail('G-3 Create seasonal badge', `status=${seasonalCreate.status} ${JSON.stringify(seasonalCreate.data).slice(0, 200)}`)

  // T24: create badge
  const badge = await api('POST', '/gamification/badges', {
    name: `QA-Badge-${tsSuffix}`, description: 'QA test badge', category: 'participation', points: 10, criteria: {},
  })
  badgeId = badge.data?.id ?? badge.data?.badge?.id ?? null
  if (badge.ok && badgeId) {
    track(badgeId, `QA badge`)
    fx.qaBadgeId = badgeId
    pass('T24 Create badge', `id=${badgeId}`)

    const badgesList = await api('GET', `/gamification/badges?schoolId=${SCHOOL_ID}`)
    if (badgesList.ok) pass('G-4 Badges list read', 'ok')
    else fail('G-4 Badges list read', `status=${badgesList.status}`)

    const bupd = await api('PUT', `/gamification/badges/${badgeId}`, { description: 'QA updated badge', points: 15 })
    if (bupd.ok) pass('G-5 Update badge', 'description+points set')
    else fail('G-5 Update badge', `status=${bupd.status} ${JSON.stringify(bupd.data).slice(0, 200)}`)
  } else {
    fail('T24 Create badge', `status=${badge.status} ${JSON.stringify(badge.data).slice(0, 300)}`)
  }

  const student = fx.firstStudent
  if (student) {
    // T25: add XP
    const xp = await api('POST', `/gamification/students/${student.id}/xp`, { amount: 25, type: 'qa_test', description: 'QA test XP' })
    if (xp.ok) pass('T25 Add XP', `student=${student.id} amount=25`)
    else fail('T25 Add XP', `status=${xp.status} ${JSON.stringify(xp.data).slice(0, 300)}`)

    const tx = await api('GET', `/gamification/students/${student.id}/transactions?skip=0&take=5`)
    if (tx.ok) pass('T25b XP transactions read', 'ok')
    else fail('T25b XP transactions read', `status=${tx.status}`)

    // G-6: growth
    const growth = await api('GET', `/gamification/students/${student.id}/growth`)
    if (growth.ok) pass('G-6 Student growth read', 'ok')
    else fail('G-6 Student growth read', `status=${growth.status} ${JSON.stringify(growth.data).slice(0, 200)}`)

    // T26: award badge
    if (badgeId) {
      const award = await api('POST', `/gamification/students/${student.id}/badges`, { badgeId })
      if (award.ok) {
        const bsId = award.data?.studentBadge?.id ?? award.data?.id ?? null
        if (bsId) track(bsId, `QA student-badge (${student.firstName})`)
        pass('T26 Award badge', `student=${student.id} badge=${badgeId}`)
      } else {
        fail('T26 Award badge', `status=${award.status} ${JSON.stringify(award.data).slice(0, 300)}`)
      }
    } else {
      fail('T26 Award badge', 'no badge created')
    }

    // G-7: student badges list
    const sbadges = await api('GET', `/gamification/students/${student.id}/badges`)
    if (sbadges.ok) pass('G-7 Student badges list read', 'ok')
    else fail('G-7 Student badges list read', `status=${sbadges.status} ${JSON.stringify(sbadges.data).slice(0, 200)}`)

    const stats = await api('GET', `/gamification/students/${student.id}/stats`)
    if (stats.ok) pass('T25c Student gamification stats read', 'ok')
    else fail('T25c Student gamification stats read', `status=${stats.status}`)

    const compute = await api('POST', `/gamification/compute/student/${student.id}`)
    if (compute.ok) pass('T27 Compute badges', 'ok')
    else fail('T27 Compute badges', `status=${compute.status} ${JSON.stringify(compute.data).slice(0, 300)}`)
  } else {
    fail('G-6/G-7/T25/T26/T27 flows', 'no student fixture available')
  }

  // G-8: group trophy (needs group + schoolId param)
  if (fx.group?.id) {
    const trophy = await api('GET', `/gamification/groups/${fx.group.id}/trophy?schoolId=${SCHOOL_ID}`)
    if (trophy.ok) pass('G-8 Group trophy read', 'ok')
    else fail('G-8 Group trophy read', `status=${trophy.status} ${JSON.stringify(trophy.data).slice(0, 200)}`)
  }

  // G-9: servant milestones
  const milestones = await api('GET', `/gamification/servant/milestones?schoolId=${SCHOOL_ID}`)
  if (milestones.ok) pass('G-9 Servant milestones read', 'ok')
  else fail('G-9 Servant milestones read', `status=${milestones.status} ${JSON.stringify(milestones.data).slice(0, 200)}`)

  // G-10: compute school
  const computeSchool = await api('POST', `/gamification/compute/school?schoolId=${SCHOOL_ID}`)
  if (computeSchool.ok) pass('G-10 Compute school', `status=${computeSchool.status} ${JSON.stringify(computeSchool.data).slice(0, 150)}`)
  else fail('G-10 Compute school', `status=${computeSchool.status} ${JSON.stringify(computeSchool.data).slice(0, 250)}`)

  return { badgeId }
}
