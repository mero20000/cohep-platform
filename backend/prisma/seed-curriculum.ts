import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const copticHymnsByLevel: Record<number, Array<{ title: string; titleAr: string; titleCoptic: string; description: string; duration: number; sessions: number }>> = {
  1: [
    { title: 'Welcome Hymn (Ahkem Oykh)', titleAr: 'ترنيمة أهكём أويخ', titleCoptic: '	TokenName', description: 'Basic welcome hymn for beginners', duration: 30, sessions: 3 },
    { title: 'Psalm 150 (Tenosht)', titleAr: 'مزمور 150', titleCoptic: 'ⲯⲁⲗⲙⲟⲥ 150', description: 'Praise hymn with musical notes', duration: 25, sessions: 2 },
    { title: 'Kyrie Eleison', titleAr: 'كيريه إليسون', titleCoptic: 'Ⲕⲩⲣⲓⲉ ⲉⲗⲉⲓⲥⲟⲛ', description: 'Lord have mercy -基础 chant', duration: 15, sessions: 2 },
    { title: 'Gospel Hymn (Shere Ne Maria)', titleAr: 'شيري ني ماريا', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲓⲙⲁⲣⲓⲁ', description: 'Hail Mary - introductory hymn', duration: 20, sessions: 3 },
    { title: 'Credo (Pi pistis)', titleAr: 'الإيمان', titleCoptic: 'Ⲡⲓⲡⲓⲥⲧⲓⲥ', description: 'The Creed hymn for Level 1 students', duration: 35, sessions: 3 },
  ],
  2: [
    { title: 'Doxology of the Apostles', titleAr: 'مجدة الرسل', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲛⲁⲡⲟⲥⲧⲟⲗⲟⲥ', description: 'Apostolic doxology with tone', duration: 30, sessions: 3 },
    { title: 'Psalm 119 (Oxya)', titleAr: 'مزمور 119', titleCoptic: 'ⲯⲁⲗⲙⲟⲥ 119', description: 'Extended psalm hymn', duration: 40, sessions: 4 },
    { title: 'Trisagion Hymn', titleAr: 'تسبيح ثالوث', titleCoptic: 'Ⲧⲣⲓⲥⲁⲅⲓⲟⲛ', description: 'Holy God hymn - intermediate', duration: 20, sessions: 2 },
    { title: 'Hymn of the Intercessions', titleAr: 'ترنيمة الشفاعات', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲛⲉⲕⲥⲱϧ', description: 'Intercessory prayer hymns', duration: 35, sessions: 3 },
    { title: 'Doxology of the Theotokos', titleAr: 'مجدة والدة الإله', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲧⲉⲟⲧⲟⲕⲟⲥ', description: 'Theotokos praise hymn', duration: 25, sessions: 3 },
    { title: 'Psalm 136 (Ouab)', titleAr: 'مزمور 136', titleCoptic: 'ⲯⲁⲗⲙⲟⲥ 136', description: 'Thanksgiving psalm hymn', duration: 30, sessions: 3 },
  ],
  3: [
    { title: 'Doxology of the Cross', titleAr: 'مجدة الصليب', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲡⲥⲧⲁⲩⲣⲟⲥ', description: 'Cross praise hymn', duration: 25, sessions: 3 },
    { title: 'Doxology of the Resurrection', titleAr: 'مجدة القيامة', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲧⲁⲛⲁⲥⲧⲁⲥⲓⲥ', description: 'Resurrection praise hymn', duration: 30, sessions: 3 },
    { title: 'Litany of Peace (Ephsho Bishois)', titleAr: 'litany of peace', titleCoptic: 'Ⲉⲡϣⲟⲉⲓⲥ ⲡⲓⲱⲙⲏ', description: 'Litany chanted during the liturgy', duration: 20, sessions: 2 },
    { title: 'Coptic Wedding Hymn', titleAr: 'ترنيمة الزفاف القبطية', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓⲙⲱⲟⲩ', description: 'Wedding hymn for special occasions', duration: 35, sessions: 3 },
    { title: 'Psalm 147 (Batos)', titleAr: 'مزمور 147', titleCoptic: 'ⲯⲁⲗⲙⲟⲥ 147', description: 'Praise psalm hymn', duration: 25, sessions: 2 },
    { title: 'Antiphon of the Day', titleAr: 'التسبيح النهاري', titleCoptic: 'Ⲁⲛⲧⲓⲫⲱⲛ ⲛⲡⲓⲉϩⲟⲟⲩ', description: 'Daily antiphon hymn', duration: 20, sessions: 2 },
    { title: 'Gospel Hymn (Tethnout)', titleAr: 'ترنيمة الإنجيل', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓⲉⲩⲁⲅⲅⲉⲗⲓⲟⲛ', description: 'Gospel hymn introduction', duration: 25, sessions: 3 },
  ],
  4: [
    { title: 'Hymn of the Three Youths', titleAr: 'ترنيمة الشبان الثلاثة', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲛϣⲏⲛ ⲙⲙⲏⲛⲟ', description: 'Song of the Three Holy Children', duration: 40, sessions: 4 },
    { title: 'Doxology of the Cross (Advanced)', titleAr: 'مجدة الصليب المتقدمة', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲡⲥⲧⲁⲩⲣⲟⲥ', description: 'Advanced cross doxology', duration: 35, sessions: 3 },
    { title: 'Litany of the Censer', titleAr: 'litany of the censer', titleCoptic: 'Ⲉⲡϣⲟⲉⲓⲥ ⲡⲓⲑⲩⲙⲓⲁⲧⲏⲣⲓⲟⲛ', description: 'Censer litany hymn', duration: 25, sessions: 3 },
    { title: 'Hymn of the Bridegroom', titleAr: 'ترنيمة العريس', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓϣⲏⲣⲉ', description: 'Holy Week bridegroom hymn', duration: 30, sessions: 3 },
    { title: 'Psalm 151 (Supplementary)', titleAr: 'مزمور 151', titleCoptic: 'ⲯⲁⲗⲙⲟⲥ 151', description: 'Additional psalm hymn', duration: 20, sessions: 2 },
    { title: 'Doxology of the Saints', titleAr: 'مجدة القديسين', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲛⲁⲅⲓⲟⲥ', description: 'Saints praise hymn', duration: 30, sessions: 3 },
  ],
  5: [
    { title: 'Paschal Troparion', titleAr: 'ترنيمة الفصح', titleCoptic: 'Ⲧⲣⲟⲡⲁⲣⲓⲟⲛ ⲛⲡⲡⲁⲥⲭⲁ', description: 'Easter celebration hymn', duration: 35, sessions: 3 },
    { title: 'Hymn of the Resurrection (Blessed)', titleAr: 'ترنيمة القيامة المباركة', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲧⲁⲛⲁⲥⲧⲁⲥⲓⲥ', description: 'Blessed resurrection hymn', duration: 40, sessions: 4 },
    { title: 'Doxology of the Prophets', titleAr: 'مجدة الأنبياء', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲛⲡⲣⲟⲫⲏⲧⲏⲥ', description: 'Prophets praise hymn', duration: 30, sessions: 3 },
    { title: 'Litany of the Font', titleAr: 'litany of the font', titleCoptic: 'Ⲉⲡϣⲟⲉⲓⲥ ⲡⲓⲃⲱⲧ', description: 'Baptismal font litany', duration: 25, sessions: 3 },
    { title: 'Hymn of the Veil', titleAr: 'ترنيمة الحجاب', titleCoptic: 'Ϣⲏⲣⲓ ⲡⲓⲕⲁⲧⲁⲡⲉⲧⲁⲥⲙⲁ', description: ' veil hymn for liturgy', duration: 20, sessions: 2 },
    { title: 'Coptic Hymn of Praise', titleAr: 'ترنيمة التسابيح القبطية', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲛⲉⲩⲟⲗⲟⲅⲓⲁ', description: 'Praise hymn with Coptic notation', duration: 30, sessions: 3 },
    { title: 'Psalm 148 (Anepsalon)', titleAr: 'مزمور 148', titleCoptic: 'ⲯⲁⲗⲙⲟⲥ 148', description: 'Praise from all creation hymn', duration: 25, sessions: 2 },
  ],
  6: [
    { title: 'Hymn of the Theotokos (Theotokia)', titleAr: 'ترنيمة والدة الإله', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲧⲉⲟⲧⲟⲕⲟⲥ', description: 'Full Theotokos hymn cycle', duration: 45, sessions: 5 },
    { title: 'Paschal Canon', titleAr: 'قانون الفصح', titleCoptic: 'Ⲕⲁⲛⲱⲛ ⲛⲡⲡⲁⲥⲭⲁ', description: 'Easter Canon hymn', duration: 40, sessions: 4 },
    { title: 'Doxology of the Martyrs', titleAr: 'مجدة الشهداء', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲛⲙⲁⲣⲧⲩⲣⲟⲥ', description: 'Martyrs praise hymn', duration: 35, sessions: 3 },
    { title: 'Hymn of the Ascension', titleAr: 'ترنيمة الصعود', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓⲁⲛⲁⲗⲏⲙⲡⲥⲓⲥ', description: 'Ascension hymn', duration: 30, sessions: 3 },
    { title: 'Litany of Thanksgiving', titleAr: 'litany of thanksgiving', titleCoptic: 'Ⲉⲡϣⲟⲉⲓⲥ ⲛⲡⲉⲩⲟⲝⲟⲗⲟⲅⲓⲁ', description: 'Thanksgiving litany hymn', duration: 25, sessions: 2 },
    { title: 'Doxology of the Angels', titleAr: 'مجدة الملائكة', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲛⲁⲅⲅⲉⲗⲟⲥ', description: 'Angels praise hymn', duration: 30, sessions: 3 },
  ],
  7: [
    { title: 'Litany of the Sick', titleAr: 'litany of the sick', titleCoptic: 'Ⲉⲡϣⲟⲉⲓⲥ ⲛⲡⲁⲣⲣⲱⲥⲧⲟⲥ', description: 'Litany for the sick', duration: 25, sessions: 3 },
    { title: 'Doxology of the Church Fathers', titleAr: 'مجدة آباء الكنيسة', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲛⲡⲁⲧⲉⲣⲥ', description: 'Church Fathers hymn', duration: 35, sessions: 3 },
    { title: 'Hymn of Pentecost', titleAr: 'ترنيمة العنصرة', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓⲡⲉⲛⲧⲏⲕⲟⲥⲧⲉ', description: 'Pentecost hymn', duration: 40, sessions: 4 },
    { title: 'Coptic Night Hymn', titleAr: 'ترنيمة الليل القبطية', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓⲏⲣ', description: 'Night prayer hymn', duration: 30, sessions: 3 },
    { title: 'Hymn of the Annunciation', titleAr: 'ترنيمة البشارة', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓⲉⲩⲁⲅⲅⲉⲗⲓⲍⲙⲁ', description: 'Annunciation hymn', duration: 35, sessions: 3 },
    { title: 'Doxology of the Stewards', titleAr: 'مجدة الخدام', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲛⲇⲓⲁⲕⲟⲛⲟⲥ', description: 'Deacons praise hymn', duration: 25, sessions: 2 },
    { title: 'Litany of the Departed', titleAr: 'litany of the departed', titleCoptic: 'Ⲉⲡϣⲟⲉⲓⲥ ⲛⲡⲁⲣⲕⲟⲓⲙⲉⲛⲟⲥ', description: 'Prayer for the departed hymn', duration: 30, sessions: 3 },
  ],
  8: [
    { title: 'Hymn of the Nativity', titleAr: 'ترنيمة الميلاد', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓⲅⲉⲛⲉⲥⲓⲟⲥ', description: 'Christmas celebration hymn', duration: 40, sessions: 4 },
    { title: 'Doxology of the Covenant', titleAr: 'مجدة العهد', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲡⲓⲇⲓⲁⲑⲏⲕⲏ', description: 'Covenant praise hymn', duration: 35, sessions: 3 },
    { title: 'Litany of the Oblation', titleAr: 'litany of the oblation', titleCoptic: 'Ⲉⲡϣⲟⲉⲓⲥ ⲛⲡⲓⲡⲣⲟⲥⲫⲟⲣⲁ', description: 'Oblation litany hymn', duration: 30, sessions: 3 },
    { title: 'Hymn of the Transfiguration', titleAr: 'ترنيمة التحول', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓⲙⲉⲧⲙⲟⲣⲫⲟⲩ', description: 'Transfiguration hymn', duration: 35, sessions: 3 },
    { title: 'Doxology of the Fathers', titleAr: 'مجدة الآباء', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲛⲡⲁⲧⲉⲣ', description: 'Fathers praise hymn', duration: 30, sessions: 3 },
    { title: 'Hymn of the Cross (Feast)', titleAr: 'ترنيمة الصليب (عيد)', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲥⲧⲁⲩⲣⲟⲥ', description: 'Cross feast hymn', duration: 25, sessions: 2 },
    { title: 'Coptic Morning Hymn', titleAr: 'ترنيمة الصباح القبطية', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓⲉⲣϣⲱⲟⲩ', description: 'Morning praise hymn', duration: 30, sessions: 3 },
  ],
  9: [
    { title: 'Complete Theotokia Cycle', titleAr: 'دورة التراتيل الكاملة', titleCoptic: 'Ⲥⲕⲩⲗⲏ ⲛⲧⲉⲟⲧⲟⲕⲟⲩⲁ', description: 'Full Theotokia cycle for advanced students', duration: 60, sessions: 6 },
    { title: 'Hymn of the Second Coming', titleAr: 'ترنيمة المجيء الثاني', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓⲙⲟⲩⲛⲉⲩⲧⲉⲣⲟⲥ ⲡⲁⲣⲟⲩⲥⲓⲁ', description: 'Second Coming hymn', duration: 40, sessions: 4 },
    { title: 'Paschal Hymn (Advanced)', titleAr: 'ترنيمة الفصح المتقدمة', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲡⲁⲥⲭⲁ', description: 'Advanced Easter hymn', duration: 45, sessions: 4 },
    { title: 'Litany of the Gospel', titleAr: 'litany of the gospel', titleCoptic: 'Ⲉⲡϣⲟⲉⲓⲥ ⲛⲡⲓⲉⲩⲁⲅⲅⲉⲗⲓⲟⲛ', description: 'Gospel reading litany', duration: 30, sessions: 3 },
    { title: 'Doxology of the Virgin Mary', titleAr: 'مجدة العذراء مريم', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲧⲡⲁⲣⲑⲉⲛⲟⲥ', description: 'Virgin Mary praise hymn', duration: 35, sessions: 3 },
    { title: 'Hymn of the Pentecost (Complex)', titleAr: 'ترنيمة العنصرة المعقدة', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓⲡⲉⲛⲧⲏⲕⲟⲥⲧⲉ', description: 'Complex Pentecost hymn', duration: 40, sessions: 4 },
  ],
  10: [
    { title: 'Master Hymn of the Year', titleAr: 'ترنيمة السنة الرئيسية', titleCoptic: 'Ϣⲏⲣⲓ ⲡⲓⲣⲟⲙⲡⲉ', description: 'Comprehensive annual hymn cycle', duration: 75, sessions: 8 },
    { title: 'Doxology of All Saints', titleAr: 'مجدة جميع القديسين', titleCoptic: 'Ⲇⲟⲝⲟⲗⲟⲅⲓⲁ ⲛⲛⲁⲅⲓⲟⲥ ⲛⲧⲏⲛⲓⲩ', description: 'All Saints comprehensive hymn', duration: 50, sessions: 5 },
    { title: 'Complete Liturgical Hymn Cycle', titleAr: 'دورة التراتيل الطقسية الكاملة', titleCoptic: 'Ⲥⲕⲩⲗⲏ ⲛⲛϩⲏⲣⲓ ⲛⲧⲁⲛⲟⲩ', description: 'Full liturgical cycle mastery', duration: 90, sessions: 10 },
    { title: 'Advanced Paschal Canon', titleAr: 'قانون الفصح المتقدم', titleCoptic: 'Ⲕⲁⲛⲱⲛ ⲛⲡⲡⲁⲥⲭⲁ', description: 'Advanced Easter canon mastery', duration: 50, sessions: 5 },
    { title: 'Hymn of the Dormition', titleAr: 'ترنيمة النياحه', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓⲕⲟⲓⲙⲟⲥ', description: 'Dormition hymn cycle', duration: 45, sessions: 4 },
    { title: 'Mastery Assessment Hymn', titleAr: 'ترنيمة التقييم النهائي', titleCoptic: 'Ϣⲏⲣⲓ ⲛⲡⲓⲙⲉⲧⲙⲏⲧⲟ', description: 'Final mastery assessment hymn', duration: 60, sessions: 6 },
  ],
};

async function main() {
  console.log('Seeding curriculum data...');

  const school = await prisma.school.findFirst({ where: { slug: 'niangelos-main' } });
  if (!school) { console.error('School not found'); return; }

  const copticHymnsSubject = await prisma.subject.findFirst({ where: { schoolId: school.id, name: 'Coptic Hymns' } });
  const copticRitesSubject = await prisma.subject.findFirst({ where: { schoolId: school.id, name: 'Coptic Rites' } });
  const copticLanguageSubject = await prisma.subject.findFirst({ where: { schoolId: school.id, name: 'Coptic Language' } });
  if (!copticHymnsSubject) { console.error('Coptic Hymns subject not found'); return; }
  if (!copticRitesSubject) { console.error('Coptic Rites subject not found'); return; }
  if (!copticLanguageSubject) { console.error('Coptic Language subject not found'); return; }

  const levels = await prisma.level.findMany({ where: { schoolId: school.id }, orderBy: { number: 'asc' } });

  // Link all 3 subjects to all levels
  for (const level of levels) {
    const allSubjects = [copticHymnsSubject, copticRitesSubject, copticLanguageSubject];
    for (const subject of allSubjects) {
      await prisma.levelSubject.upsert({
        where: { levelId_subjectId: { levelId: level.id, subjectId: subject.id } },
        update: {},
        create: { levelId: level.id, subjectId: subject.id, isRequired: true, orderIndex: subject.orderIndex },
      });
    }
  }
  console.log('Linked all subjects to all levels');

  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@niangelos.app' } });
  if (!adminUser) { console.error('Admin user not found'); return; }

  const academicYear = await prisma.academicYear.findFirst({ where: { schoolId: school.id, isCurrent: true } });
  if (!academicYear) { console.error('Academic year not found'); return; }

  // Create Coptic Hymns lessons per level
  let totalLessons = 0;
  for (const level of levels) {
    const hymns = copticHymnsByLevel[level.number] || [];
    for (let i = 0; i < hymns.length; i++) {
      const h = hymns[i];
      const lesson = await prisma.lesson.create({
        data: {
          schoolId: school.id,
          levelId: level.id,
          subjectId: copticHymnsSubject.id,
          title: h.title,
          titleAr: h.titleAr,
          titleCoptic: h.titleCoptic,
          description: h.description,
          descriptionCoptic: h.titleCoptic,
          estimatedDurationMinutes: h.duration,
          sessionsCount: h.sessions,
          orderIndex: i + 1,
          status: 'published',
          publishedAt: new Date(),
          createdBy: adminUser.id,
        },
      });

      // Create sessions for each lesson
      for (let s = 1; s <= h.sessions; s++) {
        await prisma.session.create({
          data: {
            lessonId: lesson.id,
            title: `${h.title} - Session ${s}`,
            titleAr: `${h.titleAr} - الجلسة ${s}`,
            description: `Session ${s} of ${h.title}`,
            estimatedDurationMinutes: Math.ceil(h.duration / h.sessions),
            orderIndex: s,
          },
        });
      }

      // Auto-allocate: distribute lessons across 3 terms
      const term = Math.min(3, Math.floor((i / hymns.length) * 3) + 1);
      const weekNumber = Math.ceil(((i + 1) / hymns.length) * (term === 3 ? 14 : 13));

      await prisma.curriculumAllocation.create({
        data: {
          academicYearId: academicYear.id,
          levelId: level.id,
          subjectId: copticHymnsSubject.id,
          lessonId: lesson.id,
          term,
          weekNumber,
          orderIndex: i + 1,
          status: 'published',
        },
      });

      totalLessons++;
    }
  }

  console.log(`Created ${totalLessons} Coptic Hymns lessons across ${levels.length} levels`);
  console.log('Curriculum seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
