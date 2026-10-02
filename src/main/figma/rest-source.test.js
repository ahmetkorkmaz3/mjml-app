import { describe, expect, it, vi } from 'vitest'

import { flattenVariables, getDesignFromRest, testRestConnection } from './rest-source'

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers })

const node = {
  id: '1:1',
  name: 'Newsletter',
  type: 'FRAME',
  absoluteBoundingBox: { x: 0, y: 0, width: 640, height: 900 },
  children: [
    { id: '1:2', name: 'Title', type: 'TEXT', characters: 'Hello' },
    { id: '1:3', name: 'Logo', type: 'VECTOR' },
    { id: '1:4', name: 'Hero', type: 'RECTANGLE', fills: [{ type: 'IMAGE', imageRef: 'ref1' }] },
  ],
}

// routes: [urlPart, () => Response]. The first route whose part is in the URL answers.
function fakeFetch(routes) {
  const fn = vi.fn(async url => {
    const route = routes.find(([part]) => url.includes(part))
    if (!route) {
      throw new Error(`Unexpected URL ${url}`)
    }
    return route[1]()
  })
  return fn
}

function defaultRoutes(overrides = {}) {
  return [
    ['/files/KEY/nodes', overrides.nodes || (() => json({ nodes: { '1:1': { document: node } } }))],
    [
      '/images/KEY',
      () => json({ images: { '1:1': 'https://cdn/shot.png', '1:3': 'https://cdn/logo.png' } }),
    ],
    ['/files/KEY/images', () => json({ meta: { images: { ref1: 'https://cdn/hero.png' } } })],
    ['/files/KEY/variables/local', overrides.variables || (() => json({ status: 403 }, 403))],
    ['https://cdn/shot.png', () => new Response(Buffer.from('png'))],
  ]
}

const params = { fileKey: 'KEY', nodeId: '1:1', token: 'figd_token', wait: async () => {} }

