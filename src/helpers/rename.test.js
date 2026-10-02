import { describe, expect, it } from 'vitest'

import { checkNewName, isCaseChange } from './rename'

describe('checkNewName', () => {
  it('accepts a normal name', () => {
    expect(checkNewName('footer.mjml')).toBe(null)
  })

  it('refuses an empty name', () => {
    expect(checkNewName('')).toMatch(/empty/)
    expect(checkNewName('   ')).toMatch(/empty/)
  })

  it('refuses the path separators', () => {
    expect(checkNewName('a/b.mjml')).toMatch(/cannot contain/)
    expect(checkNewName('..\\b.mjml')).toMatch(/cannot contain/)
  })

  it('refuses . and ..', () => {
    expect(checkNewName('..')).toMatch(/not valid/)
  })
})

describe('isCaseChange', () => {
  it('is true when only the letter case changes', () => {
    expect(isCaseChange('index.mjml', 'Index.mjml')).toBe(true)
    expect(isCaseChange('index.mjml', 'index.mjml')).toBe(false)
    expect(isCaseChange('index.mjml', 'footer.mjml')).toBe(false)
  })
})
