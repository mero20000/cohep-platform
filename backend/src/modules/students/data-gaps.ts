/**
 * "Data gaps" are missing details that make a student hard to look after: no photo for the register, no way to
 * reach a parent, no school grade. One definition, used by both the Reports data-quality counts and the
 * students-list filter, so the number on the report is exactly the list you land on.
 */
export const DATA_GAPS = ['photo', 'parent', 'grade'] as const;
export type DataGap = (typeof DATA_GAPS)[number];

/** Prisma `where` fragment selecting students with the given gap. */
export function dataGapWhere(gap: DataGap): Record<string, unknown> {
  switch (gap) {
    case 'photo':
      return { OR: [{ photoUrl: null }, { photoUrl: '' }] };
    case 'parent':
      // No parent email on file AND no parent account linked.
      return { AND: [{ OR: [{ parentEmail: null }, { parentEmail: '' }] }, { studentParents: { none: {} } }] };
    case 'grade':
      return { gradeId: null };
  }
}
