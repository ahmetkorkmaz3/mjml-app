import { describe, expect, it } from 'vitest'

import { getDesign } from './index'

describe('getDesign', () => {
  it('rejects a link that is not valid before any request', async () => {
    await expect(getDesign({ link: 'hello', source: 'mcp' })).rejects.toMatchObject({
      code: 'INVALID_LINK',
    })
  })

  it('uses the REST source when the settings say rest', async () => {
    await expect(
      getDesign({
        link: 'https://www.figma.com/design/KEY/N?node-id=1-1',
        source: 'rest',
        token: null,
      }),
    ).rejects.toMatchObject({ code: 'FIGMA_TOKEN_MISSING' })
  })
})
