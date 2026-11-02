import { loadAttendanceTrend } from './attendance-trend';

describe('loadAttendanceTrend', () => {
  const NOW = new Date(2026, 9, 31, 15, 0, 0);

  it('runs a single query over class sessions, decided records and non-deleted students', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await loadAttendanceTrend({ attendanceRecord: { findMany } }, 'school-1', 8, NOW);

    expect(findMany).toHaveBeenCalledTimes(1);
    const { where } = findMany.mock.calls[0][0];
    expect(where.status).toEqual({ in: ['present', 'late', 'absent'] });
    expect(where.student).toEqual({ deletedAt: null });
    expect(where.attendanceSession).toMatchObject({ schoolId: 'school-1', deletedAt: null });
    expect(where.attendanceSession.AND[0]).toMatchObject({ type: 'class' });
  });

  it('looks back exactly the span of the windows', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await loadAttendanceTrend({ attendanceRecord: { findMany } }, 's', 8, NOW);
    const since: Date = findMany.mock.calls[0][0].where.attendanceSession.scheduledDate.gte;
    expect(since.getFullYear()).toBe(2026);
    expect(since.getMonth()).toBe(8); // Sept 6: 55 days before Oct 31
    expect(since.getDate()).toBe(6);
  });

  it('turns the rows into rates, with the newest window last', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { status: 'present', attendanceSession: { scheduledDate: new Date(2026, 9, 28, 10) } },
      { status: 'absent', attendanceSession: { scheduledDate: new Date(2026, 9, 28, 10) } },
      { status: 'present', attendanceSession: { scheduledDate: new Date(2026, 9, 21, 10) } },
    ]);
    const out = await loadAttendanceTrend({ attendanceRecord: { findMany } }, 's', 8, NOW);
    expect(out).toHaveLength(8);
    expect(out[7].rate).toBe(50);
    expect(out[6].rate).toBe(100);
    expect(out[5].rate).toBeNull();
  });
});
