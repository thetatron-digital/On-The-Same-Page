import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Offline support in the built app (not in development, where it would
// serve stale code): see public/sw.js
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    // Hand the worker the files this first visit already downloaded
    navigator.serviceWorker.ready.then((reg) => {
      const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.includes('/assets/'));
      reg.active?.postMessage({ type: 'cache-urls', urls });
    }).catch(() => {});
  });
}
