import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CategoryAuditGraph from './CategoryAuditGraph'

function stubOffsets(rules) {
  const props = ['offsetLeft', 'offsetTop', 'offsetWidth', 'offsetHeight']
  const originals = props.map((p) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, p))
  props.forEach((prop) => {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get() {
        const rule = rules.find((r) => this.classList.contains(r.selector))
        return rule ? rule[prop] : 0
      },
    })
  })
  return () => props.forEach((prop, i) => Object.defineProperty(HTMLElement.prototype, prop, originals[i]))
}

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

  it('ends the incoming line at the tile\'s real measured left edge and starts the outgoing fan at its right edge', () => {
    const restore = stubOffsets([
      { selector: 'graph-stage', offsetLeft: 0, offsetTop: 0, offsetWidth: 1000, offsetHeight: 600 },
      { selector: 'graph-category-tile', offsetLeft: 300, offsetTop: 270, offsetWidth: 200, offsetHeight: 60 },
    ])

    const categories = [{ _id: 'c1', name: 'Sales' }]
    const audits = [{ _id: 'a1', categoryId: 'c1', status: 'completed', result: { score: 92 } }]
    const { container } = render(<CategoryAuditGraph categories={categories} audits={audits} />)

    // Each link renders a base path plus (once drawn in) a duplicate shine
    // path with the same d — exclude the shine so indices line up 1:1 with
    // links. Tile line is drawn before the row line in document order.
    const [sphereLineD, rowLineD] = Array.from(container.querySelectorAll('.graph-svg path:not(.graph-shine)')).map(
      (p) => p.getAttribute('d')
    )

    restore()

    // Lines are built in real stage pixels (stage is 1000x600 here). The tile
    // is already vertically centered on offsetTop via its own CSS
    // translateY(-50%), so the line's y is offsetTop itself (270), not
    // offsetTop + height/2 (which would land on the box's bottom edge
    // instead of its middle). Incoming line ends at the left edge (300);
    // outgoing fan starts at the right edge (500).
    const sphereLineEnd = sphereLineD.trim().split(/\s+/).slice(-2).join(' ')
    const rowLineStart = rowLineD.trim().split(/\s+/).slice(1, 3).join(' ')
    expect(sphereLineEnd).toBe('300 270')
    expect(rowLineStart).toBe('500 270')
  })

  it('ends the fan line at the audit row\'s real measured left edge too', () => {
    const restore = stubOffsets([
      { selector: 'graph-stage', offsetLeft: 0, offsetTop: 0, offsetWidth: 1000, offsetHeight: 600 },
      { selector: 'graph-category-tile', offsetLeft: 300, offsetTop: 270, offsetWidth: 200, offsetHeight: 60 },
      { selector: 'graph-row', offsetLeft: 700, offsetTop: 54, offsetWidth: 200, offsetHeight: 30 },
    ])

    const categories = [{ _id: 'c1', name: 'Sales' }]
    const audits = [{ _id: 'a1', categoryId: 'c1', status: 'completed', result: { score: 92 } }]
    const { container } = render(<CategoryAuditGraph categories={categories} audits={audits} />)

    const [, rowLineD] = Array.from(container.querySelectorAll('.graph-svg path:not(.graph-shine)')).map((p) =>
      p.getAttribute('d')
    )

    restore()

    // Row left edge: 700; y is offsetTop itself (54) — the row is already
    // centered on it via translateY(-50%).
    const rowLineEnd = rowLineD.trim().split(/\s+/).slice(-2).join(' ')
    expect(rowLineEnd).toBe('700 54')
  })

  it('does not use a stale shrunk-by-transform rect while the entrance animation is still running', () => {
    const restore = stubOffsets([
      { selector: 'graph-stage', offsetLeft: 0, offsetTop: 0, offsetWidth: 1000, offsetHeight: 600 },
      { selector: 'graph-category-tile', offsetLeft: 300, offsetTop: 270, offsetWidth: 200, offsetHeight: 60 },
    ])
    const originalRect = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList.contains('graph-category-tile')) return { left: 370, top: 295, width: 30, height: 10 }
      return { left: 0, top: 0, width: 0, height: 0 }
    }

    const categories = [{ _id: 'c1', name: 'Sales' }]
    const audits = [{ _id: 'a1', categoryId: 'c1', status: 'completed', result: { score: 92 } }]
    const { container } = render(<CategoryAuditGraph categories={categories} audits={audits} />)

    const [sphereLineD] = Array.from(container.querySelectorAll('.graph-svg path:not(.graph-shine)')).map((p) =>
      p.getAttribute('d')
    )

    HTMLElement.prototype.getBoundingClientRect = originalRect
    restore()

    expect(sphereLineD.trim().split(/\s+/).slice(-2).join(' ')).toBe('300 270')
  })
})
