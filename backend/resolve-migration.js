#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resolveMigration() {
  try {
    console.log('🔍 Checking failed migrations...');

    const failed = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations"
      WHERE migration_name = '20260902000000_phase5_performance_indexes'
      AND finished_at IS NULL
    `;

    if (failed.length === 0) {
      console.log('✅ No failed migrations found. Deployment should proceed.');
      return;
    }

    console.log(`Found ${failed.length} failed migration(s). Removing...`);

    await prisma.$executeRaw`
      DELETE FROM "_prisma_migrations"
      WHERE migration_name = '20260902000000_phase5_performance_indexes'
    `;

    console.log('✅ Migration record cleared. Render will retry automatically.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resolveMigration();
