/** The school's attendance goal, stored in SystemConfig so admins can change it without a deploy. */
export const ATTENDANCE_TARGET_KEY = 'attendance_target';
export const DEFAULT_ATTENDANCE_TARGET = 80;

/** A usable target is a whole number from 1 to 100. */
export function isValidAttendanceTarget(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100;
}

/** Stored value -> target, falling back to the default for anything missing or malformed. */
export function parseAttendanceTarget(value: unknown): number {
  const v = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return isValidAttendanceTarget(v) ? v : DEFAULT_ATTENDANCE_TARGET;
}

export async function loadAttendanceTarget(
  prisma: { systemConfig: { findUnique: (args: any) => Promise<{ value: unknown } | null> } },
  schoolId: string,
): Promise<number> {
  const row = await prisma.systemConfig.findUnique({ where: { schoolId_key: { schoolId, key: ATTENDANCE_TARGET_KEY } } });
  return parseAttendanceTarget(row?.value);
}
