import { buildLevelGroupOverview } from './level-group-overview';

const levels = [
  { id: 'L2', name: 'Level 2', nameAr: null, orderIndex: 2 },
  { id: 'L1', name: 'Level 1', nameAr: null, orderIndex: 1 },
];
const groups = [{ id: 'G1', name: 'Group A', nameAr: null }];
const students = [
  { id: 's1', levelId: 'L1', groupId: 'G1' },
  { id: 's2', levelId: 'L1', groupId: 'G1' },
  { id: 's3', levelId: 'L2', groupId: 'G1' },
];

describe('buildLevelGroupOverview', () => {
  it('orders by orderIndex and counts students and at-risk per level', () => {
    const r = buildLevelGroupOverview({ levels, groups, students, records: [], atRisk: new Set(['s2', 's3']), grades: [] });
    expect(r.levels.map((l) => l.id)).toEqual(['L1', 'L2']);
    expect(r.levels[0]).toMatchObject({ students: 2, atRisk: 1 });
    expect(r.groups[0]).toMatchObject({ students: 3, atRisk: 2 });
  });

  it('computes attendance for the window and the previous one, excused/unmarked neutral', () => {
    const records = [
      { studentId: 's1', status: 'present', current: true },
      { studentId: 's2', status: 'absent', current: true },
      { studentId: 's2', status: 'excused', current: true },
      { studentId: 's1', status: 'unmarked', current: true },
      { studentId: 's1', status: 'present', current: false },
    ];
    const r = buildLevelGroupOverview({ levels, groups, students, records, atRisk: new Set(), grades: [] });
    expect(r.levels[0].attendanceRate).toBe(50);
    expect(r.levels[0].prevAttendanceRate).toBe(100);
  });

  it('reports null, not 0, for a level with no class and no grades', () => {
    const r = buildLevelGroupOverview({ levels, groups, students, records: [], atRisk: new Set(), grades: [] });
    expect(r.levels[1]).toMatchObject({ attendanceRate: null, prevAttendanceRate: null, passRate: null, gradedCount: 0 });
  });

  it('computes pass rate and ignores records of students that are not active', () => {
    const r = buildLevelGroupOverview({
      levels, groups, students,
      records: [{ studentId: 'gone', status: 'absent', current: true }],
      atRisk: new Set(),
      grades: [{ studentId: 's1', passed: true }, { studentId: 's2', passed: false }, { studentId: 's3', passed: true }, { studentId: 'gone', passed: false }],
    });
    expect(r.levels[0]).toMatchObject({ passRate: 50, gradedCount: 2, attendanceRate: null });
    expect(r.groups[0]).toMatchObject({ passRate: 67, gradedCount: 3 });
  });
});
