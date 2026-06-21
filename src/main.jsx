import { createRoot } from 'react-dom/client'
import App from './App'

async function checkVersion() {
  try {
    const res = await fetch('/api/version')
    if (!res.ok) return
    const { version } = await res.json()
    const stored = localStorage.getItem('marina_app_version')
    if (stored && stored !== version) {
      const overlay = document.createElement('div')
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#0a4f6e;color:#fff;font-family:Barlow,sans-serif;font-size:18px;letter-spacing:1px;'
      overlay.textContent = 'Updating app...'
      document.body.appendChild(overlay)
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('marina_')) localStorage.removeItem(key)
      }
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.map(n => caches.delete(n)))
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      }
      localStorage.setItem('marina_app_version', version)
      window.location.reload()
      return
    }
    if (!stored) localStorage.setItem('marina_app_version', version)
  } catch {}
}

checkVersion().then(() => {
  const root = createRoot(document.getElementById('root'))
  root.render(<App />)
})
