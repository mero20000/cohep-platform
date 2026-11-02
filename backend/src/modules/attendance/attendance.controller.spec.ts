import { AttendanceController } from './attendance.controller';

describe('AttendanceController.resetAutoSeedSuspects', () => {
  const resetSuspectAutoSeeds = jest.fn().mockResolvedValue({ dryRun: true });
  const controller = new AttendanceController({ resetSuspectAutoSeeds } as any);
  const body = { schoolId: 'school-B-uuid', dryRun: false, confirm: true };

  beforeEach(() => resetSuspectAutoSeeds.mockClear());

  it('resets the caller\'s own school, not the one named in the body', async () => {
    const req = { user: { schoolId: 'school-A', roles: ['principal'] } };

    await controller.resetAutoSeedSuspects(body, req);

    expect(resetSuspectAutoSeeds).toHaveBeenCalledWith('school-A', expect.any(Object));
  });

  it('lets a super admin name the school', async () => {
    const req = { user: { schoolId: 'school-A', roles: ['super_admin'] } };

    await controller.resetAutoSeedSuspects(body, req);

    expect(resetSuspectAutoSeeds).toHaveBeenCalledWith('school-B-uuid', expect.any(Object));
  });
});
