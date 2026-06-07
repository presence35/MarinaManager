import { useState, useEffect, useContext, useMemo } from 'react'
import { NavCtx } from '../contexts/NavCtx'
import { api } from '../api'
import { STATUS_CONFIG, STORAGE_TYPES } from '../constants'
import StatusBadge from '../components/StatusBadge'
import Icon from '../components/Icon'

export default function MapScreen() {
  const { navigate } = useContext(NavCtx)
  const [cards, setCards] = useState([])
  const [view, setView] = useState('list')

  useEffect(() => {
    api('GET', '/cards')
      .then((data) => setCards(data.filter((c) => c.storage_location)))
      .catch(() => {})
  }, [])

  const storageBuildingCards = useMemo(() => {
    return cards.filter(c => c.storage_type === 'storage_building')
  }, [cards])

  const buildingMap = useMemo(() => {
    const map = {}
    storageBuildingCards.forEach(c => {
      const loc = c.storage_location || ''
      const parts = loc.split(', ')
      const bldg = parts.find(p => p.startsWith('Bldg '))
      const row = parts.find(p => p.startsWith('Row '))
      const col = parts.find(p => p.startsWith('Col '))
      const level = parts.find(p => p.startsWith('Lvl '))
      const bldgKey = bldg || 'Unknown'
      if (!map[bldgKey]) map[bldgKey] = []
      map[bldgKey].push({
        ...c,
        rowLabel: row ? row.replace('Row ', '') : '',
        colNum: col ? parseInt(col.replace('Col ', '')) : 0,
        levelNum: level ? parseInt(level.replace('Lvl ', '')) : 0,
      })
    })
    return map
  }, [storageBuildingCards])

  const otherCards = useMemo(() => {
    return cards.filter(c => c.storage_type !== 'storage_building')
  }, [cards])

  if (view === 'grid' && Object.keys(buildingMap).length > 0) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 6, padding: '10px 12px' }}>
          <button className={`chip ${view === 'list' ? 'on' : ''}`} onClick={() => setView('list')}>{'\u{1F4CB}'} List</button>
          <button className={`chip ${view === 'grid' ? 'on' : ''}`} onClick={() => setView('grid')}>{'\u{1F5FA}\uFE0F'} Grid</button>
        </div>
        {Object.entries(buildingMap).map(([bldg, boats]) => (
          <div key={bldg} style={{ margin: '0 12px 16px' }}>
            <div className="section-head">{bldg}</div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {boats.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 13 }}>Empty</div>
              ) : (
                <div style={{ padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
                    {'ABCDEFGHIJKL'.split('').map(rowLetter => (
                      <div key={rowLetter} style={{ textAlign: 'center', fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 700, color: 'var(--text3)', padding: 2 }}>
                        {rowLetter}
                      </div>
                    ))}
                    {Array.from({ length: 8 * 6 }, (_, i) => {
                      const col = (i % 8) + 1
                      const rowLetter = 'ABCDEFGHIJKL'[Math.floor(i / 8)]
                      if (!rowLetter) return null
                      const boat = boats.find(b => b.colNum === col && b.rowLabel === rowLetter)
                      return (
                        <div key={i}
                          onClick={() => boat && navigate('card', { id: boat.id })}
                          style={{
                            aspectRatio: '1', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 600, textAlign: 'center', cursor: boat ? 'pointer' : 'default', overflow: 'hidden',
                            background: boat ? (STATUS_CONFIG[boat.status]?.bg || 'var(--surface2)') : 'var(--surface2)',
                            color: boat ? (STATUS_CONFIG[boat.status]?.color || 'var(--text2)') : 'var(--text3)',
                            border: boat ? `2px solid ${STATUS_CONFIG[boat.status]?.stripe || 'transparent'}` : '1px solid var(--border)',
                            opacity: boat ? 1 : 0.4,
                          }}>
                          {boat ? (boat.boat_name || '?').slice(0, 4) : ''}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {otherCards.length > 0 && (
          <div style={{ margin: '0 12px 16px' }}>
            <div className="section-head">Other Locations</div>
            <div className="card">
              {otherCards.map((c, i) => {
                const cfg = STATUS_CONFIG[c.status]
                return (
                  <div key={c.id} onClick={() => navigate('card', { id: c.id })}
                    style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: i < otherCards.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                    <div style={{ width: 6, height: 42, borderRadius: 3, background: cfg.stripe, marginRight: 12, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Bebas Neue', fontSize: 17, letterSpacing: 1, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.boat_name || '(no name)'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{c.customer_name}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                      <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.3 }}>
                        {c.storage_location}
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, padding: '10px 12px' }}>
        <button className={`chip ${view === 'list' ? 'on' : ''}`} onClick={() => setView('list')}>{'\u{1F4CB}'} List</button>
        {Object.keys(buildingMap).length > 0 && (
          <button className={`chip ${view === 'grid' ? 'on' : ''}`} onClick={() => setView('grid')}>{'\u{1F5FA}\uFE0F'} Grid</button>
        )}
      </div>
      <div className="section-head">Boats with Location Assigned</div>
      {cards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{'\u{1F5FA}\uFE0F'}</div>
          <div className="empty-title">No Locations Set</div>
          <div className="empty-msg">Assign storage locations on service cards</div>
        </div>
      ) : (
        <div className="card" style={{ margin: '0 12px' }}>
          {cards.map((c, i) => {
            const cfg = STATUS_CONFIG[c.status]
            return (
              <div
                key={c.id}
                onClick={() => navigate('card', { id: c.id })}
                style={{
                  display: 'flex', alignItems: 'center', padding: '12px 16px',
                  borderBottom: i < cards.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: 6, height: 42, borderRadius: 3, background: cfg.stripe, marginRight: 12, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Bebas Neue', fontSize: 17, letterSpacing: 1, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.boat_name || '(no name)'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{c.customer_name}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                  <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.3 }}>
                    {c.storage_location}
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ padding: '16px 12px 8px', fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase' }}>
        {Object.keys(buildingMap).length > 0 ? 'Switch to Grid view for building layout' : 'Assign storage locations to see the map'}
      </div>
    </div>
  )
}