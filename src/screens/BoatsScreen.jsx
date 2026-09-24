import { useState, useEffect, useContext, useRef } from 'react'
import { NavCtx } from '../contexts/NavCtx'
import { AuthCtx } from '../contexts/AuthCtx'
import { ToastCtx } from '../contexts/ToastCtx'
import { api } from '../api'
import { SERIAL_TYPES } from '../constants'
import Icon from '../components/Icon'

export default function BoatsScreen({ params }) {
  const { navigate, setDirty } = useContext(NavCtx)
  const { employee } = useContext(AuthCtx)
  const showToast = useContext(ToastCtx)
  const [boats, setBoats] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingBoat, setEditingBoat] = useState(null)
  const [assigningBoat, setAssigningBoat] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [employees, setEmployees] = useState([])
  const handledAutoOpen = useRef(false)
  const originalBoatRef = useRef(null)

  const canManage = employee?.role === 'admin' || employee?.role === 'office'

  const fetchBoats = () => {
    setLoading(true)
    const qs = search ? `?q=${encodeURIComponent(search)}` : ''
    api('GET', `/boats${qs}`)
      .then((data) => { setBoats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchBoats() }, [search])

  useEffect(() => {
    if (!canManage) return
    api('GET', '/assignments').then(setAssignments).catch(() => {})
    api('GET', '/employees')
      .then((list) => setEmployees(list.filter(e => e.active && (e.role === 'mechanic' || e.role === 'cleaner'))))
      .catch(() => {})
  }, [canManage])

  const assignmentsByBoat = assignments.reduce((m, a) => {
    (m[a.boat_id] = m[a.boat_id] || []).push(a)
    return m
  }, {})

  const openEdit = async (boat) => {
    originalBoatRef.current = { ...boat, serials: boat.serials || [] }
    setEditingBoat({ ...boat, serials: boat.serials || [] })
    try {
      const detail = await api('GET', `/boats/${boat.id}`)
      originalBoatRef.current = { ...detail, serials: detail.serials || [] }
      setEditingBoat({ ...detail, serials: detail.serials || [] })
    } catch (e) {}
  }

  useEffect(() => {
    if (params?.editBoatId && boats.length > 0 && !handledAutoOpen.current) {
      const boat = boats.find(b => b.id === params.editBoatId)
      if (boat) {
        handledAutoOpen.current = true
        openEdit(boat)
      }
    }
  }, [params?.editBoatId, boats])

  useEffect(() => {
    if (!editingBoat || !originalBoatRef.current) { setDirty(false); return }
    const orig = originalBoatRef.current
    const fields = ['name', 'model', 'motor_type', 'rate_type', 'length_ft', 'licence', 'trailer_licence']
    const norm = (arr) => JSON.stringify((arr || []).map(s => [s.type || '', s.serial_number || '', s.notes || '']))
    const changed = fields.some(f => (editingBoat[f] || '') !== (orig[f] || ''))
      || norm(editingBoat.serials) !== norm(orig.serials)
    setDirty(changed)
    return () => setDirty(false)
  }, [editingBoat, setDirty])

  const navigateToBoatCard = async (boat) => {
    try {
      const cards = await api('GET', `/cards?q=${encodeURIComponent(boat.name)}`)
      const active = cards.find(c => c.boat_id === boat.id && !['invoiced', 'archived'].includes(c.status))
      if (active) navigate('card', { id: active.id })
      else navigate('customer-detail', { id: boat.customer_id })
    } catch (e) { navigate('customer-detail', { id: boat.customer_id }) }
  }

  const saveBoat = async () => {
    if (!editingBoat.name && !editingBoat.model) return showToast('Name or model required')
    const serials = (editingBoat.serials || [])
      .filter(s => s.serial_number && String(s.serial_number).trim())
      .map(s => ({ type: s.type || 'other', serial_number: String(s.serial_number).trim(), notes: s.notes || null }))
    try {
      await api('PUT', `/boats/${editingBoat.id}`, { ...editingBoat, serials })
      setDirty(false)
      showToast('Boat updated')
      setEditingBoat(null)
      setBoats(boats.map(b => b.id === editingBoat.id ? { ...b, ...editingBoat, serials } : b))
    } catch (e) { showToast('Failed to update boat') }
  }

  const addSerial = () => setEditingBoat({ ...editingBoat, serials: [...(editingBoat.serials || []), { type: 'engine', serial_number: '', notes: '' }] })
  const updateSerial = (idx, field, value) => setEditingBoat({
    ...editingBoat,
    serials: (editingBoat.serials || []).map((s, i) => i === idx ? { ...s, [field]: value } : s),
  })
  const removeSerial = (idx) => setEditingBoat({ ...editingBoat, serials: (editingBoat.serials || []).filter((_, i) => i !== idx) })

  const toggleAssignment = async (boatId, empId) => {
    const existing = (assignmentsByBoat[boatId] || []).find(a => a.employee_id === empId)
    try {
      if (existing) {
        await api('DELETE', `/assignments/${existing.id}`)
        setAssignments(assignments.filter(a => a.id !== existing.id))
      } else {
        const r = await api('POST', '/assignments', { boat_id: boatId, employee_id: empId })
        const emp = employees.find(e => e.id === empId)
        setAssignments([...assignments, { id: r.id, boat_id: boatId, employee_id: empId, employee_name: emp?.name || '', employee_initials: emp?.initials || '' }])
      }
    } catch (e) { showToast('Failed to update assignment') }
  }

  if (editingBoat) {
    return (
      <div style={{ padding: '0 12px 24px' }}>
        <div className="section-head" style={{ marginTop: 12 }}>Edit Boat</div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Boat Name</label>
            <input value={editingBoat.name || ''} onChange={(e) => setEditingBoat({...editingBoat, name: e.target.value})} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Model</label>
            <input value={editingBoat.model || ''} onChange={(e) => setEditingBoat({...editingBoat, model: e.target.value})} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Motor</label>
            <input value={editingBoat.motor_type || ''} onChange={(e) => setEditingBoat({...editingBoat, motor_type: e.target.value})} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Rate Type</label>
            <select value={editingBoat.rate_type || 'SW'} onChange={(e) => setEditingBoat({...editingBoat, rate_type: e.target.value})}>
              <option value="SW">SW</option><option value="DW">DW</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Length (ft)</label>
            <input type="number" value={editingBoat.length_ft || ''} onChange={(e) => setEditingBoat({...editingBoat, length_ft: e.target.value})} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label>Licence / Reg</label><input value={editingBoat.licence || ''} onChange={(e) => setEditingBoat({...editingBoat, licence: e.target.value})} /></div>
              <div><label>Trailer Licence</label><input value={editingBoat.trailer_licence || ''} onChange={(e) => setEditingBoat({...editingBoat, trailer_licence: e.target.value})} /></div>
            </div>
          </div>
        </div>

        <div className="section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 }}>
          <span>Serial Numbers</span>
          <button className="btn btn-outline btn-sm" style={{ width: 'auto', padding: '5px 12px' }} onClick={addSerial}>
            <Icon name="plus" size={14} /> Add
          </button>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          {(editingBoat.serials || []).length === 0 ? (
            <div style={{ color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 13, textAlign: 'center', padding: '6px 0' }}>
              No serial numbers — add engine, hull, outdrive, etc.
            </div>
          ) : (editingBoat.serials || []).map((s, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select style={{ width: 100, flexShrink: 0, background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 8px', fontFamily: 'Barlow', fontSize: 13, color: 'var(--text)', outline: 'none', textTransform: 'capitalize' }}
                  value={s.type || 'engine'} onChange={(e) => updateSerial(i, 'type', e.target.value)}>
                  {SERIAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input placeholder="Serial #" style={{ flex: 1, minWidth: 0, background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 10px', fontFamily: 'Barlow', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                  value={s.serial_number || ''} onChange={(e) => updateSerial(i, 'serial_number', e.target.value)} />
                <button onClick={() => removeSerial(i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>&times;</button>
              </div>
              <input placeholder="Notes (optional — e.g. Port engine)" style={{ width: '100%', marginTop: 6, background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '7px 10px', fontFamily: 'Barlow', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                value={s.notes || ''} onChange={(e) => updateSerial(i, 'notes', e.target.value)} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setDirty(false); setEditingBoat(null) }}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveBoat}>Save</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', padding: '12px 12px 0' }}>
        <div className="search-bar" style={{ margin: 0, flex: 1 }}>
          <span className="search-icon"><Icon name="search" size={17} /></span>
          <input type="search" placeholder="Search boats..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {(employee?.role === 'admin' || employee?.role === 'office') && (
          <button className="btn btn-accent" style={{ width: 'auto' }}
            onClick={() => navigate('new-card', { target: 'boat', initialStep: 'customer' })}>
            <Icon name="plus" size={18} color="#fff" /> New
          </button>
        )}
      </div>

      <div className="card" style={{ margin: '12px' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div>
        ) : boats.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 600 }}>No boats found</div>
        ) : (
          boats.map((b, i) => (
            <div
              key={b.id}
              style={{ padding: '0 16px', borderBottom: i < boats.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center' }}
            >
              <div onClick={() => navigateToBoatCard(b)} style={{ flex: 1, padding: '13px 0', cursor: 'pointer', minWidth: 0 }}>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 1, color: 'var(--text)' }}>{b.name || '(no name)'}</div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>{b.customer_name} · {b.model} · {b.licence}{b.trailer_licence ? ` · T:${b.trailer_licence}` : ''}</div>
                {(b.serials?.length > 0 || (assignmentsByBoat[b.id] || []).length > 0) && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                    {b.serials?.length > 0 && (
                      <span className="inline-chip" style={{ borderColor: 'var(--text3)', color: 'var(--text3)' }}>
                        {b.serials.length} SERIAL{b.serials.length > 1 ? 'S' : ''}
                      </span>
                    )}
                    {(assignmentsByBoat[b.id] || []).map(a => (
                      <span key={a.id} className="inline-chip" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 700 }}>
                        {a.employee_initials || a.employee_name || '?'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {canManage && (
                <button onClick={(e) => { e.stopPropagation(); setAssigningBoat(b) }} title="Assign mechanic" style={{ background: 'none', border: 'none', color: (assignmentsByBoat[b.id] || []).length > 0 ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer', padding: 8, flexShrink: 0 }}>
                  <Icon name="user" size={18} />
                </button>
              )}
              {canManage && (
                <button onClick={(e) => { e.stopPropagation(); openEdit(b) }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 8, flexShrink: 0 }}>
                  <Icon name="edit" size={18} />
                </button>
              )}
              {canManage && (
                <button onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Delete this boat? This action cannot be undone.')) {
                    api('DELETE', `/api/boats/${b.id}`).then(() => {
                      showToast('Boat deleted');
                      fetchBoats();
                    }).catch(() => showToast('Failed to delete boat'));
                  }
                }} style={{ background: 'none', border: 'none', color: 'var(--warn)', cursor: 'pointer', padding: 8, flexShrink: 0 }}>
                  <Icon name="trash" size={18} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {assigningBoat && (
        <div className="modal-overlay" onClick={() => setAssigningBoat(null)} style={{ alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 420, maxHeight: '80dvh', overflow: 'auto' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 20, letterSpacing: 1, color: 'var(--text)' }}>{assigningBoat.name || '(no name)'}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Assign to employees</div>
            </div>
            {employees.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 13 }}>
                No active mechanics or cleaners
              </div>
            ) : employees.map((emp) => {
              const assigned = (assignmentsByBoat[assigningBoat.id] || []).some(a => a.employee_id === emp.id)
              return (
                <button key={emp.id} onClick={() => toggleAssignment(assigningBoat.id, emp.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontFamily: 'Barlow Condensed', fontSize: 15, fontWeight: 700, letterSpacing: 0.3, color: assigned ? 'var(--text)' : 'var(--text2)' }}>
                    {emp.name} <span style={{ fontWeight: 600, color: 'var(--text3)' }}>{emp.role}</span>
                  </span>
                  <span className={`chip ${assigned ? 'on green' : ''}`} style={{ width: 'auto', textTransform: 'uppercase', fontSize: 11 }}>
                    {assigned ? 'ASSIGNED' : 'ASSIGN'}
                  </span>
                </button>
              )
            })}
            <div style={{ padding: 12 }}>
              <button className="btn btn-outline" onClick={() => setAssigningBoat(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}