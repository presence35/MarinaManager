import { createContext, useState, useContext } from 'react'
import { api } from '../api'

export const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  // TEMP AUTH BYPASS — restore localStorage lookup to bring back PIN login
  const [employee, setEmployee] = useState({ id: 1, name: 'Preview Admin', role: 'admin', initials: 'AD' })

  const login = (emp) => {
    setEmployee(emp)
    localStorage.setItem('marina_employee', JSON.stringify(emp))
  }

  const logout = async () => {
    // TEMP AUTH BYPASS — keep preview admin instead of logging out
    setEmployee({ id: 1, name: 'Preview Admin', role: 'admin', initials: 'AD' })
  }

  return (
    <AuthCtx.Provider value={{ employee, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}
