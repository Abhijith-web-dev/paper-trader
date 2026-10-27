import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Auto-recover from Vite dynamic import chunk hash mismatches during deployments
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Chunk preload mismatch detected, auto-refreshing for new deployment...', event);
  window.location.reload();
});

// Purge any stale or conflicting service workers to guarantee fresh assets from Firebase Hosting
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  }).catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
