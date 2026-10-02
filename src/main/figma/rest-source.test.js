import { describe, expect, it, vi } from 'vitest'

import { flattenVariables, getDesignFromRest } from './rest-source'

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
