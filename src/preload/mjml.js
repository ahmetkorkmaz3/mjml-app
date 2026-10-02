import { execFile } from 'node:child_process'
import path from 'node:path'
import mjml2html from 'mjml'
import migrate from 'mjml-migrate'

import { WRAPPER_LINES, includePathFor, mapErrors, wrapIntoMJMLTags } from './mjml-helpers'

const MAX_BUFFER = 10 * 1024 * 1024

function run(cmd, args, { stdin, cwd } = {}) {
  return new Promise(resolve => {
    try {
      const child = execFile(cmd, args, { maxBuffer: MAX_BUFFER, cwd }, (err, stdout, stderr) => {
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

const failure = message => ({ html: '', errors: [{ line: null, message, tagName: null }] })

/**
 * Render MJML content to HTML.
 *
 * options:
 * - mjmlPath: path of a local mjml binary (the embedded engine is used when empty)
 * - minify, keepComments
 * - useMjmlConfig, mjmlConfigPath: use a .mjmlconfig file for custom components
 * - preventAutoSave: the content is not saved, so send it through stdin
 * - rootPath: the project folder, mj-include can read the files in it
 */
export async function render(mjmlContent, filePath, options = {}) {
  const {
    mjmlPath,
    minify = false,
    keepComments = true,
    useMjmlConfig = false,
    mjmlConfigPath,
    preventAutoSave = false,
    rootPath,
  } = options

  const isFullDocument = mjmlContent.trim().startsWith('<mjml')
  const content = isFullDocument ? mjmlContent : wrapIntoMJMLTags(mjmlContent)
  const configPath = useMjmlConfig ? mjmlConfigPath || path.dirname(filePath) : null
  const includePath = includePathFor(filePath, rootPath)

  try {
    if (mjmlPath) {
      const args = [
        '-s',
        '--config.validationLevel=skip',
        '--config.allowIncludes=true',
        ...(minify ? ['--config.minify=true'] : []),
        ...(keepComments ? [] : ['--config.keepComments=false']),
        ...(configPath ? [`--config.mjmlConfigPath=${configPath}`] : []),
        ...(includePath ? [`--config.includePath=${JSON.stringify(includePath)}`] : []),
      ]

      // with stdin, filePath and cwd let mj-include find the files
      const res =
        !isFullDocument || preventAutoSave
          ? await run(mjmlPath, [...args, `--config.filePath=${filePath}`, '-i'], {
              stdin: content,
              cwd: path.dirname(filePath),
            })
          : await run(mjmlPath, [filePath, ...args], { cwd: path.dirname(filePath) })

      if (res.err) {
        const stderr = (res.stderr || '').trim()
        return failure(stderr || res.err.message)
      }
      return { html: res.stdout, errors: [] }
    }

    const res = await mjml2html(content, {
      filePath,
      minify,
      keepComments,
      // mj-include is used by projects to share a header or a footer
      ignoreIncludes: false,
      ...(includePath ? { includePath } : {}),
      ...(configPath ? { mjmlConfigPath: configPath } : {}),
    })

    return {
      html: res.html || '',
      errors: mapErrors(res.errors, { lineOffset: isFullDocument ? 0 : WRAPPER_LINES }),
    }
  } catch (e) {
    // a malformed document: show why there is no preview
    return failure(e.message || String(e))
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
