// Announcements module tests
export default async function ({ api, track, pass, fail, fx }) {
  const ts = Date.now()

  // T28: draft announcement via AI (Gemini)
  // Note: GEMINI_API_KEY in Render is invalid, so this may return a documented error.
  const draft = await api('POST', '/announcements/draft', {
    prompt: 'QA test: draft an announcement about the upcoming hymn practice session for Level 1.',
  })

  if (draft.ok && (draft.data?.title || draft.data?.body)) {
    pass('T28 Draft announcement (AI)', `title="${String(draft.data.title).slice(0, 60)}"`)
    console.log('     → response:', JSON.stringify(draft.data).slice(0, 300))
  } else {
    // Document the actual behaviour — could be a GEMINI misconfig (expected) or a code bug
    const msg = typeof draft.data === 'string' ? draft.data : JSON.stringify(draft.data)
    fail('T28 Draft announcement (AI)', `status=${draft.status} body=${msg.slice(0, 300)}`)
  }

  return {}
}
