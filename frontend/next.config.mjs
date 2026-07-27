import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseUploadsUrl(value) {
  try { return value ? new URL(value) : null } catch { return null }
}

const uploadsUrl = parseUploadsUrl(process.env.NEXT_PUBLIC_UPLOADS_URL)
const apiUrl    = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const apiBase   = apiUrl.replace(/\/api\/?$/, '')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,

  async rewrites() {
    return [
      { source: '/api/:path*',     destination: `${apiBase}/api/:path*` },
      { source: '/uploads/:path*', destination: `${apiBase}/uploads/:path*` },
    ]
  },

  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost', port: '3001' },
      // Render backend
      { protocol: 'https', hostname: '*.onrender.com' },
      ...(uploadsUrl ? [{
        protocol: uploadsUrl.protocol.replace(':', ''),
        hostname: uploadsUrl.hostname,
        port:     uploadsUrl.port,
      }] : []),
    ],
  },
}

export default nextConfig
