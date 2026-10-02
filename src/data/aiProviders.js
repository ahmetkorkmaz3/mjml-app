// AI providers for the Figma import. The main process and the settings tab
// both use this list. The default models are only a start, the user can type
// any model id of the provider.
export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic Claude',
    defaultModel: 'claude-sonnet-5-5',
    needsKey: true,
    keyURL: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-5-mini',
    needsKey: true,
    keyURL: 'https://platform.openai.com/api-keys',
  },
  google: {
    label: 'Google Gemini (has a free tier)',
    defaultModel: 'gemini-2.5-flash',
    needsKey: true,
    keyURL: 'https://aistudio.google.com/apikey',
  },
  'openai-compatible': {
    label: 'OpenAI compatible (Ollama, LM Studio, OpenRouter, Groq)',
    defaultModel: '',
    needsKey: false,
    keyURL: null,
  },
}

export const PROVIDER_IDS = Object.keys(PROVIDERS)
