// Reads the file key and the node id from a Figma link, for example
// https://www.figma.com/design/<fileKey>/<name>?node-id=12-34
// The link has `12-34`, the Figma API uses `12:34`.
const PATH_RE = /^\/(?:design|file|proto)\/([A-Za-z0-9]+)(?:\/branch\/([A-Za-z0-9]+))?/
const NODE_ID_RE = /^\d+[-:]\d+$/

export function parseFigmaUrl(link) {
  let url
  try {
    url = new URL(String(link).trim())
  } catch (err) {
    return null
  }
  if (url.hostname !== 'figma.com' && !url.hostname.endsWith('.figma.com')) {
    return null
  }
  const match = url.pathname.match(PATH_RE)
  if (!match) {
    return null
  }
  const nodeId = url.searchParams.get('node-id')
  if (!nodeId || !NODE_ID_RE.test(nodeId)) {
    return null
  }
  return { fileKey: match[2] || match[1], nodeId: nodeId.replace('-', ':') }
}
