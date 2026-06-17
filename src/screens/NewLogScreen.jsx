import { useState, useContext, useRef, useEffect } from 'react'
import { NavCtx } from '../contexts/NavCtx'
import { AuthCtx } from '../contexts/AuthCtx'
import { ToastCtx } from '../contexts/ToastCtx'
import { api } from '../api'
import Icon from '../components/Icon'
import ProductAutocomplete from '../components/ProductAutocomplete'

export default function NewLogScreen({ params = {} }) {
  const { goBack, setDirty } = useContext(NavCtx)
  const { employee } = useContext(AuthCtx)
  const showToast = useContext(ToastCtx)
  const [form, setForm] = useState({
    description: '',
    log_date: new Date().toISOString().split('T')[0],
  })
  const [parts, setParts] = useState([])
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const isDirty = form.description !== '' || parts.length > 0
    setDirty(isDirty)
    return () => setDirty(false)
  }, [form.description, parts, setDirty])

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { showToast('Voice dictation not available'); return }
    const r = new SR()
    r.continuous = true
    r.interimResults = true
    r.lang = 'en-CA'
    r.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join(' ')
      setTranscript(t)
    }
    r.onerror = () => { setRecording(false); showToast('Mic error') }
    r.onend = () => setRecording(false)
    r.start()
    recognitionRef.current = r
    setRecording(true)
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setRecording(false)
    if (transcript) setForm((f) => ({ ...f, description: f.description ? f.description + '\n' + transcript : transcript }))
    setTranscript('')
  }

  const addPart = () => setParts((p) => [...p, { product: null, quantity: 1 }])
  const updatePart = (i, field, val) => setParts((p) => p.map((x, j) => (j === i ? { ...x, [field]: val } : x)))
  const removePart = (i) => setParts((p) => p.filter((_, j) => j !== i))

  const save = async () => {
    if (!form.description && !transcript) { showToast('Add some notes first'); return }
    setSaving(true)
    try {
      await api('POST', `/cards/${params.cardId}/logs`, {
        log_date: form.log_date,
        description: form.description || transcript,
        parts: parts.filter((p) => p.product).map(p => ({
          part_number: p.product.part_number || null,
          description: p.product.name,
          quantity: p.quantity,
        })),
      })
      setDirty(false)
      showToast('Log entry saved')
      goBack()
    } catch (e) { showToast('Save failed') }
    setSaving(false)
  }

  return (
    <div>
      <div className="field" style={{ paddingTop: 16 }}>
        <label>Date</label>
        <input type="date" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} />
      </div>

      <div className="field">
        <label>Work Notes</label>
        <textarea placeholder="Describe work performed..." value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ minHeight: 100 }} />
      </div>

      {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
        <div className="field">
          <button className={`voice-btn ${recording ? 'recording' : ''}`} onClick={recording ? stopRecording : startRecording}>
            {recording ? <div className="recording-pulse" /> : <Icon name="mic" size={18} color="var(--text2)" />}
            {recording ? 'Tap to Stop Recording' : 'Voice Note (tap to record)'}
          </button>
          {transcript && <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--r3)', fontSize: 13, color: 'var(--text2)', fontStyle: 'italic' }}>
            {'\u{1F399}\uFE0F'} {transcript}
          </div>}
        </div>
      )}

      <div className="section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 }}>
        <span>Parts Used</span>
        <button className="btn btn-outline btn-sm" style={{ width: 'auto', padding: '5px 12px' }} onClick={addPart}>+ Add</button>
      </div>

      {parts.map((p, i) => (
        <div key={i} style={{ padding: '0 16px 10px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <ProductAutocomplete
              value={p.product ? { id: p.product.id, name: p.product.name } : null}
              onChange={(product) => updatePart(i, 'product', product)}
              placeholder="Search or add product..."
            />
          </div>
          <input type="number" min="0.1" step="0.1" style={{ width: 56, background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 8px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none', textAlign: 'center' }}
            value={p.quantity} onChange={(e) => updatePart(i, 'quantity', e.target.value)} />
          <button onClick={() => removePart(i)} style={{ background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', cursor: 'pointer', flexShrink: 0 }}>
            <Icon name="trash" size={15} />
          </button>
        </div>
      ))}

      <div style={{ padding: '8px 16px 20px' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : 'Save Log Entry'}
        </button>
      </div>
    </div>
  )
}
