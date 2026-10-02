import { describe, expect, it } from 'vitest'

import { pathToFileURL, resolveFileURL, rewriteCssUrls } from './file-url'

describe('pathToFileURL', () => {
  it('encodes the segments of a POSIX path', () => {
    expect(pathToFileURL('/Users/me/my project/a#b?.png')).toBe(
      'file:///Users/me/my%20project/a%23b%3F.png',
    )
  })

  it('keeps the drive letter of a Windows path', () => {
    expect(pathToFileURL('C:\\Users\\me\\logo.png')).toBe('file:///C:/Users/me/logo.png')
  })

  it('puts the server of a UNC path in the host', () => {
    expect(pathToFileURL('\\\\server\\share\\logo.png')).toBe('file://server/share/logo.png')
  })
})

describe('resolveFileURL', () => {
  it('resolves a relative path from the folder', () => {
    expect(resolveFileURL('/p/email', 'images/logo.png')).toBe('file:///p/email/images/logo.png')
    expect(resolveFileURL('/p/email', './a.png')).toBe('file:///p/email/a.png')
    expect(resolveFileURL('/p/email', '../shared/a.png')).toBe('file:///p/shared/a.png')
  })

  it('decodes the HTML URL and keeps the query and the hash', () => {
    expect(resolveFileURL('/p', 'my%20logo.png?v=2#x')).toBe('file:///p/my%20logo.png?v=2#x')
  })

  it('works with a Windows folder', () => {
    expect(resolveFileURL('C:\\p\\email', 'images\\logo.png')).toBe(
      'file:///C:/p/email/images/logo.png',
    )
  })

  it('ignores the values that are not relative paths', () => {
    for (const value of [
      'https://a.com/x.png',
      'data:image/png;base64,AA',
      'file:///x.png',
      '//cdn.com/x.png',
      '#top',
      '{{logo}}',
      '/abs/x.png',
      'C:\\x.png',
      '',
    ]) {
      expect(resolveFileURL('/p', value)).toBe(null)
    }
  })
})

describe('rewriteCssUrls', () => {
  it('rewrites only the relative urls', () => {
    const css = "background: url('bg.png') no-repeat, url(https://a.com/b.png); color: red"
    expect(rewriteCssUrls(css, '/p')).toBe(
      "background: url('file:///p/bg.png') no-repeat, url(https://a.com/b.png); color: red",
    )
  })

  it('quotes an unquoted url', () => {
    expect(rewriteCssUrls('background-image:url(bg.png)', '/p')).toBe(
      'background-image:url("file:///p/bg.png")',
    )
  })
})
