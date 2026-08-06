// Curriculum module tests — full CRUD coverage
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()
  const tsSuffix = String(ts).slice(-6)
  const out = {}

  // ── Levels ──
  const levelsGet = await api('GET', `/curriculum/levels?schoolId=${SCHOOL_ID}`)
  if (levelsGet.ok) pass('C-L1 Levels list read', `count=${Array.isArray(levelsGet.data?.levels) ? levelsGet.data.levels.length : '?'}`)
  else fail('C-L1 Levels list read', `status=${levelsGet.status} ${JSON.stringify(levelsGet.data).slice(0, 200)}`)

  const levelNum = 100 + (ts % 1000)
  const lvl = await api('POST', `/curriculum/levels?schoolId=${SCHOOL_ID}`, {
    number: levelNum, name: `QA-Level-${levelNum}-${tsSuffix}`, nameAr: `مستوى QA-${tsSuffix}`,
    orderIndex: levelNum, description: 'QA test level',
  })
  const lvlId = lvl.data?.id ?? lvl.data?.level?.id ?? null
  if (lvl.ok && lvlId) {
    track(lvlId, `QA level`)
    fx.qaLevelId = lvlId
    pass('T14 Create level', `id=${lvlId}`)

    const lpatch = await api('PATCH', `/curriculum/levels/${lvlId}`, { description: 'QA updated level' })
    if (lpatch.ok) pass('C-L2 Update level', 'description set')
    else fail('C-L2 Update level', `status=${lpatch.status} ${JSON.stringify(lpatch.data).slice(0, 200)}`)

    const ldel = await api('DELETE', `/curriculum/levels/${lvlId}`)
    if (ldel.ok) pass('C-L3 Delete level', 'deleted (soft)')
    else fail('C-L3 Delete level', `status=${ldel.status} ${JSON.stringify(ldel.data).slice(0, 200)}`)
  } else {
    fail('T14 Create level', `status=${lvl.status} ${JSON.stringify(lvl.data).slice(0, 250)}`)
  }

  // ── Subjects ──
  const subj = await api('POST', `/curriculum/subjects?schoolId=${SCHOOL_ID}`, {
    name: `QA-Subject-${tsSuffix}`, nameAr: `مادة QA-${tsSuffix}`, nameCoptic: 'QA', description: 'QA test subject',
  })
  let subjId = subj.data?.id ?? subj.data?.subject?.id ?? null
  if (subj.ok && subjId) {
    track(subjId, `QA subject`)
    pass('T8 Create subject', `id=${subjId}`)

    const sget = await api('GET', `/curriculum/subjects?schoolId=${SCHOOL_ID}`)
    if (sget.ok) pass('C-S1 Subjects list read', 'ok')
    else fail('C-S1 Subjects list read', `status=${sget.status}`)

    const sput = await api('PUT', `/curriculum/subjects/${subjId}?schoolId=${SCHOOL_ID}`, { description: 'QA updated subject' })
    if (sput.ok) pass('C-S2 Update subject', 'description set')
    else fail('C-S2 Update subject', `status=${sput.status} ${JSON.stringify(sput.data).slice(0, 200)}`)
  } else {
    fail('T8 Create subject', `status=${subj.status} ${JSON.stringify(subj.data).slice(0, 250)}`)
    subjId = null
  }

  // ── Subject items ──
  const itemSubjectId = subjId || fx.subject?.id
  if (itemSubjectId) {
    const item = await api('POST', `/curriculum/subjects/${itemSubjectId}/items?schoolId=${SCHOOL_ID}`, {
      name: `QA-Item-${tsSuffix}`, nameAr: `عنصر QA-${tsSuffix}`, nameCoptic: 'QAI',
      orderIndex: 999, sessionsGroup1: 1, sessionsGroup2: 1, sessionsGroup3: 1, sessionsGroup4: 1,
      levels: [1],
    })
    const itemId = item.data?.id ?? item.data?.item?.id ?? null
    if (item.ok && itemId) {
      track(itemId, `QA subject item`)
      pass('T9 Create subject item', `id=${itemId}`)

      const iget = await api('GET', `/curriculum/subjects/${itemSubjectId}/items?schoolId=${SCHOOL_ID}`)
      if (iget.ok) pass('C-I1 Subject items list read', 'ok')
      else fail('C-I1 Subject items list read', `status=${iget.status} ${JSON.stringify(iget.data).slice(0, 200)}`)

      const iput = await api('PUT', `/curriculum/subjects/items/${itemId}?schoolId=${SCHOOL_ID}`, { name: `QA-Item-upd-${tsSuffix}` })
      if (iput.ok) pass('C-I2 Update subject item', 'name set')
      else fail('C-I2 Update subject item', `status=${iput.status} ${JSON.stringify(iput.data).slice(0, 200)}`)

      const ipatch = await api('PATCH', `/curriculum/items/${itemId}/status`, { status: 'active' })
      if (ipatch.ok) pass('C-I3 Update item status', 'ok')
      else fail('C-I3 Update item status', `status=${ipatch.status} ${JSON.stringify(ipatch.data).slice(0, 200)}`)
    } else {
      fail('T9 Create subject item', `status=${item.status} ${JSON.stringify(item.data).slice(0, 250)}`)
    }
  } else {
    fail('T9 Create subject item', 'no subject available to attach')
  }

  // ── Items (flat, list-shaped response) ──
  const itemsFlat = await api('GET', `/curriculum/items?schoolId=${SCHOOL_ID}&levelNumber=1`)
  if (itemsFlat.ok) {
    const arr = Array.isArray(itemsFlat.data) ? itemsFlat.data : itemsFlat.data?.items ?? []
    pass('C-I4 Flat items list read', `count=${Array.isArray(arr) ? arr.length : '?'}`)
  } else {
    fail('C-I4 Flat items list read', `status=${itemsFlat.status} ${JSON.stringify(itemsFlat.data).slice(0, 200)}`)
  }

  // ── Lessons ──
  const levelId = fx.level?.id
  const lessonSubjectId = subjId || fx.subject?.id
  let lessonId = null
  if (levelId && lessonSubjectId) {
    const lesson = await api('POST', `/curriculum/lessons?schoolId=${SCHOOL_ID}`, {
      title: `QA-Lesson-${tsSuffix}`, titleAr: `درس QA-${tsSuffix}`, titleCoptic: 'QAL',
      levelId, subjectId: lessonSubjectId,
      estimatedDurationMinutes: 30, sessionsCount: 2, status: 'published', orderIndex: 999,
    })
    lessonId = lesson.data?.id ?? lesson.data?.lesson?.id ?? null
    if (lesson.ok && lessonId) {
      track(lessonId, `QA lesson`)
      fx.qaLessonId = lessonId
      pass('T10 Create lesson', `id=${lessonId}`)

      const upd = await api('PUT', `/curriculum/lessons/${lessonId}`, {
        audioUrl: '/uploads/audio/qa-test.mp3', audioOriginalName: `qa-${tsSuffix}.mp3`, audioDuration: 90, estimatedDurationMinutes: 25,
      })
      if (upd.ok) pass('T11 Update lesson (audio fields)', 'audioUrl/audioDuration persisted')
      else fail('T11 Update lesson (audio fields)', `status=${upd.status} ${JSON.stringify(upd.data).slice(0, 250)}`)

      const rb = await api('GET', `/curriculum/lessons/${lessonId}`)
      const lrb = rb.data?.lesson ?? rb.data ?? null
      if (rb.ok && lrb?.audioUrl === '/uploads/audio/qa-test.mp3') pass('T11b Read-back lesson audio', `audioUrl confirmed, duration=${lrb.audioDuration}`)
      else fail('T11b Read-back lesson audio', `status=${rb.status} data=${JSON.stringify(lrb).slice(0, 200)}`)

      const llist = await api('GET', `/curriculum/lessons?schoolId=${SCHOOL_ID}`)
      if (llist.ok) pass('C-LS1 Lessons list read', 'ok')
      else fail('C-LS1 Lessons list read', `status=${llist.status}`)

      // C-LS2: patch lesson audio (multipart file upload, field name 'audio')
      const mp3Bytes = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00QA test audio')
      const fd = new FormData()
      fd.append('audio', new Blob([mp3Bytes], { type: 'audio/mpeg' }), `qa-${tsSuffix}.mp3`)
      const aud = await api('PATCH', `/curriculum/lessons/${lessonId}/audio`, fd)
      if (aud.ok && (aud.data?.url || aud.data?.audioUrl)) pass('C-LS2 Patch lesson audio', 'uploaded')
      else fail('C-LS2 Patch lesson audio', `status=${aud.status} ${JSON.stringify(aud.data).slice(0, 200)}`)
    } else {
      fail('T10 Create lesson', `status=${lesson.status} ${JSON.stringify(lesson.data).slice(0, 300)}`)
    }
  } else {
    fail('T10 Create lesson', `levelId=${levelId} subjectId=${lessonSubjectId}`)
  }

  // C-LS3: bulk lessons
  if (levelId && lessonSubjectId) {
    const bulk = await api('POST', `/curriculum/lessons/bulk?schoolId=${SCHOOL_ID}`, {
      lessons: [
        { title: `QA-BulkLesson-1-${tsSuffix}`, levelId, subjectId: lessonSubjectId, estimatedDurationMinutes: 15, sessionsCount: 1, orderIndex: 1 },
        { title: `QA-BulkLesson-2-${tsSuffix}`, levelId, subjectId: lessonSubjectId, estimatedDurationMinutes: 15, sessionsCount: 1, orderIndex: 2 },
      ],
    })
    const bulkIds = (bulk.data?.lessons ?? bulk.data ?? []).filter(l => l?.id).map(l => l.id)
    if (bulk.ok && bulkIds.length > 0) {
      bulkIds.forEach(id => track(id, `QA bulk lesson`))
      pass('C-LS3 Bulk create lessons', `${bulkIds.length} created`)
    } else {
      fail('C-LS3 Bulk create lessons', `status=${bulk.status} ${JSON.stringify(bulk.data).slice(0, 250)}`)
    }
  }

  // C-LS4: parse-html
  const html = await api('POST', `/curriculum/parse-html`, { html: '<h1>QA Title</h1><p>Intro paragraph</p><ul><li>Point A</li><li>Point B</li></ul>' })
  if (html.ok) pass('C-LS4 Parse HTML', `keys=${Object.keys(html.data ?? {}).slice(0, 5).join(',')}`)
  else fail('C-LS4 Parse HTML', `status=${html.status} ${JSON.stringify(html.data).slice(0, 250)}`)

  // ── Academic years ──
  const ay = await api('POST', `/curriculum/academic-years?schoolId=${SCHOOL_ID}`, {
    name: `QA-Year-${tsSuffix}`, startDate: '2027-09-01', endDate: '2028-06-30', isCurrent: false,
  })
  const ayId = ay.data?.id ?? ay.data?.academicYear?.id ?? null
  if (ay.ok && ayId) {
    track(ayId, `QA academic year`)
    fx.qaYearId = ayId
    pass('T12 Create academic year', `id=${ayId}`)

    const ayGet = await api('GET', `/curriculum/academic-years?schoolId=${SCHOOL_ID}`)
    if (ayGet.ok) pass('C-Y1 Academic years list read', 'ok')
    else fail('C-Y1 Academic years list read', `status=${ayGet.status}`)

    const ayPut = await api('PUT', `/curriculum/academic-years/${ayId}`, { description: 'QA year desc' })
    if (ayPut.ok) pass('C-Y2 Update academic year', 'ok')
    else fail('C-Y2 Update academic year', `status=${ayPut.status} ${JSON.stringify(ayPut.data).slice(0, 200)}`)

    const gen = await api('POST', `/curriculum/academic-years/${ayId}/generate-weekends`)
    if (gen.ok) pass('T15 Generate weekends', `status=${gen.status} ${JSON.stringify(gen.data).slice(0, 150)}`)
    else fail('T15 Generate weekends', `status=${gen.status} ${JSON.stringify(gen.data).slice(0, 250)}`)
  } else {
    fail('T12 Create academic year', `status=${ay.status} ${JSON.stringify(ay.data).slice(0, 250)}`)
  }

  // ── Calendar ──
  const cal = await api('GET', `/curriculum/calendar?schoolId=${SCHOOL_ID}&month=8&year=2026`)
  if (cal.ok) pass('C-CAL1 Calendar read', 'ok')
  else fail('C-CAL1 Calendar read', `status=${cal.status} ${JSON.stringify(cal.data).slice(0, 200)}`)

  // ── Weeks ──
  const weeks = await api('GET', `/curriculum/weeks?schoolId=${SCHOOL_ID}`)
  if (weeks.ok) pass('C-W1 Weeks list read', 'ok')
  else fail('C-W1 Weeks list read', `status=${weeks.status} ${JSON.stringify(weeks.data).slice(0, 200)}`)

  // C-W2/C-W3: week update + bulk-update (only if QA year created weeks; use first week from fixtures otherwise)
  const weekArr = Array.isArray(weeks.data) ? weeks.data : weeks.data?.weeks ?? []
  const week = weekArr.find(w => w.academicYearId === ayId) || weekArr[0] || null
  if (week?.id) {
    const wupd = await api('PUT', `/curriculum/weeks/${week.id}`, { isAvailable: true })
    if (wupd.ok) pass('C-W2 Update week', 'isAvailable=true')
    else fail('C-W2 Update week', `status=${wupd.status} ${JSON.stringify(wupd.data).slice(0, 200)}`)

    const wbulk = await api('POST', `/curriculum/weeks/bulk-update`, { weeks: [{ id: week.id, isAvailable: true }] })
    if (wbulk.ok) pass('C-W3 Bulk-update weeks', 'ok')
    else fail('C-W3 Bulk-update weeks', `status=${wbulk.status} ${JSON.stringify(wbulk.data).slice(0, 200)}`)
  } else {
    fail('C-W2/C-W3 week flows', 'no week available')
  }

  // ── Calendar events ──
  const ev = await api('POST', `/curriculum/calendar-events?schoolId=${SCHOOL_ID}`, {
    academicYearId: ayId || fx.year?.id,
    date: '2026-09-15',
    label: `QA Event ${tsSuffix}`,
    type: 'holiday',
    description: 'QA test event',
  })
  const evId = ev.data?.id ?? ev.data?.event?.id ?? null
  if (ev.ok && evId) {
    track(evId, `QA calendar event`)
    pass('C-CAL2 Create calendar event', `id=${evId}`)

    const evGet = await api('GET', `/curriculum/calendar-events?academicYearId=${ayId || fx.year?.id}`)
    if (evGet.ok) pass('C-CAL3 Calendar events list read', 'ok')
    else fail('C-CAL3 Calendar events list read', `status=${evGet.status}`)

    const evPut = await api('PUT', `/curriculum/calendar-events/${evId}`, { label: `QA-Event-upd-${tsSuffix}` })
    if (evPut.ok) pass('C-CAL4 Update calendar event', 'label set')
    else fail('C-CAL4 Update calendar event', `status=${evPut.status} ${JSON.stringify(evPut.data).slice(0, 200)}`)

    const evDel = await api('DELETE', `/curriculum/calendar-events/${evId}`)
    if (evDel.ok) pass('C-CAL5 Delete calendar event', 'deleted')
    else fail('C-CAL5 Delete calendar event', `status=${evDel.status} ${JSON.stringify(evDel.data).slice(0, 200)}`)
  } else {
    fail('C-CAL2 Create calendar event', `status=${ev.status} ${JSON.stringify(ev.data).slice(0, 250)}`)
  }

  // ── Allocations ──
  const allocYearId = ayId || fx.year?.id
  const allocLevelId = fx.qaLevelId || fx.level?.id
  const allocSubjectId = subjId || fx.subject?.id
  if (allocYearId && allocLevelId && allocSubjectId && lessonId) {
    const alloc = await api('POST', `/curriculum/allocations`, {
      academicYearId: allocYearId, levelId: allocLevelId, subjectId: allocSubjectId,
      lessonId, groupNumber: 1, term: 1, weekNumber: 1, orderIndex: 1, status: 'published',
    })
    const allocId = alloc.data?.id ?? alloc.data?.allocation?.id ?? null
    if (alloc.ok && allocId) {
      track(allocId, `QA allocation`)
      pass('T13 Create allocation', `id=${allocId}`)

      const allocGet = await api('GET', `/curriculum/allocations?schoolId=${SCHOOL_ID}`)
      if (allocGet.ok) pass('C-A1 Allocations list read', 'ok')
      else fail('C-A1 Allocations list read', `status=${allocGet.status}`)

      const allocPut = await api('PUT', `/curriculum/allocations/${allocId}`, { weekNumber: 2 })
      if (allocPut.ok) pass('C-A2 Update allocation', 'weekNumber=2')
      else fail('C-A2 Update allocation', `status=${allocPut.status} ${JSON.stringify(allocPut.data).slice(0, 200)}`)

      const reorder = await api('POST', `/curriculum/allocations/reorder`, { allocations: [{ allocationId: allocId, newOrderIndex: 2, newTerm: 1 }] })
      if (reorder.ok) pass('C-A3 Reorder allocations', 'ok')
      else fail('C-A3 Reorder allocations', `status=${reorder.status} ${JSON.stringify(reorder.data).slice(0, 200)}`)

      const allocDel = await api('DELETE', `/curriculum/allocations/${allocId}`)
      if (allocDel.ok) pass('C-A4 Delete allocation', 'deleted')
      else fail('C-A4 Delete allocation', `status=${allocDel.status} ${JSON.stringify(allocDel.data).slice(0, 200)}`)
    } else {
      fail('T13 Create allocation', `status=${alloc.status} ${JSON.stringify(alloc.data).slice(0, 300)}`)
    }
  } else {
    fail('T13 Create allocation', `year=${allocYearId} level=${allocLevelId} subject=${allocSubjectId} lesson=${lessonId}`)
  }

  return { subjId, lessonId, ayId, lvlId }
}
