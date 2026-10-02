import { describe, expect, it } from 'vitest'

import { extractMjml } from './extract-mjml'

const DOC = '<mjml>\n  <mj-body></mj-body>\n</mjml>'

describe('extractMjml', () => {
  it('reads an mjml code block', () => {
    expect(extractMjml(`Here it is:\n\`\`\`mjml\n${DOC}\n\`\`\`\nDone.`)).toBe(DOC)
  })

  it('reads a code block without a language', () => {
    expect(extractMjml(`\`\`\`\n${DOC}\n\`\`\``)).toBe(DOC)
  })

  it('reads a reply without a code block', () => {
    expect(extractMjml(`Sure. ${DOC} Bye.`)).toBe(DOC)
  })

  it('skips a code block that has no MJML', () => {
    expect(extractMjml(`\`\`\`css\n.a { color: red }\n\`\`\`\n\`\`\`xml\n${DOC}\n\`\`\``)).toBe(DOC)
  })

  it('returns null for a reply that is cut before </mjml>', () => {
    expect(extractMjml('```mjml\n<mjml><mj-body><mj-section>')).toBeNull()
  })

  it('returns null for an empty reply', () => {
    expect(extractMjml('')).toBeNull()
    expect(extractMjml(undefined)).toBeNull()
  })
})
