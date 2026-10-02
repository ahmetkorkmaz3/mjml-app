import { describe, expect, it, vi } from 'vitest'

import { MAILJET_SECRETS, migrateMailjetKeys, sendTestEmail } from './mailjet'

function fakeSecrets(values = {}, available = true) {
  const data = { ...values }
  return {
    data,
    isAvailable: () => available,
    set: vi.fn(async (name, value) => {
      data[name] = value
    }),
    get: async name => data[name] || null,
  }
}

describe('migrateMailjetKeys', () => {
  it('moves the plain keys to the secrets and clears them', async () => {
    const secrets = fakeSecrets()
    const settings = { api: { APIKey: 'key', APISecret: 'secret', SenderName: 'Me' } }
    const res = await migrateMailjetKeys(settings, secrets)
    expect(secrets.data).toEqual({
      [MAILJET_SECRETS.APIKey]: 'key',
      [MAILJET_SECRETS.APISecret]: 'secret',
    })
    expect(res.api).toEqual({ APIKey: '', APISecret: '', SenderName: 'Me' })
  })

  it('does nothing when there are no plain keys', async () => {
    const secrets = fakeSecrets()
    const settings = { api: { APIKey: '', APISecret: '' } }
    expect(await migrateMailjetKeys(settings, secrets)).toBe(settings)
    expect(await migrateMailjetKeys(undefined, secrets)).toBe(undefined)
    expect(secrets.set).not.toHaveBeenCalled()
  })

  it('keeps the plain keys when the store cannot encrypt', async () => {
    const secrets = fakeSecrets({}, false)
    const settings = { api: { APIKey: 'key', APISecret: 'secret' } }
    expect(await migrateMailjetKeys(settings, secrets)).toBe(settings)
    expect(secrets.set).not.toHaveBeenCalled()
  })
})

describe('sendTestEmail', () => {
  const params = {
    content: '<p>Hi</p>',
    Subject: 'Test',
    SenderName: 'Me',
    SenderEmail: 'me@example.com',
    TargetEmails: ['a@example.com', 'b@example.com'],
  }

  function fakeConnect(request) {
    return vi.fn(() => ({ post: () => ({ request }) }))
  }

  it('sends one message for each recipient with the saved keys', async () => {
    const request = vi.fn(async () => ({}))
    const connect = fakeConnect(request)
    const secrets = fakeSecrets({ [MAILJET_SECRETS.APIKey]: 'k', [MAILJET_SECRETS.APISecret]: 's' })
    const res = await sendTestEmail(params, { secrets, connect })
    expect(res).toEqual({ ok: true })
    expect(connect).toHaveBeenCalledWith('k', 's')
    expect(request.mock.calls[0][0].Messages).toHaveLength(2)
  })

  it('gives the message of the Mailjet error', async () => {
    const request = vi.fn(async () => {
      throw new Error('Unsuccessful: Status Code: "401" Message: "Unauthorized"')
    })
    const secrets = fakeSecrets({ [MAILJET_SECRETS.APIKey]: 'k', [MAILJET_SECRETS.APISecret]: 's' })
    const res = await sendTestEmail(params, { secrets, connect: fakeConnect(request) })
    expect(res.error.code).toBe('SEND_FAILED')
    expect(res.error.message).toContain('401')
  })

  it('refuses to send without keys', async () => {
    const res = await sendTestEmail(params, { secrets: fakeSecrets(), connect: vi.fn() })
    expect(res.error.code).toBe('MISSING_KEYS')
  })
})
