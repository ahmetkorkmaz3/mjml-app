import { describe, expect, it } from 'vitest'

import { toHex, trimNode } from './trim-node'

const white = { r: 1, g: 1, b: 1, a: 1 }
const black = { r: 0, g: 0, b: 0, a: 1 }

const email = {
  id: '1:1',
  name: 'Email',
  type: 'FRAME',
  exportSettings: [{ format: 'PNG' }],
  absoluteBoundingBox: { x: 0.4, y: 0, width: 600, height: 800.2 },
  layoutMode: 'VERTICAL',
  itemSpacing: 16,
  paddingTop: 24,
  fills: [{ type: 'SOLID', color: white }],
  children: [
    {
      id: '1:2',
      name: 'Title',
      type: 'TEXT',
      characters: 'Hello',
      style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 32, lineHeightPx: 40, foo: 1 },
      fills: [{ type: 'SOLID', color: black }],
    },
    { id: '1:3', name: 'Hidden', type: 'TEXT', visible: false, characters: 'x' },
    {
      id: '1:4',
      name: 'Icon',
      type: 'GROUP',
      children: [
        { id: '1:5', name: 'a', type: 'VECTOR' },
        { id: '1:6', name: 'b', type: 'VECTOR' },
      ],
    },
    {
      id: '1:7',
      name: 'Hero',
      type: 'RECTANGLE',
      fills: [{ type: 'IMAGE', imageRef: 'ref1', scaleMode: 'FILL' }],
    },
    {
      id: '1:8',
      name: 'Logo',
      type: 'FRAME',
      exportSettings: [{ format: 'PNG' }],
      children: [{ id: '1:9', name: 'ACME', type: 'TEXT', characters: 'ACME' }],
    },
  ],
}

describe('toHex', () => {
  it('converts a Figma color', () => {
    expect(toHex({ r: 1, g: 0.5, b: 0, a: 1 })).toBe('#ff8000')
  })

  it('adds the alpha when it is below 1', () => {
    expect(toHex({ r: 1, g: 0.5, b: 0, a: 1 }, 0.5)).toBe('#ff800080')
  })
})

describe('trimNode', () => {
  const { tree, exports, imageFills } = trimNode(email)

  it('keeps the root as a layout node even with export settings', () => {
    expect(tree.exportAsImage).toBeUndefined()
    expect(tree.layoutMode).toBe('VERTICAL')
    expect(tree.itemSpacing).toBe(16)
    expect(tree.box).toEqual({ x: 0, y: 0, w: 600, h: 800 })
    expect(tree.fills).toEqual([{ type: 'SOLID', color: '#ffffff' }])
  })

  it('keeps text and the useful style keys', () => {
    const title = tree.children.find(c => c.id === '1:2')
    expect(title.text).toBe('Hello')
    expect(title.style).toEqual({
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 32,
      lineHeightPx: 40,
    })
  })

  it('removes hidden nodes', () => {
    expect(tree.children.find(c => c.id === '1:3')).toBeUndefined()
  })

  it('exports a group of vectors as one image', () => {
    const icon = tree.children.find(c => c.id === '1:4')
    expect(icon.exportAsImage).toBe(true)
    expect(icon.children).toBeUndefined()
    expect(exports).toContainEqual({ id: '1:4', name: 'Icon' })
    expect(exports.find(e => e.id === '1:5')).toBeUndefined()
  })

  it('exports a child node with export settings', () => {
    const logo = tree.children.find(c => c.id === '1:8')
    expect(logo.exportAsImage).toBe(true)
    expect(logo.children).toBeUndefined()
    expect(exports).toContainEqual({ id: '1:8', name: 'Logo' })
  })

  it('collects image fills', () => {
    expect(imageFills).toEqual([{ imageRef: 'ref1', name: 'Hero' }])
    const hero = tree.children.find(c => c.id === '1:7')
    expect(hero.fills).toEqual([{ type: 'IMAGE', imageRef: 'ref1', scaleMode: 'FILL' }])
  })
})
