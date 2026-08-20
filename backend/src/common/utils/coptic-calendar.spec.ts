import {
  gregorianToJD, jdToCoptic, getCopticSeason, getCopticDateLabel,
  getFeastOrFast, getCopticContext, COPTIC_MONTHS, COPTIC_MONTHS_AR, SEASON_LABEL,
} from './coptic-calendar';

describe('coptic-calendar', () => {
  describe('jdToCoptic epoch', () => {
    it('maps 29 Aug 284 CE to 1 Thout, year 1 (epoch)', () => {
      const jd = gregorianToJD(284, 8, 29);
      expect(jdToCoptic(jd)).toEqual({ year: 1, month: 1, day: 1 });
    });
    it('maps 28 Oct 284 CE to 1 Hathor, year 1 (60 days after epoch)', () => {
      const jd = gregorianToJD(284, 10, 28);
      expect(jdToCoptic(jd)).toEqual({ year: 1, month: 3, day: 1 });
    });
  });

  describe('getCopticSeason', () => {
    it('returns kiahk for month 4', () => expect(getCopticSeason(4, 10)).toBe('kiahk'));
    it('returns nativity for Tobi 1-11', () => expect(getCopticSeason(5, 1)).toBe('nativity'));
    it('returns great_lent for months 7-8', () => expect(getCopticSeason(8, 3)).toBe('great_lent'));
    it('returns bright_week for Pashons 1-7', () => expect(getCopticSeason(9, 1)).toBe('bright_week'));
    it('returns regular otherwise', () => expect(getCopticSeason(2, 5)).toBe('regular'));
  });

  describe('getFeastOrFast', () => {
    it('nayrouz on Thout 1', () => expect(getFeastOrFast(1, 1)?.key).toBe('nayrouz'));
    it('exact-day feast (Assumption) wins over nativity_fast on Hathor 16', () =>
      expect(getFeastOrFast(3, 16)?.key).toBe('assumption'));
    it('nativity_fast spans Hathor 16-30 and Koiak 1-28', () => {
      expect(getFeastOrFast(3, 20)?.key).toBe('nativity_fast');
      expect(getFeastOrFast(4, 28)?.key).toBe('nativity_fast');
    });
    it('nativity_paramoun on Koiak 29', () => expect(getFeastOrFast(4, 29)?.key).toBe('nativity_paramoun'));
    it('nativity on Tobi 1', () => expect(getFeastOrFast(5, 1)?.key).toBe('nativity'));
    it('epiphany on Tobi 11', () => expect(getFeastOrFast(5, 11)?.key).toBe('epiphany'));
    it('nineveh_fast on Tobi 21-23', () => expect(getFeastOrFast(5, 22)?.key).toBe('nineveh_fast'));
    it('annunciation on Paremhat 25', () => expect(getFeastOrFast(7, 25)?.key).toBe('annunciation'));
    it('exact-day feast (Peter & Paul) wins over apostles_fast on Epip 5', () =>
      expect(getFeastOrFast(11, 5)?.key).toBe('apostles_feast'));
    it('apostles_fast on Epip 1-4', () => expect(getFeastOrFast(11, 3)?.key).toBe('apostles_fast'));
    it('returns null on an ordinary day', () => expect(getFeastOrFast(2, 5)).toBeNull());
  });

  describe('getCopticDateLabel', () => {
    it('formats en and ar labels', () => {
      const label = getCopticDateLabel({ month: 4, day: 5, year: 1742 });
      expect(label.en).toBe('5 Kiahk 1742');
      expect(label.ar).toBe('5 كيهك 1742');
    });
  });

  describe('getCopticContext', () => {
    it('returns coptic, season and feast/fast for a date', () => {
      // 29 Aug 284 = 1 Thout 1 AM = Nayrouz
      const ctx = getCopticContext(new Date(284, 7, 29));
      expect(ctx.coptic).toEqual({ month: 1, day: 1, year: 1, monthName: 'Thout', monthNameAr: 'توت' });
      expect(ctx.season).toBe('regular');
      expect(ctx.seasonLabel).toEqual(SEASON_LABEL.regular);
      expect(ctx.feastFast?.key).toBe('nayrouz');
    });
  });

  it('exposes month name arrays', () => {
    expect(COPTIC_MONTHS[4]).toBe('Kiahk');
    expect(COPTIC_MONTHS_AR[4]).toBe('كيهك');
  });
});
