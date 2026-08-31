const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAttendance() {
  try {
    console.log('Checking attendance records...\n');

    // Count total attendance records
    const totalCount = await prisma.attendanceRecord.count();
    console.log(`Total attendance records in database: ${totalCount}`);

    // Get attendance records with details
    const records = await prisma.attendanceRecord.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        recordedAt: true,
        createdAt: true,
        attendanceSession: { select: { id: true, sessionDate: true } },
        student: { select: { firstName: true, lastName: true } }
      }
    });

    if (records.length === 0) {
      console.log('\n❌ NO attendance records found in the database!');
    } else {
      console.log(`\n✅ Found ${records.length} recent attendance records:\n`);
      records.forEach((r, i) => {
        console.log(`${i + 1}. ${r.student.firstName} ${r.student.lastName}`);
        console.log(`   Status: ${r.status}`);
        console.log(`   Session Date: ${r.attendanceSession.sessionDate}`);
        console.log(`   Recorded: ${r.recordedAt}`);
        console.log();
      });
    }

    // Check if any sessions exist
    const sessionCount = await prisma.attendanceSession.count();
    console.log(`Total attendance sessions: ${sessionCount}`);

    await prisma.$disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkAttendance();
