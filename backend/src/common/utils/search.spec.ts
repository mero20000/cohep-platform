import { buildSearchClauses } from './search';

const opts = {
  textFields: ['firstName', 'lastName'],
  phoneFilters: [(v: string) => ({ phone: { contains: v } })],
};

describe('buildSearchClauses', () => {
  it('returns no clauses for empty or whitespace input', () => {
    expect(buildSearchClauses(undefined, opts)).toEqual([]);
    expect(buildSearchClauses('   ', opts)).toEqual([]);
  });

  it('single word matches any text field', () => {
    expect(buildSearchClauses('Malak', opts)).toEqual([
      {
        OR: [
          { firstName: { contains: 'Malak', mode: 'insensitive' } },
          { lastName: { contains: 'Malak', mode: 'insensitive' } },
        ],
      },
    ]);
  });

  it('multi-word query requires every word to match some field (first + last name)', () => {
    const clauses = buildSearchClauses('  Malak   Samir ', opts);
    expect(clauses).toHaveLength(2);
    expect(clauses[0].OR).toContainEqual({ firstName: { contains: 'Malak', mode: 'insensitive' } });
    expect(clauses[1].OR).toContainEqual({ lastName: { contains: 'Samir', mode: 'insensitive' } });
  });

  it('phone-like query also searches phone fields, raw and normalised', () => {
    const [clause] = buildSearchClauses('+20 100-123 4567', opts);
    expect(buildSearchClauses('+20 100-123 4567', opts)).toHaveLength(1);
    expect(clause.OR).toContainEqual({ phone: { contains: '+20 100-123 4567' } });
    expect(clause.OR).toContainEqual({ phone: { contains: '+201001234567' } });
  });

  it('short digit strings are not treated as phone numbers', () => {
    const [clause] = buildSearchClauses('12', opts);
    expect(clause.OR).not.toContainEqual({ phone: { contains: '12' } });
  });

  it('caps the number of words', () => {
    expect(buildSearchClauses('a b c d e f g h', opts)).toHaveLength(5);
  });
});
