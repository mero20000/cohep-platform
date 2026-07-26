// ─── Permission flags (single source of truth) ──────────────────────────
export const PERMISSIONS = {
  'student:view':        'View students',
  'student:create':      'Add new students',
  'student:edit':        'Edit student profiles',
  'student:edit-sensitive': 'Edit church tool ID & parent email',
  'student:delete':      'Delete students',
  'student:bulk-delete': 'Bulk delete students',
  'student:import':      'Import students from CSV',
  'student:export':      'Export students to CSV',

  'servant:view':        'View servants',
  'servant:create':      'Add new servants',
  'servant:edit':        'Edit servant profiles',
  'servant:delete':      'Delete servants',

  'attendance:view':     'View attendance records',
  'attendance:record':   'Record attendance',
  'attendance:manage':   'Manage attendance sessions',

  'assessment:view':      'View assessments',
  'assessment:create':    'Create assessments',
  'assessment:edit':      'Edit assessments',
  'assessment:delete':    'Delete assessments',
  'assessment:grade':     'Grade assessments',

  'curriculum:view':     'View curriculum',
  'curriculum:edit':     'Edit curriculum & lessons',

  'gamification:view':   'View gamification',
  'gamification:manage': 'Manage gamification settings',

  'announcement:view':   'View announcements',
  'announcement:create': 'Create announcements',
  'announcement:edit':   'Edit announcements',
  'announcement:delete': 'Delete announcements',
  'announcement:publish':'Publish announcements',

  'settings:view':       'View settings',
  'settings:manage':     'Manage school settings',
  'settings:manage-system': 'Manage system-level settings',

  'users:view':          'View users',
  'users:create':        'Create users',
  'users:edit':          'Edit users',
  'users:delete':        'Delete users',
  'users:manage-roles':  'Manage roles & permissions',

  'reports:view':         'View reports',
  'reports:export':       'Export reports',

  'parents:link':        'Link/unlink parent-child relationships',
  'registrations:approve':'Approve pending registrations',
} as const

export type Permission = keyof typeof PERMISSIONS

// ─── Default role → permission mapping ───────────────────────────────────
const ROLE_DEFAULT_PERMS: Record<string, Permission[]> = {
  super_admin: Object.keys(PERMISSIONS) as Permission[],

  admin: [
    'student:view','student:create','student:edit','student:edit-sensitive','student:delete','student:bulk-delete','student:import','student:export',
    'servant:view','servant:create','servant:edit','servant:delete',
    'attendance:view','attendance:record','attendance:manage',
    'assessment:view','assessment:create','assessment:edit','assessment:delete','assessment:grade',
    'curriculum:view','curriculum:edit',
    'gamification:view','gamification:manage',
    'announcement:view','announcement:create','announcement:edit','announcement:delete','announcement:publish',
    'settings:view','settings:manage',
    'users:view','users:create','users:edit','users:delete',
    'reports:view','reports:export',
    'parents:link',
  ],

  principal: [
    'student:view','student:edit',
    'servant:view',
    'attendance:view','attendance:record','attendance:manage',
    'assessment:view','assessment:create','assessment:edit','assessment:grade',
    'curriculum:view','curriculum:edit',
    'gamification:view',
    'announcement:view','announcement:create','announcement:edit','announcement:delete','announcement:publish',
    'settings:view',
    'reports:view','reports:export',
  ],

  curriculum_manager: [
    'student:view',
    'curriculum:view','curriculum:edit',
    'assessment:view','assessment:create','assessment:edit','assessment:delete','assessment:grade',
    'attendance:view',
    'gamification:view',
    'announcement:view','announcement:create','announcement:edit','announcement:delete',
    'settings:view',
    'reports:view',
  ],

  level_leader: [
    'student:view',
    'servant:view',
    'attendance:view','attendance:record',
    'assessment:view','assessment:grade',
    'curriculum:view',
    'gamification:view',
    'announcement:view',
    'reports:view',
  ],

  group_leader: [
    'student:view',
    'attendance:view','attendance:record',
    'assessment:view','assessment:grade',
    'curriculum:view',
    'gamification:view',
    'announcement:view',
  ],

  servant: [
    'student:view',
    'attendance:record',
    'assessment:grade',
    'curriculum:view',
    'gamification:view',
    'announcement:view',
  ],

  parent: [
    'student:view',
    'attendance:view',
    'assessment:view',
    'gamification:view',
    'announcement:view',
    'reports:view',
    'reports:export',
  ],
}

// ─── LocalStorage overrides ──────────────────────────────────────────────
const OVERRIDE_KEY = 'niangelos_perms_override'

function loadOverrides(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}') } catch { return {} }
}

function saveOverrides(data: Record<string, string[]>) {
  try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(data)) } catch {}
}

// ─── Permission check (pure function) ────────────────────────────────────
export function hasPermission(
  role: string,
  permission: Permission,
  overrides?: Record<string, string[]>,
): boolean {
  const ov = overrides ?? loadOverrides()
  // If there's an override for this role, use it
  if (ov[role]) return ov[role].includes(permission)
  // Otherwise use defaults
  const defaults = ROLE_DEFAULT_PERMS[role]
  if (!defaults) return false
  return defaults.includes(permission)
}

// ─── Get all permissions for a role (merged with overrides) ──────────────
export function getPermissionsForRole(role: string): Permission[] {
  const ov = loadOverrides()
  if (ov[role]) return ov[role] as Permission[]
  return ROLE_DEFAULT_PERMS[role] ?? []
}

// ─── Save override for a role ────────────────────────────────────────────
export function setRolePermissions(role: string, perms: string[]) {
  const ov = loadOverrides()
  ov[role] = perms
  saveOverrides(ov)
}

// ─── Get default permissions for a role ──────────────────────────────────
export function getDefaultPermissionsForRole(role: string): Permission[] {
  return ROLE_DEFAULT_PERMS[role] ?? []
}