describe('getDesignFromRest', () => {
  it('builds the design object', async () => {
    const fetch = fakeFetch(defaultRoutes())
    const design = await getDesignFromRest({ ...params, fetch })

    expect(design.source).toBe('rest')
    expect(design.name).toBe('Newsletter')
    expect(design.width).toBe(640)
    expect(design.screenshot.toString()).toBe('png')
    expect(JSON.parse(design.context).children[0].text).toBe('Hello')
    expect(design.variables).toEqual({})
    expect(design.assets).toEqual([
      { id: '1:3', url: 'https://cdn/logo.png', suggestedName: 'Logo' },
      { id: 'ref1', url: 'https://cdn/hero.png', suggestedName: 'Hero' },
    ])
    expect(fetch.mock.calls[0][1].headers['X-Figma-Token']).toBe('figd_token')
  })

  it('reads the variables when the plan allows it', async () => {
    const variables = () =>
      json({
        meta: {
          variables: {
            v1: { name: 'color/primary', valuesByMode: { m1: { r: 0, g: 0, b: 1, a: 1 } } },
          },
        },
      })
    const design = await getDesignFromRest({
      ...params,
      fetch: fakeFetch(defaultRoutes({ variables })),
    })
    expect(design.variables).toEqual({ 'color/primary': '#0000ff' })
  })

  it('waits for Retry-After and tries again once after a 429', async () => {
    let count = 0
    const nodes = () =>
      count++ === 0
        ? json({}, 429, { 'retry-after': '2' })
        : json({ nodes: { '1:1': { document: node } } })
    const wait = vi.fn(async () => {})
    await getDesignFromRest({ ...params, wait, fetch: fakeFetch(defaultRoutes({ nodes })) })
    expect(wait).toHaveBeenCalledWith(2000)
  })

  it('maps 403 to FIGMA_FORBIDDEN', async () => {
    const nodes = () => json({}, 403)
    await expect(
      getDesignFromRest({ ...params, fetch: fakeFetch(defaultRoutes({ nodes })) }),
    ).rejects.toMatchObject({ code: 'FIGMA_FORBIDDEN' })
  })

  it('maps a missing node to FIGMA_NOT_FOUND', async () => {
    const nodes = () => json({ nodes: { '1:1': null } })
    await expect(
      getDesignFromRest({ ...params, fetch: fakeFetch(defaultRoutes({ nodes })) }),
    ).rejects.toMatchObject({ code: 'FIGMA_NOT_FOUND' })
  })

  it('needs a token', async () => {
    const fetch = vi.fn()
    await expect(getDesignFromRest({ ...params, token: null, fetch })).rejects.toMatchObject({
      code: 'FIGMA_TOKEN_MISSING',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects with FIGMA_ERROR if screenshot download fails', async () => {
    const shot = () => new Response('', { status: 404 })
    const routes = [
      ['/files/KEY/nodes', () => json({ nodes: { '1:1': { document: node } } })],
      [
        '/images/KEY',
        () => json({ images: { '1:1': 'https://cdn/shot.png', '1:3': 'https://cdn/logo.png' } }),
      ],
      ['/files/KEY/images', () => json({ meta: { images: { ref1: 'https://cdn/hero.png' } } })],
      ['/files/KEY/variables/local', () => json({ status: 403 }, 403)],
      ['https://cdn/shot.png', shot],
    ]
    await expect(getDesignFromRest({ ...params, fetch: fakeFetch(routes) })).rejects.toMatchObject({
      code: 'FIGMA_ERROR',
      message: 'Figma could not download the screenshot.',
    })
  })

  it('rejects with FIGMA_RATE_LIMIT if 429 occurs twice', async () => {
    let count = 0
    const nodes = () =>
      count++ < 2
        ? json({}, 429, { 'retry-after': '1' })
        : json({ nodes: { '1:1': { document: node } } })
    const wait = vi.fn(async () => {})
    const fetch = fakeFetch(defaultRoutes({ nodes }))
    await expect(getDesignFromRest({ ...params, wait, fetch })).rejects.toMatchObject({
      code: 'FIGMA_RATE_LIMIT',
    })
    expect(wait).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(2) // /files/KEY/nodes called twice, error thrown
  })

  it('caps Retry-After to 60 seconds', async () => {
    let count = 0
    const nodes = () =>
      count++ === 0
        ? json({}, 429, { 'retry-after': '300' })
        : json({ nodes: { '1:1': { document: node } } })
    const wait = vi.fn(async () => {})
    await getDesignFromRest({ ...params, wait, fetch: fakeFetch(defaultRoutes({ nodes })) })
    expect(wait).toHaveBeenCalledWith(60000)
  })

  it('does not expose the token in error messages', async () => {
    const nodes = () => json({}, 403)
    try {
      await getDesignFromRest({ ...params, fetch: fakeFetch(defaultRoutes({ nodes })) })
    } catch (err) {
      expect(err.message).not.toContain('figd_token')
    }
  })

  it('maps 404 on nodes route to FIGMA_NOT_FOUND', async () => {
    const nodes = () => json({}, 404)
    await expect(
      getDesignFromRest({ ...params, fetch: fakeFetch(defaultRoutes({ nodes })) }),
    ).rejects.toMatchObject({ code: 'FIGMA_NOT_FOUND' })
  })

  it('maps 500 on nodes route to FIGMA_ERROR', async () => {
    const nodes = () => json({}, 500)
    await expect(
      getDesignFromRest({ ...params, fetch: fakeFetch(defaultRoutes({ nodes })) }),
    ).rejects.toMatchObject({ code: 'FIGMA_ERROR' })
  })
})

describe('testRestConnection', () => {
  it('returns ok and message with handle', async () => {
    const fetch = fakeFetch([['/me', () => json({ handle: 'ahmet' })]])
    const result = await testRestConnection({ token: 'figd_token', fetch })
    expect(result).toEqual({
      ok: true,
      message: 'Connected to Figma as ahmet.',
    })
  })

  it('returns ok and message with email', async () => {
    const fetch = fakeFetch([['/me', () => json({ email: 'ahmet@example.com' })]])
    const result = await testRestConnection({ token: 'figd_token', fetch })
    expect(result).toEqual({
      ok: true,
      message: 'Connected to Figma as ahmet@example.com.',
    })
  })

  it('rejects with FIGMA_TOKEN_MISSING when token is null', async () => {
    const fetch = vi.fn()
    await expect(testRestConnection({ token: null, fetch })).rejects.toMatchObject({
      code: 'FIGMA_TOKEN_MISSING',
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('flattenVariables', () => {
  it('uses the first mode and skips aliases', () => {
    expect(
      flattenVariables({
        meta: {
          variables: {
            a: { name: 'space/m', valuesByMode: { m1: 16, m2: 24 } },
            b: { name: 'alias', valuesByMode: { m1: { type: 'VARIABLE_ALIAS', id: 'a' } } },
          },
        },
      }),
    ).toEqual({ 'space/m': 16 })
  })
})
