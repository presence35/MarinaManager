import { useState, useRef, useEffect, useContext } from 'react'
import { ToastCtx } from '../contexts/ToastCtx'
import { api } from '../api'

export default function ProductAutocomplete({ value, onChange, placeholder, disabled, inputStyle }) {
  const showToast = useContext(ToastCtx)
  const [input, setInput] = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(value || null)
  const ref = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (value && value.name && value.name !== selected?.name) {
      setSelected(value)
      setInput(value.name)
    } else if (!value) {
      setSelected(null)
      if (!input) setInput('')
    }
  }, [value])

  const search = async (term) => {
    if (!term || term.length < 1) {
      setResults([])
      setIsOpen(false)
      return
    }
    setLoading(true)
    try {
      const data = await api('GET', `/products?q=${encodeURIComponent(term)}`)
      setResults(data || [])
      setIsOpen(true)
    } catch (e) {
      setResults([])
    }
    setLoading(false)
  }

  const handleInput = (val) => {
    setInput(val)
    setSelected(null)
    if (onChange) onChange(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  const selectProduct = (product) => {
    setInput(product.name)
    setSelected(product)
    setIsOpen(false)
    if (onChange) onChange(product)
  }

  const addNew = async () => {
    const name = input.trim()
    if (!name) return
    try {
      const created = await api('POST', '/products', { name })
      const product = { id: created.id, name }
      setInput(name)
      setSelected(product)
      setIsOpen(false)
      if (onChange) onChange(product)
      showToast(`Added "${name}"`)
    } catch (e) {
      showToast(e.message || 'Failed to add product')
    }
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const baseInputStyle = {
    width: '100%',
    background: 'var(--surface2)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--r3)',
    padding: '9px 12px',
    fontFamily: 'Barlow',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        placeholder={placeholder || 'Search product...'}
        value={input}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => { if (input.length >= 1 && !selected) search(input) }}
        disabled={disabled}
        style={{ ...baseInputStyle, ...(inputStyle || {}) }}
      />
      {loading && (
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text3)' }}>
          ...
        </div>
      )}
      {isOpen && results.length === 0 && input.trim().length >= 1 && !loading && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--surface)', border: '1.5px solid var(--border)', borderTop: 'none',
          borderRadius: '0 0 var(--r3) var(--r3)', overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,.15)',
        }}>
          <div
            onClick={addNew}
            style={{
              padding: '10px 12px', cursor: 'pointer', fontSize: 13,
              color: 'var(--accent)', fontFamily: 'Barlow Condensed', fontWeight: 700,
              letterSpacing: 0.3, borderTop: '1px solid var(--border)',
            }}
          >
            + Add &ldquo;{input.trim()}&rdquo; as new product
          </div>
        </div>
      )}
      {isOpen && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--surface)', border: '1.5px solid var(--border)', borderTop: 'none',
          borderRadius: '0 0 var(--r3) var(--r3)', overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,.15)',
          maxHeight: 200, overflowY: 'auto',
        }}>
          {results.map((p) => (
            <div key={p.id}
              onClick={() => selectProduct(p)}
              style={{
                padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text)',
                borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--surface2)'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              <span>{p.name}</span>
              {p.part_number && (
                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{p.part_number}</span>
              )}
            </div>
          ))}
          {input.trim().length >= 1 && !results.some(r => r.name.toLowerCase() === input.trim().toLowerCase()) && (
            <div
              onClick={addNew}
              style={{
                padding: '10px 12px', cursor: 'pointer', fontSize: 13,
                color: 'var(--accent)', fontFamily: 'Barlow Condensed', fontWeight: 700,
                letterSpacing: 0.3,
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--surface2)'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              + Add &ldquo;{input.trim()}&rdquo; as new product
            </div>
          )}
        </div>
      )}
    </div>
  )
}
