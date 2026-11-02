import { FakeDb } from './fake-prisma';

/**
 * Two schools. School A has two groups, a student in each, and assessments for each group and for
 * the whole level; school B has one of each. Callers are the five the access tests care about.
 */
const role = (name: string) => [{ role: { name } }];
const user = (id: string, schoolId: string, roles: string[], metadata: any = null) => ({
  id, schoolId, isActive: true, deletedAt: null, metadata,
  userRoles: roles.map((r) => role(r)[0]),
});

export const CALLERS = {
  adminA: { id: 'adminA' },
  servantG1: { id: 'servantG1' },
  servantG2: { id: 'servantG2' },
  servantUnassigned: { id: 'servantUnassigned' },
  adminB: { id: 'adminB' },
  superAdmin: { id: 'superAdmin' },
};
export const STUDENT_USER = { id: 'stuUser' };

export function buildFixture() {
  const db = new FakeDb({
    user: {
      rows: [
        user('adminA', 'A', ['admin']),
        user('servantG1', 'A', ['servant'], { groupId: 'g1', levelId: 'L1' }),
        user('servantG2', 'A', ['servant'], { groupId: 'g2', levelId: 'L1' }),
        user('servantUnassigned', 'A', ['servant'], {}),
        user('adminB', 'B', ['admin']),
        user('superAdmin', 'A', ['super_admin']),
        user('stuUser', 'A', ['student']),
      ],
    },
    student: {
      rows: [
        { id: 's1', schoolId: 'A', levelId: 'L1', groupId: 'g1', gradeId: 'gr1', gender: 'male', deletedAt: null },
        { id: 's2', schoolId: 'A', levelId: 'L1', groupId: 'g2', gradeId: 'gr2', gender: 'female', deletedAt: null },
        { id: 'sB', schoolId: 'B', levelId: 'LB', groupId: 'gB', gradeId: 'grB', gender: 'male', deletedAt: null },
        // a student who is also a user, for the "students dispute only their own" rule
        { id: 'stuUser', schoolId: 'A', levelId: 'L1', groupId: 'g1', gradeId: 'gr1', gender: 'male', deletedAt: null },
        { id: 'sGone', schoolId: 'A', levelId: 'L1', groupId: 'g1', gradeId: 'gr1', gender: 'male', deletedAt: new Date() },
      ],
    },
    submission: {
      relations: { student: { table: 'student', foreignKey: 'studentId' } },
      rows: [
        { id: 'sub1', assessmentId: 'a1', studentId: 's1', assessment: { schoolId: 'A' }, grades: [{ id: 'gr-1', score: 5, maxScore: 10 }] },
        { id: 'sub2', assessmentId: 'a2', studentId: 's2', assessment: { schoolId: 'A' }, grades: [{ id: 'gr-2', score: 5, maxScore: 10 }] },
        { id: 'subB', assessmentId: 'aB', studentId: 'sB', assessment: { schoolId: 'B' }, grades: [{ id: 'gr-B', score: 5, maxScore: 10 }] },
        { id: 'subW1', assessmentId: 'aWide', studentId: 's1', assessment: { schoolId: 'A' }, grades: [] },
        { id: 'subW2', assessmentId: 'aWide', studentId: 's2', assessment: { schoolId: 'A' }, grades: [] },
        { id: 'subOwn', assessmentId: 'a1', studentId: 'stuUser', assessment: { schoolId: 'A' }, grades: [{ id: 'gr-own', score: 5, maxScore: 10 }] },
      ],
    },
    gradeDispute: {
      relations: { submission: { table: 'submission', foreignKey: 'submissionId' } },
      rows: [
        { id: 'd1', schoolId: 'A', submissionId: 'sub1', gradeId: 'gr-1', status: 'pending', submission: { studentId: 's1', student: { id: 's1' }, grades: [{ id: 'gr-1', score: 5, maxScore: 10 }] } },
        { id: 'd2', schoolId: 'A', submissionId: 'sub2', gradeId: 'gr-2', status: 'pending', submission: { studentId: 's2', student: { id: 's2' }, grades: [{ id: 'gr-2', score: 5, maxScore: 10 }] } },
        { id: 'dB', schoolId: 'B', submissionId: 'subB', gradeId: 'gr-B', status: 'pending', submission: { studentId: 'sB', student: { id: 'sB' }, grades: [{ id: 'gr-B', score: 5, maxScore: 10 }] } },
      ],
    },
    schoolGrade: {
      rows: [
        { id: 'gradeG1', schoolId: 'A', groupId: 'g1', deletedAt: null },
        { id: 'gradeG2', schoolId: 'A', groupId: 'g2', deletedAt: null },
        { id: 'gradeB', schoolId: 'B', groupId: 'gB', deletedAt: null },
        { id: 'gradeGone', schoolId: 'A', groupId: 'g1', deletedAt: new Date() },
      ],
    },
    assessment: {
      rows: [
        { id: 'a1', schoolId: 'A', levelId: 'L1', groupId: 'g1', deletedAt: null },
        { id: 'a2', schoolId: 'A', levelId: 'L1', groupId: 'g2', deletedAt: null },
        { id: 'aWide', schoolId: 'A', levelId: 'L1', groupId: null, deletedAt: null },
        { id: 'aB', schoolId: 'B', levelId: 'LB', groupId: 'gB', deletedAt: null },
        { id: 'aGone', schoolId: 'A', levelId: 'L1', groupId: 'g1', deletedAt: new Date() },
      ],
    },
  });
  const prisma: any = {
    user: db.table('user'),
    student: db.table('student'),
    assessment: db.table('assessment'),
    assessmentSubmission: db.table('submission'),
    gradeDispute: db.table('gradeDispute'),
    schoolGrade: db.table('schoolGrade'),
  };
  return { db, prisma };
}
