import { useState, useEffect, useContext } from 'react'
import { ToastCtx } from '../contexts/ToastCtx'
import { NavCtx } from '../contexts/NavCtx'
import { api } from '../api'
import { ROLE_COLORS } from '../constants'
import Icon from '../components/Icon'

export default function AdminScreen() {
  const showToast = useContext(ToastCtx)
  const { navigate } = useContext(NavCtx)
  const [employees, setEmployees] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [newEmp, setNewEmp] = useState({ name: '', role: 'mechanic', initials: '', pin: '' })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('employees')
  const [assignments, setAssignments] = useState([])
  const [boats, setBoats] = useState([])
  const [assignBoatId, setAssignBoatId] = useState('')
  const [assignEmpId, setAssignEmpId] = useState('')
  const [items, setItems] = useState([])
  const [showNewItem, setShowNewItem] = useState(false)
  const [newItem, setNewItem] = useState({ item_key: '', label: '', category: 'service', cleaning_cat: 'Interior', sort_order: 0 })
  const [editingItemId, setEditingItemId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editCleaningCat, setEditCleaningCat] = useState('')

  const reload = () => api('GET', '/employees').then(setEmployees).catch(() => {})
  useEffect(() => { reload() }, [])

  const loadAssignments = () => {
    api('GET', '/assignments').then(setAssignments).catch(() => {})
    api('GET', '/boats').then(setBoats).catch(() => {})
  }

  useEffect(() => {
    if (tab === 'assignments') loadAssignments()
  }, [tab])

  const loadItems = () => {
    api('GET', '/authorized-items').then(setItems).catch(() => {})
  }

  useEffect(() => {
    if (tab === 'authorized_items') loadItems()
  }, [tab])

  const createEmployee = async () => {
    if (!newEmp.name || !newEmp.pin) { showToast('Name and PIN required'); return }
    if (!/^\d{4}$/.test(newEmp.pin)) { showToast('PIN must be 4 digits'); return }
    setSaving(true)
    try {
      await api('POST', '/employees', newEmp)
      showToast('Employee created')
      setNewEmp({ name: '', role: 'mechanic', initials: '', pin: '' })
      setShowNew(false)
      reload()
    } catch (e) { showToast(e.message || 'Failed') }
    setSaving(false)
  }

  const toggleActive = async (emp) => {
    const confirmed = confirm(`${emp.active ? 'Deactivate' : 'Activate'} ${emp.name}? ${emp.active ? 'This will revoke all device tokens.' : ''}`)
    if (!confirmed) return
    try {
      await api('PUT', `/employees/${emp.id}`, { active: !emp.active })
      showToast(emp.active ? 'Employee deactivated — PIN revoked' : 'Employee reactivated')
      reload()
    } catch (e) { showToast('Failed') }
  }

  const createAssignment = async () => {
    if (!assignBoatId || !assignEmpId) { showToast('Select boat and employee'); return }
    try {
      await api('POST', '/assignments', { boat_id: parseInt(assignBoatId), employee_id: parseInt(assignEmpId) })
      showToast('Assigned')
      setAssignBoatId(''); setAssignEmpId('')
      loadAssignments()
    } catch (e) { showToast('Failed') }
  }

  const removeAssignment = async (id) => {
    if (!confirm('Remove this assignment?')) return
    try {
      await api('DELETE', `/assignments/${id}`)
      showToast('Removed')
      loadAssignments()
    } catch (e) { showToast('Failed') }
  }

  const labelToKey = (label) =>
    label.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').replace(/_+/g, '_') || ''

  const createItem = async () => {
    if (!newItem.label) { showToast('Label required'); return }
    try {
      const key = labelToKey(newItem.label)
      await api('POST', '/authorized-items', {
        item_key: key,
        label: newItem.label.trim(),
        category: newItem.category,
        cleaning_cat: newItem.category === 'cleaning' ? newItem.cleaning_cat : null,
        sort_order: items.length + 1,
      })
      showToast('Item created')
      setNewItem({ item_key: '', label: '', category: 'service', cleaning_cat: 'Interior', sort_order: 0 })
      setShowNewItem(false)
      loadItems()
    } catch (e) { showToast(e.message || 'Failed') }
  }

  const toggleItemActive = async (item) => {
    try {
      await api('PUT', `/authorized-items/${item.id}`, { active: !item.active })
      loadItems()
    } catch (e) { showToast('Failed') }
  }

  const startEdit = (item) => {
    setEditingItemId(item.id)
    setEditLabel(item.label)
    setEditCleaningCat(item.cleaning_cat || '')
  }

  const saveEdit = async (item) => {
    if (!editLabel.trim()) { showToast('Label required'); return }
    try {
      const key = labelToKey(editLabel)
      const body = { item_key: key, label: editLabel.trim() }
      if (item.category === 'cleaning') body.cleaning_cat = editCleaningCat
      await api('PUT', `/authorized-items/${item.id}`, body)
      showToast('Item updated')
      setEditingItemId(null)
      loadItems()
    } catch (e) { showToast('Failed') }
  }

  const cancelEdit = () => {
    setEditingItemId(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, padding: '10px 12px' }}>
        {['employees', 'assignments', 'authorized_items'].map((t) => (
          <button key={t} className={`chip ${tab === t ? 'on' : ''}`} style={{ textTransform: 'Capitalize' }} onClick={() => setTab(t)}>
            {t === 'employees' ? '\u{1F464}' : t === 'assignments' ? '\u{1F4CB}' : '\u{1F4DD}'} {t === 'authorized_items' ? 'Items' : t}
          </button>
        ))}
      </div>

      {tab === 'employees' && (
        <>
          <div style={{ padding: '0 12px 8px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-accent btn-sm" style={{ width: 'auto' }} onClick={() => setShowNew(!showNew)}>
              {showNew ? '\u2715 Cancel' : '+ Add Employee'}
            </button>
          </div>

          {showNew && (
            <div className="card" style={{ margin: '0 12px 12px' }}>
              <div style={{ padding: '14px 16px' }}>
                {[['Full Name *', 'name', 'text'], ['Initials (2-3) *', 'initials', 'text'], ['4-Digit PIN *', 'pin', 'number']].map(([l, k, t]) => (
                  <div key={k} style={{ marginBottom: 12 }}>
                    <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{l}</label>
                    <input type={t} maxLength={k === 'pin' ? 4 : k === 'initials' ? 3 : undefined}
                      style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                      value={newEmp[k]} onChange={(e) => setNewEmp({ ...newEmp, [k]: e.target.value })} />
                  </div>
                ))}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Role</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['admin', 'office', 'mechanic', 'cleaner', 'wrapper'].map((r) => (
                      <button key={r} className={`chip ${newEmp.role === r ? 'on' : ''}`} style={{ textTransform: 'capitalize' }} onClick={() => setNewEmp({ ...newEmp, role: r })}>{r}</button>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary" onClick={createEmployee} disabled={saving}>
                  {saving ? 'Creating...' : 'Create Employee'}
                </button>
              </div>
            </div>
          )}

          <div className="card" style={{ margin: '0 12px' }}>
            {employees.map((emp, i) => (
              <div key={emp.id} className="emp-card" style={{ borderBottom: i < employees.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div className="emp-avatar" style={{ background: emp.active ? (ROLE_COLORS[emp.role] || 'var(--accent)') : 'var(--text3)', color: '#fff' }}>
                  {emp.initials || emp.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="emp-info">
                  <div className="emp-name" style={{ color: emp.active ? 'var(--text)' : 'var(--text3)' }}>{emp.name}</div>
                  <div className="emp-role" style={{ color: emp.active ? (ROLE_COLORS[emp.role] || 'var(--text3)') : 'var(--text3)' }}>{emp.role}</div>
                </div>
                <button onClick={() => toggleActive(emp)} className={`chip btn-sm ${emp.active ? 'on danger' : ''}`} style={{ textTransform: 'uppercase', width: 'auto', fontSize: 11 }}>
                  {emp.active ? 'ACTIVE' : 'INACTIVE'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'assignments' && (
        <>
          <div className="card" style={{ margin: '12px' }}>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 10 }}>Assign Boat to Employee</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <select style={{ flex: 1, background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  value={assignBoatId} onChange={(e) => setAssignBoatId(e.target.value)}>
                  <option value="">Select boat...</option>
                  {boats.map(b => <option key={b.id} value={b.id}>{b.name || '(no name)'} — {b.customer_name}</option>)}
                </select>
                <select style={{ flex: 1, background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  value={assignEmpId} onChange={(e) => setAssignEmpId(e.target.value)}>
                  <option value="">Select employee...</option>
                  {employees.filter(e => e.active && (e.role === 'mechanic' || e.role === 'cleaner' || e.role === 'admin')).map(e =>
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  )}
                </select>
              </div>
              <button className="btn btn-accent" onClick={createAssignment}>Assign</button>
            </div>
          </div>

          <div className="section-head">Current Assignments</div>
          <div className="card" style={{ margin: '0 12px' }}>
            {assignments.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 13 }}>No assignments yet</div>
            ) : assignments.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: i < assignments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: ROLE_COLORS[a.employee_name ? 'mechanic' : 'cleaner'] || 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, marginRight: 10, flexShrink: 0 }}>
                  {a.employee_initials || '??'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Bebas Neue', fontSize: 16, letterSpacing: 1, color: 'var(--text)' }}>{a.boat_name || '(no name)'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{a.employee_name} · {a.customer_name}</div>
                </div>
                <button onClick={() => removeAssignment(a.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 6 }}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'authorized_items' && (
        <>
          <div style={{ padding: '0 12px 8px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-accent btn-sm" style={{ width: 'auto' }} onClick={() => setShowNewItem(!showNewItem)}>
              {showNewItem ? '\u2715 Cancel' : '+ Add Item'}
            </button>
          </div>

          {showNewItem && (
            <div className="card" style={{ margin: '0 12px 12px' }}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Label *</label>
                  <input type="text" style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                    value={newItem.label} onChange={(e) => setNewItem({ ...newItem, label: e.target.value })} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Category</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['service', 'cleaning'].map((c) => (
                      <button key={c} className={`chip ${newItem.category === c ? 'on' : ''}`} style={{ textTransform: 'Capitalize' }} onClick={() => setNewItem({ ...newItem, category: c })}>{c}</button>
                    ))}
                  </div>
                </div>
                {newItem.category === 'cleaning' && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Cleaning Group</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['Interior', 'Exterior'].map((g) => (
                        <button key={g} className={`chip ${newItem.cleaning_cat === g ? 'on' : ''}`} style={{ textTransform: 'Capitalize' }} onClick={() => setNewItem({ ...newItem, cleaning_cat: g })}>{g}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button className="btn btn-primary" onClick={createItem}>Create Item</button>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 13 }}>No items yet</div>
          ) : (
            <>
              {['service', 'cleaning'].map(cat => {
                const catItems = items.filter(i => i.category === cat)
                if (catItems.length === 0) return null
                return (
                  <div key={cat}>
                    <div className="section-head" style={{ textTransform: 'Capitalize' }}>{cat} Items</div>
                    <div className="card" style={{ margin: '0 12px 12px' }}>
                      {catItems.map((item, i) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: i < catItems.length - 1 ? '1px solid var(--border)' : 'none', opacity: item.active ? 1 : 0.4 }}>
                          <div style={{ flex: 1 }}>
                            {editingItemId === item.id ? (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <input type="text" style={{ flex: 1, minWidth: 120, background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '6px 10px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                                  value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                                {item.category === 'cleaning' && (
                                  <select style={{ background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '6px 10px', fontFamily: 'Barlow', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                                    value={editCleaningCat} onChange={(e) => setEditCleaningCat(e.target.value)}>
                                    <option value="Interior">Interior</option>
                                    <option value="Exterior">Exterior</option>
                                  </select>
                                )}
                                <button className="btn btn-sm btn-primary" style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={() => saveEdit(item)}>Save</button>
                                <button className="btn btn-sm btn-outline" style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={cancelEdit}>Cancel</button>
                              </div>
                            ) : (
                              <div onClick={() => startEdit(item)} style={{ cursor: 'pointer' }}>
                                <div style={{ fontFamily: 'Bebas Neue', fontSize: 15, letterSpacing: 0.5, color: item.active ? 'var(--text)' : 'var(--text3)' }}>{item.label}</div>
                              </div>
                            )}
                          </div>
                          <button onClick={() => toggleItemActive(item)} className={`chip btn-sm ${item.active ? 'on' : ''}`} style={{ textTransform: 'uppercase', width: 'auto', fontSize: 11, marginLeft: 8, flexShrink: 0 }}>
                            {item.active ? 'ACTIVE' : 'DISABLED'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}
    </div>
  )
}