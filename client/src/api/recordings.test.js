import { describe, it, expect } from 'vitest'
import { validateFileLocally } from './recordings'

function fakeFile(name, size, type = 'audio/mpeg') {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('validateFileLocally', () => {
  it('accepts an allowed extension under the size limit', () => {
    expect(validateFileLocally(fakeFile('call.mp3', 1024))).toBeNull()
  })

  it('rejects a disallowed extension', () => {
    expect(validateFileLocally(fakeFile('call.exe', 1024))).toMatch(/Unsupported file type/)
  })

  it('rejects an oversized file', () => {
    expect(validateFileLocally(fakeFile('call.wav', 200 * 1024 * 1024))).toMatch(/100MB/)
  })
})
