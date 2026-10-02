const THEME_SETTINGS = ['system', 'light', 'dark']

export function normalizeThemeSetting(value) {
  return THEME_SETTINGS.includes(value) ? value : 'system'
}

// the colors of the window background and of the Windows/Linux window buttons,
// the same values as --bg-window and --fg in src/styles/tokens.scss
export function windowColors(isDark) {
  return isDark
    ? { background: '#1e1f24', symbol: '#e6e6ea' }
    : { background: '#f5f5f7', symbol: '#1d1d1f' }
}
