// Builds file URLs for the local files of the preview (images, backgrounds).
// No Node.js here: the renderer uses it.

// a scheme (http:, data:, file:...), a protocol-relative URL, an anchor,
// or a template tag ({{ }}, <% %>)
const NOT_RELATIVE_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\{\{|<%|\$)/i

const CSS_URL_REGEX = /url\(\s*(["']?)(.*?)\1\s*\)/gi

// Turns an absolute path into a file URL. Each segment is encoded, so a space,
// a "#" or a "?" in a name stays part of the path. A Windows drive gives
// file:///C:/..., a UNC path (\\server\share) gives file://server/share.
export function pathToFileURL(p) {
  let value = String(p).replace(/\\/g, '/')
  let host = ''
  if (value.startsWith('//')) {
    const [server, ...rest] = value.slice(2).split('/')
    host = server
    value = `/${rest.join('/')}`
  } else if (/^[a-z]:/i.test(value)) {
    value = `/${value}`
  }
  const encoded = value
    .split('/')
    .map((segment, i) =>
      i === 1 && /^[a-z]:$/i.test(segment) ? segment : encodeURIComponent(segment),
    )
    .join('/')
  return `file://${host}${encoded}`
}

// joins a relative path to a folder, with "." and ".." resolved
function joinPath(base, relative) {
  const normalized = String(base).replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = normalized.split('/')
  // keep the root ("", "C:" or the UNC start)
  const rootLength = normalized.startsWith('//') ? 4 : 1
  for (const part of relative.split(/[\\/]+/)) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (parts.length > rootLength) parts.pop()
    } else {
      parts.push(part)
    }
  }
  return parts.join('/')
}

// The file URL of a relative reference of the HTML (for example
// "images/logo.png?v=2"), or null when the value is not a relative path.
export function resolveFileURL(base, value) {
  const raw = String(value || '').trim()
  if (!base || !raw || NOT_RELATIVE_REGEX.test(raw)) {
    return null
  }
  // the HTML has a URL: the query and the hash are not part of the file name
  const cut = raw.search(/[?#]/)
  const pathPart = cut > -1 ? raw.slice(0, cut) : raw
  const suffix = cut > -1 ? raw.slice(cut) : ''
  // an absolute path (POSIX, Windows drive or UNC) is not relative
  if (!pathPart || /^(?:[\\/]|[a-z]:[\\/])/i.test(pathPart)) {
    return null
  }
  let decoded
  try {
    decoded = decodeURIComponent(pathPart)
  } catch (err) {
    decoded = pathPart
  }
  return `${pathToFileURL(joinPath(base, decoded))}${suffix}`
}

// rewrites the relative url(...) of a CSS text (a style attribute)
export function rewriteCssUrls(css, base) {
  return String(css || '').replace(CSS_URL_REGEX, (match, quote, value) => {
    const url = resolveFileURL(base, value)
    // quoted, so a "(" in the URL does not end it
    const q = quote || '"'
    return url ? `url(${q}${url}${q})` : match
  })
}
