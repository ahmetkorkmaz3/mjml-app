import { readFile, rename, writeFile } from 'node:fs/promises'

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
  let writeQueue = Promise.resolve()

  async function load() {
    try {
      return JSON.parse(await readFile(filePath, 'utf8'))
    } catch (err) {
      if (err.code === 'ENOENT') {
        return {}
      }
      throw new ImportError('SECRETS_UNREADABLE', 'The app could not read the saved keys file.')
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
      writeQueue = writeQueue.then(async () => {
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
        const tmpPath = `${filePath}.tmp`
        await writeFile(tmpPath, JSON.stringify(data), { mode: 0o600 })
        await rename(tmpPath, filePath)
      })
      return writeQueue
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
