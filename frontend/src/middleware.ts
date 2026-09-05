import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Builds a strict, nonce-based Content-Security-Policy.
 *
 * - `nonce-…` + `strict-dynamic`: only scripts rendered by Next (which applies
 *   the nonce automatically) and our own nonce'd inline scripts execute. Any
 *   injected <script> without the nonce is blocked.
 * - `style-src 'unsafe-inline'`: required for Tailwind/Next runtime styles.
 * - `connect-src` allows the NestJS backend API host.
 * - Dev adds `unsafe-eval` for React refresh/HMR.
 */
function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== 'production'
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Next.js injects inline <style> tags; per-style hashes are impractical.
    // Google Fonts is loaded via <link> stylesheets in the root layout.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https:`,
    `media-src 'self' https: blob:`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `connect-src 'self' https://niangelos-backend.onrender.com https://*.r2.dev https://fonts.googleapis.com${dev ? ' http://localhost:3001' : ''}`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ')
}

export function middleware(request: NextRequest) {
  // Fresh, unguessable nonce per document request.
  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce)

  // Setting the CSP on the REQUEST headers lets Next.js automatically apply
  // the same nonce to its own bootstrap <script> tags.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response

  /* Note: route auth remains enforced client-side via API 401 responses;
     this middleware previously only passed requests through. */
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
