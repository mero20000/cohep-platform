import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/auth/login', '/auth/register', '/portal/login']
const PROTECTED    = ['/dashboard', '/portal']

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1]
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always pass static assets, Next internals, and API routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // Explicit public paths
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next()

  const token = request.cookies.get('token')?.value

  if (!token && PROTECTED.some(p => pathname.startsWith(p))) {
    const isPortal = pathname.startsWith('/portal')
    const loginUrl = new URL(isPortal ? '/portal/login' : '/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Servant role: read-only, redirect away from admin routes
  if (token) {
    const payload = decodeJwtPayload(token)
    const roles = (payload?.roles as string[]) || []
    if (roles.includes('servant') && !roles.some(r => ['admin', 'superadmin', 'staff', 'director'].includes(r))) {
      // Servants can only access /dashboard/servants and /dashboard/curriculum (read-only)
      const allowed = ['/dashboard/servants', '/dashboard/curriculum', '/portal']
      const isAllowed = allowed.some(a => pathname.startsWith(a))
      if (!isAllowed && pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/dashboard/servants', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
