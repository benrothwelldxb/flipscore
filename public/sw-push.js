// Web Push handlers, imported into the generated service worker via
// workbox `importScripts` (see vite.config.ts). Kept as plain JS in public/ so
// it isn't bundled — it runs in the service-worker global scope.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || 'FlipScorer'
  const options = {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            // navigate() can reject for an uncontrolled client — swallow it so
            // it never becomes an unhandled rejection, then focus regardless.
            if ('navigate' in client) {
              return Promise.resolve(client.navigate(target))
                .catch(() => {})
                .then(() => client.focus())
            }
            return client.focus()
          }
        }
        return self.clients.openWindow(target)
      }),
  )
})
