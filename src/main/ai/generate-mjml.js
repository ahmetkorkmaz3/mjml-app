import { APICallError, UnsupportedFunctionalityError, generateText } from 'ai'

import { ImportError } from '../errors'
import { extractMjml } from './extract-mjml'
import {
  NO_MJML_PROMPT,
  SYSTEM_PROMPT,
  bodyWidth,
  buildFixPrompt,
  buildGenerateMessages,
  buildRefineMessages,
  buildVisualCheckMessages,
} from './prompt'

export const MAX_FIX_ROUNDS = 2

// Without a limit some providers stop the answer early (a small default).
// 16384 is in the output limit of the common models (gpt-4o included).
export const MAX_OUTPUT_TOKENS = 16384

const NO_IMAGES_WARNING =
  'The model does not accept images, so the app sent only the design data. The result can be less accurate.'
const VISUAL_CHECK_WARNING =
  'The visual check did not give a valid result. The app kept the first version.'

export function isImageInputError(err) {
  if (UnsupportedFunctionalityError.isInstance(err)) {
    return true
  }
  if (!APICallError.isInstance(err) || err.statusCode !== 400) {
    return false
  }
  return /image|vision|multimodal|modalit/i.test(`${err.message} ${err.responseBody || ''}`)
}

function stripImages(messages) {
  return messages.map(message =>
    Array.isArray(message.content)
      ? { ...message, content: message.content.filter(part => part.type !== 'file') }
      : message,
  )
}

// One session counts the tokens of all calls. When the model refuses
// images, the session sends text only from then on.
function createSession({ model, signal, warnings }) {
  const usage = { inputTokens: 0, outputTokens: 0, calls: 0 }
  let acceptsImages = true

  async function call(messages) {
    signal?.throwIfAborted()
    try {
      const res = await generateText({
        model,
        system: SYSTEM_PROMPT,
        messages: acceptsImages ? messages : stripImages(messages),
        abortSignal: signal,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        maxRetries: 1,
      })
      usage.inputTokens += res.usage?.inputTokens ?? 0
      usage.outputTokens += res.usage?.outputTokens ?? 0
      usage.calls += 1
      return res.text
    } catch (err) {
      if (!acceptsImages || !isImageInputError(err)) {
        throw err
      }
      acceptsImages = false
      warnings.push(NO_IMAGES_WARNING)
      return call(messages)
    }
  }

  return { call, usage, acceptsImages: () => acceptsImages }
}

async function runWithFixes({ session, messages, validate, onProgress }) {
  let text = await session.call(messages)
  let mjml = extractMjml(text)
  let missing = !mjml
  let errors = mjml ? (await validate(mjml)).errors : []

  for (let round = 1; round <= MAX_FIX_ROUNDS && (missing || errors.length > 0); round++) {
    onProgress({ step: 'validate', detail: `round ${round} of ${MAX_FIX_ROUNDS}` })
    messages = [
      ...messages,
      { role: 'assistant', content: text },
      { role: 'user', content: missing ? NO_MJML_PROMPT : buildFixPrompt(errors) },
    ]
    text = await session.call(messages)
    const next = extractMjml(text)
    missing = !next
    if (next) {
      mjml = next
      errors = (await validate(next)).errors
    }
  }

  if (!mjml) {
    throw new ImportError(
      'AI_NO_MJML',
      'The model did not return an MJML document. Try again or use a different model.',
    )
  }
  return { mjml, errors }
}

function errorsWarning(errors) {
  return `The MJML still has ${errors.length} validation errors. The editor shows them.`
}

export async function generateMjml({
  model,
  design,
  images,
  validate,
  renderScreenshot,
  visualCheck = true,
  signal,
  onProgress = () => {},
}) {
  const warnings = []
  const session = createSession({ model, signal, warnings })

  onProgress({ step: 'generate' })
  let { mjml, errors } = await runWithFixes({
    session,
    messages: buildGenerateMessages({ design, images }),
    validate,
    onProgress,
  })

  if (visualCheck && renderScreenshot && session.acceptsImages() && errors.length === 0) {
    onProgress({ step: 'visual-check' })
    try {
      const { html } = await validate(mjml)
      const rendered = await renderScreenshot(html, bodyWidth(design.width))
      const text = await session.call(buildVisualCheckMessages({ design, mjml, rendered }))
      const better = extractMjml(text)
      // a refusal of the images makes the session send text only. That reply
      // has no comparison, so keep the first version.
      if (session.acceptsImages()) {
        if (better && (await validate(better)).errors.length === 0) {
          mjml = better
        } else {
          warnings.push(VISUAL_CHECK_WARNING)
        }
      }
    } catch (err) {
      if (signal?.aborted) {
        throw err
      }
      warnings.push(VISUAL_CHECK_WARNING)
    }
  }

  if (errors.length) {
    warnings.push(errorsWarning(errors))
  }
  return { mjml, warnings, usage: session.usage }
}

export async function refineMjml({
  model,
  content,
  instruction,
  screenshot,
  validate,
  signal,
  onProgress = () => {},
}) {
  const warnings = []
  const session = createSession({ model, signal, warnings })

  onProgress({ step: 'generate' })
  const { mjml, errors } = await runWithFixes({
    session,
    messages: buildRefineMessages({ content, instruction, screenshot }),
    validate,
    onProgress,
  })

  if (errors.length) {
    warnings.push(errorsWarning(errors))
  }
  return { mjml, warnings, usage: session.usage }
}
