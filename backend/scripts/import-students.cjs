const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const csvPath = '/Users/amir.adly/Downloads/2026-07-19_group-members_hymns-school-1.csv';
  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.trim().split(/\r?\n/);
  const rows = lines.slice(1).map((l) => {
    const p = l.split(',');
    return {
      id: (p[0] || '').trim(),
      name: (p[1] || '').trim(),
      email: (p[2] || '').trim(),
      phone: (p[3] || '').trim(),
    };
  }).filter((r) => r.name && r.id);

  console.log(`Parsed ${rows.length} rows`);

  const school = await prisma.school.findFirst();
  if (!school) throw new Error('No school found');
  console.log('School:', school.id, school.name);

  const academicYear =
    (await prisma.academicYear.findFirst({ where: { isCurrent: true } })) ||
    (await prisma.academicYear.findFirst({ orderBy: { startDate: 'desc' } })) ||
    (await prisma.academicYear.findFirst());
  if (!academicYear) throw new Error('No academic year found');
  console.log('AcademicYear:', academicYear.id);

  let level = await prisma.level.findFirst({ where: { number: 1, schoolId: school.id } });
  if (!level) {
    level = await prisma.level.create({ data: { schoolId: school.id, number: 1, name: 'Level 1', nameAr: 'المستوى 1' } });
    console.log('Created level 1');
  }

  let group = await prisma.group.findFirst({ where: { name: 'Group 1', levelId: level.id } });
  if (!group) {
    group = await prisma.group.create({ data: { levelId: level.id, name: 'Group 1', nameAr: 'المجموعة 1' } });
    console.log('Created group 1');
  }

  let created = 0, updated = 0, skipped = 0;
  for (const r of rows) {
    const nameParts = r.name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;
    const studentCode = `STU-${r.id}`;

    const data = {
      schoolId: school.id,
      academicYearId: academicYear.id,
      studentCode,
      firstName,
      lastName,
      dateOfBirth: new Date('2016-01-01'),
      gender: 'male',
      levelId: level.id,
      groupId: group.id,
      status: 'active',
      schoolGrade: 'Grade 4',
      // Col 3 of the CSV is the parent's email — used as the link key so the
      // student appears automatically on that parent's dashboard.
      parentEmail: r.email || undefined,
      metadata: (r.phone || r.email) ? {
        ...(r.phone ? { phone: r.phone } : {}),
        ...(r.email ? { email: r.email } : {}),
      } : undefined,
    };

    const existing = await prisma.student.findUnique({
      where: { schoolId_studentCode: { schoolId: school.id, studentCode } },
    });

    if (existing) {
      const { metadata, ...rest } = data;
      const updateData = { ...rest };
      if (metadata) {
        const existingMeta = (existing.metadata || {});
        updateData.metadata = { ...existingMeta, ...metadata };
      }
      await prisma.student.update({
        where: { id: existing.id },
        data: updateData,
      });
      updated++;
    } else {
      await prisma.student.create({ data });
      created++;
    }
  }

  console.log(`Done. created=${created} updated=${updated} skipped=${skipped} total=${rows.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
