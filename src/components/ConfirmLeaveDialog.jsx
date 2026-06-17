export default function ConfirmLeaveDialog({ onDiscard, onKeep }) {
  return (
    <div className="modal-overlay" onClick={onKeep}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 20 }}>
        <div className="modal-handle" />
        <div className="modal-title">Unsaved Changes</div>
        <div style={{ padding: '0 20px 16px', fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>
          You have unsaved changes that will be lost if you leave this screen.
        </div>
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-primary" onClick={onKeep}>
            Keep Editing
          </button>
          <button className="btn" onClick={onDiscard}
            style={{ background: 'transparent', color: 'var(--danger)', border: '1.5px solid var(--danger)' }}>
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  )
}
