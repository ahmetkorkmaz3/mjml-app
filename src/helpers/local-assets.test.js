import { describe, expect, it } from 'vitest'

import { findLocalAssets } from './local-assets'

describe('findLocalAssets', () => {
  it('finds the relative paths of src, href, background and url()', () => {
    const html = `
      <img src="images/logo.png" />
      <a href="docs/terms.pdf">terms</a>
      <td background="images/bg.jpg"></td>
      <div style="background-image: url('images/hero.png')"></div>
      <div style="background: url(images/plain.png) no-repeat"></div>
    `
    expect(findLocalAssets(html)).toEqual([
      'images/logo.png',
      'docs/terms.pdf',
      'images/bg.jpg',
      'images/hero.png',
      'images/plain.png',
    ])
  })

  it('ignores the remote, inline and special links', () => {
    const html = `
      <img src="https://example.com/a.png" />
      <img src="http://example.com/b.png" />
      <img src="//cdn.example.com/c.png" />
      <img src="data:image/png;base64,AAAA" />
      <img src="cid:logo" />
      <a href="mailto:a@b.c">mail</a>
      <a href="tel:123">tel</a>
      <a href="#top">top</a>
      <a href="{{unsubscribe_url}}">unsubscribe</a>
      <a href="<%= link %>">erb</a>
      <img src="" />
    `
    expect(findLocalAssets(html)).toEqual([])
  })

  it('ignores the absolute paths and the paths out of the folder', () => {
    const html = `
      <img src="/Users/me/logo.png" />
      <img src="C:\\images\\logo.png" />
      <img src="../shared/logo.png" />
      <img src="images/../../logo.png" />
    `
    expect(findLocalAssets(html)).toEqual([])
  })

  it('removes the query, the hash and the duplicates', () => {
    const html = `
      <img src="images/logo.png?v=2" />
      <img src="./images/logo.png#x" />
      <img src='images/logo.png' />
    `
    expect(findLocalAssets(html)).toEqual(['images/logo.png'])
  })

  it('decodes the URL encoding', () => {
    expect(findLocalAssets('<img src="images/my%20logo.png" />')).toEqual(['images/my logo.png'])
  })
})
