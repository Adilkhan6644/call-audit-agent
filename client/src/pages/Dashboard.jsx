import { useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import CategoryAuditGraph from '../components/CategoryAuditGraph'
import AskAgentBar from '../components/AskAgentBar'
import Icon from '../components/icons'

export default function Dashboard() {
  const navigate = useNavigate()
  const { setSelection, setHeaderExtra, data } = useOutletContext()
  const { categories, audits } = data

  // The header's toolbar group + primary action are page-specific, so the
  // graph page hands them up to Shell's header slot instead of Shell owning
  // graph-only concepts.
  useEffect(() => {
    setHeaderExtra({
      toolbar: (
        <div className="toolbar-icon-group">
          <button className="icon-button is-active" title="Graph view"><Icon name="layers" size={16} /></button>
          <button className="icon-button" title="Zoom in"><Icon name="zoomIn" size={16} /></button>
          <button className="icon-button" title="Zoom out"><Icon name="zoomOut" size={16} /></button>
          <button className="icon-button" title="Filter">
            <Icon name="filter" size={16} />
            <span className="icon-badge">{categories.length}</span>
          </button>
          <button className="icon-button" title="Sort">
            <Icon name="sort" size={16} />
            <span className="icon-badge">{audits.length}</span>
          </button>
          <button className="icon-button" title="Export"><Icon name="export" size={16} /></button>
        </div>
      ),
      action: (
        <button className="outline-button" onClick={() => navigate('/audits/new')}>
          <Icon name="play" size={14} /> New Audit
        </button>
      ),
    })
    return () => setHeaderExtra(null)
  }, [categories.length, audits.length, navigate, setHeaderExtra])

  function onSelect(kind, node) {
    if (kind === 'category') {
      const stats = audits.filter((a) => a.categoryId === node._id)
      const completed = stats.filter((a) => a.status === 'completed' && a.result)
      const avg = completed.length
        ? Math.round(completed.reduce((s, a) => s + a.result.score, 0) / completed.length)
        : null
      setSelection({
        kicker: 'Category',
        icon: 'folder',
        title: node.name,
        subtitle: `${stats.length} audit${stats.length === 1 ? '' : 's'} in this category.`,
        badge: { label: avg != null ? `Avg ${avg}` : 'No audits yet', tone: 'completed' },
        meta: `${completed.length} completed`,
        actionLabel: 'View audits',
        onAction: () => navigate('/audits/new'),
      })
    } else {
      const label = node.status === 'completed' && node.result ? `Score ${Math.round(node.result.score)}` : node.status
      setSelection({
        kicker: 'Audit',
        icon: 'play',
        title: `Audit · ${label}`,
        subtitle: node.result?.summary || 'No summary available.',
        badge: { label: node.status, tone: node.status },
        meta: node.createdAt ? `Run ${new Date(node.createdAt).toLocaleDateString()}` : null,
        actionLabel: 'Explore details',
        onAction: () => navigate(`/audits/${node._id}`),
      })
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <div className="toolbar-pill-float">
        <Icon name="search" size={13} style={{ color: '#7fa2c2' }} />
        KPI overview — {categories.length} categories, {audits.length} audits analyzed
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <CategoryAuditGraph categories={categories} audits={audits} onSelect={onSelect} />
      </div>

      <div style={{ padding: '14px 24px' }}>
        <AskAgentBar />
      </div>
    </div>
  )
}
