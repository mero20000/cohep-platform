import { ServantsController } from './servants.controller';

const prismaMock = {
  student: { findMany: jest.fn(), findFirst: jest.fn() },
  attendanceSession: { findFirst: jest.fn() },
  attendanceRecord: { findMany: jest.fn() },
};

describe('ServantsController liturgy-session', () => {
  const controller = new ServantsController({} as any, prismaMock as any);
  const user = { id: 'u1', schoolId: 's1', metadata: { groupId: 'g1', levelId: 'l1' } };

  beforeEach(() => jest.clearAllMocks());

  it('prefills statuses from the requested date records', async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: 'stu-1', firstName: 'Mina', lastName: 'A', firstNameAr: null, lastNameAr: null, photoUrl: null, grade: null },
    ]);
    prismaMock.attendanceSession.findFirst.mockResolvedValue({ id: 'sess-1' });
    prismaMock.attendanceRecord.findMany.mockResolvedValue([
      { studentId: 'stu-1', status: 'present' },
    ]);
    const res: any = await controller.getLiturgySession(user, '2026-08-30');
    expect(res.students[0].status).toBe('present');
    expect(prismaMock.attendanceSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ notes: 'liturgy' }) }),
    );
  });

  it('rejects future dates', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    await expect(controller.getLiturgySession(user, tomorrow)).rejects.toThrow();
  });
});
