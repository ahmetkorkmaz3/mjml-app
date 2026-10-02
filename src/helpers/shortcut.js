const MAC_SYMBOLS = { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', CmdOrCtrl: '⌘', Cmd: '⌘' }
const MAC_ORDER = ['Ctrl', 'Alt', 'Shift', 'CmdOrCtrl', 'Cmd']

// formats an Electron accelerator for a tooltip
export function formatShortcut(accelerator, platform) {
  if (!accelerator) {
    return ''
  }
  const parts = accelerator.split('+')
  const key = parts.pop() || '+'
  if (platform === 'darwin') {
    const modifiers = MAC_ORDER.filter(m => parts.includes(m)).map(m => MAC_SYMBOLS[m])
    return [...modifiers, key].join('')
  }
  return [...parts.map(m => (m === 'CmdOrCtrl' || m === 'Cmd' ? 'Ctrl' : m)), key].join('+')
}
