import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import { ImportError } from '../errors'

// The Figma desktop app runs this MCP server when the user turns it on in
// Dev Mode. The tools read the file that is open in the desktop app.

const NAMED_ASSET_RE =
  /(?:const|let|var)\s+(\w+)\s*=\s*["'](https?:\/\/[^"']+\/assets\/[^"']+)["']/g
const ASSET_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/assets\/[^"'\s)`]+/g
const LIMIT_RE = /\brate[ -]?limit|\bquota\b|\blimit(s|ed)?\b/i

function limitError() {
  return new ImportError(
    'FIGMA_MCP_LIMIT',
    'The Figma MCP server reached the limit of your plan. Use the REST API source instead.',
  )
}

export async function connectMcp(url) {
  const client = new Client({ name: 'mjml-app', version: '1.0.0' })
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(url)))
  } catch (err) {
    await client.close().catch(() => {})
    throw err
  }
  return client
}

export function findAssets(code) {
  const assets = []
  const seen = new Set()
  for (const [, variable, url] of code.matchAll(NAMED_ASSET_RE)) {
    if (!seen.has(url)) {
      seen.add(url)
      assets.push({ id: url, url, suggestedName: variable.replace(/^img/, '') || 'image' })
    }
  }
  for (const [url] of code.matchAll(ASSET_URL_RE)) {
    if (!seen.has(url)) {
      seen.add(url)
      assets.push({ id: url, url, suggestedName: 'image' })
    }
  }
  return assets
}

function unavailable() {
  return new ImportError(
    'FIGMA_MCP_UNAVAILABLE',
    'The app could not connect to the Figma MCP server. Open the file in the Figma desktop app and turn on the desktop MCP server in Dev Mode.',
  )
}

function textOf(result) {
  return (result.content || [])
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n')
}

async function callTool(client, name, args, signal) {
  let result
  try {
    result = await client.callTool({ name, arguments: args }, undefined, { signal })
  } catch (err) {
    if (signal?.aborted || err instanceof ImportError) {
      throw err
    }
    if (LIMIT_RE.test(err.message)) {
      throw limitError()
    }
    throw new ImportError('FIGMA_ERROR', `Figma MCP: ${err.message}`)
  }
  if (result.isError) {
    const message = textOf(result)
    if (LIMIT_RE.test(message)) {
      throw limitError()
    }
    throw new ImportError('FIGMA_ERROR', `Figma MCP: ${message}`)
  }
  return result
}

async function optionalText(client, name, args, signal) {
  try {
    return textOf(await callTool(client, name, args, signal))
  } catch (err) {
    if (signal && signal.aborted) {
      throw err
    }
    return ''
  }
}

function parseMetadata(xml) {
  const tag = (xml.match(/<[a-z-]+\s[^>]*>/i) || [''])[0]
  const name = (tag.match(/\bname="([^"]*)"/) || [])[1]
  const width = Number((tag.match(/\bwidth="([\d.]+)"/) || [])[1])
  return { name: name || 'Figma design', width: width ? Math.round(width) : 600 }
}

function parseVariables(text) {
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' ? value : {}
  } catch (err) {
    return {}
  }
}

export async function getDesignFromMcp({ nodeId, url, connect = connectMcp, signal }) {
  let client
  try {
    client = await connect(url)
  } catch (err) {
    throw unavailable()
  }

  try {
    const metadata = parseMetadata(await optionalText(client, 'get_metadata', { nodeId }, signal))
    const context = textOf(
      await callTool(
        client,
        'get_design_context',
        { nodeId, clientLanguages: 'html,css', clientFrameworks: 'mjml' },
        signal,
      ),
    )
    const shot = await callTool(client, 'get_screenshot', { nodeId }, signal)
    const image = (shot.content || []).find(part => part.type === 'image')
    if (!image) {
      throw new ImportError('FIGMA_ERROR', 'The Figma MCP server did not return a screenshot.')
    }
    const variables = parseVariables(
      await optionalText(client, 'get_variable_defs', { nodeId }, signal),
    )

    return {
      source: 'mcp',
      name: metadata.name,
      width: metadata.width,
      screenshot: Buffer.from(image.data, 'base64'),
      screenshotType: image.mimeType || 'image/png',
      context,
      variables,
      assets: findAssets(context),
    }
  } finally {
    await client.close().catch(() => {})
  }
}

export async function testMcpConnection({ url, connect = connectMcp }) {
  let client
  try {
    client = await connect(url)
  } catch (err) {
    throw unavailable()
  }
  try {
    const { tools } = await client.listTools()
    if (!tools.some(tool => tool.name === 'get_design_context')) {
      return { ok: false, message: 'The server at this URL is not the Figma MCP server.' }
    }
    return { ok: true, message: 'Connected to the Figma desktop MCP server.' }
  } finally {
    await client.close().catch(() => {})
  }
}
