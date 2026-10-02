// The theme setting is 'system', 'light' or 'dark'. 'system' (and any
// unknown value) follows the appearance of the operating system.
export function resolveTheme(setting, systemIsDark) {
  if (setting === 'light' || setting === 'dark') {
    return setting
  }
  return systemIsDark ? 'dark' : 'light'
}
