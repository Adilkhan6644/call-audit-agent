import { useEffect, useState } from 'react'
import { listApiKeys, rotateApiKey } from '../api/admin'

export default function AdminApiKeys() {
  const [keys, setKeys] = useState(null)
  const [error, setError] = useState(null)
  const [rotating, setRotating] = useState(null)
  const [value, setValue] = useState('')

  function refresh() {
    listApiKeys().then(setKeys).catch((err) => setError(err.message))
  }

  useEffect(refresh, [])

  async function handleRotate(provider) {
    if (!value.trim()) return
    try {
      await rotateApiKey(provider, value.trim())
      setValue('')
      setRotating(null)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!keys) return <div className="loading-state">LOADING KEYS…</div>

  return (
    <div>
      <div className="label" style={{ marginBottom: 12 }}>LLM PROVIDER API KEYS</div>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {keys.map((k) => (
          <div key={k.provider} className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ textTransform: 'uppercase' }}>{k.provider}</div>
                <div className="label">
                  {k.configured ? `Configured · ...${k.last4}` : 'Not configured'}
                  {k.updatedAt && ` · updated ${new Date(k.updatedAt).toLocaleString()}`}
                </div>
              </div>
              <button className="ghost-button" onClick={() => setRotating(rotating === k.provider ? null : k.provider)}>
                Rotate Key
              </button>
            </div>
            {rotating === k.provider && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  type="password"
                  placeholder="new key value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  style={{ flex: 1 }}
                  autoComplete="off"
                />
                <button onClick={() => handleRotate(k.provider)}>Save</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
