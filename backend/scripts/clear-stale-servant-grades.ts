import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default to a dry-run. Pass `--apply` to actually clear the stale grades.
const apply = process.argv.includes('--apply');

const SERVANT_ROLES = ['servant', 'group_leader', 'level_leader'] as const;

type SchoolGradeRow = { id: string; name: string; groupId: string; status: string };

async function main() {
  const schools = await prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });

  let cleared = 0;
  let reviewed = 0;

  for (const school of schools) {
    const grades: SchoolGradeRow[] = await prisma.schoolGrade.findMany({
      where: { schoolId: school.id, deletedAt: null },
      select: { id: true, name: true, groupId: true, status: true },
    });
    const groupGradeName = new Map<string, string>();
    for (const g of grades) groupGradeName.set(g.groupId, g.name);

    const roleRows = await prisma.role.findMany({ where: { name: { in: [...SERVANT_ROLES] } }, select: { id: true, name: true } });
    const roleIds = roleRows.map(r => r.id);

    const users = await prisma.user.findMany({
      where: {
        schoolId: school.id,
        deletedAt: null,
        userRoles: { some: { roleId: { in: roleIds } } },
      },
      select: { id: true, email: true, metadata: true },
    });

    for (const u of users) {
      const meta = (u.metadata as any) || {};
      const grade: string | undefined = meta.grade;
      if (!grade) continue;

      const groupId: string | undefined = meta.groupId;
      const expected = groupId ? groupGradeName.get(groupId) : undefined;

      if (groupId && expected && expected === grade) {
        // Grade matches the assigned group — correct, leave it.
        continue;
      }

      if (groupId && expected && expected !== grade) {
        // Grade is set but does NOT match the assigned group's grade (stale).
        console.log(`[CLEAR] ${school.name} | ${u.email} | grade="${grade}" but group's grade is "${expected}"`);
        cleared++;
        if (apply) {
          const { grade: _drop, ...rest } = meta;
          await prisma.user.update({ where: { id: u.id }, data: { metadata: rest } });
        }
        continue;
      }

      // Grade set but no group assigned (orphaned legacy grade) — report for review.
      console.log(`[REVIEW] ${school.name} | ${u.email} | grade="${grade}" with no group assigned`);
      reviewed++;
    }
  }

  console.log(`\nDone. mode=${apply ? 'APPLY' : 'DRY-RUN'} | cleared=${cleared} | review=${reviewed}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
