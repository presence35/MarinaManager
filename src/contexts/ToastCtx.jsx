import { createContext, useState, useCallback, useRef, useContext } from 'react'

export const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback((msg, duration = 2200) => {
    clearTimeout(timerRef.current)
    setToast(msg)
    timerRef.current = setTimeout(() => setToast(null), duration)
  }, [])

  return (
    <ToastCtx.Provider value={showToast}>
      {children}
      {toast && <div className="toast">{toast}</div>}
    </ToastCtx.Provider>
  )
}
