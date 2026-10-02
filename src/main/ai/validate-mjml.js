import mjml2html from 'mjml'

// Compiles MJML in the main process. `filePath` lets mj-include and relative
// paths resolve from the project folder.
export async function validateMjml(content, filePath) {
  try {
    const res = await mjml2html(content, {
      filePath,
      validationLevel: 'soft',
      ignoreIncludes: false,
    })
    return {
      html: res.html || '',
      errors: (res.errors || []).map(({ line, message, tagName }) => ({ line, message, tagName })),
    }
  } catch (err) {
    return { html: '', errors: [{ line: null, message: err.message, tagName: null }] }
  }
}
