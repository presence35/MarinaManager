export default function SwipeableTask({ label, authorized, completed, completedBy, completedAt, employeeName, onComplete, onUncomplete, isLast }) {
  const formatDate = (d) => {
    if (!d) return ''
    const date = new Date(d)
    return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
  }

  const handleClick = () => {
    if (completed) onUncomplete()
    else onComplete()
  }

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center',
          padding: '14px 16px',
          background: completed ? 'rgba(136,136,136,.08)' : 'var(--surface)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={handleClick}
      >
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 15, fontWeight: 600,
            color: completed ? 'var(--text3)' : authorized ? 'var(--text)' : 'var(--text3)',
          }}>
            {label}
          </div>
          {completed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text3)', textTransform: 'uppercase' }}>
                COMPLETE
              </span>
              {completedAt && (
                <span style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: 0.3 }}>
                  {formatDate(completedAt)}
                </span>
              )}
              {completedBy && employeeName && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: 'Barlow Condensed', letterSpacing: 0.5 }}>
                    {employeeName.slice(0, 2).toUpperCase()}
                  </span>
                  <span style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: 0.3 }}>
                    {employeeName}
                  </span>
                </span>
              )}
            </div>
          )}
          {authorized && (
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: completed ? 'var(--text3)' : 'var(--accent)', textTransform: 'uppercase', marginTop: 2 }}>
              {completed ? 'TAP TO UNCOMPLETE' : 'TAP TO COMPLETE'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
