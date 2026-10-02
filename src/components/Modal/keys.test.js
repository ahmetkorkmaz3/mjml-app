import { describe, expect, it } from 'vitest'

import { createModalStack, isEnterTarget } from './keys'

describe('createModalStack', () => {
  it('gives the keys to the last opened modal only', () => {
    const stack = createModalStack()
    const send = {}
    const error = {}
    stack.push(send)
    stack.push(error)
    expect(stack.isTop(error)).toBe(true)
    expect(stack.isTop(send)).toBe(false)
    stack.remove(error)
    expect(stack.isTop(send)).toBe(true)
  })

  it('ignores a modal that is not in the stack', () => {
    const stack = createModalStack()
    stack.remove({})
    expect(stack.isTop({})).toBe(false)
  })
})

describe('isEnterTarget', () => {
  it('accepts the text fields and the dialog itself', () => {
    expect(isEnterTarget({ tagName: 'INPUT', type: 'text' })).toBe(true)
    expect(isEnterTarget({ tagName: 'INPUT', type: 'email' })).toBe(true)
    expect(isEnterTarget({ tagName: 'INPUT', type: 'number' })).toBe(true)
    expect(isEnterTarget({ tagName: 'DIV', role: 'dialog' })).toBe(true)
  })

  it('refuses the controls that have their own Enter action', () => {
    expect(isEnterTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isEnterTarget({ tagName: 'TEXTAREA' })).toBe(false)
    expect(isEnterTarget({ tagName: 'A' })).toBe(false)
    expect(isEnterTarget({ tagName: 'DIV', role: 'tab' })).toBe(false)
    expect(isEnterTarget({ tagName: 'DIV', role: 'radio' })).toBe(false)
    expect(isEnterTarget({ tagName: 'DIV', role: 'checkbox' })).toBe(false)
    expect(isEnterTarget({ tagName: 'DIV' })).toBe(false)
    expect(isEnterTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(false)
  })
})
