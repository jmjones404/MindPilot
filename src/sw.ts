/// <reference lib="webworker" />
export {};
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] };
const assets = self.__WB_MANIFEST;
const fingerprint = JSON.stringify(assets).split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
const cacheName = `mindpilot-shell-${fingerprint}`;
const assetUrls = new Set(assets.map(asset => new URL(asset.url, self.registration.scope).href));

self.addEventListener('install', event => {
  // A failed precache fails installation. The previous working version stays active.
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...assetUrls].map(url => new Request(url, { cache: 'reload', credentials: 'same-origin' })));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('mindpilot-shell-') && key !== cacheName) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  // Only the explicit Update action activates a waiting version.
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const shell = await (await caches.open(cacheName)).match(new URL('index.html', self.registration.scope).href, { ignoreVary: true });
      return shell ?? fetch(request);
    })());
  } else if (assetUrls.has(request.url)) {
    // The precache is limited to public app-shell assets on this origin. Ignore
    // Vary: Origin from static hosts: module requests and precache requests can
    // have different Origin headers even when they reference the same asset.
    event.respondWith((async () => (await (await caches.open(cacheName)).match(request, { ignoreVary: true })) ?? fetch(request))());
  }
});
