/** findings is list[str] from the backend — no per-finding severity exists yet. */
export default function FindingsList({ findings }) {
  if (!findings?.length) return <div className="empty-state">No findings flagged.</div>

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {findings.map((finding, i) => (
        <li key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--warn)' }}>⚑</span>
          <span>{finding}</span>
        </li>
      ))}
    </ul>
  )
}
