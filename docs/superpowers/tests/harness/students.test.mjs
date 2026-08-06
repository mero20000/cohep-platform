// Students module tests — create, read, update, groups CRUD, bulk import/update/delete, soft delete
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()
  const tsSuffix = String(ts).slice(-6)
  const P = `QA-T1-Peter-${ts}`
  const results = {}
  let sid = null

  // S1: stats read
  const stats = await api('GET', `/students/stats?schoolId=${SCHOOL_ID}`)
  if (stats.ok) pass('S1 Student stats read', `keys=${Object.keys(stats.data ?? {}).slice(0, 6).join(',')}`)
  else fail('S1 Student stats read', `status=${stats.status} ${JSON.stringify(stats.data).slice(0, 200)}`)

  // S2: levels/all
  const levelsAll = await api('GET', `/students/levels/all?schoolId=${SCHOOL_ID}`)
  if (levelsAll.ok) pass('S2 Students levels/all read', `count=${Array.isArray(levelsAll.data) ? levelsAll.data.length : Array.isArray(levelsAll.data?.levels) ? levelsAll.data.levels.length : '?'}`)
  else fail('S2 Students levels/all read', `status=${levelsAll.status} ${JSON.stringify(levelsAll.data).slice(0, 200)}`)

  // S3: create group
  const groupName = `QA-Group-${tsSuffix}`
  const grp = await api('POST', `/students/groups?schoolId=${SCHOOL_ID}`, { name: groupName, nameAr: `مجموعة QA-${tsSuffix}` })
  const groupId = grp.data?.id ?? grp.data?.group?.id ?? null
  if (grp.ok && groupId) {
    track(groupId, `QA student group`)
    pass('S3 Create group', `id=${groupId}`)

    // S4: update group
    const gupd = await api('PATCH', `/students/groups/${groupId}`, { description: 'QA test group' })
    if (gupd.ok) pass('S4 Update group', 'description set')
    else fail('S4 Update group', `status=${gupd.status} ${JSON.stringify(gupd.data).slice(0, 200)}`)

    // S5: delete group (do NOT touch seed groups)
    const gdel = await api('DELETE', `/students/groups/${groupId}`)
    if (gdel.ok) pass('S5 Delete group', 'deleted')
    else fail('S5 Delete group', `status=${gdel.status} ${JSON.stringify(gdel.data).slice(0, 200)}`)
  } else {
    fail('S3 Create group', `status=${grp.status} ${JSON.stringify(grp.data).slice(0, 250)}`)
  }

  // S6: bulk import (2 students) — needs level + group; reuse fixtures
  if (fx.level?.id && fx.group?.id) {
    const bulk = await api('POST', `/students/bulk?schoolId=${SCHOOL_ID}`, {
      students: [
        { firstName: 'QA-Bulk1', lastName: `Imp-${tsSuffix}`, dateOfBirth: '2013-01-01', gender: 'male', levelId: fx.level.id, groupId: fx.group.id },
        { firstName: 'QA-Bulk2', lastName: `Imp-${tsSuffix}`, dateOfBirth: '2014-02-02', gender: 'female', levelId: fx.level.id, groupId: fx.group.id },
      ],
    })
    const bulkIds = (bulk.data?.students ?? bulk.data ?? []).filter(s => s?.id).map(s => s.id)
    if (bulk.ok && bulkIds.length > 0) {
      bulkIds.forEach(id => track(id, `QA bulk-import student`))
      pass('S6 Bulk import students', `${bulkIds.length} created`)
      results.bulkIds = bulkIds

      // S7: bulk update (nested { ids, data } shape)
      const bupd = await api('PATCH', `/students/bulk?schoolId=${SCHOOL_ID}`, { ids: bulkIds, data: { schoolGrade: 'QA-bulk-grade' } })
      if (bupd.ok) pass('S7 Bulk update students', `${bulkIds.length} updated`)
      else fail('S7 Bulk update students', `status=${bupd.status} ${JSON.stringify(bupd.data).slice(0, 250)}`)
    } else {
      fail('S6 Bulk import students', `status=${bulk.status} ${JSON.stringify(bulk.data).slice(0, 250)}`)
    }
  } else {
    fail('S6/S7 Bulk flows', 'missing level/group fixtures')
  }

  // T1: create student
  const create = await api('POST', `/students?schoolId=${SCHOOL_ID}`, {
    firstName: 'Peter', lastName: `Test-${ts}`,
    firstNameAr: 'بيتر', lastNameAr: `تست-${ts}`,
    dateOfBirth: '2014-05-10', gender: 'male',
    levelId: fx.level?.id, groupId: fx.group?.id,
    parentEmail: `qa-parent-${ts}@example.com`,
    phone: '+1555000' + String(ts % 10000),
    status: 'active',
  })
  if (create.ok && create.data?.id) {
    sid = create.data.id
    track(sid, `QA student ${P}`)
    results.studentId = sid
    const code = create.data.studentCode ?? create.data.code ?? null
    if (code) {
      track(code, `QA student code for ${P}`)
      results.studentCode = code
      fx.qaStudentCode = code
    }
    pass('T1 Create student', `id=${sid} code=${code ?? 'none'}`)
    console.log('     → response:', JSON.stringify(create.data).slice(0, 400))

    // T4a: read-back
    const read = await api('GET', `/students/${sid}?schoolId=${SCHOOL_ID}`)
    const rb = read.data?.student ?? read.data ?? read.data?.data ?? null
    const persisted = rb && (rb.firstName === 'Peter' || rb.firstNameAr === 'بيتر')
    if (read.ok && persisted) pass('T4a Read-back student', `firstName=${rb.firstName} level=${rb.level?.number ?? 'n/a'}`)
    else fail('T4a Read-back student', `status=${read.status} data=${JSON.stringify(rb).slice(0, 200)}`)

    // T4b: update student
    const upd = await api('PUT', `/students/${sid}?schoolId=${SCHOOL_ID}`, { schoolGrade: 'QA-grade' })
    if (upd.ok) pass('T4b Update student', 'schoolGrade set')
    else fail('T4b Update student', `status=${upd.status} ${JSON.stringify(upd.data).slice(0, 200)}`)

    // T4c: attendance read
    const att = await api('GET', `/students/${sid}/attendance?schoolId=${SCHOOL_ID}`)
    if (att.ok) pass('T4c Student attendance read', 'ok (may be empty)')
    else fail('T4c Student attendance read', `status=${att.status}`)

    // T4d: progress read
    const prog = await api('GET', `/students/${sid}/progress?schoolId=${SCHOOL_ID}`)
    if (prog.ok) pass('T4d Student progress read', 'ok (may be empty)')
    else fail('T4d Student progress read', `status=${prog.status}`)

    // T4e: activity log read
    const act = await api('GET', `/students/${sid}/activity`)
    if (act.ok) pass('T4e Student activity read', 'ok')
    else fail('T4e Student activity read', `status=${act.status} ${JSON.stringify(act.data).slice(0, 150)}`)
  } else {
    fail('T1 Create student', `status=${create.status} ${JSON.stringify(create.data).slice(0, 300)}`)
    results.createFailed = true
  }

  // S8: bulk-delete created bulk students (do it here to keep cleanup simple)
  if (results.bulkIds?.length) {
    const bdel = await api('POST', `/students/bulk-delete?schoolId=${SCHOOL_ID}`, { ids: results.bulkIds })
    if (bdel.ok) pass('S8 Bulk delete students', `${results.bulkIds.length} deleted`)
    else fail('S8 Bulk delete students', `status=${bdel.status} ${JSON.stringify(bdel.data).slice(0, 250)}`)
  }

  // T5: soft delete primary QA student LAST so other modules can use it
  if (sid) {
    results.pendingDelete = sid
    fx.qaStudentId = sid
  }
  return results
}
