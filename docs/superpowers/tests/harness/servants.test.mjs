// Servants module tests — liturgy pending/verify/reject
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  // SV-1: liturgy pending list
  const pending = await api('GET', '/servants/liturgy-pending')
  if (pending.ok) {
    const arr = Array.isArray(pending.data) ? pending.data : pending.data?.pending ?? pending.data?.data ?? []
    pass('T7 Servant liturgy-pending list', `count=${Array.isArray(arr) ? arr.length : '?'}`)
    fx.qaPendingLiturgies = arr
    console.log('     → pending count:', Array.isArray(arr) ? arr.length : '?')
  } else {
    fail('T7 Servant liturgy-pending list', `status=${pending.status} ${JSON.stringify(pending.data).slice(0, 200)}`)
  }

  // SV-2/SV-3: verify + reject liturgy records.
  // A liturgy record is created by the parents module (P-13). Verify one and
  // create a second via parents (admin can log liturgy) to test the reject path.
  const pendingList = fx.qaPendingLiturgies ?? []
  const record = pendingList[0]
  if (record?.id) {
    // SV-2: verify the first pending record
    const verify = await api('PATCH', `/servants/liturgy/${record.id}/verify`)
    if (verify.ok) pass('SV-2 Verify liturgy', `id=${record.id}`)
    else fail('SV-2 Verify liturgy', `status=${verify.status} ${JSON.stringify(verify.data).slice(0, 250)}`)
  } else {
    fail('SV-2 Verify liturgy', 'no pending liturgy records available')
  }

  // SV-3: reject — log a second liturgy via the parent token (admin is super_admin, not allowed
  // on parent-scoped routes), then delete/reject it through servants.
  const childId = fx.qaLinkedChildId
  const parentToken = fx.qaParentToken
  if (childId && parentToken) {
    const ts = Date.now()
    const lit = await fx.apiAs(parentToken, 'POST', `/parents/me/children/${childId}/liturgy`, {
      date: '2026-08-02',
      notes: 'QA liturgy to reject',
    })
    const litId = lit.data?.id ?? null
    if (lit.ok && litId) {
      track(litId, `QA family liturgy (reject path)`)
      const reject = await api('DELETE', `/servants/liturgy/${litId}`)
      if (reject.ok) pass('SV-3 Reject liturgy', `id=${litId}`)
      else fail('SV-3 Reject liturgy', `status=${reject.status} ${JSON.stringify(reject.data).slice(0, 250)}`)
    } else {
      fail('SV-3 Reject liturgy', `create liturgy for reject failed: ${lit.status} ${JSON.stringify(lit.data).slice(0, 200)}`)
    }
  } else {
    fail('SV-3 Reject liturgy', `childId=${childId} parentToken=${parentToken ? 'yes' : 'no'} (parents module?)`)
  }

  return {}
}
