import { describe, expect, it } from 'vitest'

import { validateMjml } from './validate-mjml'

describe('validateMjml', () => {
  it('returns HTML and no errors for valid MJML', async () => {
    const res = await validateMjml(
      '<mjml><mj-body><mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-body></mjml>',
    )
    expect(res.errors).toEqual([])
    expect(res.html).toContain('Hi')
  })

  it('returns the errors of wrong nesting', async () => {
    const res = await validateMjml(
      '<mjml><mj-body><mj-column><mj-text>Hi</mj-text></mj-column></mj-body></mjml>',
    )
    expect(res.errors.length).toBeGreaterThan(0)
    expect(res.errors[0].message).toContain('cannot be used inside')
    expect(res.errors[0]).toHaveProperty('line')
  })
})
