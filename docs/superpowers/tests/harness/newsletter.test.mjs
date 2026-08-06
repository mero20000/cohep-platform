// Newsletter module tests — public subscribe
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()
  const tsSuffix = String(ts).slice(-6)

  // NW-1: subscribe (public, no auth). Email is unique per run.
  const sub = await api('POST', '/newsletter/subscribe', { email: `qa-news-${tsSuffix}@example.com` })
  if (sub.ok) pass('NW-1 Newsletter subscribe', `status=${sub.status}`)
  else fail('NW-1 Newsletter subscribe', `status=${sub.status} ${JSON.stringify(sub.data).slice(0, 250)}`)

  return {}
}
