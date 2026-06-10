import { useState, useEffect, useContext, useRef } from 'react'
import { NavCtx } from '../contexts/NavCtx'
import { AuthCtx } from '../contexts/AuthCtx'
import { ToastCtx } from '../contexts/ToastCtx'
import { api } from '../api'
import Icon from '../components/Icon'

export default function BoatsScreen({ params }) {
  const { navigate } = useContext(NavCtx)
  const { employee } = useContext(AuthCtx)
  const showToast = useContext(ToastCtx)
  const [boats, setBoats] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingBoat, setEditingBoat] = useState(null)
  const handledAutoOpen = useRef(false)

  const fetchBoats = () => {
    setLoading(true)
    const qs = search ? `?q=${encodeURIComponent(search)}` : ''
    api('GET', `/boats${qs}`)
      .then((data) => { setBoats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchBoats() }, [search])

  useEffect(() => {
    if (params?.editBoatId && boats.length > 0 && !handledAutoOpen.current) {
      const boat = boats.find(b => b.id === params.editBoatId)
      if (boat) {
        setEditingBoat(boat)
        handledAutoOpen.current = true
      }
    }
  }, [params?.editBoatId, boats])

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
    try {
      await api('PUT', `/boats/${editingBoat.id}`, editingBoat)
      showToast('Boat updated')
      setEditingBoat(null)
      fetchBoats()
    } catch (e) { showToast('Failed to update boat') }
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
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditingBoat(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveBoat}>Save</button>
          </div>
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
              <div onClick={() => navigateToBoatCard(b)} style={{ flex: 1, padding: '13px 0', cursor: 'pointer' }}>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 1, color: 'var(--text)' }}>{b.name || '(no name)'}</div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>{b.customer_name} · {b.model} · {b.licence}{b.trailer_licence ? ` · T:${b.trailer_licence}` : ''}</div>
              </div>
              {(employee?.role === 'admin' || employee?.role === 'office') && (
                <button onClick={() => setEditingBoat(b)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 8, flexShrink: 0 }}>
                  <Icon name="edit" size={18} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}