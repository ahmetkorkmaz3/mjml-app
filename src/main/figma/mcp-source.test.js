import { describe, expect, it, vi } from 'vitest'

import { findAssets, getDesignFromMcp } from './mcp-source'

const CODE = `const imgLogo = "http://localhost:3845/assets/abc.png";
const imgHeroImage = "http://localhost:3845/assets/def.png";
export default function Newsletter() {
  return <div><img src={imgLogo} /><img src="http://localhost:3845/assets/ghi.svg" /></div>
}`

const text = value => ({ content: [{ type: 'text', text: value }] })

function fakeClient(overrides = {}) {
  const results = {
    get_metadata: text('<frame id="1:2" name="Newsletter" x="0" y="0" width="640" height="900">'),
    get_design_context: text(CODE),
    get_screenshot: {
      content: [
        { type: 'image', data: Buffer.from('png').toString('base64'), mimeType: 'image/png' },
      ],
    },
    get_variable_defs: text('{"color/primary":"#1A73E8"}'),
    ...overrides,
  }
  return {
    callTool: vi.fn(async ({ name }) => results[name]),
    close: vi.fn(async () => {}),
  }
}

describe('findAssets', () => {
  it('names the assets after their variables and keeps unnamed ones', () => {
    expect(findAssets(CODE)).toEqual([
      {
        id: 'http://localhost:3845/assets/abc.png',
        url: 'http://localhost:3845/assets/abc.png',
        suggestedName: 'Logo',
      },
      {
        id: 'http://localhost:3845/assets/def.png',
        url: 'http://localhost:3845/assets/def.png',
        suggestedName: 'HeroImage',
      },
      {
        id: 'http://localhost:3845/assets/ghi.svg',
        url: 'http://localhost:3845/assets/ghi.svg',
        suggestedName: 'image',
      },
    ])
  })
})

describe('getDesignFromMcp', () => {
  it('builds the design object and closes the client', async () => {
    const client = fakeClient()
    const design = await getDesignFromMcp({
      nodeId: '1:2',
      url: 'http://127.0.0.1:3845/mcp',
      connect: async () => client,
    })
    expect(design).toMatchObject({
      source: 'mcp',
      name: 'Newsletter',
      width: 640,
      context: CODE,
      variables: { 'color/primary': '#1A73E8' },
    })
    expect(design.screenshot.toString()).toBe('png')
    expect(design.assets).toHaveLength(3)
    expect(client.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'get_design_context',
        arguments: expect.objectContaining({ nodeId: '1:2' }),
      }),
      undefined,
      expect.any(Object),
    )
    expect(client.close).toHaveBeenCalled()
  })

  it('maps a connection error to FIGMA_MCP_UNAVAILABLE', async () => {
    const connect = async () => {
      throw new Error('fetch failed: ECONNREFUSED')
    }
    await expect(getDesignFromMcp({ nodeId: '1:2', url: 'x', connect })).rejects.toMatchObject({
      code: 'FIGMA_MCP_UNAVAILABLE',
    })
  })

  it('maps a limit error to FIGMA_MCP_LIMIT', async () => {
    const client = fakeClient({
      get_design_context: {
        isError: true,
        content: [{ type: 'text', text: 'Rate limit exceeded for your plan' }],
      },
    })
    await expect(
      getDesignFromMcp({ nodeId: '1:2', url: 'x', connect: async () => client }),
    ).rejects.toMatchObject({ code: 'FIGMA_MCP_LIMIT' })
    expect(client.close).toHaveBeenCalled()
  })

  it('does not map non-limit errors to FIGMA_MCP_LIMIT', async () => {
    const client = fakeClient({
      get_design_context: {
        isError: true,
        content: [{ type: 'text', text: 'Failed to generate design context' }],
      },
    })
    await expect(
      getDesignFromMcp({ nodeId: '1:2', url: 'x', connect: async () => client }),
    ).rejects.toMatchObject({ code: 'FIGMA_ERROR' })
    expect(client.close).toHaveBeenCalled()
  })

  it('works without variables and metadata', async () => {
    const client = fakeClient({
      get_variable_defs: { isError: true, content: [{ type: 'text', text: 'No variables' }] },
      get_metadata: text('nothing'),
    })
    const design = await getDesignFromMcp({ nodeId: '1:2', url: 'x', connect: async () => client })
    expect(design.variables).toEqual({})
    expect(design.width).toBe(600)
    expect(design.name).toBe('Figma design')
  })
})
