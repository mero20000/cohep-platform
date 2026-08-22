import { redirect } from 'next/navigation'

/**
 * Student portal index — the portal is reached via an access key, but parents
 * and students need a discoverable entry point. Send /student-portal to login.
 */
export default function StudentPortalIndex() {
  redirect('/student-portal/login')
}
