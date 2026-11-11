import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CategoryAuditGraph from './CategoryAuditGraph'

describe('CategoryAuditGraph', () => {
  it('shows an empty state with no categories', () => {
    render(<CategoryAuditGraph categories={[]} audits={[]} />)
    expect(screen.getByText(/No categories yet/)).toBeInTheDocument()
  })

  it('renders a node per category and per matching audit', async () => {
    const categories = [{ _id: 'c1', name: 'Sales' }]
    const audits = [
      { _id: 'a1', categoryId: 'c1', status: 'completed', result: { score: 92 } },
      { _id: 'a2', categoryId: 'does-not-exist', status: 'completed', result: { score: 10 } },
    ]
    const { container } = render(<CategoryAuditGraph categories={categories} audits={audits} />)
    await waitFor(() => expect(container.querySelectorAll('[title]').length).toBe(2))
  })
})
