import { useState } from 'react'
import { api } from '../api'

export default function LoginScreen({ onLogin }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const addDigit = async (d) => {
    if (loading) return
    const newPin = pin + d
    setPin(newPin)
    setError('')
    if (newPin.length === 4) {
      setLoading(true)
      try {
        const data = await api('POST', '/auth/login', { pin: newPin })
        localStorage.setItem('marina_token', data.token)
        localStorage.setItem('marina_employee', JSON.stringify(data.employee))
        onLogin(data.employee)
      } catch (e) {
        setError('Wrong PIN')
        setPin('')
      } finally {
        setLoading(false)
      }
    }
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '\u232B']

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{'\u2693'}</div>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 32, letterSpacing: 3, color: 'var(--primary)' }}>
          MARINA MANAGER
        </div>
        <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, fontWeight: 600, letterSpacing: 1, color: 'var(--text3)', textTransform: 'uppercase', marginTop: 4 }}>
          Enter your PIN
        </div>
      </div>

      <div className="pin-display">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
        ))}
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' }}>
          {error}
        </div>
      )}

      <div className="pin-grid" style={{ marginTop: 10, width: '100%', maxWidth: 280 }}>
        {keys.map((k, i) => (
          <button
            key={i}
            className={`pin-key ${k === '\u232B' ? 'del' : ''}`}
            style={{ visibility: k === '' ? 'hidden' : 'visible', opacity: loading ? 0.5 : 1 }}
            onClick={() => k === '\u232B' ? setPin(p => p.slice(0, -1)) : k && addDigit(k)}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}
