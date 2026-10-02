import { describe, expect, it } from 'vitest'

import { fitBounds } from './window-bounds'

const displays = [{ workArea: { x: 0, y: 25, width: 1440, height: 875 } }]
const defaults = { width: 1280, height: 800 }

describe('fitBounds', () => {
  it('keeps saved bounds that are on a display', () => {
    const saved = { x: 100, y: 100, width: 1000, height: 700 }
    expect(fitBounds(saved, displays, defaults)).toEqual(saved)
  })

  it('gives the default size without a position when nothing is saved', () => {
    expect(fitBounds(undefined, displays, defaults)).toEqual(defaults)
    expect(fitBounds({}, displays, defaults)).toEqual(defaults)
  })

  it('gives the default size when the saved window is on a missing display', () => {
    const saved = { x: 3000, y: 200, width: 1000, height: 700 }
    expect(fitBounds(saved, displays, defaults)).toEqual(defaults)
  })

  it('keeps a window that is partly on a display, when its top bar is visible', () => {
    const saved = { x: 1200, y: 100, width: 1000, height: 700 }
    expect(fitBounds(saved, displays, defaults)).toEqual(saved)
  })

  it('makes a saved window smaller than the work area fit', () => {
    const saved = { x: 0, y: 25, width: 3000, height: 2000 }
    expect(fitBounds(saved, displays, defaults)).toEqual({ x: 0, y: 25, width: 1440, height: 875 })
  })
})
