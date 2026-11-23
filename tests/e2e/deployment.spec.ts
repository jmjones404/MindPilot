import { test, expect } from '@playwright/test';

test('production assets and PWA registration stay inside the GitHub Pages base', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)\./ })).toBeVisible();
  const assets = await page.evaluate(() => ({
    scripts: [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map(item => item.src),
    styles: [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(item => item.href),
    icons: [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')].map(item => item.href),
    manifest: document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href,
  }));
  expect(assets.scripts.length).toBeGreaterThan(0);
  expect(assets.styles.length).toBeGreaterThan(0);
  expect(assets.icons).toHaveLength(2);
  for (const [kind, urls] of Object.entries(assets)) {
    for (const url of typeof urls === 'string' ? [urls] : urls) {
      expect(new URL(url).pathname).toMatch(/^\/MindPilot\//);
      expect(url).not.toMatch(/\.tsx?(?:\?|$)/);
      const response = await request.get(url);
      expect(response.ok(), url).toBe(true);
      if (kind === 'scripts') expect(response.headers()['content-type']).toMatch(/javascript/);
      if (kind === 'styles') expect(response.headers()['content-type']).toContain('text/css');
    }
  }
  const manifest = await (await request.get(assets.manifest)).json();
  expect(manifest.id).toBe('/MindPilot/');
  expect(manifest.start_url).toBe('/MindPilot/');
  expect(manifest.scope).toBe('/MindPilot/');
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, assets.manifest);
    expect(url.pathname).toMatch(/^\/MindPilot\//);
    const response = await request.get(url.href);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }
  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return { scope: registration.scope, script: registration.active?.scriptURL };
  });
  expect(new URL(worker.scope).pathname).toBe('/MindPilot/');
  expect(new URL(worker.script!).pathname).toBe('/MindPilot/sw.js');
  expect(errors).toEqual([]);
});
