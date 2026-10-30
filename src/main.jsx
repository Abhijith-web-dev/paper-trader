import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Auto-recover from Vite dynamic import chunk hash mismatches during deployments (strictly guarded against reload loops)
if (!import.meta.env.DEV) {
  window.addEventListener('vite:preloadError', (event) => {
    try {
      const lastReload = Number(sessionStorage.getItem('last_vite_preload_reload') || 0);
      if (Date.now() - lastReload > 60000) {
        sessionStorage.setItem('last_vite_preload_reload', String(Date.now()));
        console.warn('[Vite] Chunk preload mismatch detected, auto-refreshing for new deployment...', event);
        window.location.reload();
      } else {
        console.warn('[Vite] Suppressed repeat reload loop from vite:preloadError.');
      }
    } catch {
      // Safe failover
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
