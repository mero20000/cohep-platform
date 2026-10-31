/**
 * A tiny in-memory stand-in for the parts of Prisma the access checks use. Unlike a jest mock that
 * only records the `where` it was given, it evaluates it against rows, so a test can prove that a
 * record is not found rather than that a filter was passed.
 *
 * Supported in `where`: equality, null, `in`, `notIn`, `not`, `OR`, `AND`, `NOT`, and a nested
 * object for a to-one relation (resolved through `relations`).
 */
type Row = Record<string, any>;

export interface FakeTable {
  rows: Row[];
  /** to-one relations: name -> { table, foreignKey } */
  relations?: Record<string, { table: string; foreignKey: string }>;
}

export class FakeDb {
  constructor(public tables: Record<string, FakeTable>) {}

  matches(table: string, row: Row, where: Row | undefined): boolean {
    if (!where) return true;
    return Object.entries(where).every(([key, cond]) => {
      if (key === 'AND') return ([] as Row[]).concat(cond).every((c) => this.matches(table, row, c));
      if (key === 'OR') return (cond as Row[]).some((c) => this.matches(table, row, c));
      if (key === 'NOT') return !([] as Row[]).concat(cond).some((c) => this.matches(table, row, c));
      const rel = this.tables[table].relations?.[key];
      if (rel) {
        const target = this.tables[rel.table].rows.find((r) => r.id === row[rel.foreignKey]);
        return !!target && this.matches(rel.table, target, (cond as Row).is ?? cond);
      }
      return this.valueMatches(row[key], cond);
    });
  }

  private valueMatches(value: any, cond: any): boolean {
    if (cond === null) return value === null || value === undefined;
    if (cond instanceof Date || typeof cond !== 'object') return value === cond;
    return Object.entries(cond).every(([op, arg]) => {
      switch (op) {
        case 'in': return (arg as any[]).includes(value);
        case 'notIn': return !(arg as any[]).includes(value);
        case 'not': return !this.valueMatches(value, arg);
        case 'equals': return value === arg;
        default: throw new Error(`FakeDb: unsupported filter "${op}"`);
      }
    });
  }

  private project(row: Row, args: { select?: Row }) {
    if (!args.select) return { ...row };
    return Object.fromEntries(Object.keys(args.select).filter((k) => args.select![k]).map((k) => [k, row[k]]));
  }

  /** Delegate with the Prisma methods the code under test calls. */
  table(name: string) {
    const rows = () => this.tables[name].rows;
    return {
      findFirst: async (args: { where?: Row; select?: Row } = {}) => {
        const hit = rows().find((r) => this.matches(name, r, args.where));
        return hit ? this.project(hit, args) : null;
      },
      findUnique: async (args: { where: Row; select?: Row }) => {
        const hit = rows().find((r) => this.matches(name, r, args.where));
        return hit ? this.project(hit, args) : null;
      },
      findMany: async (args: { where?: Row; select?: Row } = {}) =>
        rows().filter((r) => this.matches(name, r, args.where)).map((r) => this.project(r, args)),
      count: async (args: { where?: Row } = {}) => rows().filter((r) => this.matches(name, r, args.where)).length,
    };
  }
}
