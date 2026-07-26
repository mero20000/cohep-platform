import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#D4A843',
          borderRadius: '36px',
        }}
      >
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
          <rect x="41" y="12" width="18" height="76" rx="2" fill="white" />
          <rect x="18" y="38" width="64" height="18" rx="2" fill="white" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
