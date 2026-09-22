// Legacy service-worker kill switch.
// GymOS no longer registers a service worker. This file exists only to remove
// older installations that could keep serving stale blank SPA shells.
self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    await self.clients.claim();
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      try { await client.navigate(client.url); } catch {}
    }
  })());
});
self.addEventListener("fetch", event => {
  event.respondWith(fetch(event.request));
});
