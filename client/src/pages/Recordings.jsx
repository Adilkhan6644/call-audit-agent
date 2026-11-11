import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listRecordings, uploadRecording, validateFileLocally } from '../api/recordings'
import FileDropzone from '../components/FileDropzone'
import StatusChip from '../components/StatusChip'

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function Recordings() {
  const [recordings, setRecordings] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(null)
  const navigate = useNavigate()

  function refresh() {
    listRecordings().then(setRecordings).catch((err) => setError(err.message))
  }

  useEffect(refresh, [])

  async function handleFile(file) {
    setError(null)
    const localError = validateFileLocally(file)
    if (localError) {
      setError(localError)
      return
    }
    setProgress(0)
    try {
      await uploadRecording(file, setProgress)
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setProgress(null)
    }
  }

  if (!recordings) return <div className="loading-state">LOADING RECORDINGS…</div>

  return (
    <div>
      <div className="label" style={{ marginBottom: 12 }}>RECORDING LIBRARY</div>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <FileDropzone accept=".mp3,.wav,.m4a,.ogg,audio/*" onFile={handleFile} />
        {progress !== null && <div className="label" style={{ marginTop: 8 }}>UPLOADING… {progress}%</div>}
      </div>

      {recordings.length === 0 ? (
        <div className="empty-state">No recordings yet — upload a call to begin.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recordings.map((rec) => (
            <div key={rec._id} className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div>{rec.originalFilename}</div>
                <div className="label">
                  {formatBytes(rec.sizeBytes)} · {new Date(rec.createdAt).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <StatusChip status={rec.status === 'uploaded' ? 'pending' : rec.status} />
                <button onClick={() => navigate(`/audits/new?recordingId=${rec._id}`)}>Run Audit</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
