import { useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react'
import { NavCtx } from '../contexts/NavCtx'
import { AuthCtx } from '../contexts/AuthCtx'
import { ToastCtx } from '../contexts/ToastCtx'
import { api, getToken } from '../api'
import {
  STATUS_CONFIG, STATUS_ORDER, RECEIVED_ITEMS, CONDITIONS,
  STORAGE_TYPES, STORAGE_CHECKLIST, FALL_CHECKLIST, SPRING_CHECKLIST,
  BUILDING_NAMES, BOATHOUSE_COUNT, BOATHOUSE_SLIPS, STORAGE_ROWS, STORAGE_COLS,
} from '../constants'
import Icon from '../components/Icon'
import StatusBadge from '../components/StatusBadge'
import ConditionRatingRow from '../components/ConditionRatingRow'
import SwipeableTask from '../components/SwipeableTask'
import QrCode from '../components/QrCode'

function InfoTab({ card, reload }) {
  const showToast = useContext(ToastCtx)
  const { navigate } = useContext(NavCtx)
  const { employee } = useContext(AuthCtx)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    work_order_no: card.work_order_no || '',
    storage_type: card.storage_type || '',
    wrap_required: !!card.wrap_required,
    remarks: card.remarks || '',
    other_work: card.other_work || '',
    invoice_number: card.invoice_number || '',
    storage_building: card.storage_building || '',
    storage_row: card.storage_row || '',
    storage_col: card.storage_col || '',
    boathouse_no: card.boathouse_no || '',
    slip_no: card.slip_no || '',
  })

  const save = async () => {
    try {
      await api('PUT', `/cards/${card.id}`, form)
      showToast('Saved')
      setEditing(false)
      reload()
    } catch (e) { showToast('Save failed') }
  }

  return (
    <div>
      <div className="section-head">
        <span>Customer</span>
      </div>
      <div className="card" style={{ margin: '0 12px 10px' }}>
        <div className="card-pad">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 20, letterSpacing: 1, color: 'var(--text)', marginBottom: 4 }}>{card.customer_name}</div>
              {card.address && <div style={{ fontSize: 13, color: 'var(--text2)' }}>{card.address}, {card.city} {card.postal_code}</div>}
              {card.customer_phone && (
                <a href={`tel:${card.customer_phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, color: 'var(--accent)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                  <Icon name="phone" size={16} color="var(--accent)" /> {card.customer_phone}
                </a>
              )}
            </div>
            {card.customer_token && (
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }} onClick={() => window.open(`${window.location.origin}/?wo=${card.customer_token}`, '_blank')}>
                <QrCode value={`${window.location.origin}/?wo=${card.customer_token}`} size={80} />
                <span style={{ fontSize: 10, fontFamily: 'Barlow Condensed', fontWeight: 700, color: 'var(--text3)', letterSpacing: 0.5 }}>WO#</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 }}>
        <span>Boat</span>
        {(employee?.role === 'admin' || employee?.role === 'office') && (
          <button className="btn btn-outline btn-sm" style={{ width: 'auto', padding: '5px 12px' }} onClick={() => navigate('boats', { editBoatId: card.boat_id })}>
            <Icon name="edit" size={14} /> Edit
          </button>
        )}
      </div>

      <div className="card" style={{ margin: '0 12px 10px' }}>
        <div className="card-pad">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
            {[['Motor', card.motor_type], ['Model', card.model], ['Licence', card.licence],
              ['Trailer', card.trailer_licence], ['Length', card.length_ft ? `${card.length_ft} ft` : null], ['Rate', card.rate_type],
            ].map(([l, v]) => v ? (
            <div key={l}>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase' }}>{l}</div>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{v}</div>
            </div>
          ) : null)}
        </div>
      </div>
      </div>

      <div className="section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 }}>
        <span>Service Info</span>
        {(employee?.role === 'admin' || employee?.role === 'office') && (
          <button className="btn btn-outline btn-sm" style={{ width: 'auto', padding: '5px 12px' }} onClick={() => setEditing(!editing)}>
            <Icon name="edit" size={14} /> {editing ? 'Cancel' : 'Edit'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="card" style={{ margin: '0 12px' }}>
          <div style={{ padding: '14px 16px' }}>
            <div className="row-2" style={{ marginBottom: 12 }}>
              <div>
                <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Work Order #</label>
                <input style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  value={form.work_order_no} onChange={(e) => setForm({ ...form, work_order_no: e.target.value })} />
              </div>
              <div>
                <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Invoice #</label>
                <input style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
              </div>
            </div>

            <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Storage Type</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {STORAGE_TYPES.map((st) => (
                <button key={st.key} className={`chip ${form.storage_type === st.key ? 'on' : ''}`}
                  onClick={() => {
                    const newType = form.storage_type === st.key ? '' : st.key
                    const upd = { ...form, storage_type: newType, storage_building: '', storage_row: '', storage_col: '', boathouse_no: '', slip_no: '' }
                    if (newType === 'storage_building') { upd.wrap_required = false }
                    setForm(upd)
                  }}>
                  {st.icon} {st.label}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Location Details</label>
              {(form.storage_type === 'marina_boathouse' || form.storage_type === 'customer_boathouse') && (
                <div>
                  <div className="row-2" style={{ marginBottom: 8 }}>
                    <select style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                      value={form.boathouse_no} onChange={(e) => setForm({ ...form, boathouse_no: e.target.value })}>
                      <option value="">Boathouse #</option>
                      {Array.from({ length: BOATHOUSE_COUNT }, (_, i) => i + 1).map(n => <option key={n} value={n}>Boathouse {n}</option>)}
                    </select>
                    <select style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                      value={form.slip_no} onChange={(e) => setForm({ ...form, slip_no: e.target.value })}>
                      <option value="">Slip #</option>
                      {Array.from({ length: BOATHOUSE_SLIPS }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {form.storage_type === 'storage_building' && (
                <div>
                  <div className="row-2" style={{ marginBottom: 8 }}>
                    <select style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                      value={form.storage_building} onChange={(e) => setForm({ ...form, storage_building: e.target.value })}>
                      <option value="">Building</option>
                      {BUILDING_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <select style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                      value={form.storage_row} onChange={(e) => setForm({ ...form, storage_row: e.target.value })}>
                      <option value="">Row</option>
                      {STORAGE_ROWS.map(n => <option key={n} value={n}>Row {n}</option>)}
                    </select>
                  </div>
                  <div className="row-2">
                    <select style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                      value={form.storage_col} onChange={(e) => setForm({ ...form, storage_col: e.target.value })}>
                      <option value="">Column</option>
                      {STORAGE_COLS.map(l => <option key={l} value={l}>Column {l}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {!['customer_boathouse', 'marina_boathouse', 'storage_building'].includes(form.storage_type) && form.storage_type && (
                <input placeholder="Location notes (optional)" style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  value={''} onChange={() => {}} />
              )}
              {!form.storage_type && <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 600, color: 'var(--text3)', padding: '6px 0' }}>Select a storage type above to configure location</div>}
            </div>

            {form.storage_type !== 'storage_building' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button className={`chip ${form.wrap_required ? 'on warn' : ''}`} onClick={() => setForm({ ...form, wrap_required: !form.wrap_required })}>
                  {'\u{1F381}'} Wrap Required
                </button>
              </div>
            )}

            <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Other Work Requested</label>
            <textarea placeholder="Trim not working? Customer requests..." style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none', resize: 'vertical', minHeight: 60, marginBottom: 12 }}
              value={form.other_work} onChange={(e) => setForm({ ...form, other_work: e.target.value })} />

            <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Remarks</label>
            <textarea placeholder="Winter storage 2025-2026..." style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none', resize: 'vertical', minHeight: 60, marginBottom: 14 }}
              value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />

            <button className="btn btn-accent" onClick={save}>Save Changes</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ margin: '0 12px' }}>
          <div className="card-pad">
            {[['Work Order', card.work_order_no], ['Invoice #', card.invoice_number],
              ['Storage Type', STORAGE_TYPES.find((s) => s.key === card.storage_type)?.label],
              ['Location', card.storage_location],
              ['Shrink Wrap', card.wrap_required ? 'Required' : 'No'],
              ['Pickup/Delivery', card.pickup_delivery ? card.pickup_delivery.charAt(0).toUpperCase() + card.pickup_delivery.slice(1) : '—'],
              ['Date In', card.date_in], ['Season', card.season_year],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '9px 0' }}>
                <span style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text3)', textTransform: 'uppercase' }}>{l}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{v}</span>
              </div>
            ))}
            {card.other_work && (
              <div style={{ paddingTop: 10 }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>Other Work</div>
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{card.other_work}</div>
              </div>
            )}
            {card.remarks && (
              <div style={{ paddingTop: 10 }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>Remarks</div>
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{card.remarks}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="section-head">Items Received at Intake</div>
      <div className="card" style={{ margin: '0 12px 12px' }}>
        <div className="chip-grid" style={{ padding: '4px 16px 16px' }}>
          {RECEIVED_ITEMS.map((ri) => {
            const entry = (card.received_items || []).find((i) => i.item === ri.key) || {}
            return (
              <button key={ri.key} className={`chip ${entry.present ? 'on green' : ''}`}
                onClick={async () => {
                  const items = (card.received_items || []).map(i => i.item === ri.key ? { ...i, present: i.present ? 0 : 1 } : i)
                  if (!items.find(i => i.item === ri.key)) items.push({ item: ri.key, present: 1, notes: '' })
                  try {
                    await api('PUT', `/cards/${card.id}/items`, { items: items.map(i => ({ item: i.item, present: !!i.present, notes: i.notes })) })
                    reload()
                  } catch (e) { showToast('Save failed') }
                }}>
                {entry.present ? '\u2713 ' : ''}{ri.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="section-head">Condition Assessment</div>
      <div className="card" style={{ margin: '0 12px 20px' }}>
        {CONDITIONS.map((c, i) => {
          const cond = card.condition?.find((x) => x.area === c.key) || {}
          const isConditionLocked = card.status !== 'intake' && employee?.role !== 'admin' && employee?.role !== 'office'
          return (
            <div key={c.key} style={{ padding: '10px 16px', borderBottom: i < CONDITIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
              <ConditionRatingRow area={c.key} cardId={card.id} initialRating={cond.rating} initialNotes={cond.notes} reload={reload} disabled={isConditionLocked} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AuthorizedTab({ card, reload, serviceItems: tmplService, cleaningGroups, cleanKeys, authSet }) {
  const showToast = useContext(ToastCtx)
  const { employee } = useContext(AuthCtx)
  const [work, setWork] = useState(card.authorized_work || [])
  const [customTask, setCustomTask] = useState('')
  const [deleteMode, setDeleteMode] = useState(false)
  const isReadOnly = employee?.role === 'mechanic' || employee?.role === 'wrapper' || employee?.role === 'cleaner'

  const toggleAuth = async (key) => {
    if (isReadOnly || deleteMode) return
    const updated = work.map((w) => w.service_type === key ? { ...w, authorized: w.authorized ? 0 : 1 } : w)
    if (!updated.find(w => w.service_type === key)) updated.push({ service_type: key, authorized: 1 })
    setWork(updated)
    try {
      await api('PUT', `/cards/${card.id}/work`, { work: updated.map(w => ({ ...w, authorized: !!w.authorized, completed: !!w.completed, products_used: (() => { try { return typeof w.products_used === 'string' ? JSON.parse(w.products_used) : (w.products_used || []) } catch { return [] } })() })) })
      reload()
    } catch (e) { showToast('Save failed'); reload() }
  }

  const addCustomTask = async (e) => {
    e.preventDefault()
    if (!customTask.trim() || isReadOnly) return
    const taskName = customTask.trim()
    if (work.find((w) => w.service_type === taskName)) return
    const updated = [...work, { service_type: taskName, authorized: 1, completed: 0 }]
    setWork(updated); setCustomTask('')
    try {
      await api('PUT', `/cards/${card.id}/work`, { work: updated.map(w => ({ ...w, authorized: !!w.authorized, completed: !!w.completed, products_used: (() => { try { return typeof w.products_used === 'string' ? JSON.parse(w.products_used) : (w.products_used || []) } catch { return [] } })() })) })
      reload()
    } catch (e) { showToast('Save failed'); reload() }
  }

  const deleteItem = async (key) => {
    const updated = work.filter(w => w.service_type !== key)
    setWork(updated)
    try {
      await api('PUT', `/cards/${card.id}/work`, { work: updated.map(w => ({ ...w, authorized: !!w.authorized, completed: !!w.completed, products_used: (() => { try { return typeof w.products_used === 'string' ? JSON.parse(w.products_used) : (w.products_used || []) } catch { return [] } })() })) })
      reload()
    } catch (e) { showToast('Save failed'); reload() }
  }

  const sectionServiceItems = work.filter(w => !cleanKeys.has(w.service_type))
  const sectionCleaningItems = work.filter(w => cleanKeys.has(w.service_type))
  const customItems = work.filter(w => !authSet.has(w.service_type))

  const renderDeleteIcon = (key) => deleteMode ? (
    <button onClick={(e) => { e.stopPropagation(); deleteItem(key) }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px 0 4px 8px', flexShrink: 0 }}>
      <Icon name="trash" size={16} />
    </button>
  ) : null

  return (
    <div>
      {isReadOnly && (
        <div style={{ padding: '8px 16px', background: 'var(--surface2)', fontSize: 12, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 0.5, color: 'var(--text3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
          {'\u{1F512}'} Read-only — view authorized tasks below
        </div>
      )}
      {!isReadOnly && (
        <div style={{ padding: '12px 16px 4px' }}>
          <form onSubmit={addCustomTask} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input type="text" value={customTask} onChange={(e) => setCustomTask(e.target.value)} placeholder="New custom task..."
              style={{ flex: 1, background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: 15, color: 'var(--text)', outline: 'none' }} />
            <button type="submit" disabled={!customTask.trim()} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '0 16px', fontFamily: 'Barlow Condensed', fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>Add</button>
          </form>
          <button className={`chip ${deleteMode ? 'on danger' : ''}`} onClick={() => setDeleteMode(!deleteMode)} style={{ fontSize: 12 }}>
            <Icon name="trash" size={14} /> {deleteMode ? 'Done Deleting' : 'Delete Items'}
          </button>
        </div>
      )}

      <div style={{ padding: '12px 16px 6px', fontFamily: 'Barlow Condensed', fontSize: 14, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text2)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Service</div>
      <div className="card" style={{ margin: '6px 12px 12px' }}>
        {tmplService.map((t, i) => {
          const entry = sectionServiceItems.find(x => x.service_type === t.item_key) || {}
          return (
            <div key={t.item_key} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: i < tmplService.length - 1 - customItems.filter(w => !cleanKeys.has(w.service_type)).length ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 44, height: 26, borderRadius: 13, flexShrink: 0, marginRight: 12, background: entry.authorized ? 'var(--accent)' : 'var(--surface2)', border: `2px solid ${entry.authorized ? 'var(--accent)' : 'var(--border)'}`, position: 'relative', cursor: isReadOnly || deleteMode ? 'default' : 'pointer', transition: 'all .2s', opacity: isReadOnly ? 0.7 : 1 }} onClick={() => toggleAuth(t.item_key)}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: entry.authorized ? 20 : 2, transition: 'all .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
              </div>
              <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: entry.authorized ? 'var(--text)' : 'var(--text3)' }}>{t.label}</div>
              {renderDeleteIcon(t.item_key)}
            </div>
          )
        })}
        {customItems.filter(w => !cleanKeys.has(w.service_type)).map((w, i) => (
          <div key={w.service_type} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: i < customItems.filter(x => !cleanKeys.has(x.service_type)).length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 44, height: 26, borderRadius: 13, flexShrink: 0, marginRight: 12, background: w.authorized ? 'var(--accent)' : 'var(--surface2)', border: `2px solid ${w.authorized ? 'var(--accent)' : 'var(--border)'}`, position: 'relative', cursor: isReadOnly || deleteMode ? 'default' : 'pointer', opacity: isReadOnly ? 0.7 : 1 }} onClick={() => toggleAuth(w.service_type)}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: w.authorized ? 20 : 2, transition: 'all .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
            </div>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: w.authorized ? 'var(--text)' : 'var(--text3)' }}>{w.service_type}</div>
            {renderDeleteIcon(w.service_type)}
          </div>
        ))}
        {tmplService.length === 0 && customItems.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No service tasks</div>}
      </div>

      <div style={{ padding: '12px 16px 6px', fontFamily: 'Barlow Condensed', fontSize: 14, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text2)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Cleaning</div>
      {cleaningGroups.map((group) => (
        <div key={group.cat} style={{ margin: '0 12px 6px' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text3)', textTransform: 'uppercase', padding: '8px 4px 4px' }}>{group.cat}</div>
          <div className="card">
            {group.items.map((w, i) => {
              const entry = sectionCleaningItems.find(x => x.service_type === w.key) || {}
              return (
                <div key={w.key} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: i < group.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 44, height: 26, borderRadius: 13, flexShrink: 0, marginRight: 12, background: entry.authorized ? 'var(--accent)' : 'var(--surface2)', border: `2px solid ${entry.authorized ? 'var(--accent)' : 'var(--border)'}`, position: 'relative', cursor: isReadOnly || deleteMode ? 'default' : 'pointer', opacity: isReadOnly ? 0.7 : 1 }} onClick={() => toggleAuth(w.key)}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: entry.authorized ? 20 : 2, transition: 'all .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                  </div>
                  <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: entry.authorized ? 'var(--text)' : 'var(--text3)' }}>{w.label}</div>
                  {renderDeleteIcon(w.key)}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function ServiceWorkTab({ card, reload, serviceItems: tmplService, cleaningGroups, cleanKeys, authSet }) {
  const showToast = useContext(ToastCtx)
  const { employee } = useContext(AuthCtx)
  const [work, setWork] = useState(card.authorized_work || [])
  const [productInputs, setProductInputs] = useState({})
  const [editNotes, setEditNotes] = useState({})
  const fileRefs = useRef({})

  const toggle = async (key, field, value) => {
    const now = new Date().toISOString()
    const updated = work.map((w) => {
      if (w.service_type !== key) return w
      if (field === 'completed') {
        const becomingComplete = !w.completed
        return {
          ...w,
          completed: becomingComplete ? 1 : 0,
          completed_by: becomingComplete ? employee.id : null,
          completed_at: becomingComplete ? now : null,
          products_used: becomingComplete ? (productInputs[key] ? JSON.stringify(productInputs[key]) : '[]') : w.products_used,
        }
      }
      return { ...w, [field]: w[field] ? 0 : 1 }
    })
    setWork(updated)
    if (field === 'notes') return // don't save on every keystroke
    try {
      await api('PUT', `/cards/${card.id}/work`, {
        work: updated.map(w => ({
          ...w,
          authorized: !!w.authorized,
          completed: !!w.completed,
          completed_by: w.completed_by || null,
          completed_at: w.completed_at || null,
          notes: w.notes || null,
          products_used: (() => { try { return typeof w.products_used === 'string' ? JSON.parse(w.products_used) : (w.products_used || []) } catch { return [] } })(),
        }))
      })
      setProductInputs({})
      reload()
    } catch (e) { showToast('Save failed'); reload() }
  }

  const saveNotes = async (key) => {
    try {
      await api('PUT', `/cards/${card.id}/work`, {
        work: work.map(w => ({
          ...w,
          authorized: !!w.authorized,
          completed: !!w.completed,
          completed_by: w.completed_by || null,
          completed_at: w.completed_at || null,
          notes: w.notes || null,
          products_used: (() => { try { return typeof w.products_used === 'string' ? JSON.parse(w.products_used) : (w.products_used || []) } catch { return [] } })(),
        }))
      })
      reload()
    } catch (e) { showToast('Save failed') }
  }

  const addProduct = (key) => {
    const input = productInputs[key] || []
    setProductInputs({ ...productInputs, [key]: [...input, { description: '', quantity: 1 }] })
  }

  const updateProduct = (key, idx, field, value) => {
    const input = [...(productInputs[key] || [])]
    input[idx] = { ...input[idx], [field]: value }
    setProductInputs({ ...productInputs, [key]: input })
  }

  const removeProduct = (key, idx) => {
    const input = [...(productInputs[key] || [])]
    input.splice(idx, 1)
    setProductInputs({ ...productInputs, [key]: input })
  }

  const uploadPhoto = async (key, file) => {
    if (!file) return
    try {
      const fd = new FormData()
      fd.append('photo', file)
      fd.append('photo_type', `service_work`)
      fd.append('caption', `Service: ${key}`)
      const res = await fetch(`/api/cards/${card.id}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      })
      if (!res.ok) throw new Error()
      showToast('Photo uploaded')
      reload()
    } catch (e) { showToast('Upload failed') }
  }

  const addCompletedToInvoice = async () => {
    const completedItems = work.filter(w => w.completed)
    if (completedItems.length === 0) { showToast('No completed items to add'); return }
    const invoiceRes = await api('GET', `/cards/${card.id}/invoice`).catch(() => ({ items: [] }))
    const existingItems = invoiceRes.items || []
    const newItems = []
    completedItems.forEach(w => {
      const tmpl = tmplService.find(t => t.item_key === w.service_type)
      const price = tmpl?.unit_price || 0
      newItems.push({ description: `Service: ${w.service_type}`, quantity: 1, unit_price: price })
      try {
        const products = typeof w.products_used === 'string' ? JSON.parse(w.products_used) : (w.products_used || [])
        if (Array.isArray(products)) {
          products.forEach(p => {
            if (p.description) newItems.push({ description: p.description, quantity: p.quantity || 1, unit_price: 0 })
          })
        }
      } catch (e) {}
    })
    if (newItems.length === 0) { showToast('No items to add'); return }
    const allItems = [...existingItems, ...newItems]
    try {
      await api('PUT', `/cards/${card.id}/invoice`, { items: allItems.map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })) })
      showToast(`${newItems.length} item(s) added to invoice`)
      reload()
    } catch (e) { showToast('Failed to add to invoice') }
  }

  const authServiceItems = work.filter(w => w.authorized && !cleanKeys.has(w.service_type))
  const customItems = work.filter(w => w.authorized && !authSet.has(w.service_type))

  if (authServiceItems.length === 0 && customItems.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14 }}>No authorized service tasks. Go to the Authorized tab first.</div>
  }

  return (
    <div>
      <div style={{ padding: '8px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text3)', textTransform: 'uppercase' }}>
          Tap to complete authorized service tasks
        </span>
        {(employee?.role === 'admin' || employee?.role === 'office') && (
          <button className="btn btn-sm btn-outline" style={{ width: 'auto', padding: '3px 10px', fontSize: 11 }} onClick={addCompletedToInvoice}>
            + Add Completed to Invoice
          </button>
        )}
      </div>
      <div className="card" style={{ margin: '0 12px' }}>
        {[...tmplService.filter(t => authServiceItems.find(a => a.service_type === t.item_key)), ...customItems.map(w => ({ item_key: w.service_type, label: w.service_type }))].map((w, i, arr) => {
          const entry = work.find(x => x.service_type === w.item_key) || {}
          const products = (() => { try { const p = entry.products_used; if (Array.isArray(p)) return p; const parsed = typeof p === 'string' ? JSON.parse(p) : []; return Array.isArray(parsed) ? parsed : [] } catch { return [] } })()
          const allPhotos = (card.photos || []).filter(p => p.photo_type === 'service_work' && p.caption?.includes(w.item_key))
          return (
            <div key={w.item_key}>
              <SwipeableTask key={w.item_key} label={w.label} authorized={true} completed={!!entry.completed}
                completedBy={entry.completed_by ? entry.completed_by : null}
                completedAt={entry.completed_at ? entry.completed_at : null}
                employeeName={entry.completed_by ? (card.work_logs || []).find(l => l.employee_id === entry.completed_by)?.employee_name || '' : ''}
                isLast={false}
                onComplete={() => {
                  if (!productInputs[w.item_key] || productInputs[w.item_key].length === 0) addProduct(w.item_key)
                  else toggle(w.item_key, 'completed')
                }}
                onUncomplete={() => toggle(w.item_key, 'completed')} />
              {!entry.completed && (productInputs[w.item_key] || []).length > 0 && (
                <div style={{ padding: '8px 16px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  {productInputs[w.item_key].map((p, pi) => (
                    <div key={pi} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                      <input placeholder="Product name" style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                        value={p.description} onChange={(e) => updateProduct(w.item_key, pi, 'description', e.target.value)} />
                      <input type="number" placeholder="Qty" style={{ width: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                        value={p.quantity} onChange={(e) => updateProduct(w.item_key, pi, 'quantity', Number(e.target.value))} />
                      <button onClick={() => removeProduct(w.item_key, pi)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}>&times;</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-outline" style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={() => addProduct(w.item_key)}>+ Add Product</button>
                    <button className="btn btn-sm btn-accent" style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={() => toggle(w.item_key, 'completed')}>Complete</button>
                  </div>
                </div>
              )}
              {entry.completed && products.length > 0 && (
                <div style={{ padding: '4px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {products.map((p, pi) => p.description ? (
                    <span key={pi} className="part-tag">{p.description} &times; {p.quantity}</span>
                  ) : null)}
                </div>
              )}
              <div style={{ padding: '8px 16px 12px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--surface2)' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ flex: 1, fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text3)', textTransform: 'uppercase' }}>Notes</div>
                  <button className="btn btn-sm btn-outline" style={{ width: 'auto', fontSize: 11, padding: '2px 8px' }}
                    onClick={() => fileRefs.current[w.item_key]?.click()}>
                    <Icon name="camera" size={12} /> Photo
                  </button>
                  <input ref={(el) => fileRefs.current[w.item_key] = el} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={(e) => e.target.files[0] && uploadPhoto(w.item_key, e.target.files[0])} />
                </div>
                {allPhotos.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                    {allPhotos.map(p => (
                      <img key={p.id} src={`/photos/${p.filename}`} style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} alt="" />
                    ))}
                  </div>
                )}
                <textarea placeholder="Add notes about this task..."
                  style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: 'var(--text)', outline: 'none', resize: 'vertical', minHeight: 50 }}
                  value={entry.notes || ''} onChange={(e) => {
                    const key = w.item_key
                    const updated = work.map(item => item.service_type === key ? { ...item, notes: e.target.value } : item)
                    setWork(updated)
                  }} onBlur={() => saveNotes(w.item_key)} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CleaningWorkTab({ card, reload, cleaningGroups, cleanKeys, templates }) {
  const showToast = useContext(ToastCtx)
  const { employee } = useContext(AuthCtx)
  const [work, setWork] = useState(card.authorized_work || [])
  const [productInputs, setProductInputs] = useState({})
  const [unwrapDone, setUnwrapDone] = useState(!!card.unwrap_done)

  const toggleUnwrap = async () => {
    const next = !unwrapDone
    setUnwrapDone(next)
    try {
      await api('PUT', `/cards/${card.id}`, { unwrap_done: next })
      reload()
    } catch (e) { showToast('Save failed') }
  }

  const addCompletedToInvoice = async () => {
    const completedItems = work.filter(w => w.completed)
    if (completedItems.length === 0) { showToast('No completed items to add'); return }
    const invoiceRes = await api('GET', `/cards/${card.id}/invoice`).catch(() => ({ items: [] }))
    const existingItems = invoiceRes.items || []
    const newItems = []
    completedItems.forEach(w => {
      const tmpl = (templates || []).find(t => t.item_key === w.service_type)
      const price = tmpl?.unit_price || 0
      newItems.push({ description: `Cleaning: ${w.service_type}`, quantity: 1, unit_price: price })
      try {
        const products = typeof w.products_used === 'string' ? JSON.parse(w.products_used) : (w.products_used || [])
        if (Array.isArray(products)) {
          products.forEach(p => {
            if (p.description) newItems.push({ description: p.description, quantity: p.quantity || 1, unit_price: 0 })
          })
        }
      } catch (e) {}
    })
    if (newItems.length === 0) { showToast('No items to add'); return }
    const allItems = [...existingItems, ...newItems]
    try {
      await api('PUT', `/cards/${card.id}/invoice`, { items: allItems.map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })) })
      showToast(`${newItems.length} item(s) added to invoice`)
      reload()
    } catch (e) { showToast('Failed to add to invoice') }
  }

  const toggle = async (key, field) => {
    const now = new Date().toISOString()
    const updated = work.map((w) => {
      if (w.service_type !== key) return w
      if (field === 'completed') {
        const becomingComplete = !w.completed
        return {
          ...w,
          completed: becomingComplete ? 1 : 0,
          completed_by: becomingComplete ? employee.id : null,
          completed_at: becomingComplete ? now : null,
          products_used: becomingComplete ? (productInputs[key] ? JSON.stringify(productInputs[key]) : '[]') : w.products_used,
        }
      }
      return { ...w, [field]: w[field] ? 0 : 1 }
    })
    setWork(updated)
    try {
      await api('PUT', `/cards/${card.id}/work`, {
        work: updated.map(w => ({
          ...w,
          authorized: !!w.authorized,
          completed: !!w.completed,
          completed_by: w.completed_by || null,
          completed_at: w.completed_at || null,
          products_used: (() => { try { return typeof w.products_used === 'string' ? JSON.parse(w.products_used) : (w.products_used || []) } catch { return [] } })(),
        }))
      })
      setProductInputs({})
      reload()
    } catch (e) { showToast('Save failed'); reload() }
  }

  const addProduct = (key) => {
    const input = productInputs[key] || []
    setProductInputs({ ...productInputs, [key]: [...input, { description: '', quantity: 1 }] })
  }

  const updateProduct = (key, idx, field, value) => {
    const input = [...(productInputs[key] || [])]
    input[idx] = { ...input[idx], [field]: value }
    setProductInputs({ ...productInputs, [key]: input })
  }

  const removeProduct = (key, idx) => {
    const input = [...(productInputs[key] || [])]
    input.splice(idx, 1)
    setProductInputs({ ...productInputs, [key]: input })
  }

  const allAuthCleaning = work.filter(w => w.authorized && cleanKeys.has(w.service_type))

  if (allAuthCleaning.length === 0 && !card.wrap_required) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14 }}>No authorized cleaning tasks. Go to the Authorized tab first.</div>
  }

  return (
    <div>
      <div style={{ padding: '8px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text3)', textTransform: 'uppercase' }}>
          Tap to complete authorized cleaning tasks
        </span>
        {(employee?.role === 'admin' || employee?.role === 'office') && (
          <button className="btn btn-sm btn-outline" style={{ width: 'auto', padding: '3px 10px', fontSize: 11 }} onClick={addCompletedToInvoice}>
            + Add Completed to Invoice
          </button>
        )}
      </div>
      {!!card.wrap_required && (
        <div style={{ margin: '0 12px 12px' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 14, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text2)', textTransform: 'uppercase', padding: '14px 4px 6px', borderBottom: '1px solid var(--border)' }}>Unwrap</div>
          <div className="card" style={{ marginTop: 6 }}>
            <SwipeableTask label="Unwrap boat" authorized={true} completed={unwrapDone}
              isLast={allAuthCleaning.length === 0}
              onComplete={toggleUnwrap}
              onUncomplete={toggleUnwrap} />
          </div>
        </div>
      )}
      {cleaningGroups.map((group) => {
        const groupItems = group.items.filter(w => allAuthCleaning.find(a => a.service_type === w.key))
        if (groupItems.length === 0) return null
        return (
          <div key={group.cat} style={{ margin: '0 12px 12px' }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 14, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text2)', textTransform: 'uppercase', padding: '14px 4px 6px', borderBottom: '1px solid var(--border)' }}>{group.cat}</div>
            <div className="card" style={{ marginTop: 6 }}>
              {groupItems.map((w, i) => {
                const entry = work.find(x => x.service_type === w.key) || {}
                const products = (() => { try { const p = entry.products_used; if (Array.isArray(p)) return p; const parsed = typeof p === 'string' ? JSON.parse(p) : []; return Array.isArray(parsed) ? parsed : [] } catch { return [] } })()
                return (
                  <div key={w.key}>
                    <SwipeableTask key={w.key} label={w.label} authorized={true} completed={!!entry.completed}
                      completedBy={entry.completed_by ? entry.completed_by : null}
                      completedAt={entry.completed_at ? entry.completed_at : null}
                      employeeName={entry.completed_by ? (card.work_logs || []).find(l => l.employee_id === entry.completed_by)?.employee_name || '' : ''}
                      isLast={i === groupItems.length - 1 && Object.keys(productInputs).length === 0}
                      onComplete={() => {
                        if (!productInputs[w.key] || productInputs[w.key].length === 0) addProduct(w.key)
                        else toggle(w.key, 'completed')
                      }}
                      onUncomplete={() => toggle(w.key, 'completed')} />
                    {!entry.completed && (productInputs[w.key] || []).length > 0 && (
                      <div style={{ padding: '8px 16px 12px', borderBottom: i < groupItems.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--surface2)' }}>
                        {productInputs[w.key].map((p, pi) => (
                          <div key={pi} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                            <input placeholder="Product name" style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                              value={p.description} onChange={(e) => updateProduct(w.key, pi, 'description', e.target.value)} />
                            <input type="number" placeholder="Qty" style={{ width: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                              value={p.quantity} onChange={(e) => updateProduct(w.key, pi, 'quantity', Number(e.target.value))} />
                            <button onClick={() => removeProduct(w.key, pi)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}>&times;</button>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm btn-outline" style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={() => addProduct(w.key)}>+ Add Product</button>
                          <button className="btn btn-sm btn-accent" style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={() => toggle(w.key, 'completed')}>Complete</button>
                        </div>
                      </div>
                    )}
                    {entry.completed && products.length > 0 && (
                      <div style={{ padding: '4px 16px 8px', borderBottom: i < groupItems.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {products.map((p, pi) => p.description ? (
                          <span key={pi} className="part-tag">{p.description} &times; {p.quantity}</span>
                        ) : null)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StorageTab({ card, reload }) {
  const showToast = useContext(ToastCtx)
  const { employee } = useContext(AuthCtx)
  const checklist = (card.checklists || []).find(c => c.checklist_type === 'storage')
  const items = useMemo(() => {
    try { return JSON.parse(checklist?.items_json || '{}') }
    catch { return {} }
  }, [checklist])
  const allItems = STORAGE_CHECKLIST.flatMap(cat => cat.items)

  const toggle = async (key) => {
    const updated = { ...items, [key]: items[key] ? false : true }
    try {
      await api('POST', `/cards/${card.id}/checklists`, { checklist_type: 'storage', items_json: JSON.stringify(updated) })
      reload()
    } catch (e) { showToast('Save failed') }
  }

  const isEditor = employee?.role === 'admin' || employee?.role === 'office'

  if (allItems.length === 0) return null

  return (
    <div>
      <div style={{ padding: '8px 16px 8px', fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text3)', textTransform: 'uppercase' }}>
        Tap to complete storage tasks
      </div>
      <div className="card" style={{ margin: '0 12px' }}>
        {STORAGE_CHECKLIST.map((group) => {
          const groupItems = group.items
          return (
            <div key={group.cat}>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: 14, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text2)', textTransform: 'uppercase', padding: '14px 16px 6px', borderBottom: '1px solid var(--border)' }}>{group.cat}</div>
              {groupItems.map((w, i) => {
                const done = !!items[w.key]
                return (
                  <SwipeableTask key={w.key} label={w.label} authorized={true} completed={done}
                    isLast={i === groupItems.length - 1}
                    onComplete={() => toggle(w.key)}
                    onUncomplete={() => toggle(w.key)} />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LogsTab({ card, reload }) {
  const { navigate } = useContext(NavCtx)
  const showToast = useContext(ToastCtx)
  const { employee } = useContext(AuthCtx)

  const deleteLog = async (id) => {
    if (!confirm('Delete this log entry?')) return
    try {
      await api('DELETE', `/logs/${id}`)
      showToast('Deleted')
      reload()
    } catch (e) { showToast('Failed') }
  }

  return (
    <div>
      <div style={{ padding: '10px 12px 4px' }}>
        <button className="btn btn-accent btn-sm" onClick={() => navigate('new-log', { cardId: card.id, cardName: card.boat_name })}>
          <Icon name="plus" size={15} color="#fff" /> Add Work Entry
        </button>
      </div>
      {!card.work_logs || card.work_logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{'\u{1F4CB}'}</div>
          <div className="empty-title">No Log Entries</div>
          <div className="empty-msg">Tap above to add the first entry</div>
        </div>
      ) : (
        <div className="card" style={{ margin: '10px 12px' }}>
          {card.work_logs.map((log, i) => (
            <div key={log.id} className="log-entry" style={{ borderBottom: i < card.work_logs.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="log-header">
                <div className="log-avatar">{log.employee_initials || '??'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: 0.3 }}>{log.employee_name}</div>
                  <div className="log-date">{log.log_date}</div>
                </div>
                {(employee.role === 'admin' || employee.id === log.employee_id) && (
                  <button onClick={() => deleteLog(log.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 6 }}>
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </div>
              {log.description && <div className="log-desc">{log.description}</div>}
              {log.transcription && log.transcription !== log.description && (
                <div style={{ marginTop: 6, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 'var(--r3)', fontStyle: 'italic', fontSize: 13, color: 'var(--text2)' }}>
                  {'\u{1F399}\uFE0F'} {log.transcription}
                </div>
              )}
              {log.parts && log.parts.length > 0 && (
                <div className="log-parts">
                  {log.parts.map((p) => (
                    <span key={p.id} className="part-tag">
                      {p.part_number ? `${p.part_number} \u00B7 ` : ''}{p.description} \u00D7 {p.quantity}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ChecklistTab({ card, reload, checklistType }) {
  const showToast = useContext(ToastCtx)
  const { employee } = useContext(AuthCtx)
  const [activeList, setActiveList] = useState(checklistType || 'fall')
  const CHECKLISTS = { fall: FALL_CHECKLIST, spring: SPRING_CHECKLIST }

  const [localChecklists, setLocalChecklists] = useState(card.checklists || [])
  const existing = localChecklists.find((c) => c.checklist_type === activeList)
  const items = useMemo(() => {
    try { return JSON.parse(existing?.items_json || '{}') }
    catch { return {} }
  }, [existing])
  const [itemNotes, setItemNotes] = useState({})
  const [catPhotos, setCatPhotos] = useState({})
  const fileRefs = useRef({})

  useEffect(() => {
    const notes = {}
    Object.keys(items).forEach(k => {
      if (typeof items[k] === 'object' && items[k] !== null) {
        notes[k] = items[k].notes || ''
      }
    })
    setItemNotes(notes)
  }, [items])

  const setRating = async (key, rating) => {
    const current = items[key] || {}
    const updated = {
      ...items,
      [key]: typeof current === 'object' ? { ...current, rating } : { rating }
    }
    saveChecklist(updated)
  }

  const setNote = async (key, note) => {
    setItemNotes({ ...itemNotes, [key]: note })
    const current = items[key] || {}
    const updated = {
      ...items,
      [key]: typeof current === 'object' ? { ...current, notes: note } : { rating: '', notes: note }
    }
    saveChecklist(updated)
  }

  const saveChecklist = async (updated) => {
    setLocalChecklists((prev) => {
      const idx = prev.findIndex((c) => c.checklist_type === activeList)
      const newEntry = { checklist_type: activeList, items_json: JSON.stringify(updated) }
      if (idx >= 0) { const n = [...prev]; n[idx] = newEntry; return n }
      return [...prev, newEntry]
    })
    try {
      await api('POST', `/cards/${card.id}/checklists`, { checklist_type: activeList, items_json: JSON.stringify(updated) })
      reload()
    } catch (e) { showToast('Save failed'); reload() }
  }

  const uploadCatPhoto = async (cat, file) => {
    if (!file) return
    try {
      const fd = new FormData()
      fd.append('photo', file)
      fd.append('photo_type', `checklist_${cat}`)
      fd.append('caption', `${activeList} checklist — ${cat}`)
      const res = await fetch(`/api/cards/${card.id}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      })
      if (!res.ok) throw new Error()
      showToast('Photo uploaded')
      reload()
    } catch (e) { showToast('Upload failed') }
  }

  const allItems = CHECKLISTS[activeList].flatMap((cat) => cat.items)
  const doneCount = allItems.filter((i => {
    const v = items[i.key]
    return v && (v === true || (typeof v === 'object' && v.rating))
  })).length

  const catPhotosList = (card.photos || []).filter(p => p.photo_type?.startsWith('checklist_'))

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, padding: '10px 12px 4px', alignItems: 'center' }}>
        {['fall', 'spring'].map((t) => (
          <button key={t} className={`chip ${activeList === t ? 'on' : ''}`} style={{ textTransform: 'capitalize' }} onClick={() => setActiveList(t)}>
            {t === 'fall' ? '\u{1F342}' : '\u{1F331}'} {t.toUpperCase()}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: doneCount === allItems.length ? 'var(--success)' : 'var(--text2)', alignSelf: 'center' }}>
          {doneCount}/{allItems.length}
        </div>
      </div>
      <div className="card" style={{ margin: '8px 12px' }}>
        {CHECKLISTS[activeList].map((cat) => {
          const catPhotoKey = `checklist_${cat.cat.toLowerCase().replace(/\s+/g, '_')}`
          const photosForCat = catPhotosList.filter(p => p.photo_type === catPhotoKey)
          return (
            <div key={cat.cat}>
              <div className="check-cat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{cat.cat}</span>
                <button className="btn btn-sm btn-outline" style={{ width: 'auto', fontSize: 11, padding: '3px 10px' }}
                  onClick={() => fileRefs.current[cat.cat]?.click()}>
                  <Icon name="camera" size={13} /> Photo
                </button>
                <input ref={(el) => fileRefs.current[cat.cat] = el} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={(e) => e.target.files[0] && uploadCatPhoto(catPhotoKey, e.target.files[0])} />
              </div>
              {photosForCat.length > 0 && (
                <div style={{ display: 'flex', gap: 6, padding: '4px 16px 8px', flexWrap: 'wrap' }}>
                  {photosForCat.map(p => (
                    <img key={p.id} src={`/photos/${p.filename}`} style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} alt="" />
                  ))}
                </div>
              )}
              {cat.items.map((item) => {
                const val = items[item.key]
                const rating = val && typeof val === 'object' ? val.rating : (val === true ? 'good' : '')
                const note = itemNotes[item.key] || (val && typeof val === 'object' ? val.notes : '') || ''
                return (
                  <div key={item.key} style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{item.label}</div>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                      {['good', 'fair', 'bad'].map((r) => {
                        const colors = { good: '#2da84f', fair: '#e8b42e', bad: '#d64045' }
                        return (
                          <button key={r} onClick={() => setRating(item.key, rating === r ? '' : r)}
                            style={{
                              padding: '5px 14px', borderRadius: 6, border: `1px solid ${rating === r ? colors[r] : 'var(--border)'}`,
                              background: rating === r ? colors[r] : 'transparent',
                              color: rating === r ? '#fff' : 'var(--text2)',
                              fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 12,
                              textTransform: 'uppercase', cursor: 'pointer', letterSpacing: 0.5,
                              transition: 'all .15s',
                            }}>
                            {r}
                          </button>
                        )
                      })}
                    </div>
                    <input placeholder="Notes (optional)" style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                      value={note} onChange={(e) => setNote(item.key, e.target.value)} />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PhotosTab({ card, reload }) {
  const showToast = useContext(ToastCtx)
  const { employee } = useContext(AuthCtx)
  const [uploading, setUploading] = useState(false)
  const [photoType, setPhotoType] = useState('before')
  const fileRef = useRef(null)
  const [fullscreen, setFullscreen] = useState(null)

  const upload = async (file) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      fd.append('photo_type', photoType)
      const res = await fetch(`/api/cards/${card.id}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      })
      if (!res.ok) throw new Error()
      showToast('Photo uploaded')
      reload()
    } catch (e) { showToast('Upload failed') }
    setUploading(false)
  }

  const deletePhoto = async (id) => {
    if (!confirm('Delete photo?')) return
    try {
      await api('DELETE', `/photos/${id}`)
      showToast('Deleted')
      reload()
    } catch (e) { showToast('Failed') }
  }

  const PHOTO_TYPES = ['intake', 'damage', 'replacement', 'cleaning_complete', 'general']

  return (
    <div>
      <div style={{ padding: '10px 12px 6px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {PHOTO_TYPES.map((t) => (
            <button key={t} className={`chip ${photoType === t ? 'on' : ''}`} style={{ textTransform: 'capitalize' }} onClick={() => setPhotoType(t)}>{t}</button>
          ))}
        </div>
        <button className={`btn ${uploading ? 'btn-outline' : 'btn-accent'}`} onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Icon name="camera" size={16} color={uploading ? 'var(--text2)' : '#fff'} />
          {uploading ? 'Uploading...' : `Add ${photoType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Photo`}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={(e) => e.target.files[0] && upload(e.target.files[0])} />
      </div>
      {!card.photos || card.photos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{'\u{1F4F7}'}</div>
          <div className="empty-title">No Photos Yet</div>
          <div className="empty-msg">Capture intake, damage, or completion photos</div>
        </div>
      ) : (
        <div className="photo-grid">
          {card.photos.map((p) => (
            <div key={p.id} className="photo-thumb" onClick={() => setFullscreen(p)}>
              <img src={`/photos/${p.filename}`} alt={p.caption || p.photo_type} />
              <div className="photo-type-badge">{p.photo_type}</div>
            </div>
          ))}
        </div>
      )}
      {fullscreen && (
        <div className="modal-overlay" onClick={() => setFullscreen(null)} style={{ alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#000', borderRadius: 12, overflow: 'hidden', maxWidth: '100%', maxHeight: '80dvh', position: 'relative' }}>
            <img src={`/photos/${fullscreen.filename}`} style={{ width: '100%', display: 'block' }} alt="" />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,.8)' }}>
              <span style={{ color: '#fff', fontFamily: 'Barlow Condensed', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{fullscreen.photo_type}</span>
              <button onClick={() => { deletePhoto(fullscreen.id); setFullscreen(null) }}
                style={{ background: 'rgba(214,64,69,.8)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 10px', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InvoiceTab({ card, reload }) {
  const showToast = useContext(ToastCtx)
  const { employee } = useContext(AuthCtx)
  const [items, setItems] = useState([])
  const [invoiceStatus, setInvoiceStatus] = useState(card.invoice_status || 'draft')
  const [invoiceNumber, setInvoiceNumber] = useState(card.invoice_number || '')
  const [taxRate, setTaxRate] = useState(card.tax_rate || 13)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('GET', `/cards/${card.id}/invoice`).then(data => {
      setItems(data.items || [])
      setInvoiceStatus(data.invoice_status || 'draft')
      setInvoiceNumber(data.invoice_number || '')
      setTaxRate(data.tax_rate || 13)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [card.id])

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, total: 0 }])
  }

  const updateItem = (idx, field, value) => {
    const updated = items.map((item, i) => {
      if (i !== idx) return item
      const newItem = { ...item, [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        newItem.total = (field === 'quantity' ? value : item.quantity) * (field === 'unit_price' ? value : item.unit_price)
      }
      return newItem
    })
    setItems(updated)
  }

  const removeItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const saveInvoice = async () => {
    try {
      await api('PUT', `/cards/${card.id}/invoice`, {
        invoice_number: invoiceNumber || null,
        invoice_status: invoiceStatus,
        tax_rate: taxRate,
        items: items.map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })),
      })
      showToast('Invoice saved')
      reload()
    } catch (e) { showToast('Save failed') }
  }

  const openPrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) { showToast('Please allow pop-ups'); return }
    const subtotal = items.reduce((s, i) => s + (i.total || 0), 0)
    const tax = subtotal * (taxRate / 100)
    const total = subtotal + tax
    printWindow.document.write(`
      <html><head><title>Invoice ${invoiceNumber || card.work_order_no || card.id}</title>
      <style>
        body { font-family: 'Courier New', monospace; padding: 40px; max-width: 800px; margin: 0 auto; color: #222; }
        h1 { font-size: 28px; margin: 0 0 4px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #222; }
        .info { margin-bottom: 20px; }
        .info div { margin-bottom: 3px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { text-align: left; padding: 8px 6px; border-bottom: 2px solid #222; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
        td { padding: 8px 6px; border-bottom: 1px solid #ccc; font-size: 14px; }
        .amt { text-align: right; }
        .totals { margin-left: auto; width: 300px; }
        .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
        .grand { font-weight: bold; font-size: 18px; border-top: 2px solid #222; padding-top: 8px; margin-top: 4px; }
        .footer { margin-top: 40px; font-size: 12px; color: #888; text-align: center; border-top: 1px solid #ccc; padding-top: 20px; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="header">
        <div><h1>INVOICE</h1><div style="font-size:14px;color:#666;">Campbell's Landing Marina</div></div>
        <div style="text-align:right;font-size:14px;">
          <div><strong>Invoice #:</strong> ${invoiceNumber || card.work_order_no || '—'}</div>
          <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-CA')} ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
        </div>
      </div>
      <div class="info">
        <div><strong>Bill To:</strong></div>
        <div>${card.customer_name || ''}</div>
        ${card.address ? `<div>${card.address}${card.city ? ', ' + card.city : ''}${card.postal_code ? ' ' + card.postal_code : ''}</div>` : ''}
        ${card.customer_phone ? `<div>${card.customer_phone}</div>` : ''}
      </div>
      <div class="info" style="margin-top:10px;padding-top:10px;border-top:1px solid #ccc;">
        <div><strong>Boat:</strong> ${card.boat_name || ''} — ${card.motor_type || ''} ${card.model || ''}</div>
        <div><strong>Work Order:</strong> ${card.work_order_no || ''}</div>
      </div>
      <table>
        <thead><tr><th style="width:60%">Description</th><th class="amt">Qty</th><th class="amt">Unit Price</th><th class="amt">Total</th></tr></thead>
        <tbody>
          ${items.map(i => `<tr><td>${i.description || ''}</td><td class="amt">${i.quantity || 0}</td><td class="amt">$${(i.unit_price || 0).toFixed(2)}</td><td class="amt">$${(i.total || 0).toFixed(2)}</td></tr>`).join('')}
          ${items.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#999;">No line items</td></tr>' : ''}
        </tbody>
      </table>
      <div class="totals">
        <div><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
        <div><span>HST (${taxRate.toFixed(1)}%)</span><span>$${tax.toFixed(2)}</span></div>
        <div class="grand"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>
      </div>
      <div class="footer">Campbell's Landing Marina — Thank you for your business!</div>
      <script>window.print()</script>
      </body></html>
    `)
    printWindow.document.close()
  }

  const isEditable = invoiceStatus === 'draft' && (employee?.role === 'admin' || employee?.role === 'office')
  const subtotal = items.reduce((s, i) => s + (i.total || 0), 0)
  const tax = subtotal * (taxRate / 100)
  const grandTotal = subtotal + tax

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Loading invoice...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className={`chip ${invoiceStatus === 'paid' ? 'on green' : invoiceStatus === 'issued' ? 'on' : ''}`}
            style={{ textTransform: 'uppercase' }}>{invoiceStatus.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-outline btn-sm" style={{ width: 'auto' }} onClick={openPrint}>
            <Icon name="print" size={14} /> Print
          </button>
        </div>
      </div>

      <div className="card" style={{ margin: '0 12px' }}>
        <div style={{ padding: '14px 16px' }}>
          <div className="row-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Invoice #</label>
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} disabled={!isEditable} />
            </div>
            <div className="field">
              <label>HST Rate (%)</label>
              <input type="number" step="0.1" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} disabled={!isEditable} />
            </div>
          </div>

          {isEditable && invoiceStatus === 'draft' && (
            <div style={{ marginBottom: 12, display: 'flex', gap: 6 }}>
              <button className="btn btn-accent btn-sm" style={{ width: 'auto' }} onClick={() => { setInvoiceStatus('issued'); saveInvoice() }}>
                Mark Issued
              </button>
              <button className="btn btn-outline btn-sm" style={{ width: 'auto' }} onClick={() => { setInvoiceStatus('paid'); saveInvoice() }}>
                Mark Paid
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', paddingRight: 16 }}>
        <span>Line Items</span>
        {isEditable && (
          <button className="btn btn-sm btn-outline" style={{ width: 'auto' }} onClick={addItem}>+ Add Item</button>
        )}
      </div>

      <div className="card" style={{ margin: '0 12px' }}>
        {items.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 13 }}>No invoice items — add items above</div>
        ) : items.map((item, i) => (
          <div key={i} style={{ padding: '10px 16px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <input style={{ flex: 1, background: isEditable ? 'var(--surface2)' : 'transparent', border: isEditable ? '1.5px solid var(--border)' : 'none', borderRadius: 6, padding: '8px 10px', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                placeholder="Description" value={item.description || ''}
                onChange={(e) => updateItem(i, 'description', e.target.value)} disabled={!isEditable} />
              {isEditable && (
                <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}>&times;</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: 0.5 }}>Qty:</span>
                <input type="number" style={{ width: 50, background: isEditable ? 'var(--surface2)' : 'transparent', border: isEditable ? '1.5px solid var(--border)' : 'none', borderRadius: 6, padding: '6px 8px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                  value={item.quantity || 1} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} disabled={!isEditable} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: 0.5 }}>Price:</span>
                <input type="number" step="0.01" style={{ width: 80, background: isEditable ? 'var(--surface2)' : 'transparent', border: isEditable ? '1.5px solid var(--border)' : 'none', borderRadius: 6, padding: '6px 8px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                  value={item.unit_price || 0} onChange={(e) => updateItem(i, 'unit_price', Number(e.target.value))} disabled={!isEditable} />
              </div>
              <div style={{ marginLeft: 'auto', fontFamily: 'Barlow Condensed', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                ${(item.total || 0).toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div className="card" style={{ margin: '10px 12px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 14, color: 'var(--text2)' }}>
            <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 14, color: 'var(--text2)' }}>
            <span>HST ({taxRate.toFixed(1)}%)</span><span>${tax.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontSize: 20, fontWeight: 700, color: 'var(--text)', borderTop: '2px solid var(--border)', marginTop: 4 }}>
            <span>TOTAL</span><span>${grandTotal.toFixed(2)}</span>
          </div>
        </div>
      )}

      {isEditable && (
        <div style={{ padding: '0 12px 20px' }}>
          <button className="btn btn-primary" onClick={saveInvoice}>Save Invoice</button>
        </div>
      )}
    </div>
  )
}

export default function CardDetailScreen({ params = {} }) {
  const { navigate, goBack } = useContext(NavCtx)
  const { employee } = useContext(AuthCtx)
  const showToast = useContext(ToastCtx)
  const [card, setCard] = useState(null)
  const [tab, setTab] = useState('info')
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState([])

  const reload = useCallback(() => {
    api('GET', `/cards/${params.id}`).then(setCard).catch(() => {})
  }, [params.id])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    api('GET', '/authorized-items/active').then(setTemplates).catch(() => {})
  }, [])

  const serviceItems = templates.filter(t => t.category === 'service')
  const cleaningTemplates = templates.filter(t => t.category === 'cleaning')
  const cleaningGroups = cleaningTemplates.reduce((acc, t) => {
    const cat = t.cleaning_cat || 'Other'
    let group = acc.find(g => g.cat === cat)
    if (!group) { group = { cat, items: [] }; acc.push(group) }
    group.items.push({ key: t.item_key, label: t.label })
    return acc
  }, [])
  const cleanKeys = new Set(cleaningTemplates.map(t => t.item_key))
  const authSet = new Set(templates.map(t => t.item_key))

  const advanceStatus = async () => {
    const idx = STATUS_ORDER.indexOf(card.status)
    if (idx < STATUS_ORDER.length - 1) {
      const next = STATUS_ORDER[idx + 1]
      setSaving(true)
      try {
        await api('PUT', `/cards/${card.id}`, { status: next })
        showToast(`Status \u2192 ${STATUS_CONFIG[next].label}`)
        reload()
      } catch (e) { showToast('Failed to update') }
      setSaving(false)
    }
  }

  const retreatStatus = async () => {
    const idx = STATUS_ORDER.indexOf(card.status)
    if (idx > 0) {
      const prev = STATUS_ORDER[idx - 1]
      setSaving(true)
      try {
        await api('PUT', `/cards/${card.id}`, { status: prev })
        showToast(`Status \u2190 ${STATUS_CONFIG[prev].label}`)
        reload()
      } catch (e) { showToast('Failed to update') }
      setSaving(false)
    }
  }

  if (!card) return <div style={{ padding: 20 }}><div className="shimmer" style={{ height: 200, borderRadius: 'var(--r)' }} /></div>

  const cfg = STATUS_CONFIG[card.status]
  const statusIdx = STATUS_ORDER.indexOf(card.status)
  const nextStatus = STATUS_ORDER[statusIdx + 1]
  const prevStatus = STATUS_ORDER[statusIdx - 1]

  const getTabBadge = (key) => {
    if (!card) return null
    if (key === 'authorized') {
      const total = (card.authorized_work || []).filter(w => w.authorized).length
      return total > 0 ? total : null
    }
    if (key === 'service_work') {
      const completed = (card.authorized_work || []).filter(w => w.completed && !cleanKeys.has(w.service_type))
      const total = (card.authorized_work || []).filter(w => w.authorized && !cleanKeys.has(w.service_type))
      return total.length > 0 ? `${completed.length}/${total.length}` : null
    }
    if (key === 'cleaning_work') {
      const completed = (card.authorized_work || []).filter(w => w.completed && cleanKeys.has(w.service_type))
      const total = (card.authorized_work || []).filter(w => w.authorized && cleanKeys.has(w.service_type))
      return total.length > 0 ? `${completed.length}/${total.length}` : null
    }
    if (key === 'logs') return (card.work_logs || []).length > 0 ? card.work_logs.length : null
    if (key === 'fall_checklist') {
      const existing = (card.checklists || []).find(c => c.checklist_type === 'fall')
      let checked = 0, total = FALL_CHECKLIST.reduce((acc, cat) => acc + cat.items.length, 0)
      if (existing) {
        try { const items = JSON.parse(existing.items_json || '{}'); checked = Object.keys(items).filter(k => items[k]).length } catch (e) {}
      }
      return checked > 0 ? `${checked}/${total}` : null
    }
    if (key === 'spring_checklist') {
      const existing = (card.checklists || []).find(c => c.checklist_type === 'spring')
      let checked = 0, total = SPRING_CHECKLIST.reduce((acc, cat) => acc + cat.items.length, 0)
      if (existing) {
        try { const items = JSON.parse(existing.items_json || '{}'); checked = Object.keys(items).filter(k => items[k]).length } catch (e) {}
      }
      return checked > 0 ? `${checked}/${total}` : null
    }
    if (key === 'storage') {
      const existing = (card.checklists || []).find(c => c.checklist_type === 'storage')
      let checked = 0, total = STORAGE_CHECKLIST.reduce((acc, cat) => acc + cat.items.length, 0)
      if (existing) {
        try { const items = JSON.parse(existing.items_json || '{}'); checked = Object.keys(items).filter(k => items[k]).length } catch (e) {}
      }
      return checked > 0 ? `${checked}/${total}` : null
    }
    if (key === 'photos') return (card.photos || []).length > 0 ? card.photos.length : null
    return null
  }

  const isFallStage = ['fall_checklist', 'storage', 'service', 'cleaning', 'spring_checklist'].includes(card.status)
  const isSpringStage = ['spring_checklist', 'ready'].includes(card.status)
  const isServiceStage = card.status === 'service'
  const isCleaningStage = card.status === 'cleaning'
  const isStorageStage = card.status === 'storage'

  const tabs = [
    { key: 'info', label: 'Info' },
    { key: 'authorized', label: 'Authorized' },
    ...(isFallStage || isSpringStage ? [{ key: 'fall_checklist', label: 'Fall Checklist' }] : []),
    ...(isServiceStage ? [{ key: 'service_work', label: 'Service Work' }] : []),
    ...(isCleaningStage ? [{ key: 'cleaning_work', label: 'Cleaning Work' }] : []),
    ...(isSpringStage ? [{ key: 'spring_checklist', label: 'Spring Checklist' }] : []),
    ...(isStorageStage ? [{ key: 'storage', label: 'Storage' }] : []),
    { key: 'invoice', label: 'Invoice' },
    { key: 'logs', label: 'Log' },
    { key: 'photos', label: 'Photos' },
  ]

  const statusClick = async (s) => {
    if (s === card.status) return
    setSaving(true)
    try {
      await api('PUT', `/cards/${card.id}`, { status: s })
      showToast(`Status \u2192 ${STATUS_CONFIG[s].label}`)
      reload()
    } catch (e) { showToast('Failed to update') }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ background: 'var(--primary)', padding: '12px 16px 14px' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 26, letterSpacing: 1.5, color: '#fff', lineHeight: 1 }}>
          {card.boat_name || '(no name)'}
        </div>
        <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, margin: '3px 0 10px', fontFamily: 'Barlow Condensed', fontWeight: 600, letterSpacing: 0.3 }}>
          {card.customer_name} {'\u00B7'} {card.motor_type || '—'} {'\u00B7'} {card.licence || '—'}{card.trailer_licence ? ` / T:${card.trailer_licence}` : ''}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingBottom: 2 }}>
          {STATUS_ORDER.slice(0, -1).map((s, i) => {
            const scfg = STATUS_CONFIG[s]
            const past = STATUS_ORDER.indexOf(card.status) > i
            const current = card.status === s
            return (
              <div key={s} onClick={() => statusClick(s)}
                style={{
                  flexShrink: 0, padding: '4px 10px', borderRadius: 20,
                  fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 700,
                  letterSpacing: 0.8, textTransform: 'uppercase', cursor: 'pointer',
                  background: current ? '#fff' : past ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)',
                  color: current ? cfg.color : past ? '#fff' : 'rgba(255,255,255,.5)',
                  border: current ? 'none' : '1px solid rgba(255,255,255,.2)',
                }}>
                {past && '\u2713 '}{scfg.label}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '10px 12px' }}>
        {prevStatus && (
          <button className="btn btn-outline" onClick={retreatStatus} disabled={saving} style={{ flex: 1, minWidth: 0, opacity: saving ? 0.7 : 1 }}>
            {'\u2190'} {STATUS_CONFIG[prevStatus].label}
          </button>
        )}
        {nextStatus && (
          <button className="btn btn-accent" onClick={advanceStatus} disabled={saving} style={{ flex: 1, minWidth: 0, opacity: saving ? 0.7 : 1 }}>
            {STATUS_CONFIG[nextStatus].label} {'\u2192'}
          </button>
        )}
        <button className="btn btn-outline" style={{ width: 'auto', flexShrink: 0 }} onClick={() => {
          const w = window.open('', '_blank')
          if (!w) { showToast('Please allow pop-ups'); return }
          w.document.write(`
            <html><head><title>${card.boat_name || 'Service Card'} #${card.work_order_no || card.id}</title>
            <style>
              body { font-family: 'Courier New', monospace; padding: 40px; max-width: 800px; margin: 0 auto; color: #222; }
              h1 { font-size: 24px; margin: 0 0 4px; }
              h2 { font-size: 16px; margin: 20px 0 8px; border-bottom: 1px solid #999; padding-bottom: 4px; }
              .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
              .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 15px; font-size: 14px; }
              .info-grid .lbl { font-weight: bold; color: #555; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 13px; }
              td, th { padding: 4px 6px; border-bottom: 1px solid #ddd; text-align: left; }
              .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
              .footer { margin-top: 30px; font-size: 11px; color: #999; text-align: center; }
              @media print { body { padding: 20px; } }
            </style></head><body>
            <div class="header"><div><h1>Service Card</h1><div>Campbell's Landing Marina</div></div>
            <div style="text-align:right"><div><strong>WO#:</strong> ${card.work_order_no || '—'}</div><div><strong>Season:</strong> ${card.season_year || ''}</div></div></div>
            <div class="info-grid"><span class="lbl">Boat:</span><span>${card.boat_name || ''} — ${card.motor_type || ''} ${card.model || ''}</span>
            <span class="lbl">Customer:</span><span>${card.customer_name || ''}</span>
            <span class="lbl">Licence:</span><span>${card.licence || '—'} ${card.trailer_licence ? '/ T:' + card.trailer_licence : ''}</span>
            <span class="lbl">Storage:</span><span>${card.storage_location || '—'} (${STORAGE_TYPES.find(s => s.key === card.storage_type)?.label || card.storage_type || '—'})</span>
            <span class="lbl">Status:</span><span>${STATUS_CONFIG[card.status]?.label || card.status}</span>
            <span class="lbl">Printed:</span><span>${new Date().toLocaleDateString('en-CA')} ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span></div>
            <h2>Authorized Work</h2>
            <table><thead><tr><th>Task</th><th>Auth.</th><th>Done</th></tr></thead><tbody>
            ${(card.authorized_work || []).map(w => '<tr><td>' + w.service_type + '</td><td>' + (w.authorized ? '\u2713' : '—') + '</td><td>' + (w.completed ? '\u2713' : '—') + '</td></tr>').join('')}
            ${(!card.authorized_work || card.authorized_work.length === 0) ? '<tr><td colspan="3">No work authorized</td></tr>' : ''}
            </tbody></table>
            <h2>Condition Assessment</h2>
            <table><thead><tr><th>Area</th><th>Rating</th></tr></thead><tbody>
            ${(card.condition || []).map(c => '<tr><td>' + c.area + '</td><td>' + (c.rating || '—') + '</td></tr>').join('')}
            </tbody></table>
            ${card.other_work ? '<h2>Other Work</h2><p>' + card.other_work + '</p>' : ''}
            ${card.remarks ? '<h2>Remarks</h2><p>' + card.remarks + '</p>' : ''}
            <div class="footer">&nbsp;</div>
            <script>window.print()</script></body></html>`)
          w.document.close()
        }} title="Print Service Card">
          <Icon name="print" size={14} /> Print
        </button>
      </div>

      <div className="tabs" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
        {tabs.map((t) => {
          const badge = getTabBadge(t.key)
          return (
            <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
              {badge !== null && (
                <span style={{ marginLeft: 6, background: tab === t.key ? 'var(--accent)' : 'var(--surface2)', color: tab === t.key ? '#fff' : 'var(--text2)', padding: '2px 6px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'info' && <InfoTab card={card} reload={reload} />}
      {tab === 'authorized' && <AuthorizedTab card={card} reload={reload} serviceItems={serviceItems} cleaningGroups={cleaningGroups} cleanKeys={cleanKeys} authSet={authSet} />}
      {tab === 'fall_checklist' && <ChecklistTab card={card} reload={reload} checklistType="fall" />}
      {tab === 'service_work' && <ServiceWorkTab card={card} reload={reload} serviceItems={serviceItems} cleaningGroups={cleaningGroups} cleanKeys={cleanKeys} authSet={authSet} />}
      {tab === 'cleaning_work' && <CleaningWorkTab card={card} reload={reload} cleaningGroups={cleaningGroups} cleanKeys={cleanKeys} templates={templates} />}
      {tab === 'spring_checklist' && <ChecklistTab card={card} reload={reload} checklistType="spring" />}
      {tab === 'storage' && <StorageTab card={card} reload={reload} />}
      {tab === 'invoice' && <InvoiceTab card={card} reload={reload} />}
      {tab === 'logs' && <LogsTab card={card} reload={reload} />}
      {tab === 'photos' && <PhotosTab card={card} reload={reload} />}
    </div>
  )
}
