import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const base = '/MindPilot/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), VitePWA({
    base,
    scope: base,
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'apple-touch-icon.png'],
    manifest: {
      id: base, name: 'MindPilot', short_name: 'MindPilot',
      description: 'Automate the humdrum. Amplify the mind.',
      start_url: base, scope: base, display: 'standalone',
      background_color: '#f6f8fb', theme_color: '#17283f',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
    },
  })],
});
