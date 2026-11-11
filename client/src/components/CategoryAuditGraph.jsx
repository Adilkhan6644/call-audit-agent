import { useEffect, useState } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'

const WIDTH = 760
const HEIGHT = 360

function scoreColor(score) {
  if (score == null) return 'var(--text-dim)'
  if (score >= 80) return 'var(--green)'
  if (score >= 60) return 'var(--warn)'
  return 'var(--danger)'
}

/**
 * Categories as hub nodes, recent audits as child nodes glowing by score —
 * a flat 2D force layout (d3-force for positions only), not the video
 * reference's WebGL particle graph. Static: simulated once per data change,
 * not continuously animated or draggable.
 */
export default function CategoryAuditGraph({ categories, audits }) {
  const [positioned, setPositioned] = useState(null)

  useEffect(() => {
    if (!categories.length) {
      setPositioned({ nodes: [], links: [] })
      return
    }

    const categoryIds = new Set(categories.map((c) => c._id))
    const categoryNodes = categories.map((c) => ({ id: c._id, label: c.name, type: 'category' }))
    const auditNodes = audits
      .filter((a) => categoryIds.has(a.categoryId))
      .slice(0, 24)
      .map((a) => ({
        id: a._id,
        label: a.status === 'completed' && a.result ? String(Math.round(a.result.score)) : a.status.slice(0, 4),
        type: 'audit',
        score: a.result?.score,
        categoryId: a.categoryId,
      }))

    const nodes = [...categoryNodes, ...auditNodes]
    const links = auditNodes.map((a) => ({ source: a.categoryId, target: a.id }))

    const sim = forceSimulation(nodes)
      .force('link', forceLink(links).id((d) => d.id).distance(90).strength(0.6))
      .force('charge', forceManyBody().strength(-140))
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', forceCollide(34))
      .stop()

    for (let i = 0; i < 260; i++) sim.tick()

    setPositioned({ nodes, links })
  }, [categories, audits])

  if (!positioned) return <div className="loading-state">BUILDING GRAPH…</div>
  if (!positioned.nodes.length) return <div className="empty-state">No categories yet — add one to populate the graph.</div>

  const nodeById = Object.fromEntries(positioned.nodes.map((n) => [n.id, n]))

  return (
    <div style={{ position: 'relative', width: '100%', height: HEIGHT, overflow: 'hidden' }}>
      <svg width="100%" height={HEIGHT} style={{ position: 'absolute', inset: 0 }}>
        {positioned.links.map((l, i) => {
          const source = typeof l.source === 'object' ? l.source : nodeById[l.source]
          const target = typeof l.target === 'object' ? l.target : nodeById[l.target]
          if (!source || !target) return null
          return <line key={i} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="var(--border)" strokeWidth={1.5} />
        })}
      </svg>
      {positioned.nodes.map((n) => {
        const size = n.type === 'category' ? 68 : 40
        return (
          <div
            key={n.id}
            title={n.label}
            style={{
              position: 'absolute',
              left: n.x - size / 2,
              top: n.y - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: 2,
              fontSize: n.type === 'category' ? 11 : 10,
              fontWeight: 700,
              overflow: 'hidden',
              background: n.type === 'category' ? 'var(--navy)' : '#fff',
              color: n.type === 'category' ? '#fff' : scoreColor(n.score),
              border: `2px solid ${n.type === 'category' ? 'var(--navy-dark)' : scoreColor(n.score)}`,
              boxShadow: n.type === 'category' ? '0 0 14px rgba(26,80,128,0.45)' : `0 0 10px ${scoreColor(n.score)}66`,
            }}
          >
            {n.type === 'category' ? n.label.slice(0, 10) : n.label}
          </div>
        )
      })}
    </div>
  )
}
