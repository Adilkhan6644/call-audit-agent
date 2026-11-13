import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAudit, runAudit } from '../api/audits'
import StatusPipeline from '../components/StatusPipeline'
import StatusChip from '../components/StatusChip'
import ScoreBadge from '../components/ScoreBadge'
import FindingsList from '../components/FindingsList'
import { downloadFile } from '../api/client'

export default function AuditDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getAudit(id).then(setJob).catch((err) => setError(err.message))
  }, [id])

  async function handleRerun() {
    try {
      const rerun = await runAudit(job.categoryId, job.recordingId)
      navigate(`/audits/${rerun._id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  if (error) return <div className="error-state">{error}</div>
  if (!job) return <div className="loading-state">LOADING AUDIT…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="label">AUDIT RESULT</div>
        <StatusChip status={job.status} />
      </div>

      {(job.status === 'pending' || job.status === 'processing') && (
        <div className="panel">
          <StatusPipeline status={job.status} />
        </div>
      )}

      {job.status === 'completed' && job.result && (
        <div className="panel">
          <ScoreBadge score={job.result.score} />
          <p>{job.result.summary}</p>
          <FindingsList findings={job.result.findings} />
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="ghost-button" onClick={() => downloadFile(`/audits/export.csv`, `audit-${job._id}.csv`)}>Export CSV</button>
            <button className="ghost-button" onClick={() => downloadFile(`/audits/export.pdf`, `audit-${job._id}.pdf`)}>Export PDF</button>
          </div>
        </div>
      )}

      {job.status === 'failed' && (
        <div className="error-state" style={{ marginBottom: 16 }}>
          {job.errorMessage}
        </div>
      )}
      {job.status === 'failed' && (
        <button onClick={handleRerun}>Run Again</button>
      )}
    </div>
  )
}
