import { ImportError } from '../errors'
import { getDesignFromMcp, testMcpConnection } from './mcp-source'
import { parseFigmaUrl } from './parse-url'
import { getDesignFromRest, testRestConnection } from './rest-source'

export async function getDesign({ link, source, mcpURL, token, signal, fetch, connect }) {
  const parsed = parseFigmaUrl(link)
  if (!parsed) {
    throw new ImportError(
      'INVALID_LINK',
      'This is not a link to a Figma node. In Figma, right-click the frame and select "Copy link to selection".',
    )
  }
  if (source === 'rest') {
    return getDesignFromRest({ ...parsed, token, signal, fetch })
  }
  return getDesignFromMcp({ nodeId: parsed.nodeId, url: mcpURL, signal, connect })
}

export function testFigmaConnection({ source, mcpURL, token, fetch, connect }) {
  if (source === 'rest') {
    return testRestConnection({ token, fetch })
  }
  return testMcpConnection({ url: mcpURL, connect })
}
