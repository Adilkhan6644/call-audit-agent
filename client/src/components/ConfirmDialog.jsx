export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
      }}
    >
      <div className="panel" style={{ width: 320 }}>
        <div className="label" style={{ marginBottom: 10 }}>CONFIRM ACTION</div>
        <p>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm} style={{ color: 'var(--danger)' }}>Confirm</button>
        </div>
      </div>
    </div>
  )
}
