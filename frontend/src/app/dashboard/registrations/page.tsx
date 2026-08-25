import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Registrations - Coptic Orthodox Hymn Education Platform (COHEP)',
}

// Consolidated: student + church registrations now live under one module.
export default function RegistrationsPage() {
  redirect('/dashboard/pending-registrations')
}
