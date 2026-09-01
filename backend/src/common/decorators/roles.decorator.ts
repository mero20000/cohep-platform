import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const STAFF_ROLES = [
  'super_admin',
  'admin',
  'principal',
  'curriculum_manager',
  'servant',
  'group_leader',
  'level_leader',
] as const;