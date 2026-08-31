const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://niangelos:cTgEMVAUr1souwhagELCeAg4iixs309M@dpg-d9eftd5aeets73b4dk9g-a/niangelos'
    }
  }
});

async function deleteMigration() {
  try {
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM _prisma_migrations WHERE migration_name = '20260831135815_phase_1_data_model_normalization';`
    );
    console.log(`Deleted ${result} migration record(s)`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

deleteMigration();
