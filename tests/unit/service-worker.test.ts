import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const scope = 'https://example.github.io/MindPilot/';
const otherScope = 'https://example.github.io/OtherApp/';
const source = ts.transpileModule(readFileSync(new URL('../../src/sw.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/export\s*\{\s*\};?/, '');

class MemoryCache {
  entries = new Map<string, Response>();
  async put(key: string, response: Response) { this.entries.set(key, response.clone()); }
  async match(key: string | Request) { return this.entries.get(typeof key === 'string' ? key : key.url)?.clone(); }
  async keys() { return [...this.entries.keys()].map(url => new Request(url)); }
}

function worker() {
  const stores = new Map<string, MemoryCache>();
  const caches = {
    has: async (name: string) => stores.has(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new MemoryCache());
      return stores.get(name)!;
    },
  };
  const listeners = new Map<string, (event: unknown) => void>();
  const skipWaiting = vi.fn(async () => {}), claim = vi.fn(async () => {});
  const files = [
    { url: 'index.html', type: 'text/html', body: '<html>Working MindPilot</html>' },
    { url: 'assets/app.js', type: 'text/javascript', body: 'console.log("working app")' },
    { url: 'assets/app.css', type: 'text/css', body: 'body { color: black }' },
    { url: 'manifest.webmanifest', type: 'application/manifest+json', body: '{"name":"MindPilot"}' },
  ];
  const fetch = vi.fn(async (request: Request) => {
    const file = files.find(item => new URL(item.url, scope).href === request.url);
    return file ? new Response(file.body, { headers: { 'content-type': file.type } }) : new Response('Not found', { status: 404 });
  });
  runInNewContext(source, {
    self: {
      __WB_MANIFEST: files.map(file => ({ url: file.url, revision: 'new-release' })),
      registration: { scope }, location: new URL(scope + 'sw.js'),
      addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
      skipWaiting, clients: { claim },
    },
    caches, fetch, URL, Request, Response,
  });
  const dispatch = async (type: string, values: Record<string, unknown> = {}) => {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)!({ ...values, waitUntil: (promise: Promise<unknown>) => pending.push(promise) });
    await Promise.all(pending);
  };
  const respond = async (request: { url: string; method: string; mode: string }) => {
    let result: Promise<Response> | undefined;
    listeners.get('fetch')!({ request, respondWith: (promise: Promise<Response>) => { result = promise; } });
    return result;
  };
  return { stores, caches, fetch, skipWaiting, claim, dispatch, respond };
}

describe('production service worker', () => {
  it.each([404, 200])('rejects a broken JavaScript response (%s) and preserves the previous shell', async status => {
    const sw = worker();
    const previous = await sw.caches.open('mindpilot-shell-123');
    await previous.put(scope + 'index.html', new Response('previous working release'));
    const originalFetch = sw.fetch.getMockImplementation()!;
    sw.fetch.mockImplementation(request => request.url.endsWith('.js')
      ? Promise.resolve(new Response('<html>Error page</html>', { status, headers: { 'content-type': 'text/html' } }))
      : originalFetch(request));
    await expect(sw.dispatch('install')).rejects.toThrow('Invalid app-shell response');
    expect(await sw.caches.keys()).toEqual(['mindpilot-shell-123']);
    expect(await (await previous.match(scope + 'index.html'))!.text()).toBe('previous working release');
    expect(sw.skipWaiting).not.toHaveBeenCalled();
  });

  it('retires only this app’s old caches after a successful installation', async () => {
    const sw = worker();
    const old = `mindpilot-shell-v2-${encodeURIComponent(scope)}-old`;
    const other = `mindpilot-shell-v2-${encodeURIComponent(otherScope)}-old`;
    for (const [name, url] of [[old, scope], ['mindpilot-shell-123', scope], [other, otherScope], ['mindpilot-shell-456', otherScope], ['another-app', scope]]) {
      await (await sw.caches.open(name)).put(url + 'index.html', new Response('saved data'));
    }
    await sw.dispatch('install');
    await sw.dispatch('activate');
    const names = await sw.caches.keys();
    expect(names).not.toContain(old);
    expect(names).not.toContain('mindpilot-shell-123');
    expect(names).toContain(other);
    expect(names).toContain('mindpilot-shell-456');
    expect(names).toContain('another-app');
    expect(sw.claim).toHaveBeenCalledOnce();
  });

  it('serves a consistent shell offline and leaves other project paths alone', async () => {
    const sw = worker();
    await sw.dispatch('install');
    await sw.dispatch('activate');
    sw.fetch.mockRejectedValue(new Error('offline'));
    const html = await sw.respond({ url: scope, method: 'GET', mode: 'navigate' });
    expect(await html!.text()).toContain('Working MindPilot');
    const script = await sw.respond({ url: scope + 'assets/app.js', method: 'GET', mode: 'cors' });
    expect(await script!.text()).toContain('working app');
    expect(await sw.respond({ url: otherScope, method: 'GET', mode: 'navigate' })).toBeUndefined();
  });

  it('activates a waiting update only when the existing Update action requests it', async () => {
    const sw = worker();
    await sw.dispatch('install');
    expect(sw.skipWaiting).not.toHaveBeenCalled();
    await sw.dispatch('message', { data: { type: 'UNRELATED' } });
    expect(sw.skipWaiting).not.toHaveBeenCalled();
    await sw.dispatch('message', { data: { type: 'SKIP_WAITING' } });
    expect(sw.skipWaiting).toHaveBeenCalledOnce();
  });
});
