import { useState, useEffect, useContext } from 'react'
import { NavCtx } from '../contexts/NavCtx'
import { AuthCtx } from '../contexts/AuthCtx'
import { api } from '../api'
import { STATUS_CONFIG, STATUS_ORDER } from '../constants'
import StatusBadge from '../components/StatusBadge'
import Icon from '../components/Icon'

export default function CardsScreen({ params = {} }) {
  const { navigate } = useContext(NavCtx)
  const { employee } = useContext(AuthCtx)
  const [allCards, setAllCards] = useState([])
  const [filter, setFilter] = useState(params.filterStatus || 'all')
  const [showFake, setShowFake] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState([])
  const isAssignedWorker = employee?.role === 'mechanic' || employee?.role === 'cleaner'
  const isAdminOrOffice = employee?.role === 'admin' || employee?.role === 'office'

  useEffect(() => {
    if (isAssignedWorker) {
      api('GET', `/assignments?employee_id=${employee.id}`)
        .then(setAssignments)
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (search) qs.set('q', search)
    api('GET', `/cards?${qs}`)
      .then((data) => { setAllCards(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [search])

  const cards = allCards.filter(c => {
    if (showFake && !c.is_fake) return false
    if (filter === 'all') return true
    return c.status === filter
  })
  const assignedBoatIds = new Set(assignments.map(a => a.boat_id))
  const assignedCards = cards.filter(c => assignedBoatIds.has(c.boat_id))
  const otherCards = cards.filter(c => !assignedBoatIds.has(c.boat_id))

  const displayCards = isAssignedWorker ? [...assignedCards, ...otherCards] : cards

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', padding: '12px 12px 0' }}>
        <div className="search-bar" style={{ margin: 0, flex: 1 }}>
          <span className="search-icon"><Icon name="search" size={17} /></span>
          <input type="search" placeholder="Search boat, owner, licence..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {(employee?.role === 'admin' || employee?.role === 'office') && (
          <button className="btn btn-accent" style={{ width: 'auto' }} onClick={() => navigate('new-card')}>
            <Icon name="plus" size={18} color="#fff" /> New
          </button>
        )}
      </div>

      <div className="pipeline sticky-top">
        {['all', 'fake', ...STATUS_ORDER].map((s) => {
          const cfg = s === 'all' ? { label: 'ALL', color: 'var(--text2)', bg: 'var(--surface2)' } : s === 'fake' ? { label: 'FAKE', color: '#c0392b', bg: 'rgba(192,57,43,.15)' } : STATUS_CONFIG[s]
          const isActive = s === 'fake' ? showFake : filter === s
          const count = s === 'all' ? allCards.filter(c => !showFake || c.is_fake).length : s === 'fake' ? allCards.filter(c => c.is_fake).length : allCards.filter(c => c.status === s && (!showFake || c.is_fake)).length
          return (
            <button key={s} className="pipe-step"
              style={{ background: isActive ? cfg.color : 'transparent', borderColor: isActive ? cfg.color : 'var(--border)', color: isActive ? '#fff' : cfg.color, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={() => s === 'fake' ? setShowFake(!showFake) : setFilter(s)}>
              <span>{cfg.label}</span>
              <span style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--surface2)', color: isActive ? '#fff' : 'var(--text2)', padding: '2px 6px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ padding: '20px 12px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 84, background: 'var(--surface)', borderRadius: 'var(--r)', margin: '0 0 10px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 'var(--r)' }} className="shimmer" />
            </div>
          ))}
        </div>
      ) : displayCards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{'\u2693'}</div>
          <div className="empty-title">No cards found</div>
          <div className="empty-msg">Try a different filter or search</div>
        </div>
      ) : (
        <div style={{ padding: '8px 0' }}>
          {isAssignedWorker && assignedCards.length > 0 && (
            <>
              <div style={{ padding: '4px 14px 6px', fontFamily: 'Barlow Condensed', fontSize: 13, fontWeight: 700, letterSpacing: 0.8, color: 'var(--accent)', textTransform: 'uppercase' }}>
                {'\u{1F4CB}'} My Assigned Work ({assignedCards.length})
              </div>
              {assignedCards.map((card) => renderCard(card, true))}
              {otherCards.length > 0 && (
                <div style={{ padding: '14px 14px 6px', fontFamily: 'Barlow Condensed', fontSize: 13, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase' }}>
                  All Other Boats ({otherCards.length})
                </div>
              )}
            </>
          )}
          {(isAssignedWorker ? otherCards : displayCards).map((card) => renderCard(card, false))}
        </div>
      )}
    </div>
  )

  function renderCard(card, isAssigned) {
    const cfg = STATUS_CONFIG[card.status] || STATUS_CONFIG.intake
    const effectiveIsAssigned = isAdminOrOffice ? true : isAssigned
    return (
      <div key={card.id} className="job-card" onClick={() => navigate('card', { id: card.id, isAssigned: effectiveIsAssigned })} style={isAssigned ? { border: '2px solid var(--accent)', borderRadius: 'var(--r)', margin: '0 12px 8px' } : {}}>
        <div className="job-card-stripe" style={{ background: cfg.stripe }} />
        <div className="job-card-body">
          <div className="job-card-boat">{card.boat_name || '(no name)'}</div>
          <div className="job-card-owner">{card.customer_name} {'\u00B7'} {card.motor_type || '—'}</div>
          <div className="job-card-meta">
            {!!card.is_fake && (
              <span className="inline-chip" style={{ borderColor: '#c0392b', color: '#c0392b', fontWeight: 700 }}>FAKE</span>
            )}
            <StatusBadge status={card.status} />
            {!!card.wrap_required && (
              <span className="inline-chip" style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>WRAP</span>
            )}
            {!!card.storage_location && (
              <span className="inline-chip" style={{ borderColor: 'var(--text3)', color: 'var(--text3)' }}>{card.storage_location}</span>
            )}
          </div>
        </div>
        <div className="job-card-right">
          <div className="job-card-wo">#{card.work_order_no || card.id}</div>
          <div style={{ fontSize: 18, color: 'var(--text3)' }}>{'\u203A'}</div>
          <div style={{ fontSize: 11, fontFamily: 'Barlow Condensed', fontWeight: 600, color: 'var(--text3)' }}>{card.season_year}</div>
        </div>
      </div>
    )
  }
}