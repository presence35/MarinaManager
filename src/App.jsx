import { useState, useEffect, useContext, useCallback, useRef } from 'react'
import { ThemeProvider } from './contexts/ThemeCtx'
import { AuthCtx, AuthProvider } from './contexts/AuthCtx'
import { ToastProvider } from './contexts/ToastCtx'
import { api, getToken } from './api'
import LoginScreen from './screens/LoginScreen'
import CustomerViewScreen from './screens/CustomerViewScreen'
import AppShell from './AppShell'

function App() {
  const { employee, login } = useContext(AuthCtx)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [customerCard, setCustomerCard] = useState(null)
  const [customerLoading, setCustomerLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wo = params.get('wo')
    if (wo) {
      fetch(`/api/public/card/${encodeURIComponent(wo)}`)
        .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
        .then(data => { setCustomerCard(data); setCustomerLoading(false) })
        .catch(() => { setCustomerCard('error'); setCustomerLoading(false) })
    } else {
      setCustomerLoading(false)
    }
  }, [])

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    window.addEventListener('appinstalled', () => setInstallPrompt(null))
  }, [])

  useEffect(() => {
    if (employee && getToken()) {
      api('GET', '/auth/me')
        .then((emp) => { if (emp) login(emp) })
        .catch(() => {
          localStorage.removeItem('marina_token')
          localStorage.removeItem('marina_employee')
        })
    }
  }, [])

  if (customerLoading) return null
  if (customerCard === 'error') return <CustomerViewScreen />
  if (customerCard) return <CustomerViewScreen card={customerCard} />
  if (!employee) return <LoginScreen onLogin={login} />
  return <AppShell />
}

export default function Root() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
