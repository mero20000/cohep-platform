import { ServantsController } from './servants.controller';

const prismaMock = {
  student: { findMany: jest.fn(), findFirst: jest.fn() },
  attendanceSession: { findFirst: jest.fn() },
  attendanceRecord: { findMany: jest.fn(), update: jest.fn(), create: jest.fn() },
  user: { findUnique: jest.fn(), update: jest.fn() },
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

describe('recordLiturgyAttendance', () => {
  const controller = new ServantsController({} as any, prismaMock as any);
  const user = { id: 'u1', schoolId: 's1', metadata: { groupId: 'g1', levelId: 'l1' } };

  beforeEach(() => jest.clearAllMocks());

  it('updates existing records instead of duplicating on re-save', async () => {
    prismaMock.student.findFirst.mockResolvedValue({ levelId: 'l1' });
    prismaMock.attendanceSession.findFirst.mockResolvedValue({ id: 'sess-1' });
    prismaMock.attendanceRecord.findMany.mockResolvedValue([
      { id: 'rec-1', studentId: 'stu-1', status: 'absent' },
    ]);
    prismaMock.attendanceRecord.update = jest.fn().mockResolvedValue({ id: 'rec-1' });
    prismaMock.attendanceRecord.create = jest.fn().mockResolvedValue({ id: 'rec-2' });
    const res: any = await controller.recordLiturgyAttendance(user, {
      date: '2026-08-30',
      records: [{ studentId: 'stu-1', status: 'present' }],
    });
    expect(res.recorded).toBe(1);
    expect(prismaMock.attendanceRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rec-1' } }),
    );
    expect(prismaMock.attendanceRecord.create).not.toHaveBeenCalled();
  });

  it('rejects future dates', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    await expect(
      controller.recordLiturgyAttendance(user, { date: tomorrow, records: [] }),
    ).rejects.toThrow();
  });
});

describe('toggleActive', () => {
  const controller = new ServantsController({} as any, prismaMock as any);
  const admin = { id: 'a1', schoolId: 's1', roles: ['admin'] };

  beforeEach(() => jest.clearAllMocks());

  it('toggles inactive to active', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', isActive: false, firstName: 'John', lastName: 'Doe', deletedAt: null });
    prismaMock.user.update.mockResolvedValue({ id: 'u1', isActive: true, firstName: 'John', lastName: 'Doe' });
    const res: any = await controller.toggleActive('u1');
    expect(res.isActive).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: { isActive: true } }),
    );
  });

  it('toggles active to inactive', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, firstName: 'John', lastName: 'Doe', deletedAt: null });
    prismaMock.user.update.mockResolvedValue({ id: 'u1', isActive: false, firstName: 'John', lastName: 'Doe' });
    const res: any = await controller.toggleActive('u1');
    expect(res.isActive).toBe(false);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: { isActive: false } }),
    );
  });

  it('rejects missing servant', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(controller.toggleActive('nope')).rejects.toThrow();
  });
});
