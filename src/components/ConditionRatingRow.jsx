import { useState, useContext } from 'react'
import { ToastCtx } from '../contexts/ToastCtx'
import { api } from '../api'

export default function ConditionRatingRow({ area, cardId, initialRating, initialNotes, reload, disabled }) {
  const showToast = useContext(ToastCtx)
  const [rating, setRating] = useState(initialRating || '')

  const pick = async (r) => {
    if (disabled) return
    const newR = rating === r ? '' : r
    setRating(newR)
    try {
      await api('PUT', `/cards/${cardId}/condition`, {
        condition: [{ area, rating: newR, notes: initialNotes }],
      })
    } catch (e) {
      showToast('Save failed')
    }
  }

  return (
    <div className="rating-row" style={disabled ? { opacity: 0.5 } : undefined}>
      {['good', 'fair', 'poor', 'n/a'].map((r) => (
        <button
          key={r}
          className={`rating-btn ${rating === r ? 'sel-' + r.replace('/', '').replace(' ', '-') : ''}`}
          onClick={() => pick(r)}
          style={disabled ? { cursor: 'default' } : undefined}
        >
          {r.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
