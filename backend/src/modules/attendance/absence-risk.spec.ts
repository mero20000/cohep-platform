import { AT_RISK_STREAK, findAtRiskStudents, trailingAbsenceStreaks } from './absence-risk';

const rec = (studentId: string, status: string, day: number) => ({
  studentId,
  status,
  sessionDate: new Date(Date.UTC(2026, 9, day)),
});

describe('trailingAbsenceStreaks', () => {
  it('flags a student whose newest three decided records are all absences', () => {
    const out = trailingAbsenceStreaks([rec('a', 'absent', 4), rec('a', 'absent', 11), rec('a', 'absent', 18)]);
    expect(out.get('a')).toBe(3);
  });

  it('reports the full length of a longer run', () => {
    const out = trailingAbsenceStreaks([1, 8, 15, 22, 29].map((d) => rec('a', 'absent', d)));
    expect(out.get('a')).toBe(5);
  });

  it('is not at risk with only two absences', () => {
    expect(trailingAbsenceStreaks([rec('a', 'absent', 4), rec('a', 'absent', 11)]).size).toBe(0);
  });

  it('a present or late record breaks the streak', () => {
    const base = [rec('a', 'absent', 4), rec('a', 'absent', 11), rec('a', 'absent', 18)];
    expect(trailingAbsenceStreaks([...base, rec('a', 'present', 25)]).size).toBe(0);
    expect(trailingAbsenceStreaks([...base, rec('a', 'late', 25)]).size).toBe(0);
  });

  it('only the NEWEST run counts: old absences before a return do not', () => {
    const out = trailingAbsenceStreaks([rec('a', 'absent', 1), rec('a', 'absent', 8), rec('a', 'absent', 15), rec('a', 'present', 22), rec('a', 'absent', 29)]);
    expect(out.size).toBe(0);
  });

  it('ignores excused and unmarked rows: they neither extend nor break a streak', () => {
    const out = trailingAbsenceStreaks([
      rec('a', 'absent', 4), rec('a', 'excused', 8), rec('a', 'absent', 11), rec('a', 'unmarked', 15), rec('a', 'absent', 18),
    ]);
    expect(out.get('a')).toBe(3);
  });

  it('orders by session date, not input order', () => {
    const out = trailingAbsenceStreaks([rec('a', 'present', 4), rec('a', 'absent', 25), rec('a', 'absent', 18), rec('a', 'absent', 11)]);
    expect(out.get('a')).toBe(3);
  });

  it('keeps students separate and honours a custom threshold', () => {
    const records = [rec('a', 'absent', 4), rec('a', 'absent', 11), rec('b', 'absent', 4), rec('b', 'present', 11)];
    expect(trailingAbsenceStreaks(records, 2).get('a')).toBe(2);
    expect(trailingAbsenceStreaks(records, 2).has('b')).toBe(false);
  });

  it('uses the documented threshold by default', () => {
    expect(AT_RISK_STREAK).toBe(3);
  });
});

describe('findAtRiskStudents', () => {
  const NOW = new Date(Date.UTC(2026, 9, 31));

  it('runs ONE query for the whole school, restricted to active students and class sessions', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { studentId: 'a', status: 'absent', attendanceSession: { scheduledDate: new Date(Date.UTC(2026, 9, 25)) } },
      { studentId: 'a', status: 'absent', attendanceSession: { scheduledDate: new Date(Date.UTC(2026, 9, 18)) } },
      { studentId: 'a', status: 'absent', attendanceSession: { scheduledDate: new Date(Date.UTC(2026, 9, 11)) } },
      { studentId: 'b', status: 'present', attendanceSession: { scheduledDate: new Date(Date.UTC(2026, 9, 25)) } },
    ]);
    const out = await findAtRiskStudents({ attendanceRecord: { findMany } }, 'school-1', { now: NOW });

    expect(findMany).toHaveBeenCalledTimes(1);
    const where = findMany.mock.calls[0][0].where;
    expect(where.student).toMatchObject({ schoolId: 'school-1', deletedAt: null, status: 'active' });
    expect(where.status).toEqual({ in: ['present', 'late', 'absent'] });
    expect(where.attendanceSession.AND[0]).toMatchObject({ type: 'class' });
    expect([...out.keys()]).toEqual(['a']);
  });

  it('only looks back a bounded window', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await findAtRiskStudents({ attendanceRecord: { findMany } }, 's', { now: NOW });
    const { gte, lte } = findMany.mock.calls[0][0].where.attendanceSession.scheduledDate;
    expect(lte).toEqual(NOW);
    expect(NOW.getTime() - gte.getTime()).toBe(84 * 24 * 60 * 60 * 1000);
  });
});
