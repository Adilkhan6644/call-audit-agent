import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Icon from './icons'

const HUB_Y = 46
const SPHERE = { x: 12, y: HUB_Y }
const TILE_X = 29
const CURVE_END_X = 53
const ROW_TEXT_X = 53
const ROWS_Y = [6, 94]
const TILE_ICONS = ['folder', 'chart', 'shield', 'mic', 'play']
const GOLD = '#e0b869'

// Build sequence: a purple orb expands from the hub to swallow the screen,
// then collapses back while connections draw out and cards land on them,
// then the selected tile glows, then rows. Kept slow and staged on purpose —
// see graph-orb-intro in index.css for the matching keyframe timing.
const ORB_MS = 3200
const LINK_START = 1700
const TILE_STEP_MS = 160
const CARD_OFFSET_MS = 160
const CARD_MS = 420
const ROW_STEP_MS = 60
const tileLinkDelay = (i) => LINK_START + i * TILE_STEP_MS
const tileCardDelay = (i) => tileLinkDelay(i) + CARD_OFFSET_MS

function scoreColor(score) {
  if (score == null) return '#94a3b8'
  if (score >= 80) return '#7be08a'
  if (score >= 60) return '#f2c14e'
  return '#ff6b6b'
}

function curvePath(x0, y0, x1, y1) {
  const midX = x0 + (x1 - x0) * 0.55
  return `M ${x0} ${y0} C ${midX} ${y0}, ${midX} ${y1}, ${x1} ${y1}`
}

const SPARK_MS = 2200

