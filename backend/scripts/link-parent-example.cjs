const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Example: link a parent (real user) to their children directly in the DB.
// Equivalent raw SQL for each link:
//   INSERT INTO student_parents (id, student_id, parent_id, relationship, is_primary, created_at)
//   VALUES (gen_random_uuid(), '<studentId>', '<parentId>', 'father', false, now())
//   ON CONFLICT (student_id, parent_id) DO NOTHING;
async function main() {
  const school = await prisma.school.findFirst({ where: { deletedAt: null } });
  if (!school) throw new Error('No school found');
  const schoolId = school.id;
  console.log('School:', school.name, `(${schoolId})`);

  // 1) Make sure the 'parent' role exists
  let parentRole = await prisma.role.findUnique({ where: { name: 'parent' } });
  if (!parentRole) {
    parentRole = await prisma.role.create({
      data: { name: 'parent', displayName: 'Parent', description: 'Student parent', level: 100, isSystem: false },
    });
    console.log('  • created role "parent"');
  }

  // 2) Find an existing parent user, or create a demo one
  let parent = await prisma.user.findFirst({
    where: { schoolId, userRoles: { some: { role: { name: 'parent' } } } },
  });
  if (!parent) {
    const passwordHash = await bcrypt.hash('Parent123!', 10);
    parent = await prisma.user.create({
      data: {
        schoolId,
        email: 'parent@example.com',
        phone: '+10000000000',
        passwordHash,
        firstName: 'Demo',
        lastName: 'Parent',
        locale: 'en',
        isActive: true,
        userRoles: { create: { roleId: parentRole.id } },
      },
    });
    console.log('  • created parent user:', parent.email, '(password: Parent123!)');
  } else {
    console.log('  • using existing parent user:', parent.email);
  }

  // 3) Pick two active students to link
  const students = await prisma.student.findMany({
    where: { schoolId, deletedAt: null, status: 'active' },
    take: 2,
    select: { id: true, studentCode: true, firstName: true, lastName: true },
  });
  if (students.length === 0) throw new Error('No students found');
  console.log('  • linking students:',
    students.map((s) => `${s.studentCode} (${s.firstName} ${s.lastName})`).join(', '));

  // 4) Insert the links (idempotent via the unique (studentId, parentId))
  for (const [i, s] of students.entries()) {
    await prisma.studentParent.upsert({
      where: { studentId_parentId: { studentId: s.id, parentId: parent.id } },
      update: {},
      create: {
        studentId: s.id,
        parentId: parent.id,
        relationship: i === 0 ? 'father' : 'mother',
        isPrimary: i === 0,
      },
    });
    // The parent's email is also the link key: any student whose parentEmail
    // matches the parent's login email will appear on the parent dashboard.
    await prisma.student.update({
      where: { id: s.id },
      data: { parentEmail: parent.email },
    });
  }

  // 5) Show the result
  const linked = await prisma.studentParent.findMany({
    where: { parentId: parent.id },
    include: { student: { select: { studentCode: true, firstName: true, lastName: true } } },
  });
  console.log(`\n✅ Parent ${parent.email} now has ${linked.length} linked children:`);
  linked.forEach((l) =>
    console.log(`   - ${l.student.studentCode}  ${l.student.firstName} ${l.student.lastName}  (${l.relationship})`),
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
