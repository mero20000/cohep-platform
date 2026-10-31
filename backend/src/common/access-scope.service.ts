import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/** An id no row can have, so a caller with no school matches nothing instead of everything. */
export const NO_SCHOOL = '00000000-0000-0000-0000-000000000000';

const ADMIN_ROLES = ['super_admin', 'admin', 'principal'];
const ASSIGNED_ROLES = ['servant', 'group_leader', 'level_leader'];

/** The slice of a school an assigned servant or leader may touch; empty means the whole school. */
export interface StudentScope {
  groupId?: string;
  levelId?: string;
  gradeId?: string;
  gender?: string;
}

export interface ScopedActor {
  id: string;
  schoolId: string | null;
  roles: string[];
  /** Only super admins reach across schools. */
  isSuperAdmin: boolean;
  scope: StudentScope;
}

const NOBODY: ScopedActor = { id: '', schoolId: null, roles: [], isSuperAdmin: false, scope: {} };

/**
 * One answer to "may this caller touch this record?" for the by-id routes.
 *
 * - Every lookup is inside the caller's school; only `super_admin` crosses schools.
 * - `servant`, `group_leader` and `level_leader` are limited to the group, level, grade and teaching
 *   gender on their profile. One with none of those is school-wide, like the students module.
 *   `admin`, `principal`, `priest` and `curriculum_manager` are school-wide.
 * - A record that is out of reach is "not found" (404), never "forbidden", so ids cannot be probed.
 * - A caller that cannot be loaded matches nothing.
 */
@Injectable()
export class AccessScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** `user` is `req.user`. One query: roles, school and the profile metadata that holds the assignment. */
  async loadActor(user: any): Promise<ScopedActor> {
    if (!user?.id) return NOBODY;
    if (user.isDemo) {
      // The demo guest has no database row; its token carries the demo school.
      return { id: user.id, schoolId: user.schoolId ?? null, roles: ['demo_viewer'], isSuperAdmin: false, scope: {} };
    }
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        schoolId: true,
        isActive: true,
        deletedAt: true,
        metadata: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });
    if (!row || row.deletedAt || row.isActive === false) return NOBODY;

    const roles = (row.userRoles || []).map((ur: any) => ur.role?.name).filter(Boolean) as string[];
    const isSuperAdmin = roles.includes('super_admin');
    const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
    const isAssigned = !isAdmin && roles.some((r) => ASSIGNED_ROLES.includes(r));

    const scope: StudentScope = {};
    if (isAssigned) {
      const meta = ((row.metadata as any) || {}) as Record<string, any>;
      if (meta.groupId) scope.groupId = meta.groupId;
      if (meta.levelId) scope.levelId = meta.levelId;
      if (meta.gradeId) scope.gradeId = meta.gradeId;
      if (meta.teachingGender && meta.teachingGender !== 'both') scope.gender = meta.teachingGender;
    }
    return { id: row.id, schoolId: row.schoolId ?? null, roles, isSuperAdmin, scope };
  }

  /** Where-fragment for the caller's school on any table that has `schoolId`. */
  schoolWhere(actor: ScopedActor): { schoolId?: string } {
    return actor.isSuperAdmin ? {} : { schoolId: actor.schoolId ?? NO_SCHOOL };
  }

  /** Students the caller may touch: their school, not deleted, inside their assignment. */
  studentWhere(actor: ScopedActor): Record<string, any> {
    return { deletedAt: null, ...this.schoolWhere(actor), ...actor.scope };
  }

  /**
   * Assessments the caller may touch: their school, not deleted, and for an assigned servant the
   * ones for their level and their group (or for no particular group).
   */
  assessmentWhere(actor: ScopedActor): Record<string, any> {
    const { groupId, levelId } = actor.scope;
    return {
      deletedAt: null,
      ...this.schoolWhere(actor),
      ...(levelId ? { levelId } : {}),
      ...(groupId ? { AND: [{ OR: [{ groupId }, { groupId: null }] }] } : {}),
    };
  }

  /** The student row, or 404. */
  async assertStudent(actor: ScopedActor, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, ...this.studentWhere(actor) },
      select: { id: true, schoolId: true, levelId: true, groupId: true, gradeId: true, gender: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  /** The assessment row (with whatever `args` adds), or 404. */
  async assertAssessment(actor: ScopedActor, assessmentId: string, args: { include?: any; select?: any } = {}) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, ...this.assessmentWhere(actor) },
      ...args,
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment as any;
  }

  /** 404 unless the record is in the caller's school. */
  assertInSchool(actor: ScopedActor, record: { schoolId?: string | null } | null | undefined, what = 'Record') {
    if (!record) throw new NotFoundException(`${what} not found`);
    if (actor.isSuperAdmin) return record;
    if (!actor.schoolId || record.schoolId !== actor.schoolId) throw new NotFoundException(`${what} not found`);
    return record;
  }

  /** A caller limited to one group may not point records at another. */
  assertGroupAllowed(actor: ScopedActor, groupId: string | null | undefined) {
    if (actor.scope.groupId && groupId && groupId !== actor.scope.groupId) {
      throw new ForbiddenException('You can only use your own group');
    }
  }

  /** The class (school grade) row, or 404; an assigned servant only reaches their own group's classes. */
  async assertGrade(actor: ScopedActor, gradeId: string) {
    const { groupId, gradeId: ownGrade } = actor.scope;
    const grade = await this.prisma.schoolGrade.findFirst({
      where: {
        id: gradeId,
        deletedAt: null,
        ...this.schoolWhere(actor),
        ...(groupId ? { groupId } : {}),
        ...(ownGrade ? { AND: [{ id: ownGrade }] } : {}),
      },
    });
    if (!grade) throw new NotFoundException('Grade not found');
    return grade;
  }

  /** The caller may touch the assessment and the student, and they belong to the same school. */
  async assertAssessmentAndStudent(actor: ScopedActor, assessmentId: string, studentId: string) {
    const assessment = await this.assertAssessment(actor, assessmentId);
    const student = await this.assertStudent(actor, studentId);
    if (student.schoolId !== assessment.schoolId) throw new NotFoundException('Student not found');
    return { assessment, student };
  }
}
