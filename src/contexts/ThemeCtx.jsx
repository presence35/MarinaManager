import { createContext, useState, useEffect, useContext } from 'react'
import { THEMES, THEME_PREVIEW_COLORS } from '../constants'

export const ThemeCtx = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('marina_theme') || 'deep-water')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('marina_dark') === 'true')

  useEffect(() => {
    localStorage.setItem('marina_theme', theme)
    localStorage.setItem('marina_dark', darkMode)
    const body = document.body
    THEMES.forEach(t => body.classList.remove(`theme-${t.id}`, 'light', 'dark'))
    body.classList.add(`theme-${theme}`)
    body.classList.add(darkMode ? 'dark' : 'light')
    const mc = document.querySelector('meta[name="theme-color"]')
    if (mc) {
      const colors = THEME_PREVIEW_COLORS[theme][darkMode ? 'night' : 'day']
      mc.content = colors[0]
    }
  }, [theme, darkMode])

  return (
    <ThemeCtx.Provider value={{ theme, darkMode, setTheme, setDarkMode }}>
      {children}
    </ThemeCtx.Provider>
  )
}
