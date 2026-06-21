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
  const [backups, setBackups] = useState([])

  useEffect(() => {
    fetch('/api/version').then(r => r.json()).then(d => setVersion(d.version)).catch(() => {})
  }, [])

  useEffect(() => {
    if (employee?.role === 'admin') {
      fetch('/api/backups', { headers: { Authorization: `Bearer ${getToken()}` } })
        .then(r => r.json())
        .then(data => setBackups(data))
        .catch(() => {})
    }
  }, [employee])

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

      {employee?.role === 'admin' && <div className="section-head">Lists</div>}
      {employee?.role === 'admin' && (
        <div className="card" style={{ margin: '0 12px' }}>
          <button onClick={() => navigate('admin', { tab: 'employees' })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
            <Icon name="user" size={18} color="var(--text2)" />
            <span style={{ fontFamily: 'Barlow Condensed', fontSize: 15, fontWeight: 700, letterSpacing: 0.3, color: 'var(--text)' }}>Employees</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 18 }}>{'\u203A'}</span>
          </button>
          <button onClick={() => navigate('admin', { tab: 'assignments' })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
            <Icon name="edit" size={18} color="var(--text2)" />
            <span style={{ fontFamily: 'Barlow Condensed', fontSize: 15, fontWeight: 700, letterSpacing: 0.3, color: 'var(--text)' }}>Assignments</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 18 }}>{'\u203A'}</span>
          </button>
          <button onClick={() => navigate('admin', { tab: 'authorized_items' })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
            <Icon name="settings" size={18} color="var(--text2)" />
            <span style={{ fontFamily: 'Barlow Condensed', fontSize: 15, fontWeight: 700, letterSpacing: 0.3, color: 'var(--text)' }}>Items</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 18 }}>{'\u203A'}</span>
          </button>
          <button onClick={() => navigate('admin', { tab: 'products' })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontSize: 16 }}>{'\u{1F4E6}'}</span>
            <span style={{ fontFamily: 'Barlow Condensed', fontSize: 15, fontWeight: 700, letterSpacing: 0.3, color: 'var(--text)' }}>Products</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 18 }}>{'\u203A'}</span>
          </button>
        </div>
      )}

      {employee?.role === 'admin' && <div className="section-head">Export</div>}
      {employee?.role === 'admin' && (
        <div className="card" style={{ margin: '0 12px' }}>
          <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
            <Icon name="download" size={18} color="var(--text2)" />
            <span style={{ fontFamily: 'Barlow Condensed', fontSize: 15, fontWeight: 700, letterSpacing: 0.3, color: 'var(--text)' }}>Export Database (ZIP)</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 18 }}>{'\u203A'}</span>
          </button>
          {backups.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px' }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
                Recent Backups
              </div>
              {backups.map(b => (
                <div key={b.filename} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontFamily: 'Barlow Condensed', fontSize: 13, color: 'var(--text2)' }}>
                  <span style={{ color: 'var(--text3)', fontSize: 14 }}>{'\u{1F4C4}'}</span>
                  <span>{b.filename}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
                    {(b.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button onClick={logout} className="sign-out-btn">
        <Icon name="anchor" size={18} color="var(--danger)" />
        <span style={{ fontFamily: 'Barlow Condensed', fontSize: 15, fontWeight: 700, letterSpacing: 0.3, color: 'var(--danger)' }}>Sign Out {employee?.name}</span>
      </button>

      <div style={{ textAlign: 'center', padding: '24px 16px', fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: 0.5 }}>
        MARINA MANAGER v{version} {'\u00B7'} CAMPBELL'S LANDING
      </div>
    </div>
  )
}
