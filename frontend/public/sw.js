const CACHE = 'cohep-v7'
const STATIC = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/cohep-logo.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (event.request.url.includes('/api/')) return

  // Navigations are network-first: after a deploy the cached HTML shell can
  // reference chunk hashes that no longer exist, causing "Loading chunk N
  // failed". Always fetch the latest HTML (falling back to cache offline).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          }
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Media (images/audio/video) is network-first with cache fallback — a cached
  // response must never shadow a fresh copy after deploys (fixes "Failed to
  // load audio" / broken images until hard refresh).
  if (['image', 'audio', 'video'].includes(event.request.destination)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && (response.type === 'basic' || response.type === 'cors')) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          }
          return response
        })
        .catch(() => caches.match(event.request).then((c) => c || Response.error()))
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      return cached || fetched
    })
  )
})

// Notification links come from our own server, but only same-origin paths are ever opened.
function safePath(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/dashboard'
}

self.addEventListener('push', (event) => {
  let data = { title: 'COHEP', body: '' }
  try { data = { ...data, ...(event.data?.json() || {}) } } catch {}

  const tasks = [
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      vibrate: [200, 100, 200],
      // Same tag replaces the previous notification instead of stacking a pile on the lock screen.
      ...(data.tag ? { tag: data.tag, renotify: true } : {}),
      dir: 'auto',
      data: { url: safePath(data.url) },
    }),
  ]
  // App-icon badge: the server sends the unread total with each push.
  if (typeof data.unread === 'number' && self.navigator && self.navigator.setAppBadge) {
    tasks.push(Promise.resolve(self.navigator.setAppBadge(data.unread)).catch(() => {}))
  }
  event.waitUntil(Promise.all(tasks))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = safePath(event.notification.data && event.notification.data.url)
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => new URL(c.url).pathname === url)
      if (existing) return existing.focus()
      // Reuse an open app window rather than piling up tabs.
      const open = windowClients[0]
      if (open && 'navigate' in open) return open.navigate(url).then((c) => c && c.focus())
      return clients.openWindow(url)
    })
  )
})
