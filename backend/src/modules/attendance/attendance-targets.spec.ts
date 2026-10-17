import { classTargetFor, isSessionType, normalizeGender, rosterFragments } from './attendance-targets';

describe('attendance-targets', () => {
  it('knows the three session types', () => {
    expect(['class', 'liturgy', 'event'].every(isSessionType)).toBe(true);
    expect(isSessionType('party')).toBe(false);
    expect(isSessionType(undefined)).toBe(false);
  });

  it('treats "both" and blank gender as unrestricted', () => {
    expect(normalizeGender('both')).toBeNull();
    expect(normalizeGender('')).toBeNull();
    expect(normalizeGender(undefined)).toBeNull();
    expect(normalizeGender('female')).toBe('female');
  });

  it('mirrors a class session into one target, and none without a group', () => {
    expect(classTargetFor({ groupId: 'g', levelId: 'l' }, 'male')).toEqual({ groupId: 'g', levelId: 'l', gradeId: null, gender: 'male' });
    expect(classTargetFor({ groupId: null })).toBeNull();
  });

  it('class rosters use the session columns even if audience rows exist', () => {
    expect(rosterFragments({ type: 'class', groupId: 'g', levelId: 'l' }, [{ groupId: 'other' }])).toEqual([{ groupId: 'g', levelId: 'l' }]);
  });

  it('legacy sessions without a type or audience rows fall back to their columns', () => {
    expect(rosterFragments({ groupId: 'g' }, [])).toEqual([{ groupId: 'g' }]);
    expect(rosterFragments({ type: 'liturgy', groupId: 'g', gradeId: 'gr' }, [])).toEqual([{ groupId: 'g', gradeId: 'gr' }]);
  });

  it('liturgy/event rosters are the union of their audience rows', () => {
    expect(rosterFragments({ type: 'event' }, [
      { groupId: 'g1' },
      { groupId: 'g2', levelId: 'l2', gender: 'female' },
      { groupId: 'g3', gender: 'both' },
    ])).toEqual([{ groupId: 'g1' }, { groupId: 'g2', levelId: 'l2', gender: 'female' }, { groupId: 'g3' }]);
  });

  it('a whole-school session matches every group', () => {
    expect(rosterFragments({ type: 'liturgy', allGroups: true }, [{ groupId: 'g1' }])).toEqual([{}]);
  });
});
