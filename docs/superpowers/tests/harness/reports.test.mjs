// Reports module tests — priest-pulse, liturgical-engagement, servant-contributions, diocese
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  // R-1: priest-pulse
  const pp = await api('GET', `/reports/priest-pulse?schoolId=${SCHOOL_ID}`)
  if (pp.ok) pass('R-1 Priest pulse read', 'ok')
  else fail('R-1 Priest pulse read', `status=${pp.status} ${JSON.stringify(pp.data).slice(0, 250)}`)

  // R-2: liturgical-engagement
  const le = await api('GET', `/reports/liturgical-engagement?schoolId=${SCHOOL_ID}`)
  if (le.ok) pass('R-2 Liturgical engagement read', 'ok')
  else fail('R-2 Liturgical engagement read', `status=${le.status} ${JSON.stringify(le.data).slice(0, 250)}`)

  // R-3: servant-contributions
  const sc = await api('GET', `/reports/servant-contributions?schoolId=${SCHOOL_ID}`)
  if (sc.ok) pass('R-3 Servant contributions read', 'ok')
  else fail('R-3 Servant contributions read', `status=${sc.status} ${JSON.stringify(sc.data).slice(0, 250)}`)

  // R-4: diocese
  const dg = await api('GET', `/reports/diocese?schoolId=${SCHOOL_ID}`)
  if (dg.ok) pass('R-4 Diocese report read', 'ok')
  else fail('R-4 Diocese report read', `status=${dg.status} ${JSON.stringify(dg.data).slice(0, 250)}`)

  return {}
}
