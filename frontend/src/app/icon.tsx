import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
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
          borderRadius: '6px',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="8.5" y="2" width="3" height="16" rx="0.5" fill="white" />
          <rect x="4" y="7" width="12" height="3" rx="0.5" fill="white" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
