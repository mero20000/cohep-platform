/**
 * Timezone choices shown as "Country (GMT+4)".
 *
 * Values are IANA zone ids (what the backend stores). The GMT offset is
 * computed from the zone at call time rather than hard-coded, so labels stay
 * correct across daylight-saving changes (e.g. Egypt, US, UK).
 */

interface ZoneEntry {
  /** IANA zone id stored on the user / school / church. */
  zone: string
  /** ISO 3166-1 alpha-2 code, used to localise the country name. */
  country: string
  /** Disambiguates countries that span several zones. */
  region?: { en: string; ar: string }
}

const r = (en: string, ar: string) => ({ en, ar })

const ENTRIES: ZoneEntry[] = [
  { zone: 'Africa/Algiers', country: 'DZ' },
  { zone: 'America/Argentina/Buenos_Aires', country: 'AR' },
  { zone: 'Australia/Perth', country: 'AU', region: r('Perth', 'بيرث') },
  { zone: 'Australia/Darwin', country: 'AU', region: r('Darwin', 'داروين') },
  { zone: 'Australia/Adelaide', country: 'AU', region: r('Adelaide', 'أديلايد') },
  { zone: 'Australia/Brisbane', country: 'AU', region: r('Brisbane', 'بريزبان') },
  { zone: 'Australia/Sydney', country: 'AU', region: r('Sydney / Melbourne', 'سيدني / ملبورن') },
  { zone: 'Europe/Vienna', country: 'AT' },
  { zone: 'Asia/Bahrain', country: 'BH' },
  { zone: 'Asia/Dhaka', country: 'BD' },
  { zone: 'Europe/Brussels', country: 'BE' },
  { zone: 'America/Sao_Paulo', country: 'BR' },
  { zone: 'Europe/Sofia', country: 'BG' },
  { zone: 'America/Halifax', country: 'CA', region: r('Atlantic', 'الأطلسي') },
  { zone: 'America/Toronto', country: 'CA', region: r('Eastern', 'الشرقي') },
  { zone: 'America/Winnipeg', country: 'CA', region: r('Central', 'الأوسط') },
  { zone: 'America/Edmonton', country: 'CA', region: r('Mountain', 'الجبلي') },
  { zone: 'America/Vancouver', country: 'CA', region: r('Pacific', 'الهادئ') },
  { zone: 'America/Santiago', country: 'CL' },
  { zone: 'Asia/Shanghai', country: 'CN' },
  { zone: 'America/Bogota', country: 'CO' },
  { zone: 'Europe/Zagreb', country: 'HR' },
  { zone: 'Asia/Nicosia', country: 'CY' },
  { zone: 'Europe/Prague', country: 'CZ' },
  { zone: 'Europe/Copenhagen', country: 'DK' },
  { zone: 'Africa/Cairo', country: 'EG' },
  { zone: 'Africa/Addis_Ababa', country: 'ET' },
  { zone: 'Europe/Helsinki', country: 'FI' },
  { zone: 'Europe/Paris', country: 'FR' },
  { zone: 'Europe/Berlin', country: 'DE' },
  { zone: 'Africa/Accra', country: 'GH' },
  { zone: 'Europe/Athens', country: 'GR' },
  { zone: 'Asia/Hong_Kong', country: 'HK' },
  { zone: 'Europe/Budapest', country: 'HU' },
  { zone: 'Asia/Kolkata', country: 'IN' },
  { zone: 'Asia/Jakarta', country: 'ID' },
  { zone: 'Asia/Tehran', country: 'IR' },
  { zone: 'Asia/Baghdad', country: 'IQ' },
  { zone: 'Europe/Dublin', country: 'IE' },
  { zone: 'Asia/Jerusalem', country: 'IL' },
  { zone: 'Europe/Rome', country: 'IT' },
  { zone: 'Asia/Tokyo', country: 'JP' },
  { zone: 'Asia/Amman', country: 'JO' },
  { zone: 'Africa/Nairobi', country: 'KE' },
  { zone: 'Asia/Kuwait', country: 'KW' },
  { zone: 'Asia/Beirut', country: 'LB' },
  { zone: 'Africa/Tripoli', country: 'LY' },
  { zone: 'Asia/Kuala_Lumpur', country: 'MY' },
  { zone: 'America/Mexico_City', country: 'MX' },
  { zone: 'Africa/Casablanca', country: 'MA' },
  { zone: 'Europe/Amsterdam', country: 'NL' },
  { zone: 'Pacific/Auckland', country: 'NZ' },
  { zone: 'Africa/Lagos', country: 'NG' },
  { zone: 'Europe/Oslo', country: 'NO' },
  { zone: 'Asia/Muscat', country: 'OM' },
  { zone: 'Asia/Karachi', country: 'PK' },
  { zone: 'Asia/Gaza', country: 'PS' },
  { zone: 'America/Lima', country: 'PE' },
  { zone: 'Asia/Manila', country: 'PH' },
  { zone: 'Europe/Warsaw', country: 'PL' },
  { zone: 'Europe/Lisbon', country: 'PT' },
  { zone: 'Asia/Qatar', country: 'QA' },
  { zone: 'Europe/Bucharest', country: 'RO' },
  { zone: 'Europe/Moscow', country: 'RU' },
  { zone: 'Asia/Riyadh', country: 'SA' },
  { zone: 'Asia/Singapore', country: 'SG' },
  { zone: 'Africa/Johannesburg', country: 'ZA' },
  { zone: 'Asia/Seoul', country: 'KR' },
  { zone: 'Europe/Madrid', country: 'ES' },
  { zone: 'Africa/Khartoum', country: 'SD' },
  { zone: 'Europe/Stockholm', country: 'SE' },
  { zone: 'Europe/Zurich', country: 'CH' },
  { zone: 'Asia/Damascus', country: 'SY' },
  { zone: 'Asia/Bangkok', country: 'TH' },
  { zone: 'Africa/Tunis', country: 'TN' },
  { zone: 'Europe/Istanbul', country: 'TR' },
  { zone: 'Africa/Kampala', country: 'UG' },
  { zone: 'Europe/Kiev', country: 'UA' },
  { zone: 'Asia/Dubai', country: 'AE' },
  { zone: 'Europe/London', country: 'GB' },
  { zone: 'America/New_York', country: 'US', region: r('Eastern', 'الشرقي') },
  { zone: 'America/Chicago', country: 'US', region: r('Central', 'الأوسط') },
  { zone: 'America/Denver', country: 'US', region: r('Mountain', 'الجبلي') },
  { zone: 'America/Los_Angeles', country: 'US', region: r('Pacific', 'الهادئ') },
  { zone: 'America/Anchorage', country: 'US', region: r('Alaska', 'ألاسكا') },
  { zone: 'Pacific/Honolulu', country: 'US', region: r('Hawaii', 'هاواي') },
  { zone: 'Asia/Ho_Chi_Minh', country: 'VN' },
  { zone: 'Asia/Aden', country: 'YE' },
]

