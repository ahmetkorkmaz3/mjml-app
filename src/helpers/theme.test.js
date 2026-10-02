import { describe, expect, it } from 'vitest'

import { resolveTheme } from './theme'

describe('resolveTheme', () => {
  it('keeps an explicit theme', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('follows the system for "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('follows the system for an unknown value', () => {
    expect(resolveTheme(undefined, true)).toBe('dark')
    expect(resolveTheme('blue', false)).toBe('light')
  })
})
