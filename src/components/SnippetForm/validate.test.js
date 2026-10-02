import { describe, expect, it } from 'vitest'

import { getSnippetErrors, isSnippetValid, parseSnippetsImport } from './validate'

const existing = [{ name: 'Button', trigger: 'btn', content: '<mj-button />' }]

describe('getSnippetErrors', () => {
  it('accepts a new snippet', () => {
    expect(getSnippetErrors({ name: 'Text', trigger: 'txt', content: 'x' }, existing)).toEqual({})
  })

  it('refuses empty fields, spaces in triggers and taken values', () => {
    expect(
      Object.keys(getSnippetErrors({ name: ' ', trigger: '', content: '' }, existing)),
    ).toEqual(['name', 'trigger', 'content'])
    expect(getSnippetErrors({ name: 'A', trigger: 'a b', content: 'x' }).trigger).toMatch(/Spaces/)
    const taken = getSnippetErrors({ name: 'Button', trigger: 'btn', content: 'x' }, existing)
    expect(taken.name).toMatch(/taken/)
    expect(taken.trigger).toMatch(/taken/)
  })

  it('lets an edited snippet keep its name and trigger', () => {
    expect(
      isSnippetValid({ name: 'Button', trigger: 'btn', content: 'y' }, existing, 'Button'),
    ).toBe(true)
  })
})

describe('parseSnippetsImport', () => {
  it('throws for bad JSON or a value that is not an array', () => {
    expect(() => parseSnippetsImport('{bad', existing)).toThrow()
    expect(() => parseSnippetsImport('{"name":"a"}', existing)).toThrow(/array/)
  })

  it('skips invalid entries and duplicates inside the file', () => {
    const json = JSON.stringify([
      { name: 'Text', trigger: 'txt', content: 'x' },
      { name: 'Text', trigger: 'other', content: 'x' },
      { name: 'Other', trigger: 'txt', content: 'x' },
      { name: 'Button', trigger: 'b2', content: 'x' },
      { name: 'No content', trigger: 'nc' },
      null,
      'text',
    ])
    const { added, skipped } = parseSnippetsImport(json, existing)
    expect(added).toEqual([{ name: 'Text', trigger: 'txt', content: 'x' }])
    expect(skipped).toBe(6)
  })
})
