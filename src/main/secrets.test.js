import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSecretStore } from './secrets'

// reverses the text, so the saved file never has the plain value
function fakeSafeStorage(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: text => Buffer.from([...text].reverse().join(''), 'utf8'),
    decryptString: buffer => [...buffer.toString('utf8')].reverse().join(''),
  }
}

describe('createSecretStore', () => {
  let dir
  let filePath

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mjml-secrets-'))
    filePath = join(dir, 'secrets.json')
  })

  afterEach(() => rm(dir, { recursive: true, force: true }))

  it('saves, reads and removes a secret', async () => {
    const store = createSecretStore({ filePath, safeStorage: fakeSafeStorage() })
    expect(await store.has('ai.openai')).toBe(false)

    await store.set('ai.openai', 'sk-123456')
    expect(await store.has('ai.openai')).toBe(true)
    expect(await store.get('ai.openai')).toBe('sk-123456')
    expect(await store.getAll()).toEqual(['sk-123456'])
    expect(await readFile(filePath, 'utf8')).not.toContain('sk-123456')

    await store.set('ai.openai', '')
    expect(await store.has('ai.openai')).toBe(false)
    expect(await store.get('ai.openai')).toBeNull()
  })

  it('refuses to save when encryption is not available', async () => {
    const store = createSecretStore({ filePath, safeStorage: fakeSafeStorage(false) })
    await expect(store.set('figma.token', 'figd_123')).rejects.toMatchObject({
      code: 'ENCRYPTION_UNAVAILABLE',
    })
  })

  it('returns null when the file is missing', async () => {
    const store = createSecretStore({ filePath, safeStorage: fakeSafeStorage() })
    expect(await store.get('figma.token')).toBeNull()
  })

  it('rejects with SECRETS_UNREADABLE when the file is corrupt', async () => {
    await writeFile(filePath, 'not valid json', 'utf8')
    const store = createSecretStore({ filePath, safeStorage: fakeSafeStorage() })

    await expect(store.get('ai.openai')).rejects.toMatchObject({
      code: 'SECRETS_UNREADABLE',
    })
    await expect(store.set('ai.openai', 'sk-123456')).rejects.toMatchObject({
      code: 'SECRETS_UNREADABLE',
    })

    const fileContent = await readFile(filePath, 'utf8')
    expect(fileContent).toBe('not valid json')
  })

  it('serializes concurrent set calls', async () => {
    const store = createSecretStore({ filePath, safeStorage: fakeSafeStorage() })

    await Promise.all([store.set('ai.openai', 'aaaa1'), store.set('figma.token', 'bbbb2')])

    expect(await store.get('ai.openai')).toBe('aaaa1')
    expect(await store.get('figma.token')).toBe('bbbb2')
  })

  it('recovers from a failed set and succeeds on the next call', async () => {
    let encryptionAvailable = false
    const store = createSecretStore({
      filePath,
      safeStorage: {
        isEncryptionAvailable: () => encryptionAvailable,
        encryptString: text => Buffer.from([...text].reverse().join(''), 'utf8'),
        decryptString: buffer => [...buffer.toString('utf8')].reverse().join(''),
      },
    })

    await expect(store.set('ai.openai', 'sk-123456')).rejects.toMatchObject({
      code: 'ENCRYPTION_UNAVAILABLE',
    })

    encryptionAvailable = true
    await store.set('ai.openai', 'sk-123456')
    expect(await store.get('ai.openai')).toBe('sk-123456')
  })

  it('rejects with SECRETS_UNREADABLE when the file contains non-object JSON', async () => {
    await writeFile(filePath, 'null', 'utf8')
    const store = createSecretStore({ filePath, safeStorage: fakeSafeStorage() })

    await expect(store.get('ai.openai')).rejects.toMatchObject({
      code: 'SECRETS_UNREADABLE',
    })
    await expect(store.set('ai.openai', 'sk-123456')).rejects.toMatchObject({
      code: 'SECRETS_UNREADABLE',
    })
  })

  it('rejects with SECRETS_UNREADABLE when the file contains a JSON array', async () => {
    await writeFile(filePath, '[]', 'utf8')
    const store = createSecretStore({ filePath, safeStorage: fakeSafeStorage() })

    await expect(store.get('ai.openai')).rejects.toMatchObject({
      code: 'SECRETS_UNREADABLE',
    })
  })
})
