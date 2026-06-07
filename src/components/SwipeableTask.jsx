import { useState, useRef } from 'react'

export default function SwipeableTask({ label, authorized, completed, completedBy, completedAt, employeeName, onToggleAuth, onComplete, onUncomplete, isLast }) {
  const [offset, setOffset] = useState(0)
  const startPos = useRef(null)
  const uncompleteTimeout = useRef(null)
  const [holding, setHolding] = useState(false)
  const wasDragged = useRef(false)

  const startTimer = () => {
    setHolding(true)
    uncompleteTimeout.current = setTimeout(() => {
      onUncomplete()
      setOffset(0)
      setHolding(false)
    }, 420)
  }

  const clearTimer = () => {
    if (uncompleteTimeout.current) {
      clearTimeout(uncompleteTimeout.current)
      uncompleteTimeout.current = null
    }
    setHolding(false)
  }

  const handlePointerDown = (e) => {
    startPos.current = { x: e.clientX, y: e.clientY }
    wasDragged.current = false
  }

  const handlePointerMove = (e) => {
    if (!startPos.current) return
    const dx = e.clientX - startPos.current.x
    const dy = Math.abs(e.clientY - startPos.current.y)

    if (dy > 10 || Math.abs(dx) > 10) wasDragged.current = true
    if (dy > 30) { clearTimer(); setOffset(0); return }

    if (!completed && dx > 0 && authorized) {
      setOffset(Math.min(dx, 120))
    } else if (completed && dx < 0) {
      setOffset(Math.max(dx, -120))
      if (dx < -50 && !uncompleteTimeout.current) startTimer()
      else if (dx >= -50) clearTimer()
    }
  }

  const handlePointerUp = () => {
    if (!startPos.current) return
    clearTimer()
    if (!completed && offset > 80 && authorized) onComplete()
    else if (!wasDragged.current && !completed) onToggleAuth()
    else if (!wasDragged.current && completed) onToggleAuth()
    if (wasDragged.current) setOffset(0)
    startPos.current = null
  }

  const handlePointerCancel = () => {
    clearTimer()
    setOffset(0)
    startPos.current = null
  }

  const formatDate = (d) => {
    if (!d) return ''
    const date = new Date(d)
    return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
  }

  return (
    <div
      style={{
        overflow: 'hidden',
        position: 'relative',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        touchAction: 'pan-y',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div
        style={{
          position: 'absolute', inset: 0,
          background: completed ? 'var(--danger)' : 'var(--success)',
          display: 'flex', alignItems: 'center',
          justifyContent: completed ? 'flex-end' : 'flex-start',
          padding: '0 20px', color: '#fff', fontWeight: 'bold',
          fontSize: 14, textTransform: 'uppercase', fontFamily: 'Barlow Condensed',
        }}
      >
        {completed ? (holding ? 'HOLD TO UNCOMPLETE...' : 'SLIDE & HOLD') : 'SLIDE TO COMPLETE'}
      </div>
      <div
        style={{
          position: 'relative', display: 'flex', alignItems: 'center',
          padding: '14px 16px',
          background: completed ? 'rgba(45,168,79,.1)' : 'var(--surface)',
          transform: `translateX(${offset}px)`,
          transition: startPos.current ? 'none' : 'transform .2s ease',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 15, fontWeight: 600,
            color: completed ? 'var(--success)' : authorized ? 'var(--text)' : 'var(--text3)',
          }}>
            {label}
          </div>
          {completed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--success)', textTransform: 'uppercase' }}>
                COMPLETE
              </span>
              {completedAt && (
                <span style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: 0.3 }}>
                  {formatDate(completedAt)}
                </span>
              )}
              {completedBy && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: 'Barlow Condensed', letterSpacing: 0.5 }}>
                  {employeeName ? employeeName.slice(0, 2).toUpperCase() : '??'}
                </span>
              )}
            </div>
          )}
          {authorized && !completed && (
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--accent)', textTransform: 'uppercase', marginTop: 2 }}>
              TAP TO COMPLETE
            </div>
          )}
        </div>
      </div>
    </div>
  )
}