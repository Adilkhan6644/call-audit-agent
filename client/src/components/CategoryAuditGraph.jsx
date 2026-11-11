import { useEffect, useMemo, useState } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'

const WIDTH = 760
const HEIGHT = 380

function scoreColor(score) {
  if (score == null) return '#94a3b8'
  if (score >= 80) return '#7be08a'
  if (score >= 60) return '#f2c14e'
  return '#ff6b6b'
}

function sphereGradient(color) {
  return `radial-gradient(circle at 35% 30%, #fff, ${color} 55%, ${color} 100%)`
}

/**
 * Categories as glowing hub nodes, recent audits as orbiting child nodes —
 * d3-force computes a static 2D layout (not the reference video's WebGL
 * particle engine), rendered with animated CSS (pulsing glow rings, flowing
 * energy lines, staggered entrance) and a click-to-zoom detail view.
 */
export default function CategoryAuditGraph({ categories, audits }) {
  const [positioned, setPositioned] = useState(null)
  const [selected, setSelected] = useState(null)

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
      .force('link', forceLink(links).id((d) => d.id).distance(100).strength(0.6))
      .force('charge', forceManyBody().strength(-160))
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', forceCollide(36))
      .stop()

    for (let i = 0; i < 260; i++) sim.tick()

    setPositioned({ nodes, links })
    setSelected(null)
  }, [categories, audits])

  const categoryStats = useMemo(() => {
    const stats = {}
    for (const cat of categories) {
      const forCat = audits.filter((a) => a.categoryId === cat._id)
      const completed = forCat.filter((a) => a.status === 'completed' && a.result)
      stats[cat._id] = {
        total: forCat.length,
        avgScore: completed.length
          ? Math.round(completed.reduce((sum, a) => sum + a.result.score, 0) / completed.length)
          : null,
      }
    }
    return stats
  }, [categories, audits])

  if (!positioned) return <div className="loading-state">BUILDING GRAPH…</div>
  if (!positioned.nodes.length) {
    return <div className="empty-state">No categories yet — add one to populate the graph.</div>
  }

  const nodeById = Object.fromEntries(positioned.nodes.map((n) => [n.id, n]))

  if (selected) {
    return <NodeDetail node={selected} categoryStats={categoryStats} onBack={() => setSelected(null)} />
  }

  return (
    <div className="graph-stage" style={{ height: HEIGHT }}>
      <svg width="100%" height={HEIGHT} style={{ position: 'absolute', inset: 0 }}>
        {positioned.links.map((l, i) => {
          const source = typeof l.source === 'object' ? l.source : nodeById[l.source]
          const target = typeof l.target === 'object' ? l.target : nodeById[l.target]
          if (!source || !target) return null
          return (
            <line
              key={i}
              className="graph-link"
              x1={source.x} y1={source.y} x2={target.x} y2={target.y}
              stroke={scoreColor(target.score)}
              strokeWidth={1.5}
              opacity={0.6}
            />
          )
        })}
      </svg>
      {positioned.nodes.map((n, i) => {
        const size = n.type === 'category' ? 72 : 42
        const color = n.type === 'category' ? '#f2c14e' : scoreColor(n.score)
        return (
          <div
            key={n.id}
            className="graph-node"
            onClick={() => setSelected(n)}
            style={{ left: n.x - size / 2, top: n.y - size / 2, width: size, height: size, animationDelay: `${i * 35}ms` }}
          >
            <div className="graph-node-ring" />
            <div
              className="graph-node-sphere"
              title={n.label}
              style={{
                width: size - 14,
                height: size - 14,
                background: sphereGradient(color),
                color: n.type === 'category' ? '#3a2a00' : '#0c1f30',
                fontSize: n.type === 'category' ? 11 : 10,
                boxShadow: `0 0 18px ${color}99`,
              }}
            >
              {n.type === 'category' ? n.label.slice(0, 10) : n.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function NodeDetail({ node, categoryStats, onBack }) {
  const color = node.type === 'category' ? '#f2c14e' : scoreColor(node.score)
  const stats = node.type === 'category' ? categoryStats[node.id] : null

  return (
    <div className="graph-stage graph-detail" style={{ height: HEIGHT }}>
      <button className="back-button" onClick={onBack}>&larr; Back</button>
      <div className="label" style={{ color: '#9fc4e3' }}>{node.type === 'category' ? 'CATEGORY' : 'AUDIT'}</div>
      <h2 style={{ margin: '6px 0' }}>{node.type === 'category' ? node.label : `Score ${node.label}`}</h2>
      <div
        className="graph-node-sphere"
        style={{
          width: 140,
          height: 140,
          background: sphereGradient(color),
          boxShadow: `0 0 50px ${color}aa`,
          animation: 'graph-pulse 2.4s ease-in-out infinite',
          marginTop: 12,
        }}
      />
      {node.type === 'category' ? (
        <div className="gap-badge">{stats.total} AUDITS{stats.avgScore != null ? ` · AVG ${stats.avgScore}` : ''}</div>
      ) : (
        <div className="gap-badge">{node.score != null ? `SCORE ${Math.round(node.score)}` : node.label.toUpperCase()}</div>
      )}
    </div>
  )
}
