import Mailjet from 'node-mailjet'

import { redact } from './errors'

// the secret names of the Mailjet keys (see secrets.js)
export const MAILJET_SECRETS = {
  APIKey: 'mailjet.apiKey',
  APISecret: 'mailjet.apiSecret',
}

// The old versions kept the Mailjet keys in plain text in the settings. This
// moves them to the secret store and returns the settings without them. When
// the store cannot encrypt, the settings stay as they are.
export async function migrateMailjetKeys(settings, secrets) {
  const api = settings && settings.api
  if (!api || (!api.APIKey && !api.APISecret) || !secrets.isAvailable()) {
    return settings
  }
  for (const [field, name] of Object.entries(MAILJET_SECRETS)) {
    if (api[field]) {
      await secrets.set(name, api[field])
    }
  }
  return { ...settings, api: { ...api, APIKey: '', APISecret: '' } }
}

// Sends the test email with the Mailjet Send API v3.1. The keys come from the
// secret store (or the old plain settings), the renderer never gets them.
// Returns { ok: true } or { error: { code, message } }.
export async function sendTestEmail(params, { secrets, settings, connect = Mailjet.apiConnect }) {
  const { content, Subject, SenderName, SenderEmail, TargetEmails = [] } = params || {}
  const api = (settings && settings.api) || {}
  const APIKey = (await secrets.get(MAILJET_SECRETS.APIKey)) || api.APIKey
  const APISecret = (await secrets.get(MAILJET_SECRETS.APISecret)) || api.APISecret
  if (!APIKey || !APISecret) {
    return {
      error: { code: 'MISSING_KEYS', message: 'Set the Mailjet API key and the API secret.' },
    }
  }

  try {
    const mailjet = connect(APIKey, APISecret)
    // one message for each recipient, so the recipients do not see each other
    await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: TargetEmails.map(Email => ({
        From: { Email: SenderEmail, Name: SenderName },
        To: [{ Email }],
        Subject,
        HTMLPart: content,
      })),
    })
    return { ok: true }
  } catch (err) {
    const message = redact(err.message || 'Mailjet refused the email.', [APIKey, APISecret])
    return { error: { code: 'SEND_FAILED', message } }
  }
}
