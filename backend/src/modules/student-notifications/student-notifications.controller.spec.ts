import { StudentNotificationsController } from './student-notifications.controller';

const prismaMock = {
  student: { findUnique: jest.fn() },
};
const serviceMock = { notify: jest.fn() };

describe('StudentNotificationsController sendNote', () => {
  const controller = new StudentNotificationsController(serviceMock as any, prismaMock as any);
  const servant = { id: 'srv-1', schoolId: 'school-1', roles: ['servant'] };
  const body = { studentId: 'stu-1', title: 'Note from your servant', titleAr: 'ملاحظة من خادمك', body: 'Well done', bodyAr: 'Well done' };

  beforeEach(() => jest.clearAllMocks());

  it('creates a student note via the service', async () => {
    prismaMock.student.findUnique.mockResolvedValue({ schoolId: 'school-1' });
    serviceMock.notify.mockResolvedValue({ id: 'n1' });
    const res: any = await controller.sendNote(servant, body);
    expect(res).toEqual({ id: 'n1' });
    expect(serviceMock.notify).toHaveBeenCalledWith(expect.objectContaining({
      studentId: 'stu-1', type: 'note', title: 'Note from your servant', body: 'Well done',
    }));
  });

  it('rejects empty title/body', async () => {
    await expect(controller.sendNote(servant, { ...body, body: '  ' })).rejects.toMatchObject({ status: 400 });
    expect(serviceMock.notify).not.toHaveBeenCalled();
  });

  it('404s on an unknown student', async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    await expect(controller.sendNote(servant, body)).rejects.toMatchObject({ status: 404 });
    expect(serviceMock.notify).not.toHaveBeenCalled();
  });

  it('refuses a student from another school', async () => {
    prismaMock.student.findUnique.mockResolvedValue({ schoolId: 'other-school' });
    await expect(controller.sendNote(servant, body)).rejects.toMatchObject({ status: 403 });
    expect(serviceMock.notify).not.toHaveBeenCalled();
  });
});
