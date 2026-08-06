// Upload module tests — multipart file uploads (church-logo, school-logo, avatar, student-photo, presentation)
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()

  // Minimal valid 1x1 PNG bytes (multi-part upload). Node 18+ supports FormData + Blob.
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )

  const endpoints = ['church-logo', 'school-logo', 'avatar', 'student-photo']
  for (const ep of endpoints) {
    const fd = new FormData()
    fd.append('file', new Blob([pngBytes], { type: 'image/png' }), `qa-${ep}.png`)
    const res = await api('POST', `/upload/${ep}`, fd)
    if (res.ok && res.data?.url) {
      pass(`U-${ep} upload`, `url=${res.data.url}`)
      track(res.data.url, `QA uploaded file (${ep})`)
    } else {
      fail(`U-${ep} upload`, `status=${res.status} ${JSON.stringify(res.data).slice(0, 250)}`)
    }
  }

  // presentation endpoint accepts .pptx only — send a tiny pptx-named blob
  const pptxBytes = Buffer.from('PK\x03\x04QA test pptx', 'utf8')
  const fd = new FormData()
  fd.append('file', new Blob([pptxBytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), `qa-presentation-${ts}.pptx`)
  const pres = await api('POST', '/upload/presentation', fd)
  if (pres.ok && pres.data?.url) {
    pass('U-presentation upload', `url=${pres.data.url}`)
    track(pres.data.url, `QA uploaded presentation`)
  } else {
    fail('U-presentation upload', `status=${pres.status} ${JSON.stringify(pres.data).slice(0, 250)}`)
  }

  return {}
}
