import { useState, useRef, useEffect, useContext } from 'react'
import { ToastCtx } from '../contexts/ToastCtx'
import { NavCtx } from '../contexts/NavCtx'
import { AuthCtx } from '../contexts/AuthCtx'
import { api } from '../api'
import { RECEIVED_ITEMS, AUTHORIZED_WORK } from '../constants'
import Icon from '../components/Icon'

function parseOcrText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const fullText = text
  const result = {
    work_order_nos: [],
    phone: '',
    motor_type: '',
    boat_name: '',
    licence: '',
    rate_type: '',
    length: '',
    received_items: {},
    authorized_work: {},
    other_work: '',
    remarks: '',
    date_in: '',
    storage_location: '',
  }

  for (const line of lines) {
    const upper = line.toUpperCase()

    if (/^\d{5,6}\s*$/.test(line) || /^\d{5,6}\s+\d{5,6}\s*$/.test(line)) {
      const nums = line.match(/\d{5,6}/g) || []
      result.work_order_nos.push(...nums)
      continue
    }

    if (upper.includes('HOME') || upper.includes('CELL') || upper.includes('PHONE')) {
      const phoneMatch = line.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)
      if (phoneMatch) result.phone = phoneMatch[0]
    }

    if (upper.startsWith('MOTOR') || upper.includes('MOTOR:')) {
      const val = line.replace(/MOTOR\s*:?\s*/i, '').trim()
      if (val && val.length < 30) result.motor_type = val
    }

    if (upper.startsWith('BOAT') && !upper.includes('BOATHOUSE')) {
      const val = line.replace(/BOAT\s*:?\s*/i, '').trim()
      if (val && val.length < 30) result.boat_name = val
    }

    if (upper.includes('LICENCE') || upper.includes('LICENSE')) {
      const val = line.replace(/LICEN[CS]E\s*:?\s*/i, '').trim()
      if (val && val.length < 20) result.licence = val
    }

    if (upper.includes('RATE') || upper.includes('PER SQ')) {
      if (/\bSW\b/i.test(line)) result.rate_type = 'SW'
      else if (/\bDW\b/i.test(line)) result.rate_type = 'DW'
      const lenMatch = line.match(/(\d{2}(?:\.\d)?|\d{2}\s*\/\s*\d)\s*(?:FT|')?/i)
      if (lenMatch) result.length = lenMatch[1].replace(/\s/g, '')
    }

    if (upper.includes('COMPOUND') || upper.includes('BETWEEN') || upper.includes('TRAILER') || upper.includes('ROW')) {
      result.storage_location = line
    }

    for (const item of RECEIVED_ITEMS) {
      const itemLabel = item.label.toUpperCase()
      if (upper.includes(itemLabel)) {
        if (/[\u2713\u2714\sv]/i.test(line) && !/[xX\u00D7]/.test(line.replace(itemLabel, ''))) {
          result.received_items[item.key] = true
        } else if (/[xX\u00D7]/.test(line)) {
          result.received_items[item.key] = false
        }
      }
    }

    for (const work of AUTHORIZED_WORK) {
      const workLabel = work.label.toUpperCase()
      if (upper.includes(workLabel) || upper.includes(work.key.replace(/_/g, ' ').toUpperCase())) {
        if (/\bYES\b/i.test(line)) result.authorized_work[work.key] = true
        else if (/\bNO\b/i.test(line)) result.authorized_work[work.key] = false
      }
    }

    if (upper.includes('OTHER') || upper.includes('TRIM') || upper.includes('ALGAE') || upper.includes('STRIP') || upper.includes('WAX')) {
      if (!result.other_work) result.other_work = line
      else result.other_work += '; ' + line
    }

    if (upper.includes('WINTER') || upper.includes('STORAGE') || upper.includes('SUMMER')) {
      result.remarks = line
    }

    const dateMatch = line.match(/(\d{2})\/(\d{2})\/(\d{2,4})/)
    if (dateMatch) {
      const [, m, d, y] = dateMatch
      const year = y.length === 2 ? (parseInt(y) > 50 ? '19' + y : '20' + y) : y
      result.date_in = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }

  if (result.work_order_nos.length === 0) {
    const woMatch = fullText.match(/\b(\d{5,6})\b/g)
    if (woMatch) result.work_order_nos = [...new Set(woMatch)]
  }

  return result
}

export default function ScanCardScanner() {
  const showToast = useContext(ToastCtx)
  const { navigate } = useContext(NavCtx)
  const { employee } = useContext(AuthCtx)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [phase, setPhase] = useState('capture')
  const [imageData, setImageData] = useState(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [showRawOcr, setShowRawOcr] = useState(false)

  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState([])
  const [customer, setCustomer] = useState(null)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')

  const [boats, setBoats] = useState([])
  const [boat, setBoat] = useState(null)
  const [newBoatName, setNewBoatName] = useState('')
  const [newBoatMotor, setNewBoatMotor] = useState('')
  const [newBoatLicence, setNewBoatLicence] = useState('')

  const [form, setForm] = useState({
    work_order_no: '',
    phone: '',
    motor_type: '',
    boat_name: '',
    licence: '',
    rate_type: '',
    length: '',
    other_work: '',
    remarks: '',
    date_in: new Date().toISOString().split('T')[0],
    storage_location: '',
  })

  const [receivedItems, setReceivedItems] = useState({})
  const [authorizedWork, setAuthorizedWork] = useState({})

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    startCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (e) {
      showToast('Camera access denied or unavailable')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setImageData(dataUrl)
    stopCamera()
    setPhase('preview')
  }

  const retakePhoto = () => {
    setImageData(null)
    setOcrText('')
    setPhase('capture')
    setTimeout(startCamera, 100)
  }

  const runOcr = async () => {
    if (!imageData) return
    setOcrLoading(true)
    setOcrProgress(0)
    try {
      const Tesseract = (await import('tesseract.js')).default
      const result = await Tesseract.recognize(imageData, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100))
          }
        }
      })
      const text = result.data.text
      setOcrText(text)
      const parsed = parseOcrText(text)
      setForm({
        work_order_no: parsed.work_order_nos.join(', ') || '',
        phone: parsed.phone || '',
        motor_type: parsed.motor_type || '',
        boat_name: parsed.boat_name || '',
        licence: parsed.licence || '',
        rate_type: parsed.rate_type || '',
        length: parsed.length || '',
        other_work: parsed.other_work || '',
        remarks: parsed.remarks || '',
        date_in: parsed.date_in || new Date().toISOString().split('T')[0],
        storage_location: parsed.storage_location || '',
      })
      setReceivedItems(parsed.received_items)
      setAuthorizedWork(parsed.authorized_work)
      if (parsed.phone) setNewCustomerPhone(parsed.phone)
      if (parsed.motor_type) setNewBoatMotor(parsed.motor_type)
      if (parsed.licence) setNewBoatLicence(parsed.licence)
      if (parsed.boat_name) setNewBoatName(parsed.boat_name)
      setPhase('edit')
    } catch (e) {
      showToast('OCR failed: ' + (e.message || 'Unknown error'))
    }
    setOcrLoading(false)
  }

  useEffect(() => {
    if (customerSearch.length >= 2) {
      api('GET', `/customers?q=${encodeURIComponent(customerSearch)}`).then(setCustomers).catch(() => {})
    } else {
      setCustomers([])
    }
  }, [customerSearch])

  const selectCustomer = (c) => {
    setCustomer(c)
    api('GET', `/customers/${c.id}`).then((data) => setBoats(data.boats || []))
  }

  const createCustomer = async () => {
    if (!newCustomerName.trim()) { showToast('Customer name required'); return }
    setSaving(true)
    try {
      const c = await api('POST', '/customers', {
        name: newCustomerName.trim(),
        phone: newCustomerPhone || null,
      })
      setCustomer({ id: c.id, name: newCustomerName.trim(), phone: newCustomerPhone })
      setBoats([])
      showToast('Customer created')
    } catch (e) { showToast(e.message || 'Failed') }
    setSaving(false)
  }

  const createBoat = async () => {
    if (!newBoatName.trim() && !newBoatMotor.trim()) { showToast('Boat name or motor required'); return }
    if (!customer) { showToast('Select or create customer first'); return }
    setSaving(true)
    try {
      const b = await api('POST', '/boats', {
        customer_id: customer.id,
        name: newBoatName.trim() || null,
        motor_type: newBoatMotor.trim() || null,
        licence: newBoatLicence.trim() || null,
        rate_type: form.rate_type || 'SW',
        length_ft: form.length ? parseFloat(form.length) : null,
      })
      setBoat({ id: b.id, name: newBoatName.trim(), motor_type: newBoatMotor.trim(), licence: newBoatLicence.trim() })
      showToast('Boat created')
    } catch (e) { showToast(e.message || 'Failed') }
    setSaving(false)
  }

  const createCard = async () => {
    if (!customer) { showToast('Customer required'); return }
    if (!boat) { showToast('Boat required'); return }
    setSaving(true)
    try {
      const card = await api('POST', '/cards', {
        boat_id: boat.id,
        work_order_no: form.work_order_no || null,
        rate_type: form.rate_type || null,
        remarks: form.remarks || null,
        other_work: form.other_work || null,
        date_in: form.date_in || new Date().toISOString().split('T')[0],
        storage_location: form.storage_location || null,
        is_scanned: 1,
      })

      if (Object.keys(receivedItems).length > 0) {
        const items = RECEIVED_ITEMS.map(item => ({
          item: item.key,
          present: receivedItems[item.key] ? 1 : 0,
        }))
        await api('PUT', `/cards/${card.id}/items`, { items })
      }

      if (Object.keys(authorizedWork).length > 0) {
        const work = AUTHORIZED_WORK.map(w => ({
          service_type: w.key,
          authorized: authorizedWork[w.key] ? 1 : 0,
        }))
        await api('PUT', `/cards/${card.id}/work`, { work })
      }

      if (imageData) {
        const blob = await (await fetch(imageData)).blob()
        const fd = new FormData()
        fd.append('photo', blob, 'scan-reference.jpg')
        fd.append('photo_type', 'scan_reference')
        fd.append('caption', 'OCR scan reference')
        await api('POST', `/cards/${card.id}/photos`, fd, true)
      }

      showToast('Scanned card created!')
      navigate('card', { id: card.id })
    } catch (e) { showToast(e.message || 'Failed to create card') }
    setSaving(false)
  }

  const resetScanner = () => {
    setImageData(null)
    setOcrText('')
    setCustomer(null)
    setBoat(null)
    setBoats([])
    setCustomerSearch('')
    setNewCustomerName('')
    setNewCustomerPhone('')
    setNewBoatName('')
    setNewBoatMotor('')
    setNewBoatLicence('')
    setReceivedItems({})
    setAuthorizedWork({})
    setForm({
      work_order_no: '',
      phone: '',
      motor_type: '',
      boat_name: '',
      licence: '',
      rate_type: '',
      length: '',
      other_work: '',
      remarks: '',
      date_in: new Date().toISOString().split('T')[0],
      storage_location: '',
    })
    setPhase('capture')
    setTimeout(startCamera, 100)
  }

  if (phase === 'capture') {
    return (
      <div>
        <div style={{ padding: '16px 12px 8px', fontFamily: 'Barlow Condensed', fontSize: 14, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text2)', textTransform: 'uppercase' }}>
          {'\u{1F4F7}'} Point camera at paper service card
        </div>
        <div style={{ margin: '0 12px', borderRadius: 'var(--r)', overflow: 'hidden', background: '#000', aspectRatio: '3/4', position: 'relative' }}>
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
          <div style={{ position: 'absolute', top: 12, left: 12, right: 12, bottom: 12, border: '2px dashed rgba(255,255,255,0.4)', borderRadius: 8, pointerEvents: 'none' }} />
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div style={{ padding: '16px 12px', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={capturePhoto} style={{ flex: 1 }}>
            <Icon name="camera" size={18} color="#fff" /> Capture
          </button>
        </div>
        <div style={{ padding: '0 12px 12px', fontFamily: 'Barlow Condensed', fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
          Ensure good lighting and the entire card is visible
        </div>
      </div>
    )
  }

  if (phase === 'preview') {
    return (
      <div>
        <div style={{ padding: '16px 12px 8px', fontFamily: 'Barlow Condensed', fontSize: 14, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text2)', textTransform: 'uppercase' }}>
          {'\u{1F50D}'} Review & Extract
        </div>
        <div style={{ margin: '0 12px', borderRadius: 'var(--r)', overflow: 'hidden', maxHeight: '40vh' }}>
          <img src={imageData} alt="Captured card" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        <div style={{ padding: '16px 12px', display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={retakePhoto} style={{ flex: 1 }}>
            {'\u2190'} Retake
          </button>
          <button className="btn btn-primary" onClick={runOcr} disabled={ocrLoading} style={{ flex: 2 }}>
            {ocrLoading ? `Extracting... ${ocrProgress}%` : 'Extract Text'}
          </button>
        </div>
        {ocrLoading && (
          <div style={{ padding: '0 12px' }}>
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${ocrProgress}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 11, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
              Loading OCR engine (first time only)...
            </div>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'edit') {
    return (
      <div>
        <div style={{ padding: '16px 12px 8px', fontFamily: 'Barlow Condensed', fontSize: 14, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text2)', textTransform: 'uppercase' }}>
          {'\u270F\uFE0F'} Review & Edit Extracted Data
        </div>

        <details style={{ margin: '0 12px 8px', background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
          <summary style={{ padding: '10px 14px', fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', letterSpacing: 0.5 }}>
            {showRawOcr ? 'Hide' : 'Show'} Raw OCR Text
          </summary>
          <pre style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text2)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', margin: 0 }}>
            {ocrText || '(no text extracted)'}
          </pre>
        </details>

        <div style={{ margin: '0 12px 8px', padding: '10px 14px', background: 'rgba(224,123,57,0.1)', borderRadius: 'var(--r)', border: '1px solid rgba(224,123,57,0.3)' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, color: 'var(--warn)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
            {'\u26A0\uFE0F'} OCR data may have errors — verify all fields
          </div>
        </div>

        <div className="card" style={{ margin: '0 12px 8px' }}>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 10 }}>
              Customer
            </div>
            {!customer ? (
              <>
                <div style={{ marginBottom: 10 }}>
                  <input
                    type="text"
                    placeholder="Search existing customer..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  />
                  {customers.length > 0 && (
                    <div style={{ marginTop: 4, background: 'var(--surface2)', borderRadius: 'var(--r3)', border: '1px solid var(--border)', maxHeight: 150, overflow: 'auto' }}>
                      {customers.map(c => (
                        <div key={c.id} onClick={() => selectCustomer(c)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' }}>
                          {c.name} {c.phone && <span style={{ color: 'var(--text3)' }}>· {c.phone}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Or create new customer</label>
                  <input
                    type="text"
                    placeholder="Customer name *"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none', marginBottom: 8 }}
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  />
                  <button className="btn btn-accent btn-sm" onClick={createCustomer} disabled={saving} style={{ marginTop: 8, width: 'auto' }}>
                    Create Customer
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--r3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'Bebas Neue', fontSize: 16, letterSpacing: 1, color: 'var(--text)' }}>{customer.name}</div>
                  {customer.phone && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{customer.phone}</div>}
                </div>
                <button className="chip btn-sm" onClick={() => { setCustomer(null); setBoat(null); setBoats([]) }} style={{ width: 'auto', fontSize: 11 }}>Change</button>
              </div>
            )}
          </div>
        </div>

        {customer && (
          <div className="card" style={{ margin: '0 12px 8px' }}>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 10 }}>
                Boat
              </div>
              {!boat ? (
                <>
                  {boats.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Existing boats:</div>
                      {boats.map(b => (
                        <div key={b.id} onClick={() => setBoat(b)} style={{ padding: '8px 12px', cursor: 'pointer', background: 'var(--surface2)', borderRadius: 'var(--r3)', marginBottom: 4, fontSize: 13, color: 'var(--text)' }}>
                          {b.name || '(no name)'} · {b.motor_type || '—'} · {b.licence || '—'}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6, marginTop: 10 }}>Or create new boat:</div>
                  <input
                    type="text"
                    placeholder="Boat name"
                    value={newBoatName}
                    onChange={(e) => setNewBoatName(e.target.value)}
                    style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none', marginBottom: 8 }}
                  />
                  <input
                    type="text"
                    placeholder="Motor type"
                    value={newBoatMotor}
                    onChange={(e) => setNewBoatMotor(e.target.value)}
                    style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none', marginBottom: 8 }}
                  />
                  <input
                    type="text"
                    placeholder="Licence / Registration"
                    value={newBoatLicence}
                    onChange={(e) => setNewBoatLicence(e.target.value)}
                    style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  />
                  <button className="btn btn-accent btn-sm" onClick={createBoat} disabled={saving} style={{ marginTop: 8, width: 'auto' }}>
                    Create Boat
                  </button>
                </>
              ) : (
                <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--r3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 16, letterSpacing: 1, color: 'var(--text)' }}>{boat.name || '(no name)'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{boat.motor_type || '—'} · {boat.licence || '—'}</div>
                  </div>
                  <button className="chip btn-sm" onClick={() => setBoat(null)} style={{ width: 'auto', fontSize: 11 }}>Change</button>
                </div>
              )}
            </div>
          </div>
        )}

        {boat && (
          <>
            <div className="card" style={{ margin: '0 12px 8px' }}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Card Details
                </div>
                {[
                  ['Work Order #', 'work_order_no', 'text'],
                  ['Phone', 'phone', 'tel'],
                  ['Motor Type', 'motor_type', 'text'],
                  ['Boat Name', 'boat_name', 'text'],
                  ['Licence', 'licence', 'text'],
                  ['Rate Type (SW/DW)', 'rate_type', 'text'],
                  ['Length', 'length', 'text'],
                  ['Date In', 'date_in', 'date'],
                  ['Storage Location', 'storage_location', 'text'],
                ].map(([label, key, type]) => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <label style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input
                      type={type}
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ margin: '0 12px 8px' }}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Received Items
                </div>
                {RECEIVED_ITEMS.map(item => (
                  <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={receivedItems[item.key] || false}
                      onChange={(e) => setReceivedItems({ ...receivedItems, [item.key]: e.target.checked })}
                      style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
                    />
                    <span style={{ fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)' }}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="card" style={{ margin: '0 12px 8px' }}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Authorized Work
                </div>
                {AUTHORIZED_WORK.map(work => (
                  <label key={work.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={authorizedWork[work.key] || false}
                      onChange={(e) => setAuthorizedWork({ ...authorizedWork, [work.key]: e.target.checked })}
                      style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
                    />
                    <span style={{ fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)' }}>{work.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="card" style={{ margin: '0 12px 8px' }}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Other Work / Notes
                </div>
                <textarea
                  value={form.other_work}
                  onChange={(e) => setForm({ ...form, other_work: e.target.value })}
                  placeholder="Additional work requested..."
                  rows={3}
                  style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none', resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="card" style={{ margin: '0 12px 8px' }}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Remarks
                </div>
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  placeholder="Winter storage 2025-2026..."
                  rows={2}
                  style={{ width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r3)', padding: '9px 12px', fontFamily: 'Barlow', fontSize: 14, color: 'var(--text)', outline: 'none', resize: 'vertical' }}
                />
              </div>
            </div>
          </>
        )}

        <div style={{ padding: '4px 16px 24px', display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={resetScanner} disabled={saving} style={{ flex: 1 }}>
            {'\u2190'} New Scan
          </button>
          <button className="btn btn-primary" onClick={createCard} disabled={saving || !customer || !boat} style={{ flex: 2, opacity: (!customer || !boat) ? 0.5 : 1 }}>
            {saving ? 'Creating...' : 'Create Scanned Card'}
          </button>
        </div>
      </div>
    )
  }

  return null
}
