const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importStudents() {
  try {
    // Get school ID (assuming first school in system)
    const school = await prisma.school.findFirst();
    if (!school) {
      console.error('No school found in database');
      process.exit(1);
    }

    // Get academic year
    let academicYear = await prisma.academicYear.findFirst({
      where: { schoolId: school.id, isCurrent: true }
    });
    if (!academicYear) {
      academicYear = await prisma.academicYear.findFirst({
        where: { schoolId: school.id },
        orderBy: { createdAt: 'desc' }
      });
    }
    if (!academicYear) {
      console.error('No academic year found');
      process.exit(1);
    }

    // Get level
    const level = await prisma.level.findFirst({
      where: { id: '4f2e56c9', schoolId: school.id }
    });
    if (!level) {
      console.error('Level 4f2e56c9 not found');
      const allLevels = await prisma.level.findMany({ where: { schoolId: school.id } });
      console.log('Available levels:', allLevels);
      process.exit(1);
    }

    // Get grade
    const grade = await prisma.schoolGrade.findFirst({
      where: { name: 'Grade 4B', schoolId: school.id }
    });
    if (!grade) {
      console.error('Grade "Grade 4B" not found');
      process.exit(1);
    }

    console.log(`Importing to school: ${school.id}`);
    console.log(`Academic year: ${academicYear.id}`);
    console.log(`Level: ${level.name}`);
    console.log(`Grade: ${grade.name}\n`);

    // Parse dates - handle DD/MM/YYYY format
    function parseDate(dateStr) {
      if (!dateStr || dateStr.trim() === '') return null;
      const parts = dateStr.trim().split('/');
      if (parts.length !== 3) return null;
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      return new Date(year, month - 1, day);
    }

    // Student data
    const students = [
      { name: 'Joliana Adel', dob: '28/10/2016' },
      { name: 'Gabriella amir', dob: '30/06/2016' },
      { name: 'Joelle Andre Maher Wahba Sorial', dob: '17/01/2017' },
      { name: 'Theodore Antwan', dob: '08/02/2017' },
      { name: 'Natalie Arsany Botros', dob: '13/10/2016' },
      { name: 'Adam Basem', dob: '31/10/2017' },
      { name: 'Oliver Bishoy', dob: '04/03/2017' },
      { name: 'Puirty Bishoy', dob: '01/06/2016' },
      { name: 'Isabelle Boushra', dob: '03/07/2017' },
      { name: 'Patrick Emad', dob: '23/07/2016' },
      { name: 'Chris Fady', dob: '16/09/2017' },
      { name: 'Johnny Fady Sawiris Gad', dob: '07/04/2017' },
      { name: 'Jessy John Gamal', dob: '21/04/2017' },
      { name: 'Daniel George Mourad Sadek Kodsy', dob: '02/06/2017' },
      { name: 'Celine Hany', dob: '14/09/2016' },
      { name: 'David Magdy', dob: '30/07/2017' },
      { name: 'Justin Maged', dob: '' }, // Empty DOB
      { name: 'Manuel Mina Maher Ibrahim Nessim', dob: '26/12/2016' },
      { name: 'Gabriella Michal Adel', dob: '01/12/2016' },
      { name: 'Kyrillos Micheal', dob: '30/05/2016' },
      { name: 'Amy Mina Matta', dob: '10/08/2017' },
      { name: 'Tia Mina Matta', dob: '24/03/2017' },
      { name: 'Joseph John Nawar', dob: '19/03/2017' },
      { name: 'Meriam Peter Boshra', dob: '24/01/2017' },
      { name: 'Joy Remon', dob: '21/07/2016' },
      { name: 'Paulo Mina Magdy Rizk', dob: '06/06/2016' },
      { name: 'Marwnya Emad Sabry', dob: '12/04/2017' },
      { name: 'Antonella Salib Helal', dob: '29/06/2017' },
      { name: 'Joseph Shady Abdelmalek', dob: '18/07/2017' },
      { name: 'Chris Simon', dob: '01/03/2017' },
      { name: 'Sophia Mina Tadros', dob: '13/05/2017' },
      { name: 'Parthie Yossery Salah Shafiq kerolos', dob: '01/09/2016' }
    ];

    let imported = 0;
    let skipped = 0;

    for (const student of students) {
      const nameParts = student.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || student.name;

      // Skip if no valid date
      if (!student.dob) {
        console.log(`⊘ Skipping ${student.name}: No date of birth`);
        skipped++;
        continue;
      }

      const dob = parseDate(student.dob);
      if (!dob || isNaN(dob.getTime())) {
        console.log(`⊘ Skipping ${student.name}: Invalid date "${student.dob}"`);
        skipped++;
        continue;
      }

      try {
        // Generate student code
        const lastStudent = await prisma.student.findFirst({
          where: { schoolId: school.id },
          orderBy: { createdAt: 'desc' },
          select: { studentCode: true }
        });
        let nextCode = 1;
        if (lastStudent && lastStudent.studentCode) {
          const match = lastStudent.studentCode.match(/STU-(\d+)/);
          if (match) nextCode = parseInt(match[1]) + 1;
        }
        const studentCode = `STU-${String(nextCode).padStart(5, '0')}`;

        // Create student
        await prisma.student.create({
          data: {
            firstName,
            lastName,
            dateOfBirth: dob,
            gender: 'other',
            churchName: 'Saint Mina Coptic Orthodox Church - Dubai',
            levelId: level.id,
            gradeId: grade.id,
            groupId: grade.groupId,
            schoolId: school.id,
            studentCode,
            academicYearId: academicYear.id,
            status: 'active',
            enrollmentDate: new Date()
          }
        });

        console.log(`✓ Imported: ${firstName} ${lastName} (${student.dob})`);
        imported++;
      } catch (err) {
        console.error(`✗ Error importing ${student.name}:`, err.message);
        skipped++;
      }
    }

    console.log(`\n✅ Done! Imported: ${imported}, Skipped: ${skipped}`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

importStudents();
