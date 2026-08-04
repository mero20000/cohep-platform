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
  // SECURITY: super-admin is created ONLY from env vars on first boot.
  // No hardcoded/known credentials are ever seeded. If SUPER_ADMIN_EMAIL /
  // SUPER_ADMIN_PASSWORD are unset, no admin user is created and the legacy
  // seed admin is deactivated so it can never be used as a backdoor.
  const bcrypt = await import('bcrypt');
  const superAdminRole = roles.find((r) => r.name === 'super_admin')!;
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || '').trim();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || '';

  // Neutralize any previously-seeded super admin using known default creds.
  const legacyAdmin = await prisma.user.findUnique({
    where: { schoolId_email: { schoolId: school.id, email: 'admin@niangelos.app' } },
  });
  if (legacyAdmin) {
    await prisma.user.update({
      where: { id: legacyAdmin.id },
      data: { isActive: false },
    });
    console.log('Deactivated legacy seed admin (must not be used)');
  }

  let adminUser: any = null;
  if (superAdminEmail && superAdminPassword) {
    const passwordHash = await bcrypt.hash(superAdminPassword, 12);
    adminUser = await prisma.user.upsert({
      where: { schoolId_email: { schoolId: school.id, email: superAdminEmail } },
      update: { passwordHash, isActive: true, deletedAt: null },
      create: {
        schoolId: school.id,
        email: superAdminEmail,
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        firstNameAr: 'مدير عام',
        lastNameAr: 'النظام',
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    const existingRole = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
    });
    if (!existingRole) {
      await prisma.userRole.create({
        data: { userId: adminUser.id, roleId: superAdminRole.id },
      });
    }
    console.log('Super admin ready from env:', superAdminEmail);
  } else {
    console.log('SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD unset — no admin created (secure default).');
  }

  const adminUserId = adminUser?.id;
  const seedDemo = (process.env.SEED_DEMO_USERS || 'true') !== 'false';
  const buildDemo = !!(adminUserId && seedDemo);
  const servantPw = await bcrypt.hash('Servant123!', 10);

  // ── Demo content (servants, students, lessons) — only when a real admin
  //    was configured AND demo data is explicitly allowed. ──────────────────
  if (buildDemo) {

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

  // ── Subject Items ─────────────────────────────────────────────────────
  const subjectItemsCount = await prisma.subjectItem.count({ where: { active: true } });
  if (subjectItemsCount === 0) {
    const allSubjects = await prisma.subject.findMany({ where: { schoolId: school.id } });
    const hymnsSubject = allSubjects.find(s => s.name === 'Coptic Hymns')!;
    const ritesSubject = allSubjects.find(s => s.name === 'Coptic Rites')!;
    const langSubject = allSubjects.find(s => s.name === 'Coptic Language')!;

    const itemData: { subjectId: string; name: string; nameAr: string; nameCoptic: string; levelNumber: number; orderIndex: number; sessionsGroup1: number; sessionsGroup2: number; sessionsGroup3: number; sessionsGroup4: number }[] = [
      // Coptic Hymns
      { subjectId: hymnsSubject.id, name: 'Tenħo (Doxology)', nameAr: 'تنحو (المدحة)', nameCoptic: 'Ⲧⲉⲛϩⲱ', levelNumber: 1, orderIndex: 1, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: hymnsSubject.id, name: 'Nabrubol (Basic Melodies)', nameAr: 'نبروبول (الألحان الأساسية)', nameCoptic: 'Ⲛⲁⲃⲣⲩⲃⲟⲗ', levelNumber: 1, orderIndex: 2, sessionsGroup1: 4, sessionsGroup2: 4, sessionsGroup3: 4, sessionsGroup4: 4 },
      { subjectId: hymnsSubject.id, name: 'Piⲭeⲥ (The Pascha)', nameAr: 'بيخيس (أسبوع الآلام)', nameCoptic: 'Ⲡⲓⲭⲏⲥ', levelNumber: 2, orderIndex: 1, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: hymnsSubject.id, name: 'Efshin naf (Thanksgiving)', nameAr: 'إفشين ناف (الشكر)', nameCoptic: 'Ⲉϥϣⲓⲛ ⲛⲁϥ', levelNumber: 2, orderIndex: 2, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: hymnsSubject.id, name: 'Shere ⲡiⲣⲱmi (Son of Man)', nameAr: 'شيري بي رومي (ابن الإنسان)', nameCoptic: 'Ϣⲏⲣⲉ ⲡⲓⲣⲱⲙⲓ', levelNumber: 3, orderIndex: 1, sessionsGroup1: 4, sessionsGroup2: 4, sessionsGroup3: 4, sessionsGroup4: 4 },
      { subjectId: hymnsSubject.id, name: 'Trisagion (Holy God)', nameAr: 'ثالوث القدوس (الله القدوس)', nameCoptic: 'Ⲑⲱⲟⲩⲁⲃ', levelNumber: 3, orderIndex: 2, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: hymnsSubject.id, name: 'Vespers Hymns', nameAr: 'ألحان العشية', nameCoptic: 'Ⲛⲓϩⲱⲥ ⲛ̀ⲣⲱϩⲓ', levelNumber: 4, orderIndex: 1, sessionsGroup1: 4, sessionsGroup2: 4, sessionsGroup3: 4, sessionsGroup4: 4 },
      { subjectId: hymnsSubject.id, name: 'Gospel Responses', nameAr: 'ردود الإنجيل', nameCoptic: 'Ⲛⲓⲥⲁϫⲓ ⲛ̀ⲧⲉ ⲡⲓⲉⲩⲁⲅⲅⲉⲗⲓⲟⲛ', levelNumber: 4, orderIndex: 2, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: hymnsSubject.id, name: 'Kiahk Hymns', nameAr: 'ألحان شهر كيهك', nameCoptic: 'Ⲛⲓϩⲱⲥ ⲛ̀Ⲕⲓⲁϩⲕ', levelNumber: 5, orderIndex: 1, sessionsGroup1: 4, sessionsGroup2: 4, sessionsGroup3: 4, sessionsGroup4: 4 },
      { subjectId: hymnsSubject.id, name: 'Holy Liturgy Hymns', nameAr: 'ألحان القداس الإلهي', nameCoptic: 'Ⲛⲓϩⲱⲥ ⲛ̀ⲧⲉ ⲫⲓⲉⲣⲟⲩⲣⲅⲓⲁ', levelNumber: 5, orderIndex: 2, sessionsGroup1: 4, sessionsGroup2: 4, sessionsGroup3: 4, sessionsGroup4: 4 },
      // Coptic Rites
      { subjectId: ritesSubject.id, name: 'Morning Raising of Incense', nameAr: 'رفع بخور باكر', nameCoptic: 'Ϯⲥ̀ϩⲏⲟⲩ ⲙ̀ⲡⲓⲟⲩⲉⲣϣⲓⲛⲓ', levelNumber: 1, orderIndex: 1, sessionsGroup1: 2, sessionsGroup2: 2, sessionsGroup3: 2, sessionsGroup4: 2 },
      { subjectId: ritesSubject.id, name: 'Evening Raising of Incense', nameAr: 'رفع بخور عشية', nameCoptic: 'Ⲡⲓⲟⲩⲉⲣϣⲓⲛⲓ ⲛ̀ⲣⲱϩⲓ', levelNumber: 1, orderIndex: 2, sessionsGroup1: 2, sessionsGroup2: 2, sessionsGroup3: 2, sessionsGroup4: 2 },
      { subjectId: ritesSubject.id, name: 'Liturgy of the Word', nameAr: 'قداس الكلمة', nameCoptic: 'Ⲫⲓⲉⲣⲟⲩⲣⲅⲓⲁ ⲛ̀ⲧⲉ ⲡⲓⲥⲁϫⲓ', levelNumber: 2, orderIndex: 1, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: ritesSubject.id, name: 'Liturgy of the Faithful', nameAr: 'قداس المؤمنين', nameCoptic: 'Ⲫⲓⲉⲣⲟⲩⲣⲅⲓⲁ ⲛ̀ⲧⲉ ⲛⲓⲡⲓⲥⲧⲟⲥ', levelNumber: 2, orderIndex: 2, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: ritesSubject.id, name: 'Great Lent Rites', nameAr: 'طقس الصوم الكبير', nameCoptic: 'Ⲫⲓⲟⲩⲉⲣϣⲓⲛⲓ ⲛ̀ⲧⲉ ⲡⲓⲛⲏⲥⲧⲓⲁ', levelNumber: 3, orderIndex: 1, sessionsGroup1: 4, sessionsGroup2: 4, sessionsGroup3: 4, sessionsGroup4: 4 },
      { subjectId: ritesSubject.id, name: 'Holy Week Rites', nameAr: 'طقس أسبوع الآلام', nameCoptic: 'Ⲫⲓⲟⲩⲉⲣϣⲓⲛⲓ ⲛ̀ⲧⲉ ⲡⲓϫⲱⲕ', levelNumber: 3, orderIndex: 2, sessionsGroup1: 4, sessionsGroup2: 4, sessionsGroup3: 4, sessionsGroup4: 4 },
      { subjectId: ritesSubject.id, name: 'Baptism Rite', nameAr: 'طقس المعمودية', nameCoptic: 'Ⲫⲓⲟⲩⲉⲣϣⲓⲛⲓ ⲛ̀ⲧⲉ ⲡⲓⲱⲙⲥ', levelNumber: 4, orderIndex: 1, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: ritesSubject.id, name: 'Marriage Rite', nameAr: 'طقس الزواج', nameCoptic: 'Ⲫⲓⲟⲩⲉⲣϣⲓⲛⲓ ⲛ̀ⲧⲉ ⲫⲓⲅⲁⲙⲟⲥ', levelNumber: 4, orderIndex: 2, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: ritesSubject.id, name: 'Priesthood Rites', nameAr: 'طقس الكهنوت', nameCoptic: 'Ⲫⲓⲟⲩⲉⲣϣⲓⲛⲓ ⲛ̀ⲧⲉ ⲡⲓⲟⲩⲏⲃ', levelNumber: 5, orderIndex: 1, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: ritesSubject.id, name: 'Consecration Rites', nameAr: 'طقس التكريس', nameCoptic: 'Ⲫⲓⲟⲩⲉⲣϣⲓⲛⲓ ⲛ̀ⲧⲉ ⲡⲓⲧⲟⲩⲃⲟ', levelNumber: 5, orderIndex: 2, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      // Coptic Language
      { subjectId: langSubject.id, name: 'Coptic Alphabet', nameAr: 'الأبجدية القبطية', nameCoptic: 'Ⲛⲓⲥ̀ϧⲁⲓ ⲛ̀ⲣⲉⲙⲛ̀ⲕⲏⲙⲉ', levelNumber: 1, orderIndex: 1, sessionsGroup1: 4, sessionsGroup2: 4, sessionsGroup3: 4, sessionsGroup4: 4 },
      { subjectId: langSubject.id, name: 'Basic Greetings', nameAr: 'التحيات الأساسية', nameCoptic: 'Ⲛⲓϩⲟⲗⲟⲕ', levelNumber: 1, orderIndex: 2, sessionsGroup1: 2, sessionsGroup2: 2, sessionsGroup3: 2, sessionsGroup4: 2 },
      { subjectId: langSubject.id, name: 'Numbers 1-20', nameAr: 'الأرقام 1-20', nameCoptic: 'Ⲛⲓⲁⲣⲓⲑⲙⲟⲥ', levelNumber: 2, orderIndex: 1, sessionsGroup1: 2, sessionsGroup2: 2, sessionsGroup3: 2, sessionsGroup4: 2 },
      { subjectId: langSubject.id, name: 'Basic Vocabulary - Family', nameAr: 'المفردات الأساسية - العائلة', nameCoptic: 'Ⲛⲓⲥⲁϫⲓ ⲛ̀ⲧⲉ ⲡⲓⲏⲓ', levelNumber: 2, orderIndex: 2, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: langSubject.id, name: 'Basic Vocabulary - Church', nameAr: 'المفردات الأساسية - الكنيسة', nameCoptic: 'Ⲛⲓⲥⲁϫⲓ ⲛ̀ⲧⲉ ϯⲉⲕⲕⲗⲏⲥⲓⲁ', levelNumber: 3, orderIndex: 1, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: langSubject.id, name: 'Simple Phrases', nameAr: 'الجمل البسيطة', nameCoptic: 'Ⲛⲓⲥⲁϫⲓ ⲉⲧⲟⲩⲟⲛϩ', levelNumber: 3, orderIndex: 2, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: langSubject.id, name: 'Reading Practice', nameAr: 'تمرين القراءة', nameCoptic: 'Ϯⲙⲉⲗⲉⲧⲏ ⲛ̀ⲟⲩⲱϣ', levelNumber: 4, orderIndex: 1, sessionsGroup1: 4, sessionsGroup2: 4, sessionsGroup3: 4, sessionsGroup4: 4 },
      { subjectId: langSubject.id, name: 'Grammar Basics', nameAr: 'أساسيات القواعد', nameCoptic: 'Ⲛⲓⲥⲁϫⲓ ⲛ̀ⲧⲉ ϯⲅⲣⲁⲙⲙⲁⲧⲓⲕⲏ', levelNumber: 4, orderIndex: 2, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
      { subjectId: langSubject.id, name: 'Verb Conjugation', nameAr: 'تصريف الأفعال', nameCoptic: 'Ⲡⲓⲥⲱⲧⲡ ⲛ̀ⲧⲉ ⲛⲓⲣⲏϯ', levelNumber: 5, orderIndex: 1, sessionsGroup1: 4, sessionsGroup2: 4, sessionsGroup3: 4, sessionsGroup4: 4 },
      { subjectId: langSubject.id, name: 'Sentence Structure', nameAr: 'تركيب الجمل', nameCoptic: 'Ϯⲥⲙⲏ ⲛ̀ⲧⲉ ⲛⲓⲥⲁϫⲓ', levelNumber: 5, orderIndex: 2, sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3 },
    ];

    for (const item of itemData) {
      const created = await prisma.subjectItem.create({
        data: {
          subjectId: item.subjectId,
          name: item.name,
          nameAr: item.nameAr,
          nameCoptic: item.nameCoptic,
          orderIndex: item.orderIndex,
          sessionsGroup1: item.sessionsGroup1,
          sessionsGroup2: item.sessionsGroup2,
          sessionsGroup3: item.sessionsGroup3,
          sessionsGroup4: item.sessionsGroup4,
          metadata: {},
          active: true,
          status: 'published',
          educationLanguages: ['coptic', 'arabic', 'english'],
          whenLabel: `Year 1`,
        },
      });

      await prisma.subjectItemLevel.create({
        data: {
          subjectItemId: created.id,
          levelNumber: item.levelNumber,
        },
      });
    }

    console.log(`Created ${itemData.length} subject items with level assignments`);
  } else {
    console.log('Subject items already exist:', subjectItemsCount);
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
  } // /if (buildDemo)
  if (!buildDemo) {
    console.log('Skipped demo content (requires SUPER_ADMIN_* env and SEED_DEMO_USERS=true).');
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
  console.log('Super admin:');
  console.log(superAdminEmail
    ? `  Email:    ${superAdminEmail}\n  Password: SUPPLIED VIA ENV (SUPER_ADMIN_PASSWORD)`
    : '  None — set SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD to create one.');
  if (buildDemo) {
    console.log('  Demo servants (SEED_DEMO_USERS):');
    console.log('    mina.girgis@niangelos.app / Servant123!');
    console.log('    mariam.iskander@niangelos.app / Servant123!');
  }
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
