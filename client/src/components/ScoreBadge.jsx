/** Thresholds are a frontend convention — no pass/fail cutoff exists server-side. */
function band(score) {
  if (score >= 80) return 'good'
  if (score >= 60) return 'ok'
  return 'bad'
}

export default function ScoreBadge({ score }) {
  return (
    <span className={`score-badge ${band(score)}`}>
      {Math.round(score)}
      <span className="unit">/100</span>
    </span>
  )
}
