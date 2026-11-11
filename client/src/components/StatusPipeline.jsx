/**
 * Visual-only split of the backend's single "processing" state into two
 * stages, based on the pipeline's known internal order (transcribe then
 * score) — the backend has no separate status for each. See
 * FRONTEND_PLAN.md "Open questions".
 */
const STAGES = ['Queued', 'Transcribing', 'Scoring', 'Complete']

export default function StatusPipeline({ status, elapsedMs = 0 }) {
  const failed = status === 'failed'
  // Rough split of the processing window so "Scoring" lights up partway through.
  const processingStageIndex = status === 'processing' ? (elapsedMs < 4000 ? 1 : 2) : null

  function stageState(index) {
    if (failed) return index <= 1 ? 'failed' : ''
    if (status === 'completed') return 'done'
    if (status === 'pending') return index === 0 ? 'active' : ''
    if (status === 'processing') {
      if (index < processingStageIndex) return 'done'
      if (index === processingStageIndex) return 'active'
      return ''
    }
    return ''
  }

  return (
    <div className="status-pipeline">
      {STAGES.map((label, i) => (
        <div key={label} className={`stage ${stageState(i)}`}>{label}</div>
      ))}
    </div>
  )
}
