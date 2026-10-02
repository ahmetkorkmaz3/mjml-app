import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { render } from './mjml'
import { WRAPPER_LINES, includePathFor, mapErrors } from './mjml-helpers'

describe('includePathFor', () => {
  it('allows the project folder for a file in it', () => {
    expect(includePathFor('/p/emails/a.mjml', '/p')).toEqual(['/p'])
    expect(includePathFor('C:\\p\\emails\\a.mjml', 'C:\\p')).toEqual(['C:\\p'])
  })

  it('gives nothing for a file out of the project or without a project', () => {
    expect(includePathFor('/other/a.mjml', '/p')).toBe(undefined)
    expect(includePathFor('/pp/a.mjml', '/p')).toBe(undefined)
    expect(includePathFor('/p/a.mjml')).toBe(undefined)
  })
})

describe('mapErrors', () => {
  it('removes the lines of the wrapper of a partial file', () => {
    const errors = [{ line: 5, message: 'bad', tagName: 'mj-text' }]
    expect(mapErrors(errors, { lineOffset: WRAPPER_LINES })).toEqual([
      { line: 3, message: 'bad', tagName: 'mj-text' },
    ])
  })

  it('gives no line for an error on the wrapper', () => {
    expect(mapErrors([{ line: 1, message: 'bad' }], { lineOffset: 2 })[0].line).toBe(null)
  })

  it('names the included file and gives no line in the open file', () => {
    const errors = [
      {
        line: 4,
        message: 'bad',
        tagName: 'mj-text',
        formattedMessage:
          'Line 4 of /p/header.mjml, included at line 2 of file /p/index.mjml (mj-text) — bad',
      },
    ]
    expect(mapErrors(errors)).toEqual([
      { line: null, message: 'header.mjml, line 4: bad', tagName: 'mj-text' },
    ])
  })
})

describe('render', () => {
  let dir

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mjml-render-'))
    await mkdir(join(dir, 'emails'))
    await writeFile(
      join(dir, 'header.mjml'),
      '<mj-section><mj-column><mj-text>Shared header</mj-text></mj-column></mj-section>',
    )
  })

  afterAll(() => rm(dir, { recursive: true, force: true }))

  const doc = '<mjml><mj-body><mj-include path="../header.mjml" /></mj-body></mjml>'

  it('reads an include of the project folder with ../', async () => {
    const filePath = join(dir, 'emails', 'index.mjml')
    await writeFile(filePath, doc)
    const res = await render(doc, filePath, { rootPath: dir })
    expect(res.html).toContain('Shared header')
  })

  it('denies the include out of the project folder', async () => {
    const filePath = join(dir, 'emails', 'index.mjml')
    const res = await render(doc, filePath, { rootPath: join(dir, 'emails') })
    expect(res.html).not.toContain('Shared header')
  })

  it('gives the lines of a partial file', async () => {
    const filePath = join(dir, 'partial.mjml')
    const content =
      '<mj-section>\n<mj-column>\n<mj-text foo="1">Hi</mj-text>\n</mj-column>\n</mj-section>'
    await writeFile(filePath, content)
    const res = await render(content, filePath, { rootPath: dir })
    expect(res.errors.length).toBeGreaterThan(0)
    expect(res.errors[0].line).toBe(3)
  })

  it('does not put the errors of an included file on the lines of the open file', async () => {
    await writeFile(
      join(dir, 'footer.mjml'),
      '<mj-section>\n<mj-column>\n<mj-text foo="1">Hi</mj-text>\n</mj-column>\n</mj-section>',
    )
    const filePath = join(dir, 'with-footer.mjml')
    const content = '<mjml><mj-body><mj-include path="./footer.mjml" /></mj-body></mjml>'
    await writeFile(filePath, content)
    const res = await render(content, filePath, { rootPath: dir })
    expect(res.errors.length).toBeGreaterThan(0)
    expect(res.errors[0].line).toBe(null)
    expect(res.errors[0].message).toMatch(/^footer\.mjml, line 3: /)
  })

  it('gives an error for a malformed document', async () => {
    const res = await render('<mjml><mj-body>', join(dir, 'missing', 'x.mjml'))
    expect(res.html).toBe('')
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0].line).toBe(null)
    expect(res.errors[0].message).toBeTruthy()
  })
})
