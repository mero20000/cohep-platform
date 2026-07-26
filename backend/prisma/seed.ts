import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a church
  const church = await prisma.church.upsert({
    where: { slug: 'st-mark' },
    update: {},
    create: {
      name: 'St. Mark Coptic Orthodox Church',
      nameAr: 'كنيسة مارمرقس القبطية الأرثوذكسية',
      slug: 'st-mark',
      timezone: 'America/New_York',
      locale: 'en',
    },
  });
  console.log('Church ready:', church.name);

  // Create a school
  const school = await prisma.school.upsert({
    where: { slug: 'niangelos-main' },
    update: {},
    create: {
      churchId: church.id,
      name: 'NiAngelos School for Hymns and Praises',
      nameAr: 'مدرسة نياكنغيلوس للتراتيل والتسابيح',
      slug: 'niangelos-main',
      address: '123 Church Street, City, State',
      phone: '+1-555-0100',
      email: 'info@niangelos.app',
      timezone: 'America/New_York',
      locale: 'en',
    },
  });
  console.log('School ready:', school.name);

  // Create academic year
  const academicYear = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      name: '2026-2027',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30'),
      isCurrent: true,
    },
  });
  console.log('Created academic year:', academicYear.name);

  // Create levels
  const levels: any[] = [];
  for (let i = 1; i <= 10; i++) {
    const level = await prisma.level.create({
      data: {
        schoolId: school.id,
        number: i,
        name: `Level ${i}`,
        nameAr: `المستوى ${i}`,
        description: `Hymn education level ${i}`,
        orderIndex: i,
      },
    });
    levels.push(level);
  }
  console.log('Created', levels.length, 'levels');

  // Create groups for each level
  for (const level of levels) {
    for (let g = 1; g <= 4; g++) {
      await prisma.group.create({
        data: {
          levelId: level.id,
          name: `Group ${g}`,
          nameAr: `المجموعة ${g}`,
          capacity: 30,
          orderIndex: g,
        },
      });
    }
  }
  console.log('Created groups for all levels');

  // Create subjects
  const subjects: any[] = [];
  const subjectData = [
    { name: 'Coptic Hymns', nameAr: 'التراتيل القبطية', nameCoptic: ' nueste' },
    { name: 'Coptic Rites', nameAr: 'الطقس القبطي', nameCoptic: 'ⲙⲛⲧⲁⲛⲟⲩ' },
    { name: 'Coptic Language', nameAr: 'اللغة القبطية', nameCoptic: 'ⲣⲙⲛⲕⲏⲙⲉ' },
  ];
  for (const s of subjectData) {
    const subject = await prisma.subject.create({
      data: {
        schoolId: school.id,
        name: s.name,
        nameAr: s.nameAr,
        nameCoptic: s.nameCoptic,
        description: `${s.name} curriculum`,
        orderIndex: subjects.length + 1,
      },
    });
    subjects.push(subject);
  }
  console.log('Created', subjects.length, 'subjects');

  // Create roles
  const roles: any[] = [];
  const roleData = [
    { name: 'super_admin', displayName: 'Super Admin', level: 0, isSystem: true },
    { name: 'admin', displayName: 'Admin', level: 1, isSystem: true },
    { name: 'principal', displayName: 'Principal', level: 2, isSystem: true },
    { name: 'curriculum_manager', displayName: 'Curriculum Manager', level: 3, isSystem: false },
    { name: 'servant', displayName: 'Servant', level: 4, isSystem: false },
    { name: 'group_leader', displayName: 'Group Leader', level: 5, isSystem: false },
    { name: 'level_leader', displayName: 'Level Leader', level: 6, isSystem: false },
    { name: 'assistant_servant', displayName: 'Assistant Servant', level: 7, isSystem: false },
    { name: 'student', displayName: 'Student', level: 8, isSystem: true },
    { name: 'parent', displayName: 'Parent', level: 9, isSystem: true },
    { name: 'guest', displayName: 'Guest', level: 10, isSystem: true },
  ];
  for (const r of roleData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { displayName: r.displayName, level: r.level, isSystem: r.isSystem },
      create: { name: r.name, displayName: r.displayName, level: r.level, isSystem: r.isSystem },
    });
    roles.push(role);
  }
  console.log('Upserted', roles.length, 'roles');

  // Create a test user (admin)
  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  let adminUser = await prisma.user.findFirst({
    where: { email: 'admin@niangelos.app', schoolId: school.id },
  });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        schoolId: school.id,
        email: 'admin@niangelos.app',
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        firstNameAr: 'مدير',
        lastNameAr: 'المستخدم',
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    console.log('Created admin user');
  }

  // Assign super_admin role
  const superAdminRole = roles.find((r) => r.name === 'super_admin')!;
  const existingRole = await prisma.userRole.findUnique({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: { userId: adminUser.id, roleId: superAdminRole.id },
    });
  }
  console.log('Admin user ready:', adminUser.email);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
