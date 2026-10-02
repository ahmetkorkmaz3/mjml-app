import { readFile, writeFile } from 'node:fs/promises'

import { ImportError } from './errors'

export const SECRET_NAMES = [
  'ai.anthropic',
  'ai.openai',
  'ai.google',
  'ai.openai-compatible',
  'figma.token',
]

// Keeps API keys and tokens encrypted with Electron safeStorage (the OS
// keychain). The file has one base64 string for each name. The renderer can
// set a secret and ask if it exists, only the main process reads the value.
export function createSecretStore({ filePath, safeStorage }) {
  async function load() {
    try {
      return JSON.parse(await readFile(filePath, 'utf8'))
    } catch (err) {
      return {}
    }
  }

  function decrypt(value) {
    try {
      return safeStorage.decryptString(Buffer.from(value, 'base64'))
    } catch (err) {
      return null
    }
  }

  return {
    isAvailable: () => safeStorage.isEncryptionAvailable(),

    async set(name, value) {
      const data = await load()
      if (value) {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new ImportError(
            'ENCRYPTION_UNAVAILABLE',
            'The system keychain is not available, so the app cannot save the key.',
          )
        }
        data[name] = safeStorage.encryptString(value).toString('base64')
      } else {
        delete data[name]
      }
      await writeFile(filePath, JSON.stringify(data), { mode: 0o600 })
    },

    async has(name) {
      return Boolean((await load())[name])
    },

    async get(name) {
      const value = (await load())[name]
      return value ? decrypt(value) : null
    },

    async getAll() {
      return Object.values(await load())
        .map(decrypt)
        .filter(Boolean)
    },
  }
}
