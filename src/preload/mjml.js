import { execFile } from 'node:child_process'
import path from 'node:path'
import mjml2html from 'mjml'
import migrate from 'mjml-migrate'

const MAX_BUFFER = 10 * 1024 * 1024

export function wrapIntoMJMLTags(content) {
  return `<mjml>
  <mj-body>
    ${content}
  </mj-body>
</mjml>`
}

function run(cmd, args, stdin) {
  return new Promise(resolve => {
    try {
      const child = execFile(cmd, args, { maxBuffer: MAX_BUFFER }, (err, stdout, stderr) => {
        resolve({ err, stdout, stderr })
      })
      if (stdin !== undefined) {
        child.stdin.end(stdin)
      }
    } catch (err) {
      resolve({ err })
    }
  })
}

/**
 * Render MJML content to HTML.
 *
 * options:
 * - mjmlPath: path of a local mjml binary (the embedded engine is used when empty)
 * - minify, keepComments
 * - useMjmlConfig, mjmlConfigPath: use a .mjmlconfig file for custom components
 * - preventAutoSave: the content is not saved, so send it through stdin
 */
export async function render(mjmlContent, filePath, options = {}) {
  const {
    mjmlPath,
    minify = false,
    keepComments = true,
    useMjmlConfig = false,
    mjmlConfigPath,
    preventAutoSave = false,
  } = options

  const isFullDocument = mjmlContent.trim().startsWith('<mjml')
  const content = isFullDocument ? mjmlContent : wrapIntoMJMLTags(mjmlContent)
  const configPath = useMjmlConfig ? mjmlConfigPath || path.dirname(filePath) : null

  try {
    if (mjmlPath) {
      const args = [
        '-s',
        '--config.validationLevel=skip',
        '--config.allowIncludes=true',
        ...(minify ? ['--config.minify=true'] : []),
        ...(keepComments ? [] : ['--config.keepComments=false']),
        ...(configPath ? [`--config.mjmlConfigPath=${configPath}`] : []),
      ]

      const res =
        !isFullDocument || preventAutoSave
          ? await run(mjmlPath, [...args, '-i'], content)
          : await run(mjmlPath, [filePath, ...args])

      if (res.err) {
        return { html: '', errors: [] }
      }
      return { html: res.stdout, errors: [] }
    }

    const res = await mjml2html(content, {
      filePath,
      minify,
      keepComments,
      // mj-include is used by projects to share a header or a footer
      ignoreIncludes: false,
      ...(configPath ? { mjmlConfigPath: configPath } : {}),
    })

    return {
      html: res.html || '',
      errors: (res.errors || []).map(({ line, message, tagName }) => ({ line, message, tagName })),
    }
  } catch (e) {
    return { html: '', errors: [] }
  }
}

export async function getVersion(location) {
  const { err, stdout } = await run(location, ['--version'])
  if (err) {
    return null
  }
  return stdout.trim()
}

export function migrateToMJML4(content) {
  return migrate(content)
}
