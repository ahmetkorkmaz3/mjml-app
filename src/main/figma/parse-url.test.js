import { describe, expect, it } from 'vitest'

import { parseFigmaUrl } from './parse-url'

describe('parseFigmaUrl', () => {
  it('reads a design link', () => {
    expect(
      parseFigmaUrl('https://www.figma.com/design/AbC123/Newsletter?node-id=12-34&t=x'),
    ).toEqual({ fileKey: 'AbC123', nodeId: '12:34' })
  })

  it('reads file and proto links', () => {
    expect(parseFigmaUrl('https://www.figma.com/file/AbC123/N?node-id=1-2')).toEqual({
      fileKey: 'AbC123',
      nodeId: '1:2',
    })
    expect(parseFigmaUrl('https://figma.com/proto/AbC123/N?node-id=1-2')).toEqual({
      fileKey: 'AbC123',
      nodeId: '1:2',
    })
  })

  it('uses the branch key of a branch link', () => {
    expect(
      parseFigmaUrl('https://www.figma.com/design/AbC123/branch/BrX9/Newsletter?node-id=5-6'),
    ).toEqual({ fileKey: 'BrX9', nodeId: '5:6' })
  })

  it('accepts an encoded colon and spaces around the link', () => {
    expect(parseFigmaUrl('  https://www.figma.com/design/AbC123/N?node-id=12%3A34 \n')).toEqual({
      fileKey: 'AbC123',
      nodeId: '12:34',
    })
  })

  it('returns null for a link without a node id', () => {
    expect(parseFigmaUrl('https://www.figma.com/design/AbC123/Newsletter')).toBeNull()
  })

  it('returns null for other hosts and for text that is not a URL', () => {
    expect(parseFigmaUrl('https://example.com/design/AbC123/N?node-id=1-2')).toBeNull()
    expect(parseFigmaUrl('https://notfigma.com/design/AbC123/N?node-id=1-2')).toBeNull()
    expect(parseFigmaUrl('hello')).toBeNull()
    expect(parseFigmaUrl('')).toBeNull()
  })
})
