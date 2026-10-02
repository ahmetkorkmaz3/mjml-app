// Checks the new name of a file. Returns the reason to refuse it, or null.
export function checkNewName(name) {
  const value = String(name || '').trim()
  if (!value) {
    return 'The name cannot be empty.'
  }
  if (/[\\/]/.test(value)) {
    return 'The name cannot contain "/" or "\\".'
  }
  if (value === '.' || value === '..') {
    return 'This name is not valid.'
  }
  return null
}

// Only the letter case changes. On macOS and Windows the file system finds the
// old file with the new name, so a check of existence is not correct.
export function isCaseChange(oldName, newName) {
  return oldName !== newName && oldName.toLowerCase() === newName.toLowerCase()
}
