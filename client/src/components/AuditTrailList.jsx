/** Generic "nothing is ever silently overwritten" versioned-history list. */
export default function AuditTrailList({ entries, renderLabel, activeId }) {
  if (!entries.length) return <div className="empty-state">No history yet.</div>

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderLeft: '2px solid var(--border)' }}>
      {entries.map((entry) => (
        <li
          key={entry._id}
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            color: entry._id === activeId ? 'var(--accent)' : 'var(--text)',
          }}
        >
          <span>{renderLabel(entry)}</span>
          {entry._id === activeId && <span className="status-chip completed">ACTIVE</span>}
        </li>
      ))}
    </ul>
  )
}
