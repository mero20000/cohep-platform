/** Roles under test and the localStorage session each one signs in with. */
export type RoleKey = 'super_admin' | 'admin' | 'servant' | 'parent'

export interface RoleFixture {
  key: RoleKey
  label: string
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    roles: string[]
    schoolId: string
  }
}

const SCHOOL_ID = 'school-1'

export const ROLES: RoleFixture[] = [
  { key: 'super_admin', label: 'Super admin', user: { id: 'u-sa', email: 'super@example.org', firstName: 'Sara', lastName: 'Admin', roles: ['super_admin'], schoolId: SCHOOL_ID } },
  { key: 'admin', label: 'Admin', user: { id: 'u-ad', email: 'admin@example.org', firstName: 'Adam', lastName: 'Manager', roles: ['admin'], schoolId: SCHOOL_ID } },
  { key: 'servant', label: 'Servant', user: { id: 'u-sv', email: 'servant@example.org', firstName: 'Mina', lastName: 'Servant', roles: ['servant'], schoolId: SCHOOL_ID } },
  { key: 'parent', label: 'Parent', user: { id: 'u-pa', email: 'parent@example.org', firstName: 'Paula', lastName: 'Parent', roles: ['parent'], schoolId: SCHOOL_ID } },
]

export const STUDENT_CODE = 'STU-DEMO-0001'
export { SCHOOL_ID }
