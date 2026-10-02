import { ImportError } from '../errors'
import { toHex, trimNode } from './trim-node'

const API = 'https://api.figma.com/v1'
const MAX_RETRY_SECONDS = 60

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function tokenMissing() {
  return new ImportError(
    'FIGMA_TOKEN_MISSING',
    'Add a Figma access token in Settings > AI & Figma.',
  )
}

function createClient({ token, fetch, signal, wait }) {
  return async function get(path) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${API}${path}`, { headers: { 'X-Figma-Token': token }, signal })
      if (res.status === 429 && attempt === 0) {
        const seconds = Number(res.headers.get('retry-after')) || 5
        await wait(Math.min(seconds, MAX_RETRY_SECONDS) * 1000)
        continue
      }
      if (res.status === 429) {
        throw new ImportError('FIGMA_RATE_LIMIT', 'Figma limits the requests. Try again later.')
      }
      if (res.status === 403) {
        throw new ImportError(
          'FIGMA_FORBIDDEN',
          'Figma did not accept the token, or the token has no access to this file.',
        )
      }
      if (res.status === 404) {
        throw new ImportError('FIGMA_NOT_FOUND', 'Figma did not find this file or node.')
      }
      if (!res.ok) {
        throw new ImportError('FIGMA_ERROR', `Figma returned HTTP ${res.status}.`)
      }
      return res.json()
    }
  }
}

export function flattenVariables(response) {
  const result = {}
  const variables = (response && response.meta && response.meta.variables) || {}
  for (const variable of Object.values(variables)) {
    const value = Object.values(variable.valuesByMode || {})[0]
    if (value === undefined || (value && value.type === 'VARIABLE_ALIAS')) {
      continue
    }
    result[variable.name] =
      value && typeof value === 'object' && 'r' in value ? toHex(value) : value
  }
  return result
}

export async function getDesignFromRest({
  fileKey,
  nodeId,
  token,
  fetch = globalThis.fetch,
  signal,
  wait = sleep,
}) {
  if (!token) {
    throw tokenMissing()
  }
  const get = createClient({ token, fetch, signal, wait })

  const nodes = await get(`/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`)
  const document = nodes.nodes && nodes.nodes[nodeId] && nodes.nodes[nodeId].document
  if (!document) {
    throw new ImportError('FIGMA_NOT_FOUND', 'Figma did not find this file or node.')
  }

  const { tree, exports, imageFills } = trimNode(document)

  const ids = [nodeId, ...exports.map(item => item.id)].join(',')
  const rendered = await get(`/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`)
  const renders = rendered.images || {}
  if (!renders[nodeId]) {
    throw new ImportError('FIGMA_ERROR', 'Figma could not render the node.')
  }
  const shot = await fetch(renders[nodeId], { signal })
  const screenshot = Buffer.from(await shot.arrayBuffer())

  let fills = {}
  if (imageFills.length) {
    const res = await get(`/files/${fileKey}/images`)
    fills = (res.meta && res.meta.images) || {}
  }

  // the variables endpoint works only on the Enterprise plan
  let variables = {}
  try {
    variables = flattenVariables(await get(`/files/${fileKey}/variables/local`))
  } catch (err) {
    if (signal && signal.aborted) {
      throw err
    }
  }

  return {
    source: 'rest',
    name: document.name,
    width: Math.round((document.absoluteBoundingBox && document.absoluteBoundingBox.width) || 600),
    screenshot,
    context: JSON.stringify(tree),
    variables,
    assets: [
      ...exports.map(item => ({
        id: item.id,
        url: renders[item.id] || null,
        suggestedName: item.name,
      })),
      ...imageFills.map(fill => ({
        id: fill.imageRef,
        url: fills[fill.imageRef] || null,
        suggestedName: fill.name,
      })),
    ],
  }
}

export async function testRestConnection({ token, fetch = globalThis.fetch }) {
  if (!token) {
    throw tokenMissing()
  }
  const me = await createClient({ token, fetch, wait: sleep })('/me')
  return { ok: true, message: `Connected to Figma as ${me.handle || me.email}.` }
}
