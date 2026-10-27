import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Chemins relatifs : l'appli marche aussi servie depuis un sous-dossier.
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Babiole',
        short_name: 'Babiole',
        description: 'Dessin 3D hors-ligne, pilotable à la voix ou au regard',
        lang: 'fr',
        start_url: '.',
        display: 'standalone',
        background_color: '#1d2330',
        theme_color: '#1d2330',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
      },
    }),
  ],
  build: {
    // Three.js pèse lourd ; l'appli est mise en cache une fois pour toutes.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
