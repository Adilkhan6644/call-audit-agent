import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listCategories } from '../api/categories'
import { listRecordings } from '../api/recordings'
import { runAudit } from '../api/audits'
import StatusPipeline from '../components/StatusPipeline'
import ScoreBadge from '../components/ScoreBadge'
import FindingsList from '../components/FindingsList'

export default function NewAudit() {
  const [params] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [recordings, setRecordings] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [recordingId, setRecordingId] = useState(params.get('recordingId') || '')
  const [running, setRunning] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const tickRef = useRef(null)

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {})
    listRecordings().then(setRecordings).catch(() => {})
  }, [])

  useEffect(() => () => clearInterval(tickRef.current), [])

  async function handleRun(e) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setRunning(true)
    setElapsedMs(0)
    const startedAt = Date.now()
    tickRef.current = setInterval(() => setElapsedMs(Date.now() - startedAt), 200)
    try {
      // POST /audits runs the whole pipeline synchronously — the response IS
      // the final state. There's no intermediate status to poll for; the
      // pipeline stages shown below while this is in flight are a cosmetic
      // approximation (see FRONTEND_PLAN.md "Open questions").
      const job = await runAudit(categoryId, recordingId)
      setResult(job)
    } catch (err) {
      setError(err)
    } finally {
      clearInterval(tickRef.current)
      setRunning(false)
    }
  }

  const displayStatus = result?.status || (running ? 'processing' : null)

  return (
    <div>
      <div className="label" style={{ marginBottom: 12 }}>RUN AUDIT SCAN</div>

      <form onSubmit={handleRun} className="panel" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <select value={recordingId} onChange={(e) => setRecordingId(e.target.value)} required style={{ flex: 1 }}>
          <option value="">Select recording…</option>
          {recordings.map((r) => (
            <option key={r._id} value={r._id}>{r.originalFilename}</option>
          ))}
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required style={{ flex: 1 }}>
          <option value="">Select category…</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        <button type="submit" disabled={running || !recordingId || !categoryId}>
          {running ? 'Running…' : 'Run Audit'}
        </button>
      </form>

      {error && (
        <div className="error-state" style={{ marginBottom: 16 }}>
          {error.message}
          {error.retryAfterSeconds && ` (retry in ${error.retryAfterSeconds}s — ${error.suggestion})`}
        </div>
      )}

      {displayStatus && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <StatusPipeline status={displayStatus} elapsedMs={elapsedMs} />
        </div>
      )}

      {result?.status === 'completed' && result.result && (
        <div className="panel">
          <div className="label" style={{ marginBottom: 8 }}>RESULT</div>
          <ScoreBadge score={result.result.score} />
          <p>{result.result.summary}</p>
          <FindingsList findings={result.result.findings} />
        </div>
      )}

      {result?.status === 'failed' && (
        <div className="error-state">{result.errorMessage}</div>
      )}
    </div>
  )
}
