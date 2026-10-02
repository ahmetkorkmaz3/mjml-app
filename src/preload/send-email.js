import Mailjet from 'node-mailjet'

export default async function sendEmail(opts) {
  const { content, Subject, APIKey, APISecret, SenderName, SenderEmail, TargetEmails } = opts

  const mailjet = Mailjet.apiConnect(APIKey, APISecret)

  // one message for each recipient, so the recipients do not see each other
  await mailjet.post('send', { version: 'v3.1' }).request({
    Messages: TargetEmails.map(Email => ({
      From: { Email: SenderEmail, Name: SenderName },
      To: [{ Email }],
      Subject,
      HTMLPart: content,
    })),
  })
}
