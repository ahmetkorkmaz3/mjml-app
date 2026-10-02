import { describe, expect, it } from 'vitest'

import { PROVIDERS } from '../../data/aiProviders'
import { createModel } from './providers'

describe('createModel', () => {
  it('uses the default model of the provider when the model is empty', () => {
    const model = createModel({ provider: 'anthropic', model: '' }, 'sk-ant-123')
    expect(model.modelId).toBe(PROVIDERS.anthropic.defaultModel)
    expect(model.provider).toContain('anthropic')
  })

  it('uses the model that the user gives', () => {
    expect(createModel({ provider: 'openai', model: 'gpt-x' }, 'sk-1').modelId).toBe('gpt-x')
    expect(createModel({ provider: 'google', model: '' }, 'g-1').provider).toContain('google')
  })

  it('creates an OpenAI compatible model without a key', () => {
    const model = createModel(
      { provider: 'openai-compatible', model: 'llama3.2', baseURL: 'http://localhost:11434/v1' },
      null,
    )
    expect(model.modelId).toBe('llama3.2')
    expect(model.provider).toContain('openai-compatible')
  })

  it('throws codes for missing values', () => {
    expect(() => createModel({ provider: 'nope' }, 'k')).toThrow(
      expect.objectContaining({ code: 'AI_PROVIDER_UNKNOWN' }),
    )
    expect(() => createModel({ provider: 'openai', model: '' }, '')).toThrow(
      expect.objectContaining({ code: 'AI_KEY_MISSING' }),
    )
    expect(() => createModel({ provider: 'openai-compatible', model: 'x' }, null)).toThrow(
      expect.objectContaining({ code: 'AI_BASE_URL_MISSING' }),
    )
    expect(() =>
      createModel({ provider: 'openai-compatible', model: '', baseURL: 'http://x/v1' }, null),
    ).toThrow(expect.objectContaining({ code: 'AI_MODEL_MISSING' }))
  })
})
