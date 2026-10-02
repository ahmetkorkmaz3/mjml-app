import mjml2html from 'mjml'

import { includePathFor } from '../../preload/mjml-helpers'

// Compiles MJML in the main process. `filePath` lets mj-include and relative
// paths resolve from the project folder. With `rootPath`, mj-include can also
// read the files of the project folder (for example `../header.mjml`).
export async function validateMjml(content, filePath, rootPath) {
  const includePath = includePathFor(filePath, rootPath)
  try {
    const res = await mjml2html(content, {
      filePath,
      validationLevel: 'soft',
      ignoreIncludes: false,
      ...(includePath ? { includePath } : {}),
    })
    return {
      html: res.html || '',
      errors: (res.errors || []).map(({ line, message, tagName }) => ({ line, message, tagName })),
    }
  } catch (err) {
    return { html: '', errors: [{ line: null, message: err.message, tagName: null }] }
  }
}
