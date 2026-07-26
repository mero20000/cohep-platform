const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const MALE = new Set([
  'Abanoub','Abraam','Adam','Adriano','Alexander','Amir','Andy','Anthony','Bishoy',
  'Carlos','Chris','Clever','Daniel','David','Ebram','Emanuel','Eric','Evan','George',
  'Johnny','Jonathan','Joseph','Jounier','Justin','Kevin','Kyrillos','Manuel','Marc',
  'Marcillio','Mark','Marteros','Martin','Mena','Michael','Mina','Nadim','Nicol',
  'Nicolase','Oliver','Patrick','Paulo','Peter','Philippe','Philopateer','Philopatir',
  'Pierre','Raphael','Robin','Rogeh','Steve','Theodore','Yousef','Test'
]);

const FEMALE = new Set([
  'Amy','Andrea','Antonella','Celine','Cyrine','Donia','Elsa','Ereeny','Gabriella',
  'Heavenly','Isabelle','Janelle','Jessy','Joelle','Joliana','Joy','Julia','Juliana',
  'Karen','Karma','Ladona','Lorraine','Mariam','Marina','Marly','Marwnya','Meriam',
  'Michaela','Miabelle','Nariman','Natalia','Natalie','Parthie','Purity','Sabina',
  'Sandy','Shery','Sofia','Sophia','Theodora','Tia'
]);

function guessGender(firstName, current) {
  if (MALE.has(firstName)) return 'male';
  if (FEMALE.has(firstName)) return 'female';
  return current || 'male';
}

async function main() {
  const group = await prisma.group.findFirst({ where: { name: 'Group 1' } });
  if (!group) throw new Error('Group 1 not found');

  const students = await prisma.student.findMany({ where: { groupId: group.id } });
  console.log(`Updating ${students.length} students in Group 1`);

  let male = 0, female = 0, church = 0, recoded = 0, collisions = 0;
  const usedCodes = new Set();

  for (const s of students) {
    const newCode = s.studentCode.replace(/\D/g, '');
    const gender = guessGender(s.firstName, s.gender);

    let data = {
      churchName: 'St. Mina Coptic Orthodox Church',
      gender,
    };

    if (newCode && newCode !== s.studentCode) {
      if (usedCodes.has(newCode)) {
        collisions++;
      } else {
        data.studentCode = newCode;
        usedCodes.add(newCode);
        recoded++;
      }
    } else if (newCode) {
      usedCodes.add(newCode);
    }

    await prisma.student.update({ where: { id: s.id }, data });
    if (gender === 'male') male++; else female++;
    church++;
  }

  console.log(`Done. churchSet=${church} male=${male} female=${female} recoded=${recoded} collisions=${collisions}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
