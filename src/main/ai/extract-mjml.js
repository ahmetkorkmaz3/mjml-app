const FENCE_RE = /```[^\n]*\n([\s\S]*?)```/g

function findDocument(text) {
  const start = text.indexOf('<mjml')
  const end = text.lastIndexOf('</mjml>')
  if (start === -1 || end === -1 || end < start) {
    return null
  }
  return text.slice(start, end + '</mjml>'.length).trim()
}

// Takes the MJML document out of a model reply. Returns null when the reply
// has no complete document (for example when the output was cut).
export function extractMjml(text) {
  if (!text) {
    return null
  }
  for (const [, body] of text.matchAll(FENCE_RE)) {
    const doc = findDocument(body)
    if (doc) {
      return doc
    }
  }
  return findDocument(text)
}
