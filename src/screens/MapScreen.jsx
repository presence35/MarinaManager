import { useState, useEffect, useContext, useMemo } from 'react'
import { NavCtx } from '../contexts/NavCtx'
import { api } from '../api'
import { STATUS_CONFIG, BUILDING_NAMES, STORAGE_ROWS, STORAGE_COLS, BOATHOUSE_COUNT, BOATHOUSE_SLIPS } from '../constants'
import StatusBadge from '../components/StatusBadge'
import Icon from '../components/Icon'

export default function MapScreen() {
  const { navigate } = useContext(NavCtx)
  const [cards, setCards] = useState([])
  const [view, setView] = useState('list')
  const [selectedBldg, setSelectedBldg] = useState('')

  useEffect(() => {
    api('GET', '/cards')
      .then((data) => setCards(data.filter((c) => c.storage_location)))
      .catch(() => {})
  }, [])

  const buildingCards = useMemo(() => {
    return cards.filter(c => c.storage_type === 'storage_building')
  }, [cards])

  const boathouseCards = useMemo(() => {
    return cards.filter(c => c.storage_type === 'marina_boathouse' || c.storage_type === 'customer_boathouse')
  }, [cards])

  const otherCards = useMemo(() => {
    return cards.filter(c => c.storage_type !== 'storage_building' && c.storage_type !== 'marina_boathouse' && c.storage_type !== 'customer_boathouse')
  }, [cards])

  const buildingMap = useMemo(() => {
    const map = {}
    buildingCards.forEach(c => {
      const bldg = c.storage_building || 'Unknown'
      if (!map[bldg]) map[bldg] = []
      map[bldg].push(c)
    })
    return map
  }, [buildingCards])

  const boathouseMap = useMemo(() => {
    const map = {}
    for (let i = 1; i <= BOATHOUSE_COUNT; i++) map[i] = []
    boathouseCards.forEach(c => {
      const bh = c.boathouse_no
      if (bh && map[bh]) map[bh].push(c)
    })
    return map
  }, [boathouseCards])

  const hasGrid = Object.keys(buildingMap).length > 0
  const hasBoathouse = boathouseCards.length > 0

  if (view === 'grid' && hasGrid) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 6, padding: '10px 12px', flexWrap: 'wrap' }}>
          <button className={`chip ${view === 'list' ? 'on' : ''}`} onClick={() => setView('list')}>{'\u{1F4CB}'} List</button>
          {hasGrid && <button className={`chip ${view === 'grid' ? 'on' : ''}`} onClick={() => setView('grid')}>{'\u{1F5FA}\uFE0F'} Buildings</button>}
          {hasBoathouse && <button className={`chip ${view === 'boathouse' ? 'on' : ''}`} onClick={() => setView('boathouse')}>{'\u{1F3E0}'} Boathouses</button>}
        </div>
        {BUILDING_NAMES.filter(b => buildingMap[b]).length > 1 && (
          <div style={{ display: 'flex', gap: 6, padding: '0 12px 8px', flexWrap: 'wrap' }}>
            <button className={`chip ${!selectedBldg ? 'on' : ''}`} onClick={() => setSelectedBldg('')}>All</button>
            {BUILDING_NAMES.filter(b => buildingMap[b]).map(b => (
              <button key={b} className={`chip ${selectedBldg === b ? 'on' : ''}`} onClick={() => setSelectedBldg(selectedBldg === b ? '' : b)}>{b}</button>
            ))}
          </div>
        )}
        {BUILDING_NAMES.filter(b => buildingMap[b] && (!selectedBldg || selectedBldg === b)).map(bldg => (
          <div key={bldg} style={{ margin: '0 12px 16px' }}>
            <div className="section-head">{bldg}</div>
            <div className="card" style={{ overflow: 'auto' }}>
              <div style={{ padding: 12, minWidth: 600 }}>
                <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(${STORAGE_COLS.length}, 1fr)`, gap: 2 }}>
                  <div />
                  {STORAGE_COLS.map(l => (
                    <div key={l} style={{ textAlign: 'center', fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 700, color: 'var(--text3)', padding: '2px 0' }}>
                      {l}
                    </div>
                  ))}
                  {STORAGE_ROWS.map(row => (
                    <div key={row} style={{ display: 'contents' }}>
                      <div style={{ textAlign: 'center', fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 700, color: 'var(--text3)', padding: '2px 4px', alignSelf: 'center' }}>
                        {row}
                      </div>
                      {STORAGE_COLS.map(col => {
                        const boat = buildingMap[bldg]?.find(b => String(b.storage_row) === String(row) && b.storage_col === col)
                        return (
                          <div key={col}
                            onClick={() => boat && navigate('card', { id: boat.id })}
                            style={{
                              aspectRatio: '1', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 9, fontWeight: 600, textAlign: 'center', cursor: boat ? 'pointer' : 'default', overflow: 'hidden',
                              background: boat ? (STATUS_CONFIG[boat.status]?.bg || 'var(--surface2)') : 'var(--surface2)',
                              color: boat ? (STATUS_CONFIG[boat.status]?.color || 'var(--text2)') : 'var(--text3)',
                              border: boat ? `2px solid ${STATUS_CONFIG[boat.status]?.stripe || 'transparent'}` : '1px solid var(--border)',
                              opacity: boat ? 1 : 0.4, minHeight: 28,
                            }}>
                            {boat ? (boat.boat_name || '?').slice(0, 4) : ''}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
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

  if (view === 'boathouse' && hasBoathouse) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 6, padding: '10px 12px', flexWrap: 'wrap' }}>
          <button className={`chip ${view === 'list' ? 'on' : ''}`} onClick={() => setView('list')}>{'\u{1F4CB}'} List</button>
          {hasGrid && <button className={`chip ${view === 'grid' ? 'on' : ''}`} onClick={() => setView('grid')}>{'\u{1F5FA}\uFE0F'} Buildings</button>}
          {hasBoathouse && <button className={`chip ${view === 'boathouse' ? 'on' : ''}`} onClick={() => setView('boathouse')}>{'\u{1F3E0}'} Boathouses</button>}
        </div>
        {Object.entries(boathouseMap).map(([bhNum, boats]) => (
          <div key={bhNum} style={{ margin: '0 12px 16px' }}>
            <div className="section-head">{'Boathouse ' + bhNum} ({boats.length}/{BOATHOUSE_SLIPS} occupied)</div>
            <div className="card">
              <div style={{ padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(BOATHOUSE_SLIPS, 10)}, 1fr)`, gap: 4 }}>
                  {Array.from({ length: BOATHOUSE_SLIPS }, (_, i) => i + 1).map(slip => {
                    const boat = boats.find(b => Number(b.slip_no) === slip)
                    const cfg = boat ? STATUS_CONFIG[boat.status] : null
                    return (
                      <div key={slip}
                        onClick={() => boat && navigate('card', { id: boat.id })}
                        style={{
                          aspectRatio: '1', borderRadius: 6, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', cursor: boat ? 'pointer' : 'default',
                          background: boat ? (cfg?.bg || 'var(--surface2)') : 'var(--surface2)',
                          border: boat ? `2px solid ${cfg?.stripe || 'transparent'}` : '1px solid var(--border)',
                          color: boat ? (cfg?.color || 'var(--text2)') : 'var(--text3)',
                          opacity: boat ? 1 : 0.5, padding: 4, minHeight: 48,
                        }}>
                        <div style={{ fontFamily: 'Barlow Condensed', fontSize: 9, fontWeight: 700, opacity: 0.6 }}>#{slip}</div>
                        {boat && <div style={{ fontSize: 9, fontWeight: 600, textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word' }}>{(boat.boat_name || '?').slice(0, 8)}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, padding: '10px 12px', flexWrap: 'wrap' }}>
        <button className={`chip ${view === 'list' ? 'on' : ''}`} onClick={() => setView('list')}>{'\u{1F4CB}'} List</button>
        {hasGrid && <button className={`chip ${view === 'grid' ? 'on' : ''}`} onClick={() => setView('grid')}>{'\u{1F5FA}\uFE0F'} Buildings</button>}
        {hasBoathouse && <button className={`chip ${view === 'boathouse' ? 'on' : ''}`} onClick={() => setView('boathouse')}>{'\u{1F3E0}'} Boathouses</button>}
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
        {!hasGrid && !hasBoathouse ? 'Assign storage locations to see the map' : ''}
      </div>
    </div>
  )
}
