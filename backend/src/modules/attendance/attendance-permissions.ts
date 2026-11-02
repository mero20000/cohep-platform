/**
 * Who may create / mark which kind of attendance session.
 *
 *   class    – unchanged from before (any staff role).
 *   liturgy  – servants / group leaders: only their own group.
 *              level leaders, admins, principals, super admins: any audience
 *              (level leaders are restricted to students of their own level).
 *   event    – level leaders, admins, principals, super admins.
 */
export const ADMIN_ROLES = ['super_admin', 'admin', 'principal'] as const;
export const GROUP_STAFF_ROLES = ['servant', 'group_leader'] as const;

export interface Actor {
  id: string;
  schoolId: string;
  roles: string[];
  metadata: Record<string, any>;
}

export const isAdminActor = (a: Actor) => a.roles.some(r => (ADMIN_ROLES as readonly string[]).includes(r));
export const isLevelLeaderActor = (a: Actor) => !isAdminActor(a) && a.roles.includes('level_leader');
export const isGroupStaffActor = (a: Actor) =>
  !isAdminActor(a) && !isLevelLeaderActor(a) && a.roles.some(r => (GROUP_STAFF_ROLES as readonly string[]).includes(r));

/** Admins and level leaders may build a multi-group or whole-school audience. */
export const canCreateMultiGroup = (a: Actor) => isAdminActor(a) || isLevelLeaderActor(a);

export function canCreateType(type: 'liturgy' | 'event', a: Actor): boolean {
  if (isAdminActor(a) || isLevelLeaderActor(a)) return true;
  return type === 'liturgy' && isGroupStaffActor(a);
}
