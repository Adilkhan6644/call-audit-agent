import Icon from './icons'

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

  // The connector between stage i-1 and stage i reads as "done" once flow
  // has passed through it, or carries the traveling spark while flow is
  // actively crossing into stage i.
  function connectorState(i) {
    const prev = stageState(i - 1)
    if (failed) return prev === 'failed' ? 'failed' : ''
    if (prev === 'done') return 'done'
    if (stageState(i) === 'active') return 'active'
    return ''
  }

  return (
    <div className="status-pipeline">
      {STAGES.map((label, i) => (
        <div key={label} style={{ display: 'contents' }}>
          {i > 0 && (
            <div className={`pipeline-connector ${connectorState(i)}`}>
              {connectorState(i) === 'active' && <span className="pipeline-connector-spark" />}
            </div>
          )}
          <div className={`stage ${stageState(i)}`}>
            {stageState(i) === 'done' && <Icon name="check" size={12} />}
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}
