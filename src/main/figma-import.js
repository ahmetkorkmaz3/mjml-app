import { writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join } from 'node:path'
import { generateText } from 'ai'

import { generateMjml, refineMjml } from './ai/generate-mjml'
import { createModel } from './ai/providers'
import { validateMjml } from './ai/validate-mjml'
import { downloadAssets } from './download-assets'
import { ImportError, toErrorResult } from './errors'
import { getDesign, testFigmaConnection } from './figma'

const FILE_NAME_RE = /^[\w.-]+\.mjml$/

function checkFileName(projectPath, fileName) {
  if (
    !isAbsolute(String(projectPath)) ||
    basename(fileName) !== fileName ||
    !FILE_NAME_RE.test(fileName)
  ) {
    throw new ImportError(
      'INVALID_FILE_NAME',
      'Use a file name with letters, numbers, "-", "_" or "." only.',
    )
  }
}

function imageWarnings(images) {
  const warnings = []
  for (const image of images) {
    if (!image.ok) {
      warnings.push(`The app could not download ${image.path}. The template uses a placeholder.`)
    } else if (image.format === 'svg') {
      warnings.push(
        `${image.path} is an SVG file. Many email clients do not show SVG images. Export it as PNG in Figma and replace the file.`,
      )
    }
  }
  return warnings
}

// Runs the Figma import and the refine command in the main process. Only one
// of them runs at a time. The results are plain objects, errors included,
// because errors lose their code when they cross IPC.
export function createFigmaImporter({ secrets, renderScreenshot, fetch = globalThis.fetch }) {
  let running = null
  // a corrupt keys file must not make the error handling throw
  const knownSecrets = () => secrets.getAll().catch(() => [])
  const screenshots = new Map()

  async function run(fn) {
    if (running) {
      return { error: { code: 'BUSY', message: 'An import is already running.' } }
    }
    const controller = new AbortController()
    running = controller
    try {
      return await fn(controller.signal)
    } catch (err) {
      if (controller.signal.aborted) {
        return { error: { code: 'CANCELLED', message: 'The import was cancelled.' } }
      }
      return toErrorResult(err, await knownSecrets())
    } finally {
      running = null
    }
  }

  async function getModel(ai) {
    return createModel(ai, await secrets.get(`ai.${ai.provider}`))
  }

  function importDesign({ link, projectPath, fileName, ai, figma }, onProgress) {
    return run(async signal => {
      onProgress({ step: 'parse' })
      checkFileName(projectPath, fileName)
      const model = await getModel(ai)

      onProgress({ step: 'figma' })
      const token = await secrets.get('figma.token')
      // a cancel during the awaits above must stop the import here
      signal.throwIfAborted()
      const design = await getDesign({
        link,
        source: figma.source,
        mcpURL: figma.mcpURL,
        token,
        signal,
        fetch,
      })

      const images = await downloadAssets({
        assets: design.assets,
        projectPath,
        fetch,
        signal,
        onProgress,
      })
      // MCP code has the asset URLs, the model gets the local paths instead
      let context = design.context
      for (const image of images) {
        if (image.ok && image.url) {
          context = context.split(image.url).join(image.path)
        }
      }

      const filePath = join(projectPath, fileName)
      const result = await generateMjml({
        model,
        design: { ...design, context },
        images,
        // the file does not exist yet and mjml needs an existing path: use the folder
        validate: content => validateMjml(content, projectPath),
        renderScreenshot: (html, width) => renderScreenshot(html, width, projectPath),
        visualCheck: ai.visualCheck !== false,
        signal,
        onProgress,
      })

      onProgress({ step: 'write' })
      try {
        await writeFile(filePath, result.mjml, { flag: 'wx' })
      } catch (err) {
        if (err.code === 'EEXIST') {
          throw new ImportError('FILE_EXISTS', `${fileName} already exists.`)
        }
        throw err
      }
      screenshots.set(filePath, design.screenshot)

      return {
        filePath,
        warnings: [...imageWarnings(images), ...result.warnings],
        usage: result.usage,
      }
    })
  }

  function refine({ filePath, content, instruction, ai }, onProgress) {
    return run(async signal => {
      const model = await getModel(ai)
      const result = await refineMjml({
        model,
        content,
        instruction,
        screenshot: screenshots.get(filePath),
        validate: value => validateMjml(value, filePath),
        signal,
        onProgress,
      })
      return { content: result.mjml, warnings: result.warnings, usage: result.usage }
    })
  }

  function cancel() {
    if (running) {
      running.abort()
    }
  }

  async function testAi(ai) {
    try {
      const { text } = await generateText({
        model: await getModel(ai),
        prompt: 'Reply with the word OK.',
        maxOutputTokens: 16,
        maxRetries: 0,
      })
      return { ok: true, message: `The model replied: ${text.trim().slice(0, 40)}` }
    } catch (err) {
      return { ok: false, message: toErrorResult(err, await knownSecrets()).error.message }
    }
  }

  async function testFigma(figma) {
    try {
      return await testFigmaConnection({
        source: figma.source,
        mcpURL: figma.mcpURL,
        token: await secrets.get('figma.token'),
        fetch,
      })
    } catch (err) {
      return { ok: false, message: toErrorResult(err, await knownSecrets()).error.message }
    }
  }

  return { importDesign, refine, cancel, testAi, testFigma }
}
