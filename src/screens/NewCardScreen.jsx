import { useState, useEffect, useContext } from 'react'
import { NavCtx } from '../contexts/NavCtx'
import { ToastCtx } from '../contexts/ToastCtx'
import { api } from '../api'
import { STORAGE_TYPES, BUILDING_NAMES, BOATHOUSE_COUNT, BOATHOUSE_SLIPS, STORAGE_ROWS, STORAGE_COLS } from '../constants'
import Icon from '../components/Icon'

export default function NewCardScreen({ params = {} }) {
  const { target = 'card' } = params
  const { navigate, goBack, setDirty } = useContext(NavCtx)
  const showToast = useContext(ToastCtx)
  const [step, setStep] = useState(params.initialStep || 'customer')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState([])
  const [customer, setCustomer] = useState(null)
  const [boat, setBoat] = useState(null)
  const [boats, setBoats] = useState([])
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', city: '' })
  const [newBoat, setNewBoat] = useState({ name: '', motor_type: '', model: '', licence: '', trailer_licence: '', length_ft: '' })
  const [cardForm, setCardForm] = useState({
    work_order_no: '',
    storage_type: '',
    wrap_required: false,
    remarks: '',
    other_work: '',
    date_in: new Date().toISOString().split('T')[0],
    storage_building: '',
    storage_row: '',
    storage_col: '',
    boathouse_no: '',
    slip_no: '',
  })
  const [saving, setSaving] = useState(false)
  const [creatingCustomer, setCreatingCustomer] = useState(params.target === 'customer')
  const [creatingBoat, setCreatingBoat] = useState(false)

  useEffect(() => {
    if (customerSearch.length >= 2) {
      api('GET', `/customers?q=${encodeURIComponent(customerSearch)}`).then(setCustomers).catch(() => {})
    } else {
      api('GET', '/customers').then((data) => setCustomers(data.slice(0, 20))).catch(() => {})
    }
  }, [customerSearch])

  useEffect(() => {
    api('GET', '/next-work-order-number').then(data => {
      setCardForm(f => ({ ...f, work_order_no: data.work_order_no }))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const hasCustomerData = Object.values(newCustomer).some(v => v !== '')
    const hasBoatData = Object.values(newBoat).some(v => v !== '')
    const hasCardData = cardForm.storage_type || cardForm.wrap_required || cardForm.other_work || cardForm.remarks || cardForm.storage_building || cardForm.storage_row || cardForm.storage_col || cardForm.boathouse_no || cardForm.slip_no
    const isDirty = step !== 'customer' || hasCustomerData || hasBoatData || hasCardData
    setDirty(isDirty)
    return () => setDirty(false)
  }, [step, newCustomer, newBoat, cardForm, setDirty])

  const selectCustomer = (c) => {
    if (target === 'customer') { showToast('Customer already exists'); goBack(); return }
    setCustomer(c)
    api('GET', `/customers/${c.id}`).then((data) => setBoats(data.boats || []))
    setStep('boat')
    if (target === 'boat') setCreatingBoat(true)
  }

  const createCustomer = async () => {
    if (!newCustomer.name) { showToast('Name required'); return }
    setSaving(true)
    try {
      const c = await api('POST', '/customers', newCustomer)
      if (target === 'customer') { setDirty(false); showToast('Customer created'); goBack() }
      else { setCustomer({ ...newCustomer, id: c.id }); setBoats([]); setStep('boat'); setCreatingCustomer(false) }
    } catch (e) { showToast(e.message || 'Failed to create customer') }
    setSaving(false)
  }

  const selectBoat = (b) => {
    if (target === 'boat') { showToast('Boat already exists'); goBack(); return }
    setBoat(b)
    setStep('card')
  }

  const createBoat = async () => {
    if (!newBoat.name && !newBoat.model) { showToast('Add boat name or model'); return }
    setSaving(true)
    try {
      const b = await api('POST', '/boats', { ...newBoat, customer_id: customer.id })
      if (target === 'boat') { setDirty(false); showToast('Boat created'); goBack() }
      else { setBoat({ ...newBoat, id: b.id }); setStep('card'); setCreatingBoat(false) }
    } catch (e) { showToast(e.message || 'Failed to create boat') }
    setSaving(false)
  }

  const createCard = async (isFake) => {
    setSaving(true)
    try {
      const card = await api('POST', '/cards', { boat_id: boat.id, ...cardForm, season_year: new Date().getFullYear(), is_fake: isFake ? 1 : 0 })
      setDirty(false)
      showToast(isFake ? 'FAKE card created!' : 'Card created!')
      navigate('card', { id: card.id })
    } catch (e) { showToast(e.message || 'Failed to create card') }
    setSaving(false)
  }

  if (step === 'customer') return (
    <div>
      <div className="section-head" style={{ marginTop: 12 }}>
        {target === 'boat' ? 'Select Customer for New Boat' :
         target === 'customer' ? 'Create New Customer' :
         'Select Customer for New Service Card'}
      </div>
      {target !== 'customer' && (
        <>
          <div className="search-bar" style={{ marginTop: 12 }}>
            <span className="search-icon"><Icon name="search" size={17} /></span>
            <input placeholder="Search customer..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
          </div>
          <div style={{ padding: '8px 12px 4px' }}>
            <button className="btn btn-outline btn-sm" style={{ width: 'auto' }} onClick={() => setCreatingCustomer(!creatingCustomer)}>
              {creatingCustomer ? '\u2715 Cancel' : '+ New Customer'}
            </button>
          </div>
        </>
      )}
      {creatingCustomer && (
        <div className="card" style={{ margin: '8px 12px' }}>
          <div style={{ padding: '14px 16px' }}>
            {[['Name *', 'name', 'text'], ['Phone', 'phone', 'tel'], ['Email', 'email', 'email'], ['City', 'city', 'text']].map(([label, key, type]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{label}</label>
                <input type={type} style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  value={newCustomer[key]} onChange={(e) => setNewCustomer({ ...newCustomer, [key]: e.target.value })} />
              </div>
            ))}
            <button className="btn btn-primary" onClick={createCustomer} disabled={saving}>
              {saving ? 'Creating...' : 'Create Customer'}
            </button>
          </div>
        </div>
      )}
      {target !== 'customer' && (
        <div className="card" style={{ margin: '8px 12px' }}>
          {customers.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 13 }}>No customers found</div>
          ) : customers.map((c, i) => (
            <div key={c.id} onClick={() => selectCustomer(c)}
              style={{ padding: '13px 16px', borderBottom: i < customers.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 1, color: 'var(--text)' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{c.phone}</div>
              </div>
              <span style={{ color: 'var(--text3)', fontSize: 18 }}>{'\u203A'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (step === 'boat') return (
    <div>
      <div style={{ padding: '14px 16px 8px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
        <div style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase' }}>Customer</div>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 20, letterSpacing: 1, color: 'var(--text)' }}>{customer.name}</div>
      </div>
      <div style={{ padding: '8px 12px 4px' }}>
        <button className="btn btn-outline btn-sm" style={{ width: 'auto' }} onClick={() => setCreatingBoat(!creatingBoat)}>
          {creatingBoat ? '\u2715 Cancel' : '+ New Boat'}
        </button>
      </div>
      {creatingBoat && (
        <div className="card" style={{ margin: '8px 12px' }}>
          <div style={{ padding: '14px 16px' }}>
            {[['Boat Name', 'name'], ['Motor Type', 'motor_type'], ['Model', 'model'], ['Length (ft)', 'length_ft']].map(([label, key]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{label}</label>
                <input style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  value={newBoat[key]} onChange={(e) => setNewBoat({ ...newBoat, [key]: e.target.value })} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Licence / Reg</label>
                <input style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  value={newBoat.licence} onChange={(e) => setNewBoat({ ...newBoat, licence: e.target.value })} />
              </div>
              <div>
                <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Trailer Licence</label>
                <input style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  value={newBoat.trailer_licence} onChange={(e) => setNewBoat({ ...newBoat, trailer_licence: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={createBoat} disabled={saving}>
              {saving ? 'Creating...' : 'Create Boat'}
            </button>
          </div>
        </div>
      )}
      <div className="card" style={{ margin: '8px 12px' }}>
        {boats.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 13 }}>No boats — create one above</div>
        ) : boats.map((b, i) => (
          <div key={b.id} onClick={() => selectBoat(b)}
            style={{ padding: '13px 16px', borderBottom: i < boats.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 1, color: 'var(--text)' }}>{b.name || '(no name)'}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{b.motor_type} {'\u00B7'} {b.model} {'\u00B7'} {b.licence}</div>
            </div>
            <span style={{ color: 'var(--text3)', fontSize: 18 }}>{'\u203A'}</span>
          </div>
        ))}
      </div>
    </div>
  )

  if (step === 'card') return (
    <div>
      <div style={{ padding: '14px 16px 8px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 20, letterSpacing: 1, color: 'var(--text)' }}>{boat.name || boat.model || '(boat)'}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{customer.name} {'\u00B7'} {boat.motor_type} {'\u00B7'} {boat.licence}</div>
      </div>
      <div className="field" style={{ paddingTop: 16 }}>
        <label>Work Order #</label>
        <div style={{ fontFamily: 'Barlow', fontSize: 14, color: 'var(--text3)', padding: '9px 12px' }}>{cardForm.work_order_no || '—'}</div>
      </div>
      <div className="field">
        <label>Date In</label>
        <input type="date" value={cardForm.date_in} onChange={(e) => setCardForm({ ...cardForm, date_in: e.target.value })} />
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <label style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Storage Type</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STORAGE_TYPES.map((st) => (
            <button key={st.key} className={`chip ${cardForm.storage_type === st.key ? 'on' : ''}`}
              onClick={() => setCardForm({ ...cardForm, storage_type: cardForm.storage_type === st.key ? '' : st.key, storage_building: '', storage_row: '', storage_col: '', boathouse_no: '', slip_no: '' })}>
              {st.icon} {st.label}
            </button>
          ))}
        </div>
      </div>
      {(cardForm.storage_type === 'marina_boathouse' || cardForm.storage_type === 'customer_boathouse') && (
        <div style={{ padding: '0 16px 12px' }}>
          <label style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Boathouse Location</label>
          <div className="row-2">
            <select style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
              value={cardForm.boathouse_no} onChange={(e) => setCardForm({ ...cardForm, boathouse_no: e.target.value })}>
              <option value="">Boathouse #</option>
              {Array.from({ length: BOATHOUSE_COUNT }, (_, i) => i + 1).map(n => <option key={n} value={n}>Boathouse {n}</option>)}
            </select>
            <select style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
              value={cardForm.slip_no} onChange={(e) => setCardForm({ ...cardForm, slip_no: e.target.value })}>
              <option value="">Slip #</option>
              {Array.from({ length: BOATHOUSE_SLIPS }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      )}
      {cardForm.storage_type === 'storage_building' && (
        <div style={{ padding: '0 16px 12px' }}>
          <label style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Building Location</label>
          <div className="row-2" style={{ marginBottom: 8 }}>
            <select style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
              value={cardForm.storage_building} onChange={(e) => setCardForm({ ...cardForm, storage_building: e.target.value })}>
              <option value="">Building</option>
              {BUILDING_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
              value={cardForm.storage_row} onChange={(e) => setCardForm({ ...cardForm, storage_row: e.target.value })}>
              <option value="">Row</option>
              {STORAGE_ROWS.map(n => <option key={n} value={n}>Row {n}</option>)}
            </select>
          </div>
          <div className="row-2">
            <select style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
              value={cardForm.storage_col} onChange={(e) => setCardForm({ ...cardForm, storage_col: e.target.value })}>
              <option value="">Column</option>
              {STORAGE_COLS.map(l => <option key={l} value={l}>Column {l}</option>)}
            </select>
          </div>
        </div>
      )}
      <div style={{ padding: '0 16px 12px' }}>
        <button className={`chip ${cardForm.wrap_required ? 'on warn' : ''}`}
          onClick={() => setCardForm({ ...cardForm, wrap_required: !cardForm.wrap_required })}>
          {'\u{1F381}'} Shrink Wrap Required
        </button>
      </div>
      <div className="field">
        <label>Other Work / Notes</label>
        <textarea placeholder="Trim not working, additional work requested..." value={cardForm.other_work}
          onChange={(e) => setCardForm({ ...cardForm, other_work: e.target.value })} />
      </div>
      <div className="field">
        <label>Remarks</label>
        <textarea placeholder="Winter storage 2025-2026..." value={cardForm.remarks}
          onChange={(e) => setCardForm({ ...cardForm, remarks: e.target.value })} />
      </div>
      <div style={{ padding: '4px 16px 24px' }}>
        <button className="btn btn-primary" onClick={() => createCard(false)} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Creating...' : '\u2693 Create Service Card'}
        </button>
        <button onClick={() => createCard(true)} disabled={saving} style={{ width: '100%', marginTop: 8, padding: '14px 0', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 'var(--r3)', fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 1.2, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Creating...' : '\u26A0 Create FAKE Service Card'}
        </button>
      </div>
    </div>
  )
}