function AnimatedLink({ d, color = GOLD, delay = 0, glowDelay = null }) {
  const ref = useRef(null)
  const sparkRef = useRef(null)
  const [shining, setShining] = useState(false)

  // Runs exactly once per mount (empty deps — never keyed on `d`). `d`
  // starts as an estimated fallback position and corrects to the real
  // measured one within milliseconds of mount, then changes again on every
  // category switch; re-running this on those changes (it used to be keyed
  // on `d`) baked stroke-dasharray/dashoffset in from whatever the path's
  // length happened to be at that moment, then a "played once" guard blocked
  // ever recomputing it — so the dash values went stale against the real,
  // differently-sized path and rendered as a broken/dotted line forever.
  // Deferring getTotalLength() until the timeout actually fires (by which
  // time `delay` — always 1s+ — has long outlasted any early resize/reflow)
  // guarantees it reads the final, settled geometry. Hidden via opacity
  // until then, which doesn't care about path length at all.
  useLayoutEffect(() => {
    const path = ref.current
    if (!path || typeof path.getTotalLength !== 'function') {
      setShining(true)
      return undefined
    }
    path.style.opacity = '0'
    let raf
    let settleTimeout
    const startTimeout = setTimeout(() => {
      const length = path.getTotalLength()
      path.style.transition = 'none'
      path.style.strokeDasharray = `${length}`
      path.style.strokeDashoffset = `${length}`
      path.style.opacity = '0.75'
      raf = requestAnimationFrame(() => {
        path.style.transition = 'stroke-dashoffset 0.7s cubic-bezier(0.16, 1, 0.3, 1)'
        path.style.strokeDashoffset = '0'
      })
      settleTimeout = setTimeout(() => {
        path.style.transition = ''
        path.style.strokeDasharray = ''
        path.style.strokeDashoffset = ''
        setShining(true)
      }, 750)
    }, delay)
    return () => {
      clearTimeout(startTimeout)
      if (raf) cancelAnimationFrame(raf)
      if (settleTimeout) clearTimeout(settleTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (glowDelay == null) return undefined
    const timeout = setTimeout(() => {
      const path = ref.current
      if (!path) return
      path.style.opacity = '1'
      path.style.strokeWidth = '1.8'
      path.style.stroke = '#ffe3a3'
    }, glowDelay)
    return () => clearTimeout(timeout)
  }, [glowDelay])

  // Drive the traveling spark imperatively (getPointAtLength each frame)
  // instead of <animateMotion>/<mpath> — SMIL motion-path support is spotty
  // enough across browsers that it silently rendered nothing. This reuses
  // the same getTotalLength the draw-in above already relies on, so if the
  // line itself draws, the spark is guaranteed to move with it.
  useEffect(() => {
    if (!shining) return undefined
    const path = ref.current
    const spark = sparkRef.current
    if (!path || !spark || typeof path.getTotalLength !== 'function') return undefined
    let raf
    const tick = (now) => {
      const length = path.getTotalLength()
      const progress = (now % SPARK_MS) / SPARK_MS
      const point = path.getPointAtLength(progress * length)
      spark.setAttribute('cx', point.x)
      spark.setAttribute('cy', point.y)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // Reads the path's current geometry fresh every frame, so it doesn't
    // need to restart when `d` changes (e.g. a category switch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shining])

  return (
    <>
      <path
        ref={ref}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={0.75}
        vectorEffect="non-scaling-stroke"
      />
      {shining && (
        <>
          <path
            d={d}
            className="graph-shine"
            fill="none"
            stroke="url(#goldShine)"
            strokeWidth={2.2}
            vectorEffect="non-scaling-stroke"
            style={{ mixBlendMode: 'screen' }}
          />
          <circle ref={sparkRef} className="graph-spark" r="5" />
        </>
      )}
    </>
  )
}

function sameRects(a, b) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => b[key] && b[key].left === a[key].left && b[key].right === a[key].right && b[key].y === a[key].y)
}

export default function CategoryAuditGraph({ categories, audits, onSelect }) {
  const [selectedId, setSelectedId] = useState(null)
  const stageRef = useRef(null)
  const boxEls = useRef(new Map())
  const [boxRects, setBoxRects] = useState({})
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [showOrb, setShowOrb] = useState(true)
  const orbPlayedRef = useRef(false)

  // Categories/audits often arrive after an async fetch, so the first mount
  // can be the empty-state (no graph at all) — only start the hide timer once
  // the graph itself actually exists, not on that earlier empty-state paint.
  useEffect(() => {
    if (categories.length === 0 || orbPlayedRef.current) return undefined
    orbPlayedRef.current = true
    const timeout = setTimeout(() => setShowOrb(false), ORB_MS + 100)
    return () => clearTimeout(timeout)
  }, [categories.length])

  useLayoutEffect(() => {
    const stageEl = stageRef.current
    if (!stageEl) return undefined

    function measure() {
      const stageWidth = stageEl.offsetWidth
      const stageHeight = stageEl.offsetHeight
      if (stageWidth === 0 || stageHeight === 0) return
      setStageSize((prev) => (prev.width === stageWidth && prev.height === stageHeight ? prev : { width: stageWidth, height: stageHeight }))
      const next = {}
      boxEls.current.forEach((el, id) => {
        next[id] = {
          left: Math.round((el.offsetLeft / stageWidth) * 10000) / 100,
          right: Math.round(((el.offsetLeft + el.offsetWidth) / stageWidth) * 10000) / 100,
          // These boxes are already vertically centered on offsetTop via
          // their own CSS transform: translateY(-50%) — adding half the
          // height on top of that lands on the box's bottom edge, not its
          // middle, which is the "touches the end, not the middle" bug.
          y: Math.round((el.offsetTop / stageHeight) * 10000) / 100,
        }
      })
      setBoxRects((prev) => (sameRects(prev, next) ? prev : next))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(stageEl)
    return () => observer.disconnect()
  })

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

  if (!categories.length) {
    return <div className="empty-state">No categories yet — add one to populate the graph.</div>
  }

  const selected = categories.find((c) => c._id === selectedId) || categories[0]

  // Pin the selected tile to the middle slot so the sphere → tile → fan
  // line reads as one straight hub-and-spoke, whatever was clicked.
  const shown = categories.length <= 5
    ? categories.slice()
    : [selected, ...categories.filter((c) => c._id !== selected._id).slice(0, 4)]
  const tiles = shown.filter((c) => c._id !== selected._id)
  const middleIndex = Math.floor(shown.length / 2)
  tiles.splice(middleIndex, 0, selected)
  const tileGap = 9
  const tileY = (i) => HUB_Y + (i - middleIndex) * tileGap

  const rows = audits.filter((a) => a.categoryId === selected._id)
  const rowGap = rows.length > 1 ? (ROWS_Y[1] - ROWS_Y[0]) / (rows.length - 1) : 0
  const rowY = (i) => (rows.length > 1 ? ROWS_Y[0] + i * rowGap : 50)
  const selectedRect = boxRects[selected._id]
  const fanOrigin = { x: selectedRect ? selectedRect.right : TILE_X, y: selectedRect ? selectedRect.y : HUB_Y }
  const selectedGlowDelay = tileCardDelay(middleIndex) + CARD_MS + 150
  const rowsStartDelay = Math.max(selectedGlowDelay + 300, tileCardDelay(tiles.length - 1) + CARD_MS + 200)

  // Lines are built in real stage pixels, not raw 0-100 viewBox units — the
  // stage is almost never square, and stretching a 100x100 viewBox to fit it
  // (preserveAspectRatio="none") skews every curve non-uniformly. Combined
  // with vector-effect="non-scaling-stroke" that skew is what rendered as a
  // broken/dotted line: the stroke outline and the curve's own geometry
  // disagreed once one axis was stretched far more than the other.
  const pxX = (pct) => (pct / 100) * (stageSize.width || 1)
  const pxY = (pct) => (pct / 100) * (stageSize.height || 1)

  function pick(kind, node) {
    if (kind === 'category') setSelectedId(node._id)
    onSelect?.(kind, node)
  }

  return (
    <div className="graph-stage graph-stage--fullbleed" ref={stageRef}>
      {showOrb && (
        <div className="graph-orb-overlay" style={{ left: `${SPHERE.x}%`, top: `${SPHERE.y}%` }} />
      )}
      <div className="graph-sphere-halo" style={{ left: `${SPHERE.x}%`, top: `${SPHERE.y}%` }} />
      <div className="graph-sphere-label" style={{ left: `${SPHERE.x}%`, top: `${SPHERE.y}%` }}>
        {selected.name}
      </div>
      <div
        className="graph-node"
        title={selected.name}
        onClick={() => pick('category', selected)}
        style={{ left: `${SPHERE.x}%`, top: `${SPHERE.y}%`, width: 92, height: 92, marginLeft: -46, marginTop: -46 }}
      >
        <div className="graph-node-ring" />
        <div
          className="graph-node-sphere"
          style={{
            width: 78,
            height: 78,
            background: 'radial-gradient(circle at 35% 30%, #fff, #8a7af2 55%, #4e3fb8 100%)',
            boxShadow: '0 0 30px #8a7af2aa',
          }}
        />
      </div>
      <div className="gap-pill" style={{ left: `${SPHERE.x}%`, top: `${SPHERE.y}%` }}>
        GAPS {categoryStats[selected._id]?.total ?? 0}
      </div>

      <svg viewBox={`0 0 ${stageSize.width || 1} ${stageSize.height || 1}`} className="graph-svg">
        <defs>
          <linearGradient id="goldShine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff6de" stopOpacity="0" />
            <stop offset="45%" stopColor="#fff6de" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff6de" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#fff6de" stopOpacity="0" />
            <stop offset="100%" stopColor="#fff6de" stopOpacity="0" />
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="-1.5 0"
              to="1.5 0"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </linearGradient>
        </defs>
        {tiles.map((cat, i) => {
          const rect = boxRects[cat._id]
          const endX = rect ? rect.left : TILE_X
          const endY = rect ? rect.y : tileY(i)
          const isSelected = cat._id === selected._id
          return (
            <AnimatedLink
              key={cat._id}
              d={curvePath(pxX(SPHERE.x), pxY(SPHERE.y), pxX(endX), pxY(endY))}
              delay={tileLinkDelay(i)}
              glowDelay={isSelected ? selectedGlowDelay : null}
            />
          )
        })}
        {rows.map((a, i) => {
          const rect = boxRects[a._id]
          const endX = rect ? rect.left : CURVE_END_X
          const endY = rect ? rect.y : rowY(i)
          return (
            <AnimatedLink
              key={a._id}
              d={curvePath(pxX(fanOrigin.x), pxY(fanOrigin.y), pxX(endX), pxY(endY))}
              delay={rowsStartDelay + i * ROW_STEP_MS}
            />
          )
        })}
      </svg>

      {tiles.map((cat, i) => {
        const stats = categoryStats[cat._id]
        const isSelected = cat._id === selected._id
        const cardDelay = tileCardDelay(i)
        const style = {
          left: `${TILE_X}%`,
          top: `${tileY(i)}%`,
          animationName: isSelected ? 'graph-card-arrive, graph-select-glow' : 'graph-card-arrive',
          animationDuration: isSelected ? `${CARD_MS}ms, 650ms` : `${CARD_MS}ms`,
          animationDelay: isSelected ? `${cardDelay}ms, ${selectedGlowDelay}ms` : `${cardDelay}ms`,
          animationTimingFunction: isSelected
            ? 'cubic-bezier(0.22, 1, 0.36, 1), ease-out'
            : 'cubic-bezier(0.22, 1, 0.36, 1)',
          animationFillMode: 'both',
        }
        return (
          <button
            key={cat._id}
            ref={(el) => {
              if (el) boxEls.current.set(cat._id, el)
              else boxEls.current.delete(cat._id)
            }}
            title={cat.name}
            className={`graph-category-tile${isSelected ? ' is-selected' : ''}`}
            onClick={() => pick('category', cat)}
            style={style}
          >
            <Icon name={TILE_ICONS[i % TILE_ICONS.length]} size={16} />
            <span>
              <span className="graph-category-count">{stats.total}</span>
              <span className="graph-category-name">{cat.name}</span>
            </span>
          </button>
        )
      })}

      {rows.length === 0 && (
        <div
          className="empty-state graph-row-reveal"
          style={{
            position: 'absolute',
            left: `${ROW_TEXT_X}%`,
            top: '50%',
            transform: 'translateY(-50%)',
            animationDelay: `${rowsStartDelay + 150}ms`,
          }}
        >
          No audits in this category yet.
        </div>
      )}
      {rows.map((a, i) => {
        const score = a.result?.score
        const color = scoreColor(score)
        const title = a.status === 'completed' && a.result ? `Audit · score ${Math.round(score)}` : `Audit · ${a.status}`
        const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''
        return (
          <button
            key={a._id}
            ref={(el) => {
              if (el) boxEls.current.set(a._id, el)
              else boxEls.current.delete(a._id)
            }}
            title={title}
            className="graph-row"
            onClick={() => pick('audit', a)}
            style={{ left: `${ROW_TEXT_X}%`, top: `${rowY(i)}%`, animationDelay: `${rowsStartDelay + i * ROW_STEP_MS}ms` }}
          >
            <span className="graph-row-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
            <span>
              <span className="graph-row-title">{title}</span>
              <span className="graph-row-meta">{date}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
