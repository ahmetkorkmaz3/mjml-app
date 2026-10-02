import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MockLanguageModelV4 } from 'ai/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./figma', () => ({ getDesign: vi.fn(), testFigmaConnection: vi.fn() }))
vi.mock('./ai/providers', () => ({ createModel: vi.fn() }))

const { getDesign } = await import('./figma')
const { createModel } = await import('./ai/providers')
const { createFigmaImporter } = await import('./figma-import')

const VALID =
  '<mjml><mj-body><mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-body></mjml>'

function replyModel(text, prompts = []) {
  return new MockLanguageModelV4({
    doGenerate: async options => {
      prompts.push(options.prompt)
      return {
        content: [{ type: 'text', text }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 5, text: 5, reasoning: 0 },
        },
        warnings: [],
      }
    },
  })
}

const design = {
  source: 'mcp',
  name: 'Newsletter',
  width: 600,
  screenshot: Buffer.from('png'),
  context: 'code',
  variables: {},
  assets: [],
}

const secrets = { get: async () => 'secret-key-123', getAll: async () => ['secret-key-123'] }
const ai = { provider: 'anthropic', model: '', visualCheck: false }
const figma = { source: 'mcp', mcpURL: 'http://127.0.0.1:3845/mcp' }

describe('createFigmaImporter', () => {
  let dir

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mjml-import-'))
    getDesign.mockReset()
    createModel.mockReset()
    createModel.mockReturnValue(replyModel(`\`\`\`mjml\n${VALID}\n\`\`\``))
  })

  afterEach(() => rm(dir, { recursive: true, force: true }))

  const params = () => ({ link: 'L', projectPath: dir, fileName: 'news.mjml', ai, figma })

  it('writes the MJML file and returns the usage', async () => {
    getDesign.mockResolvedValue(design)
    const importer = createFigmaImporter({ secrets, renderScreenshot: vi.fn() })
    const onProgress = vi.fn()

    const res = await importer.importDesign(params(), onProgress)

    expect(res.error).toBeUndefined()
    expect(res.filePath).toBe(join(dir, 'news.mjml'))
    expect(await readFile(res.filePath, 'utf8')).toBe(VALID)
    expect(res.usage).toEqual({ inputTokens: 10, outputTokens: 5, calls: 1 })
    expect(onProgress).toHaveBeenCalledWith({ step: 'write' })
  })

  it('never overwrites a file', async () => {
    getDesign.mockResolvedValue(design)
    await writeFile(join(dir, 'news.mjml'), 'mine')
    const importer = createFigmaImporter({ secrets, renderScreenshot: vi.fn() })

    const res = await importer.importDesign(params(), () => {})

    expect(res.error.code).toBe('FILE_EXISTS')
    expect(await readFile(join(dir, 'news.mjml'), 'utf8')).toBe('mine')
    expect(getDesign).not.toHaveBeenCalled()
    expect(createModel).not.toHaveBeenCalled()
  })

  it('rejects a file name with a path', async () => {
    const importer = createFigmaImporter({ secrets, renderScreenshot: vi.fn() })
    const res = await importer.importDesign({ ...params(), fileName: '../x.mjml' }, () => {})
    expect(res.error.code).toBe('INVALID_FILE_NAME')
    expect(getDesign).not.toHaveBeenCalled()
  })

  it('runs one import at a time and can cancel it', async () => {
    getDesign.mockImplementation(
      ({ signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )
    const importer = createFigmaImporter({ secrets, renderScreenshot: vi.fn() })

    const first = importer.importDesign(params(), () => {})
    const second = await importer.importDesign(params(), () => {})
    expect(second.error.code).toBe('BUSY')

    importer.cancel()
    expect((await first).error.code).toBe('CANCELLED')
  })

  it('removes secrets from error messages', async () => {
    getDesign.mockRejectedValue(new Error('bad key secret-key-123'))
    const importer = createFigmaImporter({ secrets, renderScreenshot: vi.fn() })
    const res = await importer.importDesign(params(), () => {})
    expect(res.error.message).toBe('bad key ***')
  })

  it('refines content and sends the Figma screenshot of an imported file', async () => {
    getDesign.mockResolvedValue(design)
    const importer = createFigmaImporter({ secrets, renderScreenshot: vi.fn() })
    const { filePath } = await importer.importDesign(params(), () => {})
    const prompts = []
    createModel.mockReturnValue(replyModel(`\`\`\`mjml\n${VALID}\n\`\`\``, prompts))

    const res = await importer.refine(
      { filePath, content: VALID, instruction: 'make it blue', ai },
      () => {},
    )

    expect(res.content).toBe(VALID)
    expect(res.usage.calls).toBe(1)
    const parts = prompts[0].flatMap(message =>
      Array.isArray(message.content) ? message.content : [],
    )
    expect(parts.some(part => part.type === 'file')).toBe(true)
  })

  it('returns an error result when the parameters are missing', async () => {
    const importer = createFigmaImporter({ secrets, renderScreenshot: vi.fn() })
    const res = await importer.importDesign(undefined, () => {})
    expect(res.error.code).toBe('INVALID_FILE_NAME')
  })

  it('returns the error when the secret store cannot be read', async () => {
    getDesign.mockRejectedValue(new Error('boom'))
    const brokenSecrets = {
      get: async () => 'secret-key-123',
      getAll: async () => {
        throw new Error('SECRETS_UNREADABLE')
      },
    }
    const importer = createFigmaImporter({ secrets: brokenSecrets, renderScreenshot: vi.fn() })
    const res = await importer.importDesign(params(), () => {})
    expect(res).toEqual({ error: { code: 'UNKNOWN', message: 'boom' } })
  })
})
