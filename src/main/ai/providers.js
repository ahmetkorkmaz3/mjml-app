import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

import { PROVIDERS } from '../../data/aiProviders'
import { ImportError } from '../errors'

export function createModel({ provider, model, baseURL } = {}, apiKey) {
  const info = PROVIDERS[provider]
  if (!info) {
    throw new ImportError('AI_PROVIDER_UNKNOWN', 'Select an AI provider in Settings > AI & Figma.')
  }
  if (info.needsKey && !apiKey) {
    throw new ImportError(
      'AI_KEY_MISSING',
      `Add an API key for ${info.label} in Settings > AI & Figma.`,
    )
  }

  const modelId = (model || '').trim() || info.defaultModel

  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(modelId)
    case 'openai':
      return createOpenAI({ apiKey })(modelId)
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(modelId)
    default: {
      if (!baseURL) {
        throw new ImportError(
          'AI_BASE_URL_MISSING',
          'Add the base URL of the OpenAI compatible server in Settings > AI & Figma.',
        )
      }
      if (!modelId) {
        throw new ImportError('AI_MODEL_MISSING', 'Add a model name in Settings > AI & Figma.')
      }
      return createOpenAICompatible({
        name: 'openai-compatible',
        baseURL,
        apiKey: apiKey || undefined,
      })(modelId)
    }
  }
}
