import { redirect } from 'next/navigation'

/** Creating a liturgy session is now part of the Sessions page (Session type → Liturgy). */
export default function LiturgyCreateRedirect() {
  redirect('/dashboard/attendance/sessions?new=liturgy&start=0')
}
