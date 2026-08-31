const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAttendance() {
  try {
    const count = await prisma.attendanceRecord.count();
    console.log(`✅ Total attendance records: ${count}\n`);

    const records = await prisma.attendanceRecord.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        recordedAt: true,
        createdAt: true,
        attendanceSession: { select: { id: true, scheduledDate: true } },
        student: { select: { firstName: true, lastName: true } }
      }
    });

    console.log(`Recent 15 attendance records:\n`);
    records.forEach((r, i) => {
      console.log(`${i + 1}. ${r.student.firstName} ${r.student.lastName}`);
      console.log(`   Status: ${r.status}`);
      console.log(`   Scheduled: ${r.attendanceSession.scheduledDate}`);
      console.log(`   Recorded: ${r.recordedAt}`);
      console.log();
    });

    // Check today's records
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = await prisma.attendanceRecord.count({
      where: {
        attendanceSession: {
          scheduledDate: { gte: today, lt: tomorrow }
        }
      }
    });

    console.log(`\nToday's attendance records: ${todayCount}`);

    await prisma.$disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkAttendance();
