import { describe, expect, it, vi } from 'vitest'

import { registerCommand, runCommand } from './commands'

describe('commands', () => {
  it('runs the registered handler', () => {
    const handler = vi.fn()
    const unregister = registerCommand('test-a', handler)
    expect(runCommand('test-a')).toBe(true)
    expect(handler).toHaveBeenCalledOnce()
    unregister()
  })

  it('returns false for a command without a handler', () => {
    expect(runCommand('test-missing')).toBe(false)
  })

  it('uses the last registered handler, and unregister keeps a newer one', () => {
    const first = vi.fn()
    const second = vi.fn()
    const unregisterFirst = registerCommand('test-b', first)
    const unregisterSecond = registerCommand('test-b', second)
    unregisterFirst()
    runCommand('test-b')
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
    unregisterSecond()
    expect(runCommand('test-b')).toBe(false)
  })
})
