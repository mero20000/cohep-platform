// Parents module tests — parent user, child link/unlink, attendance/assessments/progress/home/current-lesson/practice/liturgy/milestones/archive/term-report
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()
  const tsSuffix = String(ts).slice(-6)
  const parentEmail = `qa-parent-${tsSuffix}@example.com`
  const results = {}

  // Create a parent-role user (as admin)
  const createParent = await api('POST', '/users', {
    email: parentEmail,
    firstName: 'QaParent',
    lastName: `Pr-${tsSuffix}`,
    password: 'QaParent123!',
    roleName: 'parent',
    schoolId: SCHOOL_ID,
  })
  const parentUserId = createParent.data?.id ?? createParent.data?.user?.id ?? null
  if (!createParent.ok || !parentUserId) {
    fail('P-1 Create parent user', `status=${createParent.status} ${JSON.stringify(createParent.data).slice(0, 250)}`)
    return {}
  }
  track(parentUserId, `QA parent user ${parentEmail}`)
  pass('P-1 Create parent user', `id=${parentUserId}`)

  // Login as the parent → needs a JWT token for the parents endpoints
  const plogin = await fx.loginAs(parentEmail, 'QaParent123!')
  const parentToken = plogin.token
  if (!parentToken) {
    fail('P-2 Parent login', JSON.stringify(plogin.error).slice(0, 200))
    return {}
  }
  pass('P-2 Parent login', 'token issued')
  fx.qaParentToken = parentToken

  // Use a student code to link (the QA student created in students module, or a seed student)
  const studentCode = fx.qaStudentCode || fx.firstStudent?.studentCode
  if (!studentCode) {
    fail('P-3 Link child', 'no student code available')
    return {}
  }

  // Helper: parent-scoped api (uses parent token via runner's apiAs)
  const parentApi = (method, path, body) => fx.apiAs(parentToken, method, path, body)

  // P-3: link child
  const link = await parentApi('POST', '/parents/me/children/link', { studentCode, relationship: 'guardian' })
  if (link.ok) pass('P-3 Link child', `code=${studentCode}`)
  else fail('P-3 Link child', `status=${link.status} ${JSON.stringify(link.data).slice(0, 250)}`)

  // P-4: children list → find child id
  const children = await parentApi('GET', '/parents/me/children')
  let childId = null
  if (children.ok) {
    const arr = children.data?.children ?? children.data?.data ?? (Array.isArray(children.data) ? children.data : [])
    childId = arr[0]?.id ?? arr[0]?.student?.id ?? null
    pass('P-4 Children list read', `count=${arr.length} childId=${childId ?? 'n/a'}`)
  } else {
    fail('P-4 Children list read', `status=${children.status} ${JSON.stringify(children.data).slice(0, 250)}`)
  }

  if (!childId) {
    fail('P-5…P-15 parent child flows', 'no linked child id')
    return {}
  }
  fx.qaLinkedChildId = childId

  // P-5: get child
  const child = await parentApi('GET', `/parents/me/children/${childId}`)
  if (child.ok) pass('P-5 Get child', `id=${childId}`)
  else fail('P-5 Get child', `status=${child.status} ${JSON.stringify(child.data).slice(0, 250)}`)

  // P-6: child attendance
  const att = await parentApi('GET', `/parents/me/children/${childId}/attendance`)
  if (att.ok) pass('P-6 Child attendance read', 'ok')
  else fail('P-6 Child attendance read', `status=${att.status} ${JSON.stringify(att.data).slice(0, 250)}`)

  // P-7: child assessments
  const assess = await parentApi('GET', `/parents/me/children/${childId}/assessments`)
  if (assess.ok) pass('P-7 Child assessments read', 'ok')
  else fail('P-7 Child assessments read', `status=${assess.status} ${JSON.stringify(assess.data).slice(0, 250)}`)

  // P-8: child progress
  const prog = await parentApi('GET', `/parents/me/children/${childId}/progress`)
  if (prog.ok) pass('P-8 Child progress read', 'ok')
  else fail('P-8 Child progress read', `status=${prog.status} ${JSON.stringify(prog.data).slice(0, 250)}`)

  // P-9: child home
  const home = await parentApi('GET', `/parents/me/children/${childId}/home`)
  if (home.ok) pass('P-9 Child home read', 'ok')
  else fail('P-9 Child home read', `status=${home.status} ${JSON.stringify(home.data).slice(0, 250)}`)

  // P-10: current lesson
  const curLesson = await parentApi('GET', `/parents/me/children/${childId}/current-lesson`)
  if (curLesson.ok) pass('P-10 Child current lesson read', 'ok (may be null)')
  else fail('P-10 Child current lesson read', `status=${curLesson.status} ${JSON.stringify(curLesson.data).slice(0, 250)}`)

  // P-11: log practice (needs a lesson; may fail harmlessly if no lesson)
  const lessonId = fx.qaLessonId || fx.lessonId || null
  if (lessonId) {
    const practice = await parentApi('POST', `/parents/me/children/${childId}/practice`, { lessonId })
    if (practice.ok) pass('P-11 Log practice (parent)', `lesson=${lessonId}`)
    else fail('P-11 Log practice (parent)', `status=${practice.status} ${JSON.stringify(practice.data).slice(0, 250)}`)

    const ps = await parentApi('GET', `/parents/me/children/${childId}/practice-summary`)
    if (ps.ok) pass('P-12 Practice summary read', 'ok')
    else fail('P-12 Practice summary read', `status=${ps.status} ${JSON.stringify(ps.data).slice(0, 250)}`)
  } else {
    fail('P-11/P-12 practice flows', 'no lesson fixture')
  }

  // P-13: log liturgy (creates a family liturgy record → feeds servants module)
  const liturgy = await parentApi('POST', `/parents/me/children/${childId}/liturgy`, { date: '2026-08-01', notes: 'QA liturgy record' })
  if (liturgy.ok) {
    const litId = liturgy.data?.id ?? null
    if (litId) track(litId, `QA family liturgy (${studentCode})`)
    pass('P-13 Log liturgy', `id=${litId ?? 'n/a'} status=${liturgy.data?.status ?? '?'}`)
  } else {
    fail('P-13 Log liturgy', `status=${liturgy.status} ${JSON.stringify(liturgy.data).slice(0, 250)}`)
  }

  // P-14: liturgy records read
  const litRead = await parentApi('GET', `/parents/me/children/${childId}/liturgy`)
  if (litRead.ok) pass('P-14 Child liturgy records read', 'ok')
  else fail('P-14 Child liturgy records read', `status=${litRead.status} ${JSON.stringify(litRead.data).slice(0, 250)}`)

  // P-15: milestones
  const miles = await parentApi('GET', `/parents/me/children/${childId}/milestones`)
  if (miles.ok) pass('P-15 Child milestones read', 'ok')
  else fail('P-15 Child milestones read', `status=${miles.status} ${JSON.stringify(miles.data).slice(0, 250)}`)

  // P-16: archive
  const arch = await parentApi('GET', `/parents/me/children/${childId}/archive`)
  if (arch.ok) pass('P-16 Child archive read', 'ok')
  else fail('P-16 Child archive read', `status=${arch.status} ${JSON.stringify(arch.data).slice(0, 250)}`)

  // P-17: term-report
  const term = await parentApi('GET', `/parents/me/children/${childId}/term-report`)
  if (term.ok) pass('P-17 Child term report read', 'ok')
  else fail('P-17 Child term report read', `status=${term.status} ${JSON.stringify(term.data).slice(0, 250)}`)

  // P-18: unlink child, then re-link so downstream modules (servants liturgy) still work
  const unlink = await parentApi('DELETE', `/parents/me/children/${childId}`)
  if (unlink.ok) {
    const relink = await parentApi('POST', '/parents/me/children/link', { studentCode, relationship: 'guardian' })
    if (relink.ok) pass('P-18 Unlink child', 'unlinked + re-linked for downstream modules')
    else fail('P-18 Unlink child', `unlink ok but re-link failed: ${relink.status} ${JSON.stringify(relink.data).slice(0, 200)}`)
  } else {
    fail('P-18 Unlink child', `status=${unlink.status} ${JSON.stringify(unlink.data).slice(0, 250)}`)
  }

  results.parentUserId = parentUserId
  return results
}
