export const COPTIC_EPOCH_JD = 1825029.5; // Julian Day for 1 Thout 1 AM (29 Aug 284 CE)

export function gregorianToJD(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) -
    Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

export function jdToCoptic(jd: number): { month: number; day: number; year: number } {
  const copticDays = jd - COPTIC_EPOCH_JD;
  const year = Math.floor(copticDays / 365.25);
  const remaining = copticDays - year * 365.25;
  const month = Math.floor(remaining / 30) + 1;
  const day = Math.floor(remaining % 30) + 1;
  return { year: Math.floor(year) + 1, month: Math.max(1, Math.min(13, month)), day: Math.max(1, Math.min(30, day)) };
}

// Coptic month names (1=Thout ... 13=Nasie)
export const COPTIC_MONTHS = ['', 'Thout', 'Paopi', 'Hathor', 'Kiahk', 'Tobi', 'Meshir', 'Paremhat', 'Parmouti', 'Pashons', 'Paoni', 'Epip', 'Mesori', 'Nasie'];
export const COPTIC_MONTHS_AR = ['', 'توت', 'بابه', 'هاتور', 'كيهك', 'طوبه', 'أمشير', 'برمهات', 'برموده', 'بشنس', 'بؤونه', 'أبيب', 'مسرا', 'نسيئ'];

export type CopticSeason = 'kiahk' | 'nativity' | 'great_lent' | 'bright_week' | 'regular';

export function getCopticSeason(month: number, day: number): CopticSeason {
  if (month === 4) return 'kiahk';
  if (month === 5 && day <= 11) return 'nativity';
  if (month === 7 || month === 8) return 'great_lent';
  if (month === 9 && day <= 7) return 'bright_week';
  return 'regular';
}

export const SEASON_LABEL: Record<CopticSeason, { en: string; ar: string }> = {
  kiahk: { en: 'Month of Kiahk', ar: 'شهر كيهك' },
  nativity: { en: 'Nativity Season', ar: 'زمن الميلاد' },
  great_lent: { en: 'Great Lent', ar: 'الصوم الكبير' },
  bright_week: { en: 'Bright Week', ar: 'أسبوع الفرح' },
  regular: { en: 'Ordinary Time', ar: 'زمن عادي' },
};

export function getUpcomingSundayDate(from = new Date()): Date {
  const d = new Date(from);
  const day = d.getDay(); // 0=Sun
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  d.setDate(d.getDate() + daysUntilSunday);
  return d;
}

const FEASTS: Array<{ month: number; day: number; key: string; en: string; ar: string }> = [
  { month: 1, day: 1, key: 'nayrouz', en: 'Nayrouz (New Year / Martyrs)', ar: 'النيروز (رأس السنة / عيد الشهداء)' },
  { month: 3, day: 16, key: 'assumption', en: 'Feast of the Assumption', ar: 'عيد صعود العذراء' },
  { month: 4, day: 29, key: 'nativity_paramoun', en: 'Paramoun of the Nativity', ar: 'برمون الميلاد' },
  { month: 5, day: 1, key: 'nativity', en: 'Feast of the Nativity', ar: 'عيد الميلاد' },
  { month: 5, day: 6, key: 'epiphany_paramoun', en: 'Paramoun of the Epiphany', ar: 'برمون الغطاس' },
  { month: 5, day: 11, key: 'epiphany', en: 'Feast of the Epiphany', ar: 'عيد الغطاس' },
  { month: 7, day: 25, key: 'annunciation', en: 'Feast of the Annunciation', ar: 'عيد البشارة' },
  { month: 11, day: 5, key: 'apostles_feast', en: 'Feast of Sts. Peter & Paul', ar: 'عيد الرسل' },
];

const FASTS: Array<{ month: number; from: number; to: number; key: string; en: string; ar: string }> = [
  { month: 3, from: 1, to: 15, key: 'theotokos_fast', en: 'Fast of the Theotokos', ar: 'صوم السيدة العذراء' },
  { month: 3, from: 16, to: 30, key: 'nativity_fast', en: 'Nativity Fast (Advent)', ar: 'صوم الميلاد' },
  { month: 4, from: 1, to: 28, key: 'nativity_fast', en: 'Nativity Fast (Advent)', ar: 'صوم الميلاد' },
  { month: 5, from: 21, to: 23, key: 'nineveh_fast', en: 'Fast of Nineveh', ar: 'صوم نينوى' },
  { month: 11, from: 1, to: 5, key: 'apostles_fast', en: 'Apostles\' Fast', ar: 'صوم الرسل' },
];

export function getFeastOrFast(month: number, day: number): { key: string; en: string; ar: string } | null {
  const feast = FEASTS.find(f => f.month === month && f.day === day);
  if (feast) return { key: feast.key, en: feast.en, ar: feast.ar };
  const fast = FASTS.find(f => f.month === month && day >= f.from && day <= f.to);
  if (fast) return { key: fast.key, en: fast.en, ar: fast.ar };
  return null;
}

export function getCopticDateLabel(coptic: { month: number; day: number; year: number }): { en: string; ar: string } {
  return {
    en: `${coptic.day} ${COPTIC_MONTHS[coptic.month] || ''} ${coptic.year}`.trim(),
    ar: `${coptic.day} ${COPTIC_MONTHS_AR[coptic.month] || ''} ${coptic.year}`.trim(),
  };
}

export function getCopticContext(date: Date): {
  coptic: { month: number; day: number; year: number; monthName: string; monthNameAr: string };
  season: CopticSeason;
  seasonLabel: { en: string; ar: string };
  feastFast: { key: string; en: string; ar: string } | null;
} {
  const jd = gregorianToJD(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const coptic = jdToCoptic(jd);
  const season = getCopticSeason(coptic.month, coptic.day);
  return {
    coptic: {
      month: coptic.month,
      day: coptic.day,
      year: coptic.year,
      monthName: COPTIC_MONTHS[coptic.month] || '',
      monthNameAr: COPTIC_MONTHS_AR[coptic.month] || '',
    },
    season,
    seasonLabel: SEASON_LABEL[season],
    feastFast: getFeastOrFast(coptic.month, coptic.day),
  };
}
