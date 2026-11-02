import { DEFAULT_ATTENDANCE_TARGET, isValidAttendanceTarget, loadAttendanceTarget, parseAttendanceTarget } from './attendance-target';

describe('attendance target', () => {
  it('accepts whole numbers 1..100 only', () => {
    expect([1, 80, 100].every(isValidAttendanceTarget)).toBe(true);
    expect([0, 101, 79.5, NaN, '80', null, undefined].some(isValidAttendanceTarget)).toBe(false);
  });
  it('falls back to the default for missing or malformed stored values', () => {
    expect(parseAttendanceTarget(undefined)).toBe(DEFAULT_ATTENDANCE_TARGET);
    expect(parseAttendanceTarget('abc')).toBe(DEFAULT_ATTENDANCE_TARGET);
    expect(parseAttendanceTarget(250)).toBe(DEFAULT_ATTENDANCE_TARGET);
    expect(parseAttendanceTarget('' as any)).toBe(DEFAULT_ATTENDANCE_TARGET);
  });
  it('reads numbers and numeric strings', () => {
    expect(parseAttendanceTarget(90)).toBe(90);
    expect(parseAttendanceTarget('85')).toBe(85);
  });
  it('loads per school and defaults when no row exists', async () => {
    const findUnique = jest.fn().mockResolvedValueOnce({ value: 70 }).mockResolvedValueOnce(null);
    const prisma = { systemConfig: { findUnique } };
    expect(await loadAttendanceTarget(prisma, 's1')).toBe(70);
    expect(await loadAttendanceTarget(prisma, 's1')).toBe(DEFAULT_ATTENDANCE_TARGET);
    expect(findUnique).toHaveBeenCalledWith({ where: { schoolId_key: { schoolId: 's1', key: 'attendance_target' } } });
  });
});
