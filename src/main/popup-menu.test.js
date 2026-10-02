import { describe, expect, it, vi } from 'vitest'

import { toPopupTemplate } from './popup-menu'

describe('toPopupTemplate', () => {
  it('gives each item a click that chooses its id', () => {
    const onChoose = vi.fn()
    const [open] = toPopupTemplate([{ id: 'open', label: 'Open' }], onChoose)
    open.click()
    expect(onChoose).toHaveBeenCalledWith('open')
  })

  it('keeps the separators and the enabled state', () => {
    const t = toPopupTemplate(
      [{ id: 'a', label: 'A', enabled: false }, { type: 'separator' }, { id: 'b', label: 'B' }],
      vi.fn(),
    )
    expect(t[0].enabled).toBe(false)
    expect(t[1]).toEqual({ type: 'separator' })
    expect(t[2].enabled).toBe(true)
  })

  it('makes an item with `checked` a checkbox item', () => {
    const [item] = toPopupTemplate([{ id: 'a', label: 'A', checked: true }], vi.fn())
    expect(item.type).toBe('checkbox')
    expect(item.checked).toBe(true)
  })

  it('drops the items without an id or a label', () => {
    expect(toPopupTemplate([{ label: 'No id' }, { id: 'x' }, null], vi.fn())).toEqual([])
  })

  it('gives an empty menu for a value that is not an array', () => {
    expect(toPopupTemplate('open', vi.fn())).toEqual([])
  })
})
