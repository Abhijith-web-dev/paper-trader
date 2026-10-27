import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'unsafe-none',
    },
    proxy: {
      // High-performance same-origin proxy to eliminate CORS preflight on TradingView Scanner
      '/api/tv-scanner': {
        target: 'https://scanner.tradingview.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tv-scanner/, ''),
        headers: {
          'Origin': 'https://www.tradingview.com',
          'Referer': 'https://www.tradingview.com/',
        },
      },
      // Real-time Yahoo Finance Chart and Quotes proxy (No CORS, real 1-day intraday & streaming data)
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://finance.yahoo.com/',
        },
      },
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) {
              return 'vendor-firebase-firestore';
            }
            if (id.includes('@firebase/auth') || id.includes('firebase/auth')) {
              return 'vendor-firebase-auth';
            }
            if (id.includes('@firebase/database') || id.includes('firebase/database')) {
              return 'vendor-firebase-rtdb';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase-core';
            }
            if (id.includes('lightweight-charts')) {
              return 'vendor-charts';
            }
            if (id.includes('dexie')) {
              return 'vendor-dexie';
            }
          }
        },
      },
    },
  },
})

