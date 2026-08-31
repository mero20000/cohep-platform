const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://niangelos:cTgEMVAUr1souwhagELCeAg4iixs309M@dpg-d9eftd5aeets73b4dk9g-a.oregon-postgres.render.com/niangelos'
    }
  }
});

async function checkOrphans() {
  try {
    const orphans = await prisma.$queryRaw`
      SELECT id, subject_item_id FROM lessons 
      WHERE subject_item_id NOT IN (SELECT id FROM subject_items) 
      AND subject_item_id IS NOT NULL
      LIMIT 10;
    `;
    console.log(`Found ${orphans.length} orphaned lessons:`, orphans);
    
    if (orphans.length > 0) {
      console.log('\nFirst orphaned lesson:', orphans[0]);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrphans();
