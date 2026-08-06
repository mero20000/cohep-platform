// Churches module tests — list, get, create, update, delete
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()
  const tsSuffix = String(ts).slice(-6)

  // CH-1: list churches
  const list = await api('GET', '/churches')
  if (list.ok) pass('CH-1 Churches list read', `count=${Array.isArray(list.data) ? list.data.length : Array.isArray(list.data?.churches) ? list.data.churches.length : '?'}`)
  else fail('CH-1 Churches list read', `status=${list.status} ${JSON.stringify(list.data).slice(0, 250)}`)

  // CH-2: create church (super_admin)
  const create = await api('POST', '/churches', {
    name: `QA Church ${tsSuffix}`,
    nameAr: `كنيسة QA-${tsSuffix}`,
    slug: `qa-church-${tsSuffix}`,
    country: 'Egypt',
    city: 'Cairo',
  })
  const churchId = create.data?.id ?? create.data?.church?.id ?? null
  if (create.ok && churchId) {
    track(churchId, `QA church`)
    pass('CH-2 Create church', `id=${churchId}`)

    // CH-3: get church
    const get = await api('GET', `/churches/${churchId}`)
    if (get.ok) pass('CH-3 Get church read', `id=${churchId}`)
    else fail('CH-3 Get church read', `status=${get.status} ${JSON.stringify(get.data).slice(0, 250)}`)

    // CH-4: update church
    const upd = await api('PATCH', `/churches/${churchId}`, { city: 'Alexandria' })
    if (upd.ok) pass('CH-4 Update church', 'city=Alexandria')
    else fail('CH-4 Update church', `status=${upd.status} ${JSON.stringify(upd.data).slice(0, 250)}`)

    // CH-5: delete church
    const del = await api('DELETE', `/churches/${churchId}`)
    if (del.ok) pass('CH-5 Delete church', 'deleted')
    else fail('CH-5 Delete church', `status=${del.status} ${JSON.stringify(del.data).slice(0, 250)}`)
  } else {
    fail('CH-2 Create church', `status=${create.status} ${JSON.stringify(create.data).slice(0, 250)}`)
  }

  return {}
}
