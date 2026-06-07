import { useState, useEffect, useContext } from 'react'
import { NavCtx } from '../contexts/NavCtx'
import { AuthCtx } from '../contexts/AuthCtx'
import { STATUS_CONFIG } from '../constants'
import { api } from '../api'
import Icon from '../components/Icon'

export default function CustomerDetailScreen({ params = {} }) {
  const { navigate } = useContext(NavCtx)
  const { employee } = useContext(AuthCtx)
  const [customer, setCustomer] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBoat, setSelectedBoat] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api('GET', `/customers/${params.customerId}`),
      api('GET', `/cards?q=${encodeURIComponent(params.customerName)}`),
    ]).then(([cust, cardsData]) => {
      setCustomer(cust)
      setCards(cardsData.filter(c => c.customer_name === params.customerName))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [params.customerId, params.customerName])

  const filteredCards = selectedBoat ? cards.filter(c => c.boat_name === selectedBoat) : cards

  if (loading) return <div style={{ padding: 20 }}><div className="shimmer" style={{ height: 200, borderRadius: 'var(--r)' }} /></div>
  if (!customer) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Customer not found</div>

  return (
    <div>
      <div style={{ background: 'var(--primary)', padding: '12px 16px' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 24, letterSpacing: 1.5, color: '#fff' }}>{customer.name}</div>
        <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, marginTop: 4 }}>
          {customer.phone} {customer.email ? `\u00B7 ${customer.email}` : ''}
        </div>
      </div>

      <div className="section-head">Boats</div>
      {(!customer.boats || customer.boats.length === 0) ? (
        <div style={{ margin: '0 12px', padding: 16, textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 600 }}>No boats for this customer</div>
      ) : (
        <div className="card" style={{ margin: '0 12px 12px' }}>
          {customer.boats.map((b, i) => (
            <div key={b.id} onClick={() => setSelectedBoat(selectedBoat === b.name ? null : b.name)}
              style={{ padding: '13px 16px', borderBottom: i < customer.boats.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', cursor: 'pointer', background: selectedBoat === b.name ? 'var(--surface2)' : 'transparent' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 1, color: 'var(--text)' }}>{b.name || '(no name)'}</div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>{b.model || ''} {b.licence ? `\u00B7 ${b.licence}` : ''} {b.trailer_licence ? `\u00B7 T:${b.trailer_licence}` : ''}</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', flexShrink: 0 }}>{b.motor_type || ''}</div>
            </div>
          ))}
          {selectedBoat && (
            <div style={{ padding: '8px 16px', background: 'var(--bg)', fontSize: 12, fontFamily: 'Barlow Condensed', fontWeight: 700, color: 'var(--text3)', letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' }}>
              Showing cards for {selectedBoat} — tap again to show all
            </div>
          )}
        </div>
      )}

      <div className="section-head">Service Cards {selectedBoat ? `— ${selectedBoat}` : ''}</div>
      {filteredCards.length === 0 ? (
        <div style={{ margin: '0 12px 12px', padding: 16, textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 600 }}>No service cards yet</div>
      ) : (
        <div className="card" style={{ margin: '0 12px 12px' }}>
          {filteredCards.map((c, i) => {
            const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.intake
            return (
              <div key={c.id} onClick={() => navigate('card', { id: c.id })} style={{ padding: '12px 16px', borderBottom: i < filteredCards.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ width: 4, height: 32, borderRadius: 2, background: cfg.color, flexShrink: 0, marginRight: 12 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Bebas Neue', fontSize: 16, letterSpacing: 1, color: 'var(--text)' }}>{c.boat_name} {'\u00B7'} {c.season_year}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{c.work_order_no} {'\u00B7'} {cfg.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(employee?.role === 'admin' || employee?.role === 'office') && (
        <div style={{ padding: '0 12px 24px' }}>
          <button className="btn btn-accent" onClick={() => navigate('new-card', { customerId: customer.id })} style={{ width: '100%' }}>
            <Icon name="plus" size={16} color="#fff" /> New Service Card
          </button>
        </div>
      )}
    </div>
  )
}
