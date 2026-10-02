import { APICallError, RetryError } from 'ai'

// An error with a code that the renderer can show. Errors lose their `code`
// when they cross the context bridge, so the IPC handlers return
// toErrorResult(err) instead of throwing.
export class ImportError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ImportError'
    this.code = code
  }
}

export function redact(text, secrets = []) {
  return secrets
    .filter(secret => typeof secret === 'string' && secret.length >= 4)
    .reduce((result, secret) => result.split(secret).join('***'), String(text))
}

export function toErrorResult(err, secrets = []) {
  if (RetryError.isInstance(err) && err.lastError) {
    err = err.lastError
  }

  let code = 'UNKNOWN'
  let message = (err && err.message) || 'Unknown error.'

  if (err instanceof ImportError) {
    code = err.code
  } else if (err && err.name === 'AbortError') {
    code = 'CANCELLED'
    message = 'The import was cancelled.'
  } else if (APICallError.isInstance(err)) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      code = 'AI_UNAUTHORIZED'
      message =
        'The AI provider did not accept the API key. Check the key in Settings > AI & Figma.'
    } else {
      code = 'AI_ERROR'
      message = `The AI provider returned an error: ${err.message}`
    }
  }

  return { error: { code, message: redact(message, secrets) } }
}
