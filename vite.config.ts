import mdx from '@mdx-js/rollup';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH umožní nasazení do podadresáře (např. GitHub Pages); výchozí je kořen domény.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev') },
  plugins: [
    { enforce: 'pre', ...mdx({ providerImportSource: '@mdx-js/react' }) },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'DiveEdu – teorie technického potápění',
        short_name: 'DiveEdu',
        description: 'Výuková aplikace teorie technického potápění (OC). Není to plánovač ponorů.',
        lang: 'cs',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b1418',
        theme_color: '#0b1418',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Jádro: kód, styly, text, otázky, graf, matematické fonty. Média se cachují až po stažení balíčku.
        // Manifest zvuku je malý a musí být offline, aby aplikace věděla, které soubory hledat ve staženém balíčku.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}', 'media-manifest.json'],
        globIgnores: ['media/**'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/media/'),
            handler: 'CacheFirst',
            options: { cacheName: 'media', rangeRequests: true, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
  build: { target: 'es2022', sourcemap: false },
});
