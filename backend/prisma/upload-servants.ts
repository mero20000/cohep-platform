import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SCHOOL_SLUG = 'niangelos-main';
const DEFAULT_PW = 'Password123!';
const GROUP = 'Group 1B';
const TEACHING_SUBJECTS = ['Coptic Hymns', 'Coptic Rites', 'Coptic Language'];
const DATE_JOINED = '01/09/2024';

interface ServantRow {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  level: string;
}

// lastName left blank where the source had no known surname ("Missing")
const servants: ServantRow[] = [
  { email: 'servant01@niangelos.org', firstName: 'Peter', lastName: 'Boshra', phone: '+9715000000', level: 'Level 2' },
  { email: 'servant02@niangelos.org', firstName: 'Ereeny', lastName: 'Soliman', phone: '+9715000000', level: 'Level 2' },
  { email: 'servant03@niangelos.org', firstName: 'Abanoub', lastName: 'Mikhael', phone: '+9715000000', level: 'Level 1' },
  { email: 'servant04@niangelos.org', firstName: 'Mark', lastName: 'Sobhy', phone: '+9715000000', level: 'Level 2' },
  { email: 'servant05@niangelos.org', firstName: 'Hany', lastName: 'Saleb', phone: '+9715000000', level: 'Level 1' },
  { email: 'servant06@niangelos.org', firstName: 'Marc', lastName: 'Hanna', phone: '+9715000000', level: 'Level 2' },
  { email: 'servant07@niangelos.org', firstName: 'Beshoy', lastName: 'Emil', phone: '+9715000000', level: 'Level 2' },
  { email: 'servant08@niangelos.org', firstName: 'Christine', lastName: '', phone: '+9715000000', level: 'Level 1' },
  { email: 'servant09@niangelos.org', firstName: 'Monica', lastName: '', phone: '+9715000000', level: 'Level 1' },
  { email: 'servant10@niangelos.org', firstName: 'Mark', lastName: 'Medhat', phone: '+9715000000', level: 'Level 1' },
];

async function main() {
  const school = await prisma.school.findUnique({ where: { slug: SCHOOL_SLUG } });
  if (!school) {
    console.error(`School "${SCHOOL_SLUG}" not found in this database. Aborting.`);
    process.exit(1);
  }
  const schoolId = school.id;

  const role = await prisma.role.findUnique({ where: { name: 'servant' } });
  if (!role) {
    console.error('Role "servant" not found. Aborting.');
    process.exit(1);
  }

  const yearsOfService = Math.max(0, new Date().getFullYear() - new Date(DATE_JOINED).getFullYear());
  console.log(`School: ${school.name} (${schoolId}) · role: servant · yearsOfService: ${yearsOfService}\n`);

  let created = 0;
  let skipped = 0;

  for (const s of servants) {
    const existing = await prisma.user.findFirst({
      where: { email: s.email, schoolId, deletedAt: null },
    });
    if (existing) {
      console.log(`SKIP  ${s.email} (already exists)`);
      skipped++;
      continue;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PW, 12);
    const user = await prisma.user.create({
      data: {
        email: s.email,
        passwordHash,
        firstName: s.firstName,
        lastName: s.lastName,
        phone: s.phone,
        schoolId,
        locale: 'en',
        timezone: 'UTC',
        metadata: { dateJoined: DATE_JOINED, teachingSubjects: TEACHING_SUBJECTS },
      },
    });

    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    await prisma.servantProfile.create({
      data: {
        userId: user.id,
        schoolId,
        yearsOfService,
        currentLevelName: s.level,
        currentGroupName: GROUP,
        lastCalculatedAt: new Date(),
      },
    });

    console.log(`OK     ${s.email} → ${s.firstName} ${s.lastName} (${s.level})`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
