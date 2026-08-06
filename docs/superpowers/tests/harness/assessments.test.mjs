// Assessments module tests — full CRUD + assign/unassign/reassess/mark/submit/stats
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()
  const tsSuffix = String(ts).slice(-6)

  // AS-1: list + stats
  const list = await api('GET', `/assessments?schoolId=${SCHOOL_ID}`)
  if (list.ok) pass('AS-1 Assessments list read', 'ok')
  else fail('AS-1 Assessments list read', `status=${list.status} ${JSON.stringify(list.data).slice(0, 200)}`)

  const stats = await api('GET', `/assessments/stats?schoolId=${SCHOOL_ID}`)
  if (stats.ok) pass('AS-2 Assessments stats read', 'ok')
  else fail('AS-2 Assessments stats read', `status=${stats.status} ${JSON.stringify(stats.data).slice(0, 200)}`)

  const level = fx.level
  const subject = fx.subject
  if (!level || !subject) {
    fail('AS-3 Create assessment', 'missing level/subject fixtures')
    return {}
  }

  // T20: create assessment
  const assessment = await api('POST', `/assessments?schoolId=${SCHOOL_ID}`, {
    title: `QA-Assessment-${tsSuffix}`, description: 'QA test assessment',
    levelId: level.id, subjectId: subject.id,
    totalPoints: 10, passingPoints: 6, term: 1, status: 'published',
    questions: [
      { text: 'QA Question 1', type: 'multiple_choice', options: ['A', 'B', 'C'], correctAnswer: 'A', points: 5, orderIndex: 1 },
      { text: 'QA Question 2', type: 'true_false', correctAnswer: 'true', points: 5, orderIndex: 2 },
    ],
  })
  const assessmentId = assessment.data?.id ?? assessment.data?.assessment?.id ?? null
  if (assessment.ok && assessmentId) {
    track(assessmentId, `QA assessment`)
    fx.qaAssessmentId = assessmentId
    pass('T20 Create assessment', `id=${assessmentId}`)

    // AS-3: read-back single
    const get = await api('GET', `/assessments/${assessmentId}`)
    if (get.ok && (get.data?.id || get.data?.assessment?.id)) pass('AS-3 Read-back assessment', 'ok')
    else fail('AS-3 Read-back assessment', `status=${get.status} ${JSON.stringify(get.data).slice(0, 200)}`)

    const student = fx.firstStudent
    if (student) {
      // T21: submit
      const questions = assessment.data?.questions ?? assessment.data?.assessment?.questions ?? null
      const qid = Array.isArray(questions) ? questions[0]?.id : null
      const submit = await api('POST', `/assessments/${assessmentId}/submit?studentId=${student.id}`, {
        answers: qid ? [{ questionId: qid, answer: 'A' }] : [],
      })
      if (submit.ok) pass('T21 Submit assessment', `student=${student.id}`)
      else fail('T21 Submit assessment', `status=${submit.status} ${JSON.stringify(submit.data).slice(0, 300)}`)

      // T22: assign
      const assign = await api('POST', `/assessments/${assessmentId}/assign`, { studentIds: [student.id] })
      if (assign.ok) pass('T22 Assign student', `student=${student.id}`)
      else fail('T22 Assign student', `status=${assign.status} ${JSON.stringify(assign.data).slice(0, 250)}`)

      // T23: mark
      const mark = await api('POST', `/assessments/${assessmentId}/students/${student.id}/mark`, { score: 8, maxScore: 10, feedback: 'QA feedback' })
      if (mark.ok) pass('T23 Mark submission', 'score=8/10')
      else fail('T23 Mark submission', `status=${mark.status} ${JSON.stringify(mark.data).slice(0, 300)}`)

      // AS-4: reassess (re-open)
      const reassess = await api('POST', `/assessments/${assessmentId}/students/${student.id}/reassess`)
      if (reassess.ok) pass('AS-4 Reassess student', 'submission reopened')
      else fail('AS-4 Reassess student', `status=${reassess.status} ${JSON.stringify(reassess.data).slice(0, 250)}`)

      // AS-5: unassign
      const unassign = await api('DELETE', `/assessments/${assessmentId}/students/${student.id}`)
      if (unassign.ok) pass('AS-5 Unassign student', 'removed')
      else fail('AS-5 Unassign student', `status=${unassign.status} ${JSON.stringify(unassign.data).slice(0, 250)}`)
    } else {
      fail('AS-4/AS-5/T21/T22/T23 flows', 'no student fixture available')
    }

    // submissions + students lists
    const subs = await api('GET', `/assessments/${assessmentId}/submissions`)
    if (subs.ok) pass('Assessment submissions list read', 'ok')
    else fail('Assessment submissions list read', `status=${subs.status}`)

    const studs = await api('GET', `/assessments/${assessmentId}/students`)
    if (studs.ok) pass('Assessment students list read', 'ok')
    else fail('Assessment students list read', `status=${studs.status}`)

    // AS-6: update assessment — NOTE: UpdateAssessmentDto requires totalPoints/passingPoints
    // (not @IsOptional) so a truly partial update (description only) → 400. Sending full
    // numeric fields validates the update path works when they are provided.
    const upd = await api('PUT', `/assessments/${assessmentId}`, {
      description: 'QA updated assessment',
      totalPoints: 10,
      passingPoints: 6,
    })
    if (upd.ok) pass('AS-6 Update assessment', 'description set (with required numeric fields)')
    else fail('AS-6 Update assessment', `status=${upd.status} ${JSON.stringify(upd.data).slice(0, 200)}`)
  } else {
    fail('T20 Create assessment', `status=${assessment.status} ${JSON.stringify(assessment.data).slice(0, 400)}`)
  }

  return { assessmentId }
}
