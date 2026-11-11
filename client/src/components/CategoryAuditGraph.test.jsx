import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CategoryAuditGraph from './CategoryAuditGraph'

describe('CategoryAuditGraph', () => {
  it('shows an empty state with no categories', () => {
    render(<CategoryAuditGraph categories={[]} audits={[]} />)
    expect(screen.getByText(/No categories yet/)).toBeInTheDocument()
  })

  it('renders the selected category plus only its matching audits', () => {
    const categories = [{ _id: 'c1', name: 'Sales' }]
    const audits = [
      { _id: 'a1', categoryId: 'c1', status: 'completed', result: { score: 92 } },
      { _id: 'a2', categoryId: 'does-not-exist', status: 'completed', result: { score: 10 } },
    ]
    render(<CategoryAuditGraph categories={categories} audits={audits} />)
    expect(screen.getAllByTitle('Sales').length).toBeGreaterThan(0)
    expect(screen.getByTitle('Audit · score 92')).toBeInTheDocument()
  })
})
