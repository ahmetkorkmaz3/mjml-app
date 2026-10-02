import { describe, expect, it } from 'vitest'

import { normalizeThemeSetting, windowColors } from './theme'

describe('normalizeThemeSetting', () => {
  it('keeps the known values', () => {
    expect(normalizeThemeSetting('light')).toBe('light')
    expect(normalizeThemeSetting('dark')).toBe('dark')
    expect(normalizeThemeSetting('system')).toBe('system')
  })

  it('gives "system" for other values', () => {
    expect(normalizeThemeSetting(undefined)).toBe('system')
    expect(normalizeThemeSetting(42)).toBe('system')
  })
})

describe('windowColors', () => {
  it('gives the window colors of each theme', () => {
    expect(windowColors(true)).toEqual({ background: '#1e1f24', symbol: '#e6e6ea' })
    expect(windowColors(false)).toEqual({ background: '#f5f5f7', symbol: '#1d1d1f' })
  })
})
