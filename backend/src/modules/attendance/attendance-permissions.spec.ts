import { Actor, canCreateMultiGroup, canCreateType, isAdminActor, isGroupStaffActor, isLevelLeaderActor } from './attendance-permissions';

const actor = (...roles: string[]): Actor => ({ id: 'u', schoolId: 's', roles, metadata: {} });

describe('attendance-permissions', () => {
  it('classifies actors, with admin taking precedence over other roles', () => {
    expect(isAdminActor(actor('principal'))).toBe(true);
    expect(isLevelLeaderActor(actor('level_leader'))).toBe(true);
    expect(isLevelLeaderActor(actor('level_leader', 'admin'))).toBe(false);
    expect(isGroupStaffActor(actor('servant'))).toBe(true);
    expect(isGroupStaffActor(actor('group_leader', 'level_leader'))).toBe(false);
  });

  it('liturgy: everyone with a teaching role; events: admins and level leaders only', () => {
    expect(canCreateType('liturgy', actor('servant'))).toBe(true);
    expect(canCreateType('liturgy', actor('group_leader'))).toBe(true);
    expect(canCreateType('liturgy', actor('priest'))).toBe(false);
    expect(canCreateType('event', actor('servant'))).toBe(false);
    expect(canCreateType('event', actor('group_leader'))).toBe(false);
    expect(canCreateType('event', actor('level_leader'))).toBe(true);
    expect(canCreateType('event', actor('super_admin'))).toBe(true);
  });

  it('multi-group audiences are for admins, principals and level leaders', () => {
    expect(canCreateMultiGroup(actor('servant'))).toBe(false);
    expect(canCreateMultiGroup(actor('level_leader'))).toBe(true);
    expect(canCreateMultiGroup(actor('admin'))).toBe(true);
  });
});