export interface TimezoneOption {
  value: string
  label: string
}

/** "GMT+4", "GMT-5", "GMT+5:30", or "GMT" for zero-offset zones; null if the runtime doesn't know the zone. */
export function gmtOffsetLabel(zone: string, at: Date = new Date()): string | null {
  try {
    const label = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value
    // ICU renders some zero-offset zones (e.g. London in winter) as "GMT+0".
    return label === 'GMT+0' ? 'GMT' : label ?? null
  } catch {
    return null
  }
}

function withOffset(label: string, zone: string, at: Date): string {
  const offset = gmtOffsetLabel(zone, at)
  return offset ? `${label} (${offset})` : label
}

function countryName(code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/**
 * Options sorted by country name (UTC first). A stored zone that isn't in the
 * list is appended as-is so an existing value is never silently replaced.
 */
export function getTimezoneOptions(
  lang: 'en' | 'ar' = 'en',
  current?: string,
  at: Date = new Date(),
): TimezoneOption[] {
  const collator = new Intl.Collator(lang)
  const options = ENTRIES.map((e) => {
    const name = countryName(e.country, lang)
    const place = e.region ? `${name} – ${e.region[lang]}` : name
    return { value: e.zone, label: withOffset(place, e.zone, at) }
  }).sort((a, b) => collator.compare(a.label, b.label))

  const result: TimezoneOption[] = [{ value: 'UTC', label: 'UTC (GMT)' }, ...options]
  if (current && !result.some((o) => o.value === current)) {
    result.push({ value: current, label: withOffset(current.replace(/_/g, ' '), current, at) })
  }
  return result
}
