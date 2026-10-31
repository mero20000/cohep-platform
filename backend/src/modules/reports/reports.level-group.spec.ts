import { ReportsService } from './reports.service';

describe('ReportsService.getLevelGroupOverview', () => {
  const day = 24 * 60 * 60 * 1000;
  const mk = () => {
    const prisma: any = {
      level: { findMany: jest.fn().mockResolvedValue([{ id: 'L1', name: 'Level 1', nameAr: null, orderIndex: 1 }]) },
      group: { findMany: jest.fn().mockResolvedValue([{ id: 'G1', name: 'A', nameAr: null, orderIndex: 1 }]) },
      student: { findMany: jest.fn().mockResolvedValue([{ id: 's1', levelId: 'L1', groupId: 'G1' }, { id: 's2', levelId: 'L1', groupId: 'G1' }]) },
      attendanceRecord: { findMany: jest.fn() },
      assessmentSubmission: { findMany: jest.fn().mockResolvedValue([
        { studentId: 's1', assessment: { passingScore: 60 }, grades: [{ score: 80 }] },
        { studentId: 's2', assessment: { passingScore: 60 }, grades: [{ score: 40 }] },
      ]) },
    };
    const svc = new ReportsService(prisma, { resolve: jest.fn().mockResolvedValue('school-1') } as any);
    return { prisma, svc };
  };

  it('runs a fixed number of queries and aggregates per level and group', async () => {
    const { prisma, svc } = mk();
    const recent = new Date(Date.now() - 2 * day);
    const older = new Date(Date.now() - 40 * day);
    prisma.attendanceRecord.findMany.mockImplementation(async (args: any) => {
      // the at-risk query bounds scheduledDate with lte AND selects studentId; both queries select studentId
      return [
        { studentId: 's1', status: 'present', attendanceSession: { scheduledDate: recent } },
        { studentId: 's2', status: 'absent', attendanceSession: { scheduledDate: recent } },
        { studentId: 's1', status: 'present', attendanceSession: { scheduledDate: older } },
      ];
    });
    const r = await svc.getLevelGroupOverview('x', 30);
    expect(r.windowDays).toBe(30);
    expect(r.levels[0]).toMatchObject({ students: 2, attendanceRate: 50, prevAttendanceRate: 100, passRate: 50, gradedCount: 2, atRisk: 0 });
    expect(r.groups[0].students).toBe(2);
    // 2 attendance queries (window data + at-risk), no per-student queries
    expect(prisma.attendanceRecord.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.student.findMany).toHaveBeenCalledTimes(1);
  });

  it('clamps the window and tolerates garbage input', async () => {
    const { prisma, svc } = mk();
    prisma.attendanceRecord.findMany.mockResolvedValue([]);
    expect((await svc.getLevelGroupOverview('x', 9999)).windowDays).toBe(180);
    expect((await svc.getLevelGroupOverview('x', 1)).windowDays).toBe(7);
    expect((await svc.getLevelGroupOverview('x', NaN)).windowDays).toBe(30);
  });
});
