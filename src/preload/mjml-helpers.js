// Pure helpers of the MJML rendering (no Electron, so the tests can use them).

// A partial file (a header, a footer) is wrapped in <mjml><mj-body> before it
// renders. Its first line is then line 3 of the rendered document.
export const WRAPPER_LINES = 2

export function wrapIntoMJMLTags(content) {
  return `<mjml>
  <mj-body>
    ${content}
  </mj-body>
</mjml>`
}

function isInside(root, filePath) {
  const normalize = p => String(p).replace(/\\/g, '/').replace(/\/+$/, '')
  const r = normalize(root)
  const f = normalize(filePath)
  return f === r || f.startsWith(`${r}/`)
}

// The folders where mj-include can read files. MJML 5 allows only the folder
// of the file, so `../header.mjml` is denied. The project folder is allowed
// too, when the file is in it.
export function includePathFor(filePath, rootPath) {
  if (!rootPath || !filePath || !isInside(rootPath, filePath)) {
    return undefined
  }
  return [rootPath]
}

const INCLUDED_REGEX = /^Line \S+ of (.*?), included at /

// the name of the included file that has the error, or null
function includedFileName(err) {
  const match = INCLUDED_REGEX.exec(err.formattedMessage || '')
  if (!match) {
    return null
  }
  return match[1].split(/[\\/]/).pop() || match[1]
}

// Gives the errors of mjml2html with the lines of the open file. The errors of
// an included file have no line in the open file: their message names the file.
export function mapErrors(errors, { lineOffset = 0 } = {}) {
  return (errors || []).map(err => {
    const { message, tagName = null } = err
    const included = includedFileName(err)
    if (included) {
      return { line: null, message: `${included}, line ${err.line}: ${message}`, tagName }
    }
    const line = typeof err.line === 'number' ? err.line - lineOffset : null
    return { line: line > 0 ? line : null, message, tagName }
  })
}
