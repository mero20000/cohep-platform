import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BADGES = [
  {
    name: 'Faithful Worshipper',
    nameAr: 'المُصَلّي الأمين',
    description: 'Attended 10 liturgy sessions verified by servants',
    descriptionAr: 'حضر 10 قداسات معتمدة من الخدام',
    iconUrl: '⛪',
    category: 'liturgy',
    xpReward: 200,
    criteria: { rule: 'liturgy_total', count: 10 },
  },
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
  {
    name: 'Home Practitioner',
    nameAr: 'المتمرن المنزلي',
    description: 'Practiced at home 5 times with family',
    descriptionAr: 'تمرن في المنزل 5 مرات مع العائلة',
    iconUrl: '🏠',
    category: 'practice',
    xpReward: 100,
    criteria: { rule: 'practice_total', count: 5 },
  },
  {
    name: 'Practice Streak',
    nameAr: 'سلسلة التمرين',
    description: 'Practiced at home for 3 consecutive weeks',
    descriptionAr: 'تمرن في المنزل لمدة 3 أسابيع متتالية',
    iconUrl: '🔥',
    category: 'practice',
    xpReward: 150,
    criteria: { rule: 'practice_streak', weeks: 3 },
  },
  {
    name: 'Subject Master',
    nameAr: 'متقن المادة',
    description: 'Passed 5 subject items',
    descriptionAr: 'اجتاز 5 عناصر درسية',
    iconUrl: '🎓',
    category: 'academic',
    xpReward: 200,
    criteria: { rule: 'subject_items_passed', count: 5 },
  },
  {
    name: 'Recording Star',
    nameAr: 'نجم التسجيلات',
    description: 'Submitted 5 practice recordings',
    descriptionAr: 'أرسل 5 تسجيلات تمرين',
    iconUrl: '🎙️',
    category: 'practice',
    xpReward: 150,
    criteria: { rule: 'recordings_submitted', count: 5 },
  },
  {
    name: 'Assessment Streak',
    nameAr: 'سلسلة التقييمات',
    description: 'Passed 3 consecutive assessments',
    descriptionAr: 'اجتاز 3 تقييمات متتالية',
    iconUrl: '📊',
    category: 'academic',
    xpReward: 200,
    criteria: { rule: 'assessment_streak', count: 3 },
  },
  {
    name: 'Family Star',
    nameAr: 'نجم العائلة',
    description: 'Parent reported 3 home assessment results',
    descriptionAr: 'أبلغ الوالد عن 3 نتائج تقييم منزلية',
    iconUrl: '👨‍👩‍👧',
    category: 'family',
    xpReward: 100,
    criteria: { rule: 'parent_reports_total', count: 3 },
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
