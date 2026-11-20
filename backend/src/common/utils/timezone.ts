/** Milliseconds a zone's wall clock is ahead of UTC at a given instant. */
function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The UTC instant at which the wall clock of `timeZone` reads `hour`:00 on the
 * calendar day `day` (a UTC-midnight Date, as returned by `localToday`).
 * Unknown zones fall back to UTC. Two passes keep it right across DST switches.
 */
export function zonedTimeToUtc(day: Date, hour: number, timeZone: string): Date {
  const wall = day.getTime() + hour * 3_600_000;
  try {
    let utc = wall - offsetMs(new Date(wall), timeZone);
    utc = wall - offsetMs(new Date(utc), timeZone);
    return new Date(utc);
  } catch {
    return new Date(wall);
  }
}
