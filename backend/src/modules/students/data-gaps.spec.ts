import { DATA_GAPS, dataGapWhere } from './data-gaps';

describe('dataGapWhere', () => {
  it('has a fragment for every gap', () => {
    for (const g of DATA_GAPS) expect(Object.keys(dataGapWhere(g)).length).toBeGreaterThan(0);
  });
  it('photo: null or empty', () => {
    expect(dataGapWhere('photo')).toEqual({ OR: [{ photoUrl: null }, { photoUrl: '' }] });
  });
  it('parent: needs BOTH no email and no linked parent account', () => {
    const w: any = dataGapWhere('parent');
    expect(w.AND).toHaveLength(2);
    expect(w.AND[1]).toEqual({ studentParents: { none: {} } });
  });
  it('grade: unset', () => {
    expect(dataGapWhere('grade')).toEqual({ gradeId: null });
  });
});
