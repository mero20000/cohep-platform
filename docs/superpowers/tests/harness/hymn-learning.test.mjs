// Hymn Learning module tests — practice, map, due-review, this-sunday, stats, history, review-queue, review
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()
  const tsSuffix = String(ts).slice(-6)

  const studentId = fx.firstStudent?.id || fx.qaStudentId
  const lessonId = fx.qaLessonId || fx.lessonId || null
  const sidParam = studentId ? `?studentId=${studentId}` : ''

  // HL1: this-sunday (no student needed)
  const sunday = await api('GET', `/hymn-learning/this-sunday?schoolId=${SCHOOL_ID}`)
  if (sunday.ok) pass('HL1 This Sunday hymns', `keys=${Object.keys(sunday.data ?? {}).slice(0, 6).join(',')}`)
  else fail('HL1 This Sunday hymns', `status=${sunday.status} ${JSON.stringify(sunday.data).slice(0, 250)}`)

  if (!studentId) {
    fail('HL2-HL6 hymn learning flows', 'no student fixture available')
    return {}
  }

  // HL2: practice (needs a lesson; use fixture lesson)
  let practiceId = null
  if (lessonId) {
    const practice = await api('POST', `/hymn-learning/practice`, {
      lessonId,
      selfRating: 3,
      durationSec: 60,
      studentId,
    })
    practiceId = practice.data?.id ?? practice.data?.session?.id ?? practice.data?.practiceSession?.id ?? null
    if (practice.ok) {
      if (practiceId) track(practiceId, `QA hymn practice session`)
      pass('HL2 Log practice', `lesson=${lessonId} id=${practiceId ?? 'n/a'}`)
      console.log('     → response:', JSON.stringify(practice.data).slice(0, 300))
    } else {
      fail('HL2 Log practice', `status=${practice.status} ${JSON.stringify(practice.data).slice(0, 300)}`)
    }
  } else {
    fail('HL2 Log practice', 'no lesson fixture (create one first)')
  }

  // HL3: map
  const map = await api('GET', `/hymn-learning/map${sidParam}`)
  if (map.ok) pass('HL3 Hymn map', 'ok')
  else fail('HL3 Hymn map', `status=${map.status} ${JSON.stringify(map.data).slice(0, 250)}`)

  // HL4: due-review
  const due = await api('GET', `/hymn-learning/due-review${sidParam}`)
  if (due.ok) pass('HL4 Due review', 'ok')
  else fail('HL4 Due review', `status=${due.status} ${JSON.stringify(due.data).slice(0, 250)}`)

  // HL5: stats
  const stats = await api('GET', `/hymn-learning/stats${sidParam}`)
  if (stats.ok) pass('HL5 Learning stats', 'ok')
  else fail('HL5 Learning stats', `status=${stats.status} ${JSON.stringify(stats.data).slice(0, 250)}`)

  // HL6: history (needs lesson)
  if (lessonId) {
    const hist = await api('GET', `/hymn-learning/history/${lessonId}${sidParam}`)
    if (hist.ok) pass('HL6 Practice history', 'ok')
    else fail('HL6 Practice history', `status=${hist.status} ${JSON.stringify(hist.data).slice(0, 250)}`)
  }

  // HL7: review-queue (servant) — admin has staff role
  const queue = await api('GET', `/hymn-learning/review-queue?schoolId=${SCHOOL_ID}`)
  if (queue.ok) pass('HL7 Servant review queue', 'ok (may be empty)')
  else fail('HL7 Servant review queue', `status=${queue.status} ${JSON.stringify(queue.data).slice(0, 250)}`)

  // HL8: review a practice session (if one was created)
  if (practiceId) {
    const review = await api('PATCH', `/hymn-learning/sessions/${practiceId}/review`, {
      servantRating: 4, servantNote: 'QA review note',
    })
    if (review.ok) pass('HL8 Review practice session', 'servantRating saved')
    else fail('HL8 Review practice session', `status=${review.status} ${JSON.stringify(review.data).slice(0, 250)}`)
  }

  return { practiceId }
}
