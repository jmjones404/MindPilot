/// <reference lib="webworker" />
export {};
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] };
const assets = self.__WB_MANIFEST;
const scope = new URL(self.registration.scope);
const cachePrefix = `mindpilot-shell-v2-${encodeURIComponent(scope.href)}-`;
const fingerprint = JSON.stringify(assets).split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
const cacheName = `${cachePrefix}${fingerprint}`;
const assetUrls = new Set(assets.map(asset => new URL(asset.url, scope).href));
function inScope(value: string) {
  const url = new URL(value);
  return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
}
function validAsset(url: string, response: Response) {
  if (!response.ok || response.redirected) return false;
  const path = new URL(url).pathname, type = response.headers.get('content-type') ?? '';
  if (path.endsWith('.js')) return /(?:javascript|ecmascript)/i.test(type);
  if (path.endsWith('.css')) return type.includes('text/css');
  if (path.endsWith('.html')) return type.includes('text/html');
  if (path.endsWith('.webmanifest')) return /(?:manifest\+json|application\/json)/i.test(type);
  return true;
}

self.addEventListener('install', event => {
  // Validate the whole shell before caching it. A failed deployment must not
  // replace a working offline version with 404s or HTML masquerading as JS/CSS.
  event.waitUntil((async () => {
    const existed = await caches.has(cacheName);
    try {
      const entries = await Promise.all([...assetUrls].map(async url => {
        if (!inScope(url)) throw new Error('App-shell asset is outside the app scope.');
        const response = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
        if (!validAsset(url, response)) throw new Error(`Invalid app-shell response: ${new URL(url).pathname}`);
        return { url, response };
      }));
      const cache = await caches.open(cacheName);
      await Promise.all(entries.map(({ url, response }) => cache.put(url, response)));
    } catch (error) {
      if (!existed) await caches.delete(cacheName);
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(cachePrefix) && key !== cacheName) await caches.delete(key);
      // Migrate old unscoped MindPilot caches only when their entries belong
      // to this app. Other projects on the same github.io origin stay intact.
      else if (/^mindpilot-shell--?\d+$/.test(key)) {
        const requests = await (await caches.open(key)).keys();
        if (requests.every(request => inScope(request.url))) await caches.delete(key);
      }
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  // Only the explicit Update action activates a waiting version.
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !inScope(request.url)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      // Keep HTML and its hashed assets on the same release until Update is
      // accepted; registration.update() checks for newer releases in the app.
      const shell = await (await caches.open(cacheName)).match(new URL('index.html', scope).href, { ignoreVary: true });
      return shell ?? fetch(request);
    })());
  } else if (assetUrls.has(request.url)) {
    // The precache is limited to public app-shell assets on this origin. Ignore
    // Vary: Origin from static hosts: module requests and precache requests can
    // have different Origin headers even when they reference the same asset.
    event.respondWith((async () => (await (await caches.open(cacheName)).match(request, { ignoreVary: true })) ?? fetch(request))());
  }
});
