import { useState } from 'react'
import Icon from './icons'

const QUICK_ACTIONS = [
  { icon: 'chart', label: 'Ask about scores' },
  { icon: 'shield', label: 'Find gaps' },
  { icon: 'folder', label: 'Summarize a category' },
  { icon: 'search', label: 'Search past audits' },
]

/** Visual only — no backend Q&A endpoint exists yet. See FRONTEND_PLAN.md. */
export default function AskAgentBar() {
  const [value, setValue] = useState('')
  const [notice, setNotice] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setMode] = useState('Concise')

  function handleSubmit(e) {
    e.preventDefault()
    if (!value.trim()) return
    setNotice('Not available yet.')
    setValue('')
  }

  function pick(label) {
    setValue(label)
    setMenuOpen(false)
  }

  return (
    <div className="ask-bar-wrap">
      {menuOpen && (
        <div className="ask-bar-menu">
          {QUICK_ACTIONS.map((a) => (
            <button key={a.label} type="button" className="ask-bar-menu-item" onClick={() => pick(a.label)}>
              <Icon name={a.icon} size={15} />
              {a.label}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="ask-bar">
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setNotice(null) }}
          placeholder="Ask about this audit…"
          className="ask-bar-input"
        />
        <div className="ask-bar-toolbar">
          <button
            type="button"
            className={`ask-bar-icon-btn${menuOpen ? ' is-active' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            title="Quick actions"
          >
            <Icon name="plus" size={16} />
          </button>
          <button
            type="button"
            className="ask-bar-pill"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Icon name="sparkle" size={13} /> Tools
          </button>
          <button
            type="button"
            className="ask-bar-pill"
            onClick={() => setMode((m) => (m === 'Concise' ? 'Detailed' : 'Concise'))}
          >
            {mode}
          </button>
          <span className="ask-bar-notice">{notice}</span>
          <div style={{ flex: 1 }} />
          <button type="button" className="ask-bar-icon-btn" title="Voice (not available yet)">
            <Icon name="mic" size={16} />
          </button>
          <button type="submit" className="ask-bar-send" disabled={!value.trim()} title="Ask">
            <Icon name="arrowRight" size={16} style={{ transform: 'rotate(-90deg)' }} />
          </button>
        </div>
      </form>
    </div>
  )
}
