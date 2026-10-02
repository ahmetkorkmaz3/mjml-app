const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const ago = (n, word) => `${n} ${word}${n === 1 ? '' : 's'} ago`

export function formatRelativeTime(time, now) {
  if (time === null || time === undefined) return ''
  const diff = now - time
  if (diff < MIN) return 'just now'
  if (diff < HOUR) return ago(Math.floor(diff / MIN), 'minute')
  if (diff < DAY) return ago(Math.floor(diff / HOUR), 'hour')
  if (diff < 2 * DAY) return 'yesterday'
  if (diff < 30 * DAY) return ago(Math.floor(diff / DAY), 'day')
  return new Date(time).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// the parent folder of a project, with ~ for the home folder
export function displayPath(p, homedir, sep) {
  const parent = p.slice(0, p.lastIndexOf(sep)) || sep
  if (parent === homedir) return '~'
  if (parent.startsWith(homedir + sep)) return `~${parent.slice(homedir.length)}`
  return parent
}

function baseName(p) {
  return p.split(/[\\/]/).pop()
}

export function sortProjects(projects, sort) {
  const list = [...projects]
  if (sort === 'name') {
    return list.sort((a, b) =>
      baseName(a.path).localeCompare(baseName(b.path), undefined, { sensitivity: 'base' }),
    )
  }
  if (sort === 'modified') {
    return list.sort((a, b) => (b.mtime ?? -Infinity) - (a.mtime ?? -Infinity))
  }
  return list
}

// the selection after a click, with the Finder rules (Cmd/Ctrl toggles, Shift selects a range)
export function nextSelection({ selected, clicked, ordered, anchor, meta, shift }) {
  if (shift && ordered.includes(anchor)) {
    const [from, to] = [ordered.indexOf(anchor), ordered.indexOf(clicked)].sort((a, b) => a - b)
    return { selected: ordered.slice(from, to + 1), anchor }
  }
  if (meta) {
    const next = selected.includes(clicked)
      ? selected.filter(p => p !== clicked)
      : [...selected, clicked]
    return { selected: next, anchor: clicked }
  }
  return { selected: [clicked], anchor: clicked }
}
