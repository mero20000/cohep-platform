import { GamificationController } from './gamification.controller';

describe('GamificationController.createBadge', () => {
  const createBadge = jest.fn().mockResolvedValue({ id: 'badge-1' });
  const controller = new GamificationController({ createBadge } as any);
  const dto = { name: 'Attendee', schoolId: 'school-B' } as any;

  beforeEach(() => createBadge.mockClear());

  it('ignores a body school for a servant and uses their own', async () => {
    const req = { user: { schoolId: 'school-A', roles: ['servant'] } };

    await controller.createBadge(req, 'school-A', dto);

    expect(createBadge).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 'school-A' }));
  });

  it('lets a super admin choose the school', async () => {
    const req = { user: { schoolId: 'school-A', roles: ['super_admin'] } };

    await controller.createBadge(req, '', dto);

    expect(createBadge).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 'school-B' }));
  });
});
