import { useState, useEffect, useContext } from 'react'
import { NavCtx } from '../contexts/NavCtx'
import { AuthCtx } from '../contexts/AuthCtx'
import { ToastCtx } from '../contexts/ToastCtx'
import { api } from '../api'
import Icon from '../components/Icon'

export default function CustomersScreen() {
  const { navigate } = useContext(NavCtx)
  const { employee } = useContext(AuthCtx)
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const showToast = useContext(ToastCtx)

  const fetchCustomers = () => {
    setLoading(true)
    const qs = search ? `?q=${encodeURIComponent(search)}` : ''
    api('GET', `/customers${qs}`)
      .then((data) => { setCustomers(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchCustomers() }, [search])

  const editCustomer = async (c, e) => {
    e.stopPropagation()
    const name = prompt('Name', c.name)
    if (!name) return
    const phone = prompt('Phone', c.phone || '')
    const email = prompt('Email', c.email || '')
    try {
      await api('PUT', `/customers/${c.id}`, { name, phone, email })
      showToast('Customer updated')
      fetchCustomers()
    } catch (e) { showToast('Failed') }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', padding: '12px 12px 0' }}>
        <div className="search-bar" style={{ margin: 0, flex: 1 }}>
          <span className="search-icon"><Icon name="search" size={17} /></span>
          <input type="search" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {(employee?.role === 'admin' || employee?.role === 'office') && (
          <button className="btn btn-accent" style={{ width: 'auto' }}
            onClick={() => navigate('new-card', { target: 'customer', initialStep: 'customer' })}>
            <Icon name="plus" size={18} color="#fff" /> New
          </button>
        )}
      </div>

      <div className="card" style={{ margin: '12px' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div>
        ) : customers.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 600 }}>No customers found</div>
        ) : (
          customers.map((c, i) => (
            <div
              key={c.id}
              onClick={() => navigate('customer-detail', { customerId: c.id, customerName: c.name })}
              style={{ padding: '13px 16px', borderBottom: i < customers.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 1, color: 'var(--text)' }}>{c.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>{c.phone || c.email || 'No contact info'}</div>
              </div>
              {(employee?.role === 'admin' || employee?.role === 'office') && (
                <button onClick={(e) => editCustomer(c, e)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 6 }}>
                  <Icon name="edit" size={16} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
