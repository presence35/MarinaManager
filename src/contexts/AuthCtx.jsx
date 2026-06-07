import { createContext, useState, useContext } from 'react'
import { api } from '../api'

export const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(() => {
    try { return JSON.parse(localStorage.getItem('marina_employee')) }
    catch { return null }
  })

  const login = (emp) => {
    setEmployee(emp)
    localStorage.setItem('marina_employee', JSON.stringify(emp))
  }

  const logout = async () => {
    try { await api('POST', '/auth/logout') } catch {}
    localStorage.removeItem('marina_token')
    localStorage.removeItem('marina_employee')
    setEmployee(null)
  }

  return (
    <AuthCtx.Provider value={{ employee, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}
