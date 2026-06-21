import { useState, useEffect } from 'react'
import { STATUS_CONFIG, STORAGE_TYPES, AUTHORIZED_WORK, CLEANING_ITEMS } from '../constants'

const STATUS_ORDER_FULL = ['intake', 'fall_checklist', 'storage', 'spring_checklist', 'service', 'cleaning', 'ready', 'invoiced', 'archived']

function Timeline({ statusHistory }) {
  const sorted = [...(statusHistory || [])].sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at))
  if (sorted.length === 0) return null
  return (
    <div style={{ margin: '10px 12px' }}>
      <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>Timeline</div>
      <div className="card" style={{ padding: '12px 16px' }}>
        {sorted.reverse().map((h, i) => {
          const cfg = STATUS_CONFIG[h.to_status]
          return (
            <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < sorted.length - 1 ? 8 : 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg?.color || '#888', marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{cfg?.label || h.to_status}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {new Date(h.changed_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {h.employee_name ? ` · ${h.employee_name}` : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InvoiceSection({ invoice, serviceLabelMap }) {
  if (!invoice || invoice.length === 0) return null
  const subtotal = invoice.reduce((s, i) => s + Number(i.total || 0), 0)
  const formatDesc = (desc) => desc.replace(/^(Service|Cleaning):\s*(.+)$/, (_, prefix, key) => `${prefix}: ${serviceLabelMap[key] || key}`)
  return (
    <div style={{ margin: '10px 12px' }}>
      <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>Invoice Items</div>
      <div className="card" style={{ padding: '12px 16px' }}>
        {invoice.map((i, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: idx < invoice.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
            <span>{formatDesc(i.description)} {i.quantity > 1 ? `× ${i.quantity}` : ''}</span>
            <span style={{ fontWeight: 600 }}>${Number(i.total || 0).toFixed(2)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '2px solid var(--text)', fontWeight: 700, fontSize: 15 }}>
          <span>Total</span><span>${subtotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

export default function CustomerViewScreen({ card: initialCard }) {
  const [card, setCard] = useState(initialCard || null)
  const [loading, setLoading] = useState(!initialCard)
  const [error, setError] = useState('')

  useEffect(() => {
    if (card) return
    const params = new URLSearchParams(window.location.search)
    const token = params.get('wo')
    if (!token) { setError('No service card link provided'); setLoading(false); return }
    fetch(`/api/public/card/${encodeURIComponent(token)}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(data => { setCard(data); setLoading(false) })
      .catch(() => { setError('Could not load service card details'); setLoading(false) })
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontSize: 16, fontWeight: 700 }}>Loading...</div>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--bg)', padding: 20 }}>
      <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{'\u26F5'}</div>
        <div style={{ fontFamily: 'Barlow Condensed', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Service Card Not Found</div>
        <div style={{ fontSize: 14 }}>Please check the link or contact Campbell's Landing Marina.</div>
      </div>
    </div>
  )

  if (!card) return null

  const cfg = STATUS_CONFIG[card.status] || STATUS_CONFIG.intake
  const statusIdx = STATUS_ORDER_FULL.indexOf(card.status)

  const serviceLabelMap = {}
  AUTHORIZED_WORK.forEach(w => { serviceLabelMap[w.key] = w.label })
  CLEANING_ITEMS.forEach(cat => cat.items.forEach(item => { serviceLabelMap[item.key] = item.label }))

  return (
    <div className="standalone-view" style={{ background: 'var(--bg)', paddingBottom: 30, fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ background: 'var(--primary)', padding: '30px 20px 20px' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 32, letterSpacing: 1.5, color: '#fff' }}>{card.boat_name}</div>
        <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 15, marginTop: 4 }}>{card.customer_name}</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 12px', borderRadius: 20, background: cfg.color, color: '#fff', fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>{cfg.label}</span>
        </div>
      </div>

      <div style={{ margin: '10px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            ['Work Order', card.work_order_no],
            ['Season', card.season_year],
            ['Storage', STORAGE_TYPES.find(s => s.key === card.storage_type)?.label || card.storage_type],
            ['Location', card.storage_location],
            ['Date In', card.date_in],
          ].filter(([, v]) => v).map(([l, v]) => (
            <div key={l} style={{ padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--r)' }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase' }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {card.motor_type && (
        <div style={{ margin: '10px 12px' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[['Motor', card.motor_type], ['Model', card.model], ['Licence', card.licence], ['Length', card.length_ft ? `${card.length_ft} ft` : null]].filter(([, v]) => v).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase' }}>{l}:</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {card.other_work && (
        <div style={{ margin: '10px 12px' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>Work Requested</div>
          <div className="card" style={{ padding: '12px 16px', fontSize: 14, lineHeight: 1.5, color: 'var(--text)' }}>{card.other_work}</div>
        </div>
      )}

      {card.remarks && (
        <div style={{ margin: '10px 12px' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>Remarks</div>
          <div className="card" style={{ padding: '12px 16px', fontSize: 14, lineHeight: 1.5, color: 'var(--text)' }}>{card.remarks}</div>
        </div>
      )}

      {(card.authorized_work || []).filter(w => w.authorized).length > 0 && (
        <div style={{ margin: '10px 12px' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>Authorized Work</div>
          <div className="card">
            {card.authorized_work.filter(w => w.authorized).map((w, i, arr) => (
              <div key={w.service_type} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: w.completed ? 'var(--success)' : 'var(--surface2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 }}>
                  {w.completed ? <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{'\u2713'}</span> : null}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: w.completed ? 'var(--text3)' : 'var(--text)' }}>{serviceLabelMap[w.service_type] || w.service_type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <InvoiceSection invoice={card.invoice} serviceLabelMap={serviceLabelMap} />
      <Timeline statusHistory={card.status_history} />

      <div style={{ textAlign: 'center', marginTop: 20, padding: '0 12px' }}>
        <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, fontWeight: 700, color: 'var(--text3)', letterSpacing: 0.5 }}>
          Campbell's Landing Marina
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
          Questions? Contact us for details
        </div>
      </div>
    </div>
  )
}
