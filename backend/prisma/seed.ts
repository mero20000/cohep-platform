import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Church ─────────────────────────────────────────────────────────────
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

  // ── School ─────────────────────────────────────────────────────────────
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

  // ── Academic year ──────────────────────────────────────────────────────
  let academicYear = await prisma.academicYear.findFirst({
    where: { schoolId: school.id, name: '2026-2027' },
  });
  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: {
        schoolId: school.id,
        name: '2026-2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        isCurrent: true,
      },
    });
    console.log('Created academic year:', academicYear.name);
  } else {
    console.log('Academic year already exists:', academicYear.name);
  }

  // ── Levels ─────────────────────────────────────────────────────────────
  const levels: any[] = [];
  for (let i = 1; i <= 10; i++) {
    let level = await prisma.level.findFirst({
      where: { schoolId: school.id, number: i },
    });
    if (!level) {
      level = await prisma.level.create({
        data: {
          schoolId: school.id,
          number: i,
          name: `Level ${i}`,
          nameAr: `المستوى ${i}`,
          description: `Hymn education level ${i}`,
          orderIndex: i,
        },
      });
    }
    levels.push(level);
  }
  console.log('Levels ready:', levels.length);

  // ── Groups ─────────────────────────────────────────────────────────────
  for (const level of levels) {
    for (let g = 1; g <= 4; g++) {
      const existing = await prisma.group.findFirst({
        where: { levelId: level.id, name: `Group ${g}` },
      });
      if (!existing) {
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
  }
  console.log('Groups ready');

  // ── Subjects ───────────────────────────────────────────────────────────
  const subjectData = [
    { name: 'Coptic Hymns', nameAr: 'التراتيل القبطية', nameCoptic: 'ⲛⲓϩⲱⲥ' },
    { name: 'Coptic Rites', nameAr: 'الطقس القبطي', nameCoptic: 'ⲙⲛⲧⲁⲛⲟⲩ' },
    { name: 'Coptic Language', nameAr: 'اللغة القبطية', nameCoptic: 'ⲣⲙⲛⲕⲏⲙⲉ' },
  ];
  for (let idx = 0; idx < subjectData.length; idx++) {
    const s = subjectData[idx];
    const existing = await prisma.subject.findFirst({
      where: { schoolId: school.id, name: s.name },
    });
    if (!existing) {
      await prisma.subject.create({
        data: {
          schoolId: school.id,
          name: s.name,
          nameAr: s.nameAr,
          nameCoptic: s.nameCoptic,
          description: `${s.name} curriculum`,
          orderIndex: idx + 1,
        },
      });
    }
  }
  console.log('Subjects ready');

  // ── Roles ──────────────────────────────────────────────────────────────
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
  const roles: any[] = [];
  for (const r of roleData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { displayName: r.displayName, level: r.level, isSystem: r.isSystem },
      create: { name: r.name, displayName: r.displayName, level: r.level, isSystem: r.isSystem },
    });
    roles.push(role);
  }
  console.log('Roles ready:', roles.length);

  // ── Admin user ─────────────────────────────────────────────────────────
  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const servantPw = await bcrypt.hash('Servant123!', 10);

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
  } else {
    console.log('Admin user already exists');
  }

  // ── Assign super_admin role ────────────────────────────────────────────
  const superAdminRole = roles.find((r) => r.name === 'super_admin')!;
  const existingRole = await prisma.userRole.findUnique({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: { userId: adminUser.id, roleId: superAdminRole.id },
    });
  }

  const adminUserId = adminUser.id;
  console.log('Admin user ready:', adminUser.email);

  // ── Servant (teacher) users ────────────────────────────────────────────
  const servantData = [
    { firstName: 'Mina', lastName: 'Girgis', email: 'mina.girgis@niangelos.app' },
    { firstName: 'Mariam', lastName: 'Iskander', email: 'mariam.iskander@niangelos.app' },
    { firstName: 'Bishoy', lastName: 'Nabil', email: 'bishoy.nabil@niangelos.app' },
  ];
  const servantRole = roles.find((r) => r.name === 'servant')!;
  const servantUsers: any[] = [];
  for (const s of servantData) {
    let user = await prisma.user.findFirst({
      where: { email: s.email, schoolId: school.id },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          schoolId: school.id,
          email: s.email,
          passwordHash: servantPw,
          firstName: s.firstName,
          lastName: s.lastName,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: servantRole.id } },
        update: {},
        create: { userId: user.id, roleId: servantRole.id, assignedBy: adminUserId },
      });
      console.log('Created servant:', s.email);
    }
    servantUsers.push(user);
  }

  // ── Sample Students ────────────────────────────────────────────────────
  const studentsCount = await prisma.student.count({ where: { schoolId: school.id } });
  if (studentsCount === 0) {
    const firstNames = ['Peter', 'John', 'Mary', 'David', 'Sarah', 'Mark', 'Esther', 'Joseph', 'Rebecca', 'Samuel', 'Rita', 'George', 'Veronica', 'James', 'Martha'];
    const lastNames = ['Ibrahim', 'Youssef', 'Michael', 'Hanna', 'Soliman', 'Ayoub', 'Fam', 'Ghattas', 'Henein', 'Barsoum'];
    const firstNamesAr = ['بيتر', 'يوحنا', 'مريم', 'داود', 'سارة', 'مرقس', 'استير', 'يوسف', 'رفقة', 'صموئيل', 'ريتا', 'جرجس', 'فيرونيكا', 'يعقوب', 'مرثا'];
    const lastNamesAr = ['إبراهيم', 'يوسف', 'ميخائيل', 'حنا', 'سليمان', 'أيوب', 'فام', 'غطاس', 'حنين', 'برسوم'];
    const genders = ['male', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female'];

    const allGroups = await prisma.group.findMany({
      where: { levelId: { in: levels.map((l: any) => l.id) }, deletedAt: null },
      orderBy: [{ levelId: 'asc' }, { orderIndex: 'asc' }],
    });

    let studentIdx = 0;
    const studentData: any[] = [];
    for (let levelIdx = 0; levelIdx < Math.min(levels.length, 5); levelIdx++) {
      const level = levels[levelIdx];
      const levelGroups = allGroups.filter((g: any) => g.levelId === level.id);
      const studentsPerLevel = 3;

      for (let i = 0; i < studentsPerLevel && studentIdx < firstNames.length; i++) {
        const group = levelGroups[i % levelGroups.length];
        const nameIdx = studentIdx % firstNames.length;
        studentData.push({
          firstName: firstNames[nameIdx],
          lastName: lastNames[(studentIdx * 3 + levelIdx) % lastNames.length],
          firstNameAr: firstNamesAr[nameIdx],
          lastNameAr: lastNamesAr[(studentIdx * 3 + levelIdx) % lastNames.length],
          dateOfBirth: new Date(2012 + studentIdx, 0, 15),
          gender: genders[studentIdx % genders.length],
          churchName: 'St. Mary Church',
          schoolGrade: `${3 + (studentIdx % 6)}`,
          levelId: level.id,
          groupId: group.id,
          schoolId: school.id,
          studentCode: `STU-${String(2026001 + studentIdx).padStart(5, '0')}`,
          academicYearId: academicYear.id,
          parentEmail: `parent${studentIdx + 1}@email.com`,
          status: 'active',
          enrollmentDate: new Date('2026-09-01'),
        });
        studentIdx++;
      }
    }

    await prisma.student.createMany({ data: studentData });
    console.log(`Created ${studentData.length} students`);
  } else {
    console.log('Students already exist:', studentsCount);
  }

  // ── Subjects → Level assignment ──────────────────────────────────────
  const allSubjects = await prisma.subject.findMany({ where: { schoolId: school.id } });
  for (const level of levels.slice(0, 5)) {
    const existing = await prisma.levelSubject.findFirst({
      where: { levelId: level.id },
    });
    if (!existing) {
      for (const subject of allSubjects) {
        await prisma.levelSubject.create({
          data: {
            levelId: level.id,
            subjectId: subject.id,
            isRequired: true,
            orderIndex: 1,
          },
        });
      }
      console.log(`Assigned subjects to ${level.name}`);
    }
  }

  // ── Lessons & Sessions ──────────────────────────────────────────────
  const lessonsCount = await prisma.lesson.count({ where: { schoolId: school.id } });
  if (lessonsCount === 0) {
    const lessonNames = [
      { title: 'Introduction to Coptic Hymns', titleAr: 'مقدمة في التراتيل القبطية' },
      { title: 'Basic Melodies (Nabrubol)', titleAr: 'الألحان الأساسية (نبروبول)' },
      { title: 'The Liturgy of St. Basil', titleAr: 'قداس القديس باسيليوس' },
      { title: 'Responses of the Deacons', titleAr: 'ردود الشمامسة' },
      { title: 'The Coptic Alphabet', titleAr: 'الأبجدية القبطية' },
    ];
    const subjects = await prisma.subject.findMany({ where: { schoolId: school.id } });

    for (let i = 0; i < lessonNames.length; i++) {
      const level = levels[i % 5];
      const subject = subjects[i % subjects.length];
      const lesson = await prisma.lesson.create({
        data: {
          schoolId: school.id,
          levelId: level.id,
          subjectId: subject.id,
          title: lessonNames[i].title,
          titleAr: lessonNames[i].titleAr,
          description: `Lesson covering ${lessonNames[i].title}`,
          objectives: [{ en: 'Understand the basics', ar: 'فهم الأساسيات' }],
          orderIndex: i + 1,
          status: 'published',
          publishedAt: new Date(),
          createdBy: adminUserId,
          estimatedDurationMinutes: 45,
          sessionsCount: 3,
        },
      });

      for (let s = 1; s <= 3; s++) {
        await prisma.session.create({
          data: {
            lessonId: lesson.id,
            title: `Session ${s}: ${lessonNames[i].title}`,
            titleAr: `الجلسة ${s}: ${lessonNames[i].titleAr}`,
            description: `Session ${s} of ${lessonNames[i].title}`,
            orderIndex: s,
            estimatedDurationMinutes: 15,
            contentEn: `<h2>Session ${s}</h2><p>Content for ${lessonNames[i].title}</p>`,
            contentAr: `<h2>الجلسة ${s}</h2><p>محتوى ${lessonNames[i].titleAr}</p>`,
          },
        });
      }
    }
    console.log('Created lessons with sessions:', lessonNames.length);
  } else {
    console.log('Lessons already exist:', lessonsCount);
  }

  // ── System Configs ──────────────────────────────────────────────────────
  const configs = [
    { key: 'practice_xp_reward', value: 20, description: 'XP earned per practice session' },
    { key: 'practice_weekly_limit', value: 3, description: 'Max practice sessions per week per child' },
    { key: 'liturgy_badge_threshold', value: 10, description: 'Verified liturgies needed for Faithful Worshipper badge' },
    { key: 'liturgy_xp_reward', value: 30, description: 'XP earned per verified liturgy attendance' },
  ];
  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where: { schoolId_key: { schoolId: school.id, key: cfg.key } },
      update: { value: cfg.value },
      create: { schoolId: school.id, key: cfg.key, value: cfg.value, description: cfg.description },
    });
  }
  console.log('System configs ready');

  console.log('');
  console.log('─────────────────────────────────────────');
  console.log('Login credentials:');
  console.log('  Admin:');
  console.log('    Email:    admin@niangelos.app');
  console.log('    Password: Admin123!');
  console.log('  Servants:');
  console.log('    Email:    mina.girgis@niangelos.app');
  console.log('    Password: Servant123!');
  console.log('    Email:    mariam.iskander@niangelos.app');
  console.log('    Password: Servant123!');
  console.log('  School:   niangelos-main');
  console.log('─────────────────────────────────────────');
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
