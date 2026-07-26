import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding academic weeks...');
  const school = await prisma.school.findFirst({ where: { slug: 'niangelos-main' } });
  if (!school) { console.error('School not found'); return; }
  const year = await prisma.academicYear.findFirst({ where: { schoolId: school.id, isCurrent: true } });
  if (!year) { console.error('Academic year not found'); return; }

  const start = new Date(year.startDate);
  let weekNum = 1;
  const feastWeeks: number[] = []; // weeks around Christmas, Easter, etc.

  for (let w = 0; w < 40; w++) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + w * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const term = w < 14 ? 1 : w < 27 ? 2 : 3;
    const month = weekStart.getMonth();
    const isFeast = (month === 11 && weekStart.getDate() >= 20) || (month === 0 && weekStart.getDate() <= 7) || // Christmas/New Year
                    (month === 2 && weekStart.getDate() >= 15 && weekStart.getDate() <= 31) || // Lent/Easter approx
                    (month === 3 && weekStart.getDate() <= 15); // Easter/Resurrection

    if (isFeast) feastWeeks.push(weekNum);

    await prisma.academicWeek.upsert({
      where: { academicYearId_weekNumber: { academicYearId: year.id, weekNumber: weekNum } },
      update: {},
      create: {
        academicYearId: year.id,
        weekNumber: weekNum,
        term,
        startDate: weekStart,
        endDate: weekEnd,
        isAvailable: !isFeast,
        label: isFeast ? (month === 11 ? 'Christmas Feast' : month <= 0 ? 'New Year' : 'Lent/Easter') : undefined,
        reason: isFeast ? 'Feast period - not available for allocation' : undefined,
      },
    });
    weekNum++;
  }

  console.log(`Created ${weekNum - 1} academic weeks (${feastWeeks.length} feast/unavailable)`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
