// the reason why a new project name is not valid, or null when it is valid
// the name must stay in the same folder, so path separators and `..` are refused
export function getProjectNameError(name) {
  const trimmed = (name || '').trim()
  if (!trimmed) {
    return 'Type a name'
  }
  if (/[\\/]/.test(trimmed)) {
    return 'The name cannot contain / or \\'
  }
  if (trimmed === '.' || trimmed === '..') {
    return 'The name cannot be . or ..'
  }
  return null
}
