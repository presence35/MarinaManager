import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Marina Manager',
        short_name: 'Marina',
        description: "Campbell's Landing Marina — Service & Storage Management",
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a4f6e',
        theme_color: '#0a4f6e',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
  base: '',
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/photos': 'http://localhost:3000',
    },
  },
})
