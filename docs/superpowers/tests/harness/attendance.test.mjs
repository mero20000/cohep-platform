// Attendance module tests — sessions CRUD, mark, stats, search, generate, qr-checkin, start-class, heatmap
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()

  // A-1: sessions list
  const list = await api('GET', `/attendance/sessions?schoolId=${SCHOOL_ID}`)
  if (list.ok) pass('A-1 Sessions list read', 'ok')
  else fail('A-1 Sessions list read', `status=${list.status} ${JSON.stringify(list.data).slice(0, 200)}`)

  // A-2: stats
  const stats = await api('GET', `/attendance/stats?schoolId=${SCHOOL_ID}`)
  if (stats.ok) pass('A-2 Attendance stats read', 'ok')
  else fail('A-2 Attendance stats read', `status=${stats.status} ${JSON.stringify(stats.data).slice(0, 200)}`)

  // A-3: student-search
  const search = await api('GET', `/attendance/student-search?schoolId=${SCHOOL_ID}&q=${encodeURIComponent(fx.firstStudent?.firstName ?? '')}`)
  if (search.ok) pass('A-3 Student search read', 'ok')
  else fail('A-3 Student search read', `status=${search.status} ${JSON.stringify(search.data).slice(0, 200)}`)

  // A-4: level-stats
  const lvlStats = await api('GET', `/attendance/level-stats?schoolId=${SCHOOL_ID}`)
  if (lvlStats.ok) pass('A-4 Level stats read', 'ok')
  else fail('A-4 Level stats read', `status=${lvlStats.status} ${JSON.stringify(lvlStats.data).slice(0, 200)}`)

  // A-5: group-stats
  const grpStats = await api('GET', `/attendance/group-stats?schoolId=${SCHOOL_ID}`)
  if (grpStats.ok) pass('A-5 Group stats read', 'ok')
  else fail('A-5 Group stats read', `status=${grpStats.status} ${JSON.stringify(grpStats.data).slice(0, 200)}`)

  const group = fx.group
  const level = fx.level
  if (!group || !level) {
    fail('A-6 Create session', `group=${group?.id} level=${level?.id} — missing fixtures`)
  } else {
    // T16: create session
    const session = await api('POST', '/attendance/sessions', {
      servantId: fx.ownerId || null,
      levelId: level.id,
      groupId: group.id,
      scheduledDate: '2026-08-01',
      scheduledTime: '10:00',
      status: 'scheduled',
      schoolId: SCHOOL_ID,
    })
    let sessionId = session.data?.id ?? session.data?.session?.id ?? null
    if (session.ok && sessionId) {
      track(sessionId, `QA attendance session`)
      fx.qaSessionId = sessionId
      pass('T16 Create session', `id=${sessionId}`)

      // T17: mark attendance
      const students = fx.students.slice(0, 3)
      if (students.length > 0) {
        const records = students.map((s, i) => ({
          studentId: s.id, status: i === 0 ? 'present' : i === 1 ? 'late' : 'absent', homeworkStatus: 'not_assigned',
        }))
        const mark = await api('POST', `/attendance/sessions/${sessionId}/mark`, { records, recordedBy: fx.ownerId || null })
        if (mark.ok) pass('T17 Mark attendance', `${records.length} records saved`)
        else fail('T17 Mark attendance', `status=${mark.status} ${JSON.stringify(mark.data).slice(0, 300)}`)
      } else {
        fail('T17 Mark attendance', 'no students in fixtures')
      }

      // T18: read-back session
      const read = await api('GET', `/attendance/sessions/${sessionId}`)
      const rb = read.data?.session ?? read.data ?? null
      if (read.ok && rb?.id) {
        const summary = rb.summary ?? rb.records?.length ?? 'n/a'
        pass('T18 Read-back session', `summary=${JSON.stringify(summary).slice(0, 120)}`)
      } else {
        fail('T18 Read-back session', `status=${read.status} ${JSON.stringify(rb).slice(0, 200)}`)
      }

      // A-6: update session
      const upd = await api('PUT', `/attendance/sessions/${sessionId}`, { status: 'completed', notes: 'QA note' })
      if (upd.ok) pass('A-6 Update session', 'status=completed')
      else fail('A-6 Update session', `status=${upd.status} ${JSON.stringify(upd.data).slice(0, 200)}`)

      // A-7: delete session (last, after reads)
      const del = await api('DELETE', `/attendance/sessions/${sessionId}`)
      if (del.ok) pass('A-7 Delete session', 'deleted')
      else fail('A-7 Delete session', `status=${del.status} ${JSON.stringify(del.data).slice(0, 200)}`)
    } else {
      fail('T16 Create session', `status=${session.status} ${JSON.stringify(session.data).slice(0, 350)}`)
    }
  }

  // A-8: generate sessions
  const gen = await api('POST', `/attendance/sessions/generate?schoolId=${SCHOOL_ID}`)
  if (gen.ok) pass('A-8 Generate sessions', `status=${gen.status} ${JSON.stringify(gen.data).slice(0, 120)}`)
  else fail('A-8 Generate sessions', `status=${gen.status} ${JSON.stringify(gen.data).slice(0, 200)}`)

  // A-9: qr-checkin (needs a student)
  if (fx.firstStudent?.id) {
    const qr = await api('POST', '/attendance/qr-checkin', { studentId: fx.firstStudent.id })
    if (qr.ok) pass('A-9 QR check-in', `status=${qr.status}`)
    else fail('A-9 QR check-in', `status=${qr.status} ${JSON.stringify(qr.data).slice(0, 250)}`)
  } else {
    fail('A-9 QR check-in', 'no student fixture')
  }

  // T19: start-class
  const sc = await api('POST', '/attendance/start-class')
  if (sc.ok) {
    const scData = sc.data
    pass('T19 Start-class auto-detect', `returned=${Array.isArray(scData) ? 'array' : typeof scData === 'object' ? Object.keys(scData).slice(0, 4).join(',') : '?'}`)
  } else {
    fail('T19 Start-class auto-detect', `status=${sc.status} ${JSON.stringify(sc.data).slice(0, 250)}`)
  }

  // A-10: liturgy heatmap
  const heat = await api('GET', `/attendance/liturgy-heatmap?schoolId=${SCHOOL_ID}`)
  if (heat.ok) pass('A-10 Liturgy heatmap read', 'ok')
  else fail('A-10 Liturgy heatmap read', `status=${heat.status} ${JSON.stringify(heat.data).slice(0, 200)}`)

  return {}
}
