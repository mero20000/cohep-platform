import { redirect } from 'next/navigation'

/**
 * Liturgy attendance now lives with all other attendance sessions
 * (Attendance → Sessions, type "Liturgy"). Old bookmarks and links land on the
 * create dialog preset to a liturgy that starts now.
 */
export default function LiturgyAttendanceRedirect() {
  redirect('/dashboard/attendance/sessions?new=liturgy')
}
