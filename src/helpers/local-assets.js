// The HTML of a project can use local files (for example the images of a
// Figma import in `images/`). When the HTML goes to another folder, these
// files must go with it, or the links break.

const ATTRIBUTE_REGEX = /\b(?:src|href|background)\s*=\s*(["'])(.*?)\1/gi
const CSS_URL_REGEX = /url\(\s*(["']?)(.*?)\1\s*\)/gi

// a scheme (http:, data:, mailto:...), a protocol-relative URL, an anchor,
// or a template tag ({{ }}, <% %>)
const NOT_LOCAL_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\{\{|<%|\$)/i

function toRelativePath(value) {
  let p = value.trim().replace(/[?#].*$/, '')
  if (!p || NOT_LOCAL_REGEX.test(p)) {
    return null
  }
  try {
    p = decodeURIComponent(p)
  } catch (err) {
    return null
  }
  // absolute paths (POSIX, Windows drive or UNC) stay as they are
  if (p.startsWith('/') || p.startsWith('\\') || /^[a-z]:[\\/]/i.test(p)) {
    return null
  }
  const parts = []
  for (const part of p.split(/[\\/]+/)) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      // the file is out of the folder of the HTML
      if (!parts.length) return null
      parts.pop()
    } else {
      parts.push(part)
    }
  }
  return parts.length ? parts.join('/') : null
}

// the relative paths of the local files that the HTML uses, without duplicates
export function findLocalAssets(html) {
  const found = new Set()
  for (const regex of [ATTRIBUTE_REGEX, CSS_URL_REGEX]) {
    for (const match of String(html || '').matchAll(regex)) {
      const p = toRelativePath(match[2])
      if (p) found.add(p)
    }
  }
  return [...found]
}
