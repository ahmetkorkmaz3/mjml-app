import { describe, expect, it } from 'vitest'

import { getProjectNameError } from './projectName'

describe('getProjectNameError', () => {
  it('accepts a simple name', () => {
    expect(getProjectNameError('my email')).toBe(null)
    expect(getProjectNameError('v1..2')).toBe(null)
  })

  it('refuses an empty name', () => {
    expect(getProjectNameError('')).not.toBe(null)
    expect(getProjectNameError('   ')).not.toBe(null)
    expect(getProjectNameError(undefined)).not.toBe(null)
  })

  it('refuses path separators and dot names', () => {
    expect(getProjectNameError('../x')).not.toBe(null)
    expect(getProjectNameError('a/b')).not.toBe(null)
    expect(getProjectNameError('a\\b')).not.toBe(null)
    expect(getProjectNameError('..')).not.toBe(null)
    expect(getProjectNameError('.')).not.toBe(null)
  })
})
