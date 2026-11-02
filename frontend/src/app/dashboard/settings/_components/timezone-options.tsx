'use client'

import { useMemo } from 'react'
import { getTimezoneOptions } from '@/lib/timezones'

/** `<option>`s for a timezone `<select>`, labelled "Country (GMT+4)". */
export function TimezoneOptions({ lang, value }: { lang: 'en' | 'ar'; value?: string }) {
  const options = useMemo(() => getTimezoneOptions(lang, value), [lang, value])
  return (
    <>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </>
  )
}
