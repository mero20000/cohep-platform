import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
function parseUploadsUrl(value) {
  try {
    return value ? new URL(value) : null
  } catch {
    return null
  }
}

const uploadsUrl = parseUploadsUrl(process.env.NEXT_PUBLIC_UPLOADS_URL)

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' },
      { source: '/uploads/:path*', destination: 'http://localhost:3001/uploads/:path*' },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '3001' },
      ...(uploadsUrl ? [{
        protocol: uploadsUrl.protocol.replace(':', ''),
        hostname: uploadsUrl.hostname,
        port: uploadsUrl.port,
      }] : []),
    ],
  },
}

export default nextConfig
