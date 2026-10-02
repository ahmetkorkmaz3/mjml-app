import { describe, expect, it } from 'vitest'

import { formatShortcut } from './shortcut'

describe('formatShortcut', () => {
  it('uses the macOS symbols in the macOS order', () => {
    expect(formatShortcut('CmdOrCtrl+Shift+E', 'darwin')).toBe('⇧⌘E')
    expect(formatShortcut('CmdOrCtrl+Alt+P', 'darwin')).toBe('⌥⌘P')
    expect(formatShortcut('CmdOrCtrl+,', 'darwin')).toBe('⌘,')
  })

  it('uses words on Windows and Linux', () => {
    expect(formatShortcut('CmdOrCtrl+Shift+E', 'win32')).toBe('Ctrl+Shift+E')
    expect(formatShortcut('CmdOrCtrl+0', 'linux')).toBe('Ctrl+0')
  })

  it('gives an empty string without an accelerator', () => {
    expect(formatShortcut(undefined, 'darwin')).toBe('')
  })
})
