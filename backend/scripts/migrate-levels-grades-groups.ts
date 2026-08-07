import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

const summary = {
  schools: 0,
  groupsBefore: 0,
  groupsAfter: 0,
  dupsSoftDeleted: 0,
  fksRemapped: 0,
  gradesFromConfig: 0,
  gradesDerived: 0,
  gradesCreated: 0,
  studentsMatched: 0,
  studentsUnmatched: 0,
  configKeysDeleted: 0,
};

function normalizeGradeName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^grade\s*(\d+)$/i);
  if (m) return `Grade ${m[1]}`;
  const d = s.match(/^(\d+)$/);
  if (d) return `Grade ${d[1]}`;
  return s;
}

function gradeKey(name: string): string {
  return (normalizeGradeName(name) ?? name.trim()).trim().toLowerCase();
}

type ProjectedGrade = { id: string; name: string; groupId: string; status: string };

async function main() {
  const schools = await prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });

  for (const school of schools) {
    summary.schools++;
    console.log(`\n=== School: ${school.name} (${school.id}) ===`);

    // ── 1) Dedupe groups: canonical = lowest createdAt per trimmed-lowercase name ──
    const groups = await prisma.group.findMany({
      where: { schoolId: school.id, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    summary.groupsBefore += groups.length;

    const canonical = new Map<string, (typeof groups)[number]>();
    for (const g of groups) {
      const key = gradeKey(g.name);
      if (!canonical.has(key)) canonical.set(key, g);
    }
    summary.groupsAfter += canonical.size;

    const remap = new Map<string, string>();
    for (const g of groups) {
      const c = canonical.get(gradeKey(g.name));
      if (c && c.id !== g.id) remap.set(g.id, c.id);
    }
    console.log(`  groups: before=${groups.length} after=${canonical.size} duplicates=${remap.size}`);

    // ── 2) Remap FKs referencing duplicates, then soft-delete them ──
    for (const [dupId, canonicalId] of remap) {
      const counts = await Promise.all([
        prisma.student.count({ where: { groupId: dupId } }),
        prisma.attendanceSession.count({ where: { groupId: dupId } }),
        prisma.assessment.count({ where: { groupId: dupId } }),
        prisma.promotionRecord.count({ where: { OR: [{ fromGroupId: dupId }, { toGroupId: dupId }] } }),
      ]);
      const fkRefs = counts[0] + counts[1] + counts[2] + counts[3];
      console.log(
        `  dup ${dupId} -> ${canonicalId} (refs: students=${counts[0]} attendance=${counts[1]} assessments=${counts[2]} promotions=${counts[3]})`,
      );
      if (!dryRun) {
        await prisma.student.updateMany({ where: { groupId: dupId }, data: { groupId: canonicalId } });
        await prisma.attendanceSession.updateMany({ where: { groupId: dupId }, data: { groupId: canonicalId } });
        await prisma.assessment.updateMany({ where: { groupId: dupId }, data: { groupId: canonicalId } });
        await prisma.promotionRecord.updateMany({ where: { fromGroupId: dupId }, data: { fromGroupId: canonicalId } });
        await prisma.promotionRecord.updateMany({ where: { toGroupId: dupId }, data: { toGroupId: canonicalId } });
        await prisma.group.update({ where: { id: dupId }, data: { deletedAt: new Date() } });
      }
      summary.fksRemapped += fkRefs;
      summary.dupsSoftDeleted++;
    }

    // ── 3) Build the SchoolGrade set: existing + gradeGroups config + derived ──
    const existingGrades = await prisma.schoolGrade.findMany({ where: { schoolId: school.id, deletedAt: null } });
    const gradeMap = new Map<string, ProjectedGrade>();
    for (const eg of existingGrades) {
      gradeMap.set(gradeKey(eg.name), { id: eg.id, name: eg.name, groupId: eg.groupId, status: eg.status });
    }

    const configRow = await prisma.systemConfig.findUnique({
      where: { schoolId_key: { schoolId: school.id, key: 'gradeGroups' } },
    });
    let combos: any[] = [];
    if (configRow) {
      const v = configRow.value as any;
      if (Array.isArray(v)) combos = v;
      else if (v && Array.isArray(v.combos)) combos = v.combos;
      else if (v && Array.isArray(v.combo)) combos = v.combo;
    }
    console.log(`  gradeGroups config: ${combos.length} combo(s)`);

    const resolveGroupId = (groupName?: string | null, groupId?: string | null): string | null => {
      if (groupName) {
        const c = canonical.get(gradeKey(groupName));
        if (c) return c.id;
      }
      if (groupId) {
        const remapped = remap.get(groupId);
        if (remapped) return remapped;
        if (canonical.get(gradeKey(groups.find((g) => g.id === groupId)?.name ?? ''))) return groupId;
      }
      return groupId || null;
    };

    const newGrades: ProjectedGrade[] = [];
    let configGrades = 0;
    for (const combo of combos) {
      const name = String(combo.gradeName ?? '').trim();
      if (!name) continue;
      const key = gradeKey(name);
      if (gradeMap.has(key)) continue;
      const groupId = resolveGroupId(combo.groupName, combo.groupId);
      if (!groupId) {
        console.log(`  WARN: cannot resolve group for config combo "${name}" — skipping`);
        continue;
      }
      gradeMap.set(key, { id: '', name, groupId, status: combo.status || 'active' });
      newGrades.push(gradeMap.get(key)!);
      configGrades++;
    }
    summary.gradesFromConfig += configGrades;

    const students = await prisma.student.findMany({
      where: { schoolId: school.id, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    for (const s of students) {
      const name = normalizeGradeName(s.schoolGrade);
      if (!name) continue;
      const key = gradeKey(name);
      if (gradeMap.has(key)) continue;
      const remappedGroupId = remap.get(s.groupId) ?? s.groupId;
      gradeMap.set(key, { id: '', name, groupId: remappedGroupId, status: 'active' });
      newGrades.push(gradeMap.get(key)!);
    }
    const derivedGrades = newGrades.length - configGrades;
    summary.gradesDerived += derivedGrades;

    let orderIndex = existingGrades.reduce((m, g) => Math.max(m, g.orderIndex), 0);
    if (!dryRun) {
      for (const g of newGrades) {
        const created = await prisma.schoolGrade.create({
          data: {
            schoolId: school.id,
            name: g.name,
            groupId: g.groupId,
            status: g.status,
            orderIndex: ++orderIndex,
          },
          select: { id: true },
        });
        gradeMap.get(gradeKey(g.name))!.id = created.id;
      }
    }
    summary.gradesCreated += newGrades.length;
    console.log(
      `  grades: existing=${existingGrades.length} fromConfig=${configGrades} derived=${derivedGrades}`,
    );

    // ── 4) Map students to grades by normalized name ──
    let matched = 0;
    for (const s of students) {
      const name = normalizeGradeName(s.schoolGrade);
      const grade = name ? gradeMap.get(gradeKey(name)) : undefined;
      if (!grade) {
        summary.studentsUnmatched++;
        console.log(`  student ${s.firstName} (${s.id}) school_grade="${s.schoolGrade}" -> UNMATCHED`);
        continue;
      }
      matched++;
      if (!dryRun && grade.id) {
        await prisma.student.update({ where: { id: s.id }, data: { gradeId: grade.id, groupId: grade.groupId } });
      }
    }
    summary.studentsMatched += matched;

    // ── 5) Delete gradeGroups + grades config rows ──
    const configKeys = ['gradeGroups', 'grades'];
    const configRowsToDelete = await prisma.systemConfig.findMany({
      where: { schoolId: school.id, key: { in: configKeys } },
      select: { key: true },
    });
    if (configRowsToDelete.length > 0) {
      if (!dryRun) {
        await prisma.systemConfig.deleteMany({ where: { schoolId: school.id, key: { in: configKeys } } });
      }
      summary.configKeysDeleted += configRowsToDelete.length;
      console.log(`  config keys to delete: ${configRowsToDelete.map((c) => c.key).join(', ')}`);
    }
  }

  console.log('\n===== SUMMARY =====');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
