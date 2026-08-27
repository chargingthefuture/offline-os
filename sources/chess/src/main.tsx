import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Always land on the latest deployed version. The service worker is set to update in the
// background (skipWaiting + clientsClaim), so a freshly deployed build activates as soon as the
// browser fetches it — which the browser does on each load. When that newer worker takes control
// of this tab, reload once so the page swaps to it instead of running the previously cached build.
//
// Guarded so it fires at most once, and only when the page was ALREADY controlled by a worker —
// i.e. a real update, never on the first install and never in a loop.
//
// Offline is unaffected: with no network there is no newer worker, nothing reloads, and the
// precached app shell + engine are served exactly as before, so the app still works with no data.
if ('serviceWorker' in navigator) {
  let reloading = false
  const alreadyControlled = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !alreadyControlled) return
    reloading = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
