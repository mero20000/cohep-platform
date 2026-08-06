// Notifications module tests — list, unread-count, create, mark-read, read-all
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()

  // N-1: list notifications
  const list = await api('GET', `/notifications?schoolId=${SCHOOL_ID}&userId=${fx.ownerId}`)
  if (list.ok) pass('N-1 Notifications list read', 'ok')
  else fail('N-1 Notifications list read', `status=${list.status} ${JSON.stringify(list.data).slice(0, 250)}`)

  // N-2: unread-count
  const unread = await api('GET', `/notifications/unread-count?schoolId=${SCHOOL_ID}&userId=${fx.ownerId}`)
  if (unread.ok) pass('N-2 Unread count read', 'ok')
  else fail('N-2 Unread count read', `status=${unread.status} ${JSON.stringify(unread.data).slice(0, 250)}`)

  // N-3: create notification
  const create = await api('POST', '/notifications', {
    schoolId: SCHOOL_ID,
    userId: fx.ownerId,
    type: 'qa_test',
    title: `QA Notification ${ts}`,
    body: 'QA notification body',
    channels: ['in_app'],
  })
  const notifId = create.data?.id ?? create.data?.notification?.id ?? null
  if (create.ok && notifId) {
    track(notifId, `QA notification`)
    pass('N-3 Create notification', `id=${notifId}`)
    fx.qaNotificationId = notifId

    // N-4: mark-read
    const mark = await api('PATCH', `/notifications/${notifId}/read?schoolId=${SCHOOL_ID}`)
    if (mark.ok) pass('N-4 Mark notification read', 'ok')
    else fail('N-4 Mark notification read', `status=${mark.status} ${JSON.stringify(mark.data).slice(0, 250)}`)
  } else {
    fail('N-3 Create notification', `status=${create.status} ${JSON.stringify(create.data).slice(0, 250)}`)
  }

  // N-5: mark-all-read
  const all = await api('PATCH', `/notifications/read-all?schoolId=${SCHOOL_ID}&userId=${fx.ownerId}`)
  if (all.ok) pass('N-5 Mark all read', 'ok')
  else fail('N-5 Mark all read', `status=${all.status} ${JSON.stringify(all.data).slice(0, 250)}`)

  return {}
}
