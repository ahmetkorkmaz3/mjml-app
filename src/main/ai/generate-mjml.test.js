import { APICallError } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'

import { generateMjml, refineMjml } from './generate-mjml'
import { validateMjml } from './validate-mjml'

const VALID =
  '<mjml><mj-body><mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-body></mjml>'
const VALID_2 =
  '<mjml><mj-body><mj-section><mj-column><mj-text>Hello</mj-text></mj-column></mj-section></mj-body></mjml>'
const INVALID = '<mjml><mj-body><mj-column><mj-text>Hi</mj-text></mj-column></mj-body></mjml>'

const block = mjml => `\`\`\`mjml\n${mjml}\n\`\`\``

// gives the replies in order, an Error in the list is thrown
function mockModel(replies) {
  const calls = []
  const model = new MockLanguageModelV4({
    doGenerate: async options => {
      calls.push(options)
      const reply = replies[calls.length - 1]
      if (reply instanceof Error) {
        throw reply
      }
      return {
        content: [{ type: 'text', text: reply }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 5, text: 5, reasoning: 0 },
        },
        warnings: [],
      }
    },
  })
  return { model, calls }
}

const promptText = call => JSON.stringify(call.prompt)
const hasImage = call => promptText(call).includes('"type":"file"')

const design = {
  source: 'mcp',
  name: 'Newsletter',
  width: 1200,
  screenshot: Buffer.from('png'),
  context: '<div>Hi</div>',
  variables: {},
  assets: [],
}

const base = { design, images: [], validate: c => validateMjml(c), visualCheck: false }

describe('generateMjml', () => {
  it('returns valid MJML from the first reply', async () => {
    const { model, calls } = mockModel([block(VALID)])
    const res = await generateMjml({ ...base, model })
    expect(res.mjml).toBe(VALID)
    expect(res.warnings).toEqual([])
    expect(res.usage).toEqual({ inputTokens: 10, outputTokens: 5, calls: 1 })
    expect(hasImage(calls[0])).toBe(true)
  })

  it('sends the validation errors back and uses the fixed version', async () => {
    const { model, calls } = mockModel([block(INVALID), block(VALID)])
    const onProgress = vi.fn()
    const res = await generateMjml({ ...base, model, onProgress })
    expect(res.mjml).toBe(VALID)
    expect(calls).toHaveLength(2)
    expect(promptText(calls[1])).toContain('cannot be used inside')
    expect(onProgress).toHaveBeenCalledWith({ step: 'validate', detail: 'round 1 of 2' })
  })

  it('stops after 2 fix rounds and adds a warning', async () => {
    const { model, calls } = mockModel([block(INVALID), block(INVALID), block(INVALID)])
    const res = await generateMjml({ ...base, model })
    expect(calls).toHaveLength(3)
    expect(res.mjml).toBe(INVALID)
    expect(res.warnings.join(' ')).toContain('validation errors')
    expect(res.usage.calls).toBe(3)
  })

  it('asks again when a reply has no MJML', async () => {
    const { model, calls } = mockModel(['Sorry, I cannot.', block(VALID)])
    const res = await generateMjml({ ...base, model })
    expect(res.mjml).toBe(VALID)
    expect(promptText(calls[1])).toContain('did not contain a complete MJML document')
  })

  it('fails with AI_NO_MJML when no reply has MJML', async () => {
    const { model } = mockModel(['no', 'no', 'no'])
    await expect(generateMjml({ ...base, model })).rejects.toMatchObject({ code: 'AI_NO_MJML' })
  })

  it('sends text only when the model does not accept images', async () => {
    const imageError = new APICallError({
      message: 'This model does not support image input',
      url: 'https://api.example.com',
      requestBodyValues: {},
      statusCode: 400,
      isRetryable: false,
    })
    const { model, calls } = mockModel([imageError, block(VALID)])
    const res = await generateMjml({ ...base, model })
    expect(res.mjml).toBe(VALID)
    expect(hasImage(calls[1])).toBe(false)
    expect(res.warnings.join(' ')).toContain('does not accept images')
  })

  it('uses the result of the visual check when it is valid', async () => {
    const { model, calls } = mockModel([block(VALID), block(VALID_2)])
    const renderScreenshot = vi.fn(async () => Buffer.from('render'))
    const res = await generateMjml({ ...base, model, visualCheck: true, renderScreenshot })
    expect(res.mjml).toBe(VALID_2)
    expect(renderScreenshot).toHaveBeenCalledWith(expect.stringContaining('Hi'), 600)
    expect(promptText(calls[1])).toContain('The first image is the Figma design')
  })

  it('keeps the first version when the visual check finds that images are refused', async () => {
    const imageError = new APICallError({
      message: 'This model does not support image input',
      url: 'https://api.example.com',
      requestBodyValues: {},
      statusCode: 400,
      isRetryable: false,
    })
    const { model } = mockModel([block(VALID), imageError, block(VALID_2)])
    const renderScreenshot = async () => Buffer.from('render')
    const res = await generateMjml({ ...base, model, visualCheck: true, renderScreenshot })
    expect(res.mjml).toBe(VALID)
    expect(res.warnings.join(' ')).toContain('does not accept images')
  })

  it('keeps the first version when the visual check gives invalid MJML', async () => {
    const { model } = mockModel([block(VALID), block(INVALID)])
    const renderScreenshot = async () => Buffer.from('render')
    const res = await generateMjml({ ...base, model, visualCheck: true, renderScreenshot })
    expect(res.mjml).toBe(VALID)
    expect(res.warnings.join(' ')).toContain('visual check')
  })

  it('stops before a model call when the signal is aborted', async () => {
    const { model, calls } = mockModel([block(VALID)])
    const controller = new AbortController()
    controller.abort()
    await expect(generateMjml({ ...base, model, signal: controller.signal })).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })
})

describe('refineMjml', () => {
  it('sends the content and the instruction', async () => {
    const { model, calls } = mockModel([block(VALID_2)])
    const res = await refineMjml({
      model,
      content: VALID,
      instruction: 'say hello',
      validate: c => validateMjml(c),
    })
    expect(res.mjml).toBe(VALID_2)
    expect(promptText(calls[0])).toContain('say hello')
    expect(hasImage(calls[0])).toBe(false)
  })
})
