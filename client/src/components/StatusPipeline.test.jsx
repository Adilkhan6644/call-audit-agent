import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusPipeline from './StatusPipeline'

function stageClasses(container) {
  return [...container.querySelectorAll('.stage')].map((el) => el.className)
}

describe('StatusPipeline', () => {
  it('marks only Queued active while pending', () => {
    const { container } = render(<StatusPipeline status="pending" />)
    const classes = stageClasses(container)
    expect(classes[0]).toContain('active')
    expect(classes[1]).not.toContain('active')
  })

  it('marks every stage done when completed', () => {
    const { container } = render(<StatusPipeline status="completed" />)
    expect(stageClasses(container).every((c) => c.includes('done'))).toBe(true)
  })

  it('marks Queued and Transcribing failed when failed', () => {
    const { container } = render(<StatusPipeline status="failed" />)
    const classes = stageClasses(container)
    expect(classes[0]).toContain('failed')
    expect(classes[1]).toContain('failed')
    expect(classes[2]).not.toContain('failed')
  })
})
