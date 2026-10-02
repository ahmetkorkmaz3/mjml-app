import { path } from 'helpers/api'
import { copyAssets, writeFile } from 'helpers/fs'
import { findLocalAssets } from 'helpers/local-assets'

// Writes the HTML to `filePath` and copies the local files that it uses
// (images...) from `sourceDir`, so the links of the HTML stay correct.
export async function exportHTML(html, sourceDir, filePath) {
  await writeFile(filePath, html)
  return copyAssets(sourceDir, path.dirname(filePath), findLocalAssets(html))
}

// the text of the alert after an export
export function exportMessage(what, { copied, missing }) {
  const lines = [copied ? `${what} and ${copied} linked file(s)` : what]
  if (missing.length) {
    lines.push('These linked files do not exist:', ...missing.map(m => `■ ${m}`))
  }
  return lines.length > 1 ? lines : lines[0]
}
