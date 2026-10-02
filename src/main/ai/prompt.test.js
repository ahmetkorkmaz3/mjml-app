import { describe, expect, it } from 'vitest'

import {
  MAX_CONTEXT_CHARS,
  bodyWidth,
  buildDesignText,
  buildGenerateMessages,
  buildRefineMessages,
} from './prompt'

const design = {
  source: 'rest',
  name: 'Newsletter',
  width: 640,
  screenshot: Buffer.from('png'),
  context: '{"id":"1:1"}',
  variables: { 'color/primary': '#1a73e8' },
  assets: [],
}

const images = [
  { id: '1:4', url: 'u1', name: 'Logo', path: 'images/logo.png', ok: true, format: 'png' },
  { id: 'ref1', url: 'u2', name: 'Hero', path: 'images/hero.png', ok: false, format: 'png' },
]

describe('bodyWidth', () => {
  it('keeps a width up to 700 px and uses 600 px above it', () => {
    expect(bodyWidth(480)).toBe(480)
    expect(bodyWidth(700)).toBe(700)
    expect(bodyWidth(1200)).toBe(600)
    expect(bodyWidth(undefined)).toBe(600)
  })
})

describe('buildDesignText', () => {
  it('lists the images, the variables and the design data', () => {
    const text = buildDesignText(design, images)
    expect(text).toContain('Body width: 640px')
    expect(text).toContain('- images/logo.png (Figma: Logo, id: 1:4)')
    expect(text).toContain('- images/hero.png (Figma: Hero, id: ref1) - missing, use a placeholder')
    expect(text).toContain('"color/primary": "#1a73e8"')
    expect(text).toContain('{"id":"1:1"}')
  })

  it('cuts design data that is too long', () => {
    const text = buildDesignText({ ...design, context: 'x'.repeat(MAX_CONTEXT_CHARS + 10) }, [])
    expect(text).toContain('The design data is cut at this point')
    expect(text.length).toBeLessThan(MAX_CONTEXT_CHARS + 2000)
  })
})

describe('message builders', () => {
  it('adds the screenshot to the generate message', () => {
    const [message] = buildGenerateMessages({ design, images })
    expect(message.role).toBe('user')
    expect(message.content[1]).toEqual({
      type: 'file',
      mediaType: 'image/png',
      data: design.screenshot,
    })
  })

  it('adds the screenshot to the refine message only when there is one', () => {
    const [withShot] = buildRefineMessages({
      content: '<mjml></mjml>',
      instruction: 'make it blue',
      screenshot: Buffer.from('png'),
    })
    expect(withShot.content.some(part => part.type === 'file')).toBe(true)
    expect(withShot.content[0].text).toContain('make it blue')

    const [noShot] = buildRefineMessages({ content: '<mjml></mjml>', instruction: 'x' })
    expect(noShot.content.some(part => part.type === 'file')).toBe(false)
  })
})
