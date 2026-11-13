import { useState } from 'react'

/** Visual only — no backend Q&A endpoint exists yet. See FRONTEND_PLAN.md. */
export default function AskAgentBar() {
  const [value, setValue] = useState('')
  const [notice, setNotice] = useState(null)

  function handleSubmit(e) {
    e.preventDefault()
    if (!value.trim()) return
    setNotice('Not available yet.')
    setValue('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="panel"
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        background: 'var(--navy-dark)',
        border: 'none',
      }}
    >
      <input
        value={value}
        onChange={(e) => { setValue(e.target.value); setNotice(null) }}
        placeholder="Ask a question…"
        style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none' }}
      />
      {notice && <span style={{ color: '#cfe3f5', fontSize: 12 }}>{notice}</span>}
      <button type="submit" style={{ background: 'var(--purple)', color: '#fff' }}>Ask</button>
    </form>
  )
}
