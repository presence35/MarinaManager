import { useState, useEffect, useContext, useCallback, useRef } from 'react'
import { ThemeProvider } from './contexts/ThemeCtx'
import { AuthCtx, AuthProvider } from './contexts/AuthCtx'
import { ToastProvider } from './contexts/ToastCtx'
import { api, getToken } from './api'
import LoginScreen from './screens/LoginScreen'
import AppShell from './AppShell'

function App() {
  const { employee, login } = useContext(AuthCtx)

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
