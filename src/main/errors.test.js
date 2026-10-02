import { APICallError, RetryError } from 'ai'
import { describe, expect, it } from 'vitest'

import { ImportError, redact, toErrorResult } from './errors'

function apiError(statusCode, message = 'Bad request') {
  return new APICallError({
    message,
    url: 'https://api.example.com',
    requestBodyValues: {},
    statusCode,
    isRetryable: false,
  })
}

describe('toErrorResult', () => {
  it('keeps the code of an ImportError', () => {
    expect(toErrorResult(new ImportError('INVALID_LINK', 'Bad link.'))).toEqual({
      error: { code: 'INVALID_LINK', message: 'Bad link.' },
    })
  })

  it('maps an abort to CANCELLED', () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    expect(toErrorResult(err).error.code).toBe('CANCELLED')
  })

  it('maps 401 and 403 from the AI provider to AI_UNAUTHORIZED', () => {
    expect(toErrorResult(apiError(401)).error.code).toBe('AI_UNAUTHORIZED')
    expect(toErrorResult(apiError(403)).error.code).toBe('AI_UNAUTHORIZED')
  })

  it('maps other AI provider errors to AI_ERROR and keeps the message', () => {
    const { error } = toErrorResult(apiError(500, 'Overloaded'))
    expect(error.code).toBe('AI_ERROR')
    expect(error.message).toContain('Overloaded')
  })

  it('unwraps a RetryError', () => {
    const err = new RetryError({
      message: 'Failed after 2 attempts',
      reason: 'maxRetriesExceeded',
      errors: [apiError(500), apiError(401)],
    })
    expect(toErrorResult(err).error.code).toBe('AI_UNAUTHORIZED')
  })

  it('gives UNKNOWN for other errors', () => {
    expect(toErrorResult(new Error('boom'))).toEqual({
      error: { code: 'UNKNOWN', message: 'boom' },
    })
  })

  it('removes secrets from the message', () => {
    const { error } = toErrorResult(new Error('key sk-secret-123 is wrong'), ['sk-secret-123'])
    expect(error.message).toBe('key *** is wrong')
  })
})

describe('redact', () => {
  it('ignores empty and very short secrets', () => {
    expect(redact('abc', ['', null, 'ab'])).toBe('abc')
  })
})
