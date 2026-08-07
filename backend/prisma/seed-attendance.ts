import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding attendance data...');

  const school = await prisma.school.findFirst({ where: { slug: 'niangelos-main' } });
  if (!school) { console.error('School not found'); return; }

  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@niangelos.app' } });
  if (!adminUser) { console.error('Admin user not found'); return; }

  const levels = await prisma.level.findMany({ where: { schoolId: school.id }, orderBy: { number: 'asc' }, take: 5 });
  const lessons = await prisma.lesson.findMany({ where: { schoolId: school.id, subject: { name: 'Coptic Hymns' } }, take: 10 });
  const students = await prisma.student.findMany({ where: { schoolId: school.id }, take: 24 });

  if (students.length === 0) { console.error('No students found - run student seed first'); return; }

  const statuses = ['present', 'present', 'present', 'present', 'late', 'absent', 'excused'];
  const hwStatuses = ['completed', 'completed', 'partial', 'not_submitted', 'not_assigned'];
  const sessionStatuses = ['completed', 'completed', 'completed', 'scheduled', 'in_progress'];

  const now = new Date();
  let totalSessions = 0;
  let totalRecords = 0;

  for (let dayOffset = 14; dayOffset >= 0; dayOffset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends

    const sessionsToday = Math.min(3, levels.length);
    for (let s = 0; s < sessionsToday; s++) {
      const level = levels[s % levels.length];
      const lesson = lessons.find(l => l.levelId === level.id) || lessons[0];
      if (!lesson) continue;

      const groups = await prisma.group.findMany({ where: { schoolId: school.id } });
      const group = groups[0];
      if (!group) continue;

      const levelStudents = students.filter(st => st.levelId === level.id);
      if (levelStudents.length === 0) continue;

      const isPast = dayOffset > 2;
      const status = isPast ? 'completed' : sessionStatuses[Math.floor(Math.random() * sessionStatuses.length)];
      const time = s === 0 ? '16:00' : s === 1 ? '17:00' : '18:00';

      const session = await prisma.attendanceSession.create({
        data: {
          schoolId: school.id,
          lessonId: lesson.id,
          servantId: adminUser.id,
          levelId: level.id,
          groupId: group.id,
          scheduledDate: date,
          scheduledTime: time,
          status,
          notes: isPast ? `Regular ${level.name} class` : undefined,
        },
      });
      totalSessions++;

      if (isPast && status === 'completed') {
        const records = levelStudents.slice(0, Math.min(levelStudents.length, 12)).map(student => {
          const roll = Math.random();
          const st = roll < 0.7 ? 'present' : roll < 0.85 ? 'late' : roll < 0.95 ? 'absent' : 'excused';
          const hw = hwStatuses[Math.floor(Math.random() * hwStatuses.length)];
          return prisma.attendanceRecord.create({
            data: {
              attendanceSessionId: session.id,
              studentId: student.id,
              status: st,
              homeworkStatus: hw,
              note: st === 'excused' ? 'Parent notified' : undefined,
              recordedBy: adminUser.id,
              recordedAt: date,
            },
          });
        });
        await Promise.all(records);
        totalRecords += records.length;
      }
    }
  }

  console.log(`Created ${totalSessions} attendance sessions with ${totalRecords} student records`);
}

main()
  .catch((e) => { console.error('Seeding failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
