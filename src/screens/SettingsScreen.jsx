import { useState, useEffect, useContext } from 'react'
import { ThemeCtx } from '../contexts/ThemeCtx'
import { AuthCtx } from '../contexts/AuthCtx'
import { NavCtx } from '../contexts/NavCtx'
import { THEMES, THEME_PREVIEW_COLORS, ROLE_COLORS } from '../constants'
import Icon from '../components/Icon'
import { getToken } from '../api'

export default function SettingsScreen() {
  const { theme, darkMode, setTheme, setDarkMode } = useContext(ThemeCtx)
  const { employee, logout } = useContext(AuthCtx)
  const { navigate } = useContext(NavCtx)
  const [version, setVersion] = useState('')

  useEffect(() => {
    fetch('/api/version').then(r => r.json()).then(d => setVersion(d.version)).catch(() => {})
  }, [])

  async function handleExport() {
    const res = await fetch('/api/export', { headers: { Authorization: `Bearer ${getToken()}` } })
    if (res.status === 401) {
      localStorage.removeItem('marina_token'); localStorage.removeItem('marina_employee'); window.location.reload(); return
    }
    if (!res.ok) return alert('Export failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `marina-backup-${new Date().toISOString().split('T')[0]}.zip`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="section-head">Theme</div>
      <div className="day-night-toggle">
        <button className={`dnt-btn ${!darkMode ? 'active' : ''}`} onClick={() => setDarkMode(false)}>
          {'\u2600\uFE0F'} Day
        </button>
        <button className={`dnt-btn ${darkMode ? 'active' : ''}`} onClick={() => setDarkMode(true)}>
          {'\u{1F319}'} Night
        </button>
      </div>
      <div className="theme-grid">
        {THEMES.map((t) => {
          const colors = THEME_PREVIEW_COLORS[t.id][darkMode ? 'night' : 'day']
          const isSelected = theme === t.id
          return (
            <div key={t.id} className={`theme-card ${isSelected ? 'selected' : ''}`} onClick={() => setTheme(t.id)}>
              <div className="theme-preview" style={{ background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 28 }}>{t.icon}</span>
                {isSelected && <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={12} color="#fff" />
                </div>}
              </div>
              <div className="theme-meta"><div className="theme-name">{t.name}</div></div>
            </div>
          )
        })}
      </div>

      <div className="section-head">Profile</div>
      <div className="card" style={{ margin: '0 12px' }}>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: 20, letterSpacing: 1, color: '#fff' }}>
            {employee?.initials || employee?.name?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 1, color: 'var(--text)' }}>{employee?.name}</div>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: ROLE_COLORS[employee?.role] || 'var(--text3)', textTransform: 'uppercase' }}>{employee?.role}</div>
          </div>
        </div>
      </div>

      {employee?.role === 'admin' && <div className="section-head">Administration</div>}
      {employee?.role === 'admin' && (
        <div className="card" style={{ margin: '0 12px' }}>
          <button onClick={() => navigate('admin')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
            <Icon name="user" size={18} color="var(--text2)" />
            <span style={{ fontFamily: 'Barlow Condensed', fontSize: 15, fontWeight: 700, letterSpacing: 0.3, color: 'var(--text)' }}>Administration</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 18 }}>{'\u203A'}</span>
          </button>
          <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
            <Icon name="download" size={18} color="var(--text2)" />
            <span style={{ fontFamily: 'Barlow Condensed', fontSize: 15, fontWeight: 700, letterSpacing: 0.3, color: 'var(--text)' }}>Export Database (ZIP)</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 18 }}>{'\u203A'}</span>
          </button>
        </div>
      )}

      <button onClick={logout} className="sign-out-btn">
        <Icon name="anchor" size={18} color="var(--danger)" />
        <span style={{ fontFamily: 'Barlow Condensed', fontSize: 15, fontWeight: 700, letterSpacing: 0.3, color: 'var(--danger)' }}>Sign Out</span>
      </button>

      <div style={{ textAlign: 'center', padding: '24px 16px', fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: 0.5 }}>
        MARINA MANAGER v{version} {'\u00B7'} CAMPBELL'S LANDING
      </div>
    </div>
  )
}
