import { describe, expect, it } from 'vitest'

import { duplicateName, fileKind } from './files'

describe('fileKind', () => {
  it('finds the kind from the extension', () => {
    expect(fileKind('index.mjml', false)).toBe('mjml')
    expect(fileKind('out.HTML', false)).toBe('html')
    expect(fileKind('logo.png', false)).toBe('image')
    expect(fileKind('photo.jpeg', false)).toBe('image')
    expect(fileKind('notes.txt', false)).toBe('other')
    expect(fileKind('Makefile', false)).toBe('other')
  })

  it('gives folder for a folder, whatever its name', () => {
    expect(fileKind('images.mjml', true)).toBe('folder')
  })
})

describe('duplicateName', () => {
  it('adds " copy" before the extension', () => {
    expect(duplicateName('index.mjml', ['index.mjml'])).toBe('index copy.mjml')
  })

  it('adds a number when the copy exists', () => {
    expect(duplicateName('index.mjml', ['index.mjml', 'index copy.mjml'])).toBe('index copy 2.mjml')
    expect(
      duplicateName('index.mjml', ['index.mjml', 'index copy.mjml', 'index copy 2.mjml']),
    ).toBe('index copy 3.mjml')
  })

  it('works for a name without an extension and for a dot file', () => {
    expect(duplicateName('README', ['README'])).toBe('README copy')
    expect(duplicateName('.mjmlconfig', ['.mjmlconfig'])).toBe('.mjmlconfig copy')
  })
})
