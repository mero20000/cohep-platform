import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BADGES = [
  {
    name: 'Perfect Week',
    nameAr: 'أسبوع كامل',
    description: 'Attend all sessions in a calendar week without absence',
    descriptionAr: 'حضور جميع الحصص في الأسبوع بدون غياب',
    iconUrl: '📅',
    category: 'attendance',
    xpReward: 100,
    criteria: { rule: 'perfect_week' },
  },
  {
    name: 'Perfect Month',
    nameAr: 'شهر كامل',
    description: 'Attend all sessions in a calendar month without absence',
    descriptionAr: 'حضور جميع الحصص في الشهر بدون غياب',
    iconUrl: '🗓️',
    category: 'attendance',
    xpReward: 300,
    criteria: { rule: 'perfect_month' },
  },
  {
    name: 'Star Behavior',
    nameAr: 'سلوك نجمي',
    description: 'Get a behavior score of 5/5 for 3 consecutive sessions',
    descriptionAr: 'الحصول على درجة سلوك 5/5 في 3 حصص متتالية',
    iconUrl: '⭐',
    category: 'behavior',
    xpReward: 100,
    criteria: { rule: 'behavior_streak', count: 3 },
  },
  {
    name: 'Active Voice',
    nameAr: 'صوت نشط',
    description: 'Get a participation score of 5/5 on 5 sessions total',
    descriptionAr: 'الحصول على درجة مشاركة 5/5 في 5 حصص إجمالاً',
    iconUrl: '🎤',
    category: 'participation',
    xpReward: 150,
    criteria: { rule: 'participation_total', count: 5 },
  },
  {
    name: 'Faithful',
    nameAr: 'مؤمن',
    description: 'Attend liturgy 5 times',
    descriptionAr: 'حضور القداس 5 مرات',
    iconUrl: '⛪',
    category: 'liturgy',
    xpReward: 200,
    criteria: { rule: 'liturgy_total', count: 5 },
  },
  {
    name: 'Dedicated',
    nameAr: 'ملتزم',
    description: 'Attend 50 sessions total',
    descriptionAr: 'حضور 50 حصة إجمالاً',
    iconUrl: '🏆',
    category: 'attendance',
    xpReward: 500,
    criteria: { rule: 'attendance_total', count: 50 },
  },
  {
    name: 'Consistent',
    nameAr: 'منتظم',
    description: 'Attend at least one session each week for 4 consecutive weeks',
    descriptionAr: 'حضور حصة واحدة على الأقل أسبوعياً لمدة 4 أسابيع متتالية',
    iconUrl: '📈',
    category: 'attendance',
    xpReward: 200,
    criteria: { rule: 'attendance_streak', weeks: 4 },
  },
  {
    name: 'Point Collector',
    nameAr: 'جامع النقاط',
    description: 'Accumulate 500 total points',
    descriptionAr: 'تجميع 500 نقطة إجمالاً',
    iconUrl: '🪙',
    category: 'points',
    xpReward: 300,
    criteria: { rule: 'points_total', points: 500 },
  },
  {
    name: 'Point Master',
    nameAr: 'سيد النقاط',
    description: 'Accumulate 2000 total points',
    descriptionAr: 'تجميع 2000 نقطة إجمالاً',
    iconUrl: '💎',
    category: 'points',
    xpReward: 800,
    criteria: { rule: 'points_total', points: 2000 },
  },
  {
    name: 'Rising Star',
    nameAr: 'نجم صاعد',
    description: 'Improve attendance rate by 15% month-over-month',
    descriptionAr: 'تحسين نسبة الحضور بنسبة 15% مقارنة بالشهر السابق',
    iconUrl: '🌟',
    category: 'improvement',
    xpReward: 200,
    criteria: { rule: 'attendance_improvement', percent: 15 },
  },
  {
    name: 'Perfect Score',
    nameAr: 'درجة كاملة',
    description: 'Score 100% on any assessment',
    descriptionAr: 'الحصول على 100% في أي اختبار',
    iconUrl: '✅',
    category: 'academic',
    xpReward: 250,
    criteria: { rule: 'assessment_perfect' },
  },
  {
    name: 'XP Champion',
    nameAr: 'بطل النقاط',
    description: 'Earn 1000 total XP',
    descriptionAr: 'تجميع 1000 نقطة خبرة إجمالاً',
    iconUrl: '⚡',
    category: 'xp',
    xpReward: 500,
    criteria: { rule: 'xp_total', xp: 1000 },
  },
];

async function main() {
  console.log('Seeding badges...');

  const school = await prisma.school.findFirst({ where: { slug: 'niangelos-main' } });
  if (!school) {
    console.log('School not found — skipping badge seed');
    return;
  }

  let created = 0;
  let updated = 0;
  for (const b of BADGES) {
    const existing = await prisma.badge.findFirst({
      where: { schoolId: school.id, criteria: { path: ['rule'], equals: b.criteria.rule } },
    });
    if (!existing) {
      await prisma.badge.create({
        data: {
          schoolId: school.id,
          name: b.name,
          nameAr: b.nameAr,
          description: b.description,
          descriptionAr: b.descriptionAr,
          iconUrl: b.iconUrl,
          category: b.category,
          xpReward: b.xpReward,
          criteria: b.criteria,
          isActive: true,
        },
      });
      created++;
    } else if (existing.iconUrl !== b.iconUrl) {
      await prisma.badge.update({
        where: { id: existing.id },
        data: { iconUrl: b.iconUrl },
      });
      updated++;
    }
  }

  console.log(`Created ${created}, updated ${updated} badges (${BADGES.length - created - updated} unchanged)`);
}

main()
  .catch((e) => { console.error('Badge seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
