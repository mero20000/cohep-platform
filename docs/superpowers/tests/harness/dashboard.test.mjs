// Dashboard module tests — stats, mine, leaderboard, servant-digest, practice-stats, absence-cascade
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  // D-1: stats
  const stats = await api('GET', `/dashboard/stats?schoolId=${SCHOOL_ID}`)
  if (stats.ok) pass('D-1 Dashboard stats read', 'ok')
  else fail('D-1 Dashboard stats read', `status=${stats.status} ${JSON.stringify(stats.data).slice(0, 250)}`)

  // D-2: mine
  const mine = await api('GET', `/dashboard/mine?schoolId=${SCHOOL_ID}`)
  if (mine.ok) pass('D-2 Dashboard mine read', 'ok')
  else fail('D-2 Dashboard mine read', `status=${mine.status} ${JSON.stringify(mine.data).slice(0, 250)}`)

  // D-3: leaderboard
  const lb = await api('GET', `/dashboard/leaderboard?schoolId=${SCHOOL_ID}`)
  if (lb.ok) pass('D-3 Dashboard leaderboard read', 'ok')
  else fail('D-3 Dashboard leaderboard read', `status=${lb.status} ${JSON.stringify(lb.data).slice(0, 250)}`)

  // D-4: servant-digest
  const sd = await api('GET', `/dashboard/servant-digest?schoolId=${SCHOOL_ID}`)
  if (sd.ok) pass('D-4 Servant digest read', 'ok')
  else fail('D-4 Servant digest read', `status=${sd.status} ${JSON.stringify(sd.data).slice(0, 250)}`)

  // D-5: practice-stats
  const ps = await api('GET', `/dashboard/practice-stats?schoolId=${SCHOOL_ID}`)
  if (ps.ok) pass('D-5 Practice stats read', 'ok')
  else fail('D-5 Practice stats read', `status=${ps.status} ${JSON.stringify(ps.data).slice(0, 250)}`)

  // D-6: absence-cascade (admin/principal/super_admin)
  const ac = await api('POST', `/dashboard/absence-cascade?schoolId=${SCHOOL_ID}`)
  if (ac.ok) pass('D-6 Absence cascade run', `status=${ac.status}`)
  else fail('D-6 Absence cascade run', `status=${ac.status} ${JSON.stringify(ac.data).slice(0, 250)}`)

  return {}
}
