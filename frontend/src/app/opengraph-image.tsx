import { ImageResponse } from 'next/og'

export const alt = 'Coptic Orthodox Hymn Education Platform (COHEP)'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          position: 'relative',
        }}
      >
        {/* Subtle cross pattern background */}
        <svg
          width="1200"
          height="630"
          viewBox="0 0 1200 630"
          style={{ position: 'absolute', top: 0, left: 0, opacity: 0.05 }}
        >
          <defs>
            <pattern id="crosses" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <rect x="27" y="10" width="6" height="40" rx="1" fill="white" />
              <rect x="12" y="25" width="36" height="6" rx="1" fill="white" />
            </pattern>
          </defs>
          <rect width="1200" height="630" fill="url(#crosses)" />
        </svg>

        {/* Gold glow */}
        <div
          style={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,168,67,0.3) 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Cross icon */}
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ marginBottom: '24px' }}>
          <rect x="33" y="8" width="14" height="64" rx="2" fill="#D4A843" />
          <rect x="14" y="28" width="52" height="14" rx="2" fill="#D4A843" />
        </svg>

        {/* Title */}
        <div
          style={{
            fontSize: '44px',
            fontWeight: 'bold',
            color: 'white',
            textAlign: 'center',
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
          }}
        >
          Coptic Orthodox Hymn Education Platform
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '24px',
            color: '#D4A843',
            marginTop: '16px',
            textAlign: 'center',
            fontWeight: 500,
          }}
        >
          Learn. Grow. Praise.
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            fontSize: '16px',
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
          }}
        >
          Structured curriculum &bull; Progress tracking &bull; Gamified learning
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
