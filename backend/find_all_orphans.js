const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://niangelos:cTgEMVAUr1souwhagELCeAg4iixs309M@dpg-d9eftd5aeets73b4dk9g-a.oregon-postgres.render.com/niangelos'
    }
  }
});

async function findOrphans() {
  try {
    const systemConfigs = await prisma.$queryRaw`
      SELECT id, school_id FROM system_configs 
      WHERE school_id NOT IN (SELECT id FROM schools);
    `;
    
    console.log(`Found ${systemConfigs.length} orphaned system_configs:`);
    systemConfigs.forEach(sc => console.log(`  ${sc.id} -> school ${sc.school_id}`));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

findOrphans();
