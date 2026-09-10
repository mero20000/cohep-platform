import { redirect } from 'next/navigation'

export function buildMarkRedirect(
  searchParams?: Record<string, string | string[] | undefined>,
): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams || {})) {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item !== undefined) q.append(k, item)
      }
    } else if (v !== undefined) {
      q.append(k, v)
    }
  }
  const qs = q.toString()
  return `/dashboard/attendance/mark${qs ? `?${qs}` : ''}`
}

type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>

export default async function AttendancePage({ searchParams }: { searchParams?: SearchParamsInput }) {
  redirect(buildMarkRedirect((await searchParams) || {}))
}
