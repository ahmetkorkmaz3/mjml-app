import { describe, expect, it } from 'vitest'

import { fitPreviewWidth } from './layout'

describe('fitPreviewWidth', () => {
  it('keeps the saved width when there is room for the editor', () => {
    expect(fitPreviewWidth(500, 1200, { min: 320, editorMin: 320 })).toBe(500)
  })

  it('makes the preview smaller so the editor keeps its minimum width', () => {
    expect(fitPreviewWidth(500, 740, { min: 320, editorMin: 320 })).toBe(420)
  })

  it('does not go under the minimum preview width', () => {
    expect(fitPreviewWidth(500, 500, { min: 320, editorMin: 320 })).toBe(320)
  })

  it('keeps the saved width before the first measure', () => {
    expect(fitPreviewWidth(500, 0, { min: 320, editorMin: 320 })).toBe(500)
  })
})
