import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadAssets, slugify } from './download-assets'

function fakeFetch(files) {
  return vi.fn(async url => {
    const file = files[url]
    if (!file) {
      return new Response('missing', { status: 404 })
    }
    return new Response(file.body, { headers: { 'content-type': file.type } })
  })
}

describe('slugify', () => {
  it('makes a safe file name', () => {
    expect(slugify('Hero Image / Dark')).toBe('hero-image-dark')
    expect(slugify('Çiçek Logo')).toBe('cicek-logo')
    expect(slugify('***')).toBe('image')
  })
})

describe('downloadAssets', () => {
  let dir

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mjml-assets-'))
  })

  afterEach(() => rm(dir, { recursive: true, force: true }))

  it('downloads the images and never overwrites a file', async () => {
    await mkdir(join(dir, 'images'))
    await writeFile(join(dir, 'images', 'hero.png'), 'old')

    const fetch = fakeFetch({
      'u/1': { body: 'logo1', type: 'image/png' },
      'u/2': { body: 'logo2', type: 'image/png' },
      'u/3': { body: 'hero', type: 'image/jpeg' },
      'u/4': { body: '<svg/>', type: 'image/svg+xml' },
    })
    const onProgress = vi.fn()

    const res = await downloadAssets({
      projectPath: dir,
      fetch,
      onProgress,
      assets: [
        { id: 'a', url: 'u/1', suggestedName: 'Logo' },
        { id: 'b', url: 'u/2', suggestedName: 'Logo' },
        { id: 'c', url: 'u/3', suggestedName: 'Hero' },
        { id: 'd', url: 'u/4', suggestedName: 'Icon' },
        { id: 'e', url: 'u/404', suggestedName: 'Gone' },
        { id: 'f', url: null, suggestedName: 'No url' },
      ],
    })

    expect(res.map(r => [r.path, r.ok, r.format])).toEqual([
      ['images/logo.png', true, 'png'],
      ['images/logo-2.png', true, 'png'],
      ['images/hero.jpg', true, 'jpg'],
      ['images/icon.svg', true, 'svg'],
      ['images/gone.png', false, 'png'],
      ['images/no-url.png', false, 'png'],
    ])
    expect(await readFile(join(dir, 'images', 'hero.png'), 'utf8')).toBe('old')
    expect(await readFile(join(dir, 'images', 'logo-2.png'), 'utf8')).toBe('logo2')
    expect(onProgress).toHaveBeenCalledWith({ step: 'assets', detail: '6/6' })
  })

  it('does nothing without assets', async () => {
    expect(await downloadAssets({ assets: [], projectPath: dir })).toEqual([])
  })
})
