# Figma to MJML Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user pastes a Figma link in MJML App, and the app writes a new `.mjml` file made by an AI model from that Figma node, with a refine command after it.

**Architecture:** All network calls and secrets stay in the Electron main process (`src/main/`). A Figma source (Desktop MCP or REST) returns one `Design` object. The images download into the project. The Vercel AI SDK sends the design to the provider that the user selects. The main process validates the MJML with `mjml2html` and sends the errors back to the model for at most 2 fix rounds, then runs one visual self-check. The renderer calls the main process through IPC and gets results as `{ error: { code, message } }` or a success object.

**Tech Stack:** Electron 44, electron-vite 5, React 19, Redux + Immutable.js, `ai` 7, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`, `@modelcontextprotocol/sdk` 1.x, `mjml` 5, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-02-figma-to-mjml-design.md`

## Global Constraints

- Node.js 24 (`.nvmrc`), Yarn 1. Add packages with `yarn add`, never with npm.
- Runtime packages of the main process go into `dependencies`. `vitest` goes into `devDependencies`.
- Main and preload code use relative imports without file extensions (for example `from './figma'`). Renderer code imports from the `src` root (`from 'helpers/api'`).
- The renderer never imports `fs`, `path`, `os` or `electron`. It uses `helpers/api`, `helpers/fs` and `import { path } from 'helpers/api'`.
- Files with JSX use the `.jsx` extension. Styles use Sass `@use`.
- Every commit passes `yarn lint`, `yarn prettier:check` and `yarn test`.
- IPC handlers never throw to the renderer. They return `{ error: { code, message } }` (errors lose `code` on the context bridge).
- Messages and logs never contain an API key or a token.
- Figma Desktop MCP default URL: `http://127.0.0.1:3845/mcp`.
- At most 2 MJML fix rounds. One visual self-check, only when `ai.visualCheck` is true and the model accepts images.
- Body width: the design width, or 600 px if the design is wider than 700 px.
- Settings keys: `ai.provider` (`anthropic` | `openai` | `google` | `openai-compatible`), `ai.model`, `ai.baseURL`, `ai.visualCheck`, `figma.source` (`mcp` | `rest`), `figma.mcpURL`.
- Secret names: `ai.anthropic`, `ai.openai`, `ai.google`, `ai.openai-compatible`, `figma.token`.
- UI text is English, like the rest of the app.

## Review Focus

- A root frame with export settings (designers often mark the whole email for export) must not become one big image. The root stays a layout node. Test in Task 4.
- An icon made of many vector layers must download as one image, not as one file for each vector. Test in Task 4.
- A model reply that is cut (no `</mjml>`) or that has a CSS code block before the MJML block must not give a broken file. Extraction picks the MJML block or returns `null`, and the loop asks again. Tests in Task 5 and Task 6.
- Figma links copied from the app have variants: branch links, `node-id=12%3A34`, spaces around the link. All must work. Test in Task 1.
- The import must never overwrite a user file: the `.mjml` file uses the `wx` flag, and image names get a number suffix. Tests in Task 10 and Task 11.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `vitest.config.mjs` | Vitest config: node environment, `src/**/*.test.js` |
| `src/main/errors.js` | `ImportError`, `toErrorResult()`, `redact()` |
| `src/main/secrets.js` | `createSecretStore()` on top of `safeStorage`, `SECRET_NAMES` |
| `src/main/figma/parse-url.js` | `parseFigmaUrl()` |
| `src/main/figma/trim-node.js` | `trimNode()`, `toHex()` for REST node JSON |
| `src/main/figma/rest-source.js` | `getDesignFromRest()`, `flattenVariables()`, `testRestConnection()` |
| `src/main/figma/mcp-source.js` | `connectMcp()`, `getDesignFromMcp()`, `findAssets()`, `testMcpConnection()` |
| `src/main/figma/index.js` | `getDesign()` picks the source |
| `src/main/ai/extract-mjml.js` | `extractMjml()` |
| `src/main/ai/validate-mjml.js` | `validateMjml()` |
| `src/main/ai/prompt.js` | system prompt and message builders |
| `src/main/ai/generate-mjml.js` | `generateMjml()`, `refineMjml()`, the fix loop, the visual check |
| `src/main/ai/providers.js` | `createModel()` |
| `src/data/aiProviders.js` | provider list shared by main and renderer |
| `src/main/download-assets.js` | `downloadAssets()`, `slugify()` |
| `src/main/screenshot.js` | `takeScreenshot()`, `renderScreenshot()` (moved from `ipc.js`) |
| `src/main/figma-import.js` | `createFigmaImporter()`: import, refine, cancel, connection tests |
| `src/main/ipc.js` | new IPC handlers |
| `src/preload/index.js` | `window.api.figma`, `window.api.ai`, `window.api.secrets`, new event channel |
| `src/actions/settings.js`, `src/reducers/settings.js` | `ai` and `figma` defaults and state |
| `src/components/SettingsModal/AIFigmaSettings.jsx` | "AI & Figma" settings tab |
| `src/pages/Project/FigmaImportModal.jsx` | import modal |
| `src/pages/Project/RefineModal.jsx` | refine modal |
| `src/pages/Project/index.jsx` | buttons and modal wiring |

---

### Task 1: Vitest setup and Figma link parsing

**Files:**

- Create: `vitest.config.mjs`
- Create: `src/main/figma/parse-url.js`
- Test: `src/main/figma/parse-url.test.js`
- Modify: `package.json` (script `test`, devDependency `vitest`)
- Modify: `.github/workflows/ci.yml` (step `yarn test`)

**Interfaces:**

- Produces: `parseFigmaUrl(link: string) -> { fileKey: string, nodeId: string } | null`. `nodeId` uses the API form `12:34`.

- [ ] **Step 1: Install Vitest and add the script**

Run: `yarn add -D vitest@^5`

In `package.json` `scripts`, add after `"prettier:check"`:

```json
    "test": "vitest run",
```

Create `vitest.config.mjs`:

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
    environment: 'node',
  },
})
```

In `.github/workflows/ci.yml`, add after `- run: yarn prettier:check`:

```yaml
      - run: yarn test
```

- [ ] **Step 2: Write the failing test**

Create `src/main/figma/parse-url.test.js`:

```js
import { describe, expect, it } from 'vitest'

import { parseFigmaUrl } from './parse-url'

describe('parseFigmaUrl', () => {
  it('reads a design link', () => {
    expect(
      parseFigmaUrl('https://www.figma.com/design/AbC123/Newsletter?node-id=12-34&t=x'),
    ).toEqual({ fileKey: 'AbC123', nodeId: '12:34' })
  })

  it('reads file and proto links', () => {
    expect(parseFigmaUrl('https://www.figma.com/file/AbC123/N?node-id=1-2')).toEqual({
      fileKey: 'AbC123',
      nodeId: '1:2',
    })
    expect(parseFigmaUrl('https://figma.com/proto/AbC123/N?node-id=1-2')).toEqual({
      fileKey: 'AbC123',
      nodeId: '1:2',
    })
  })

  it('uses the branch key of a branch link', () => {
    expect(
      parseFigmaUrl('https://www.figma.com/design/AbC123/branch/BrX9/Newsletter?node-id=5-6'),
    ).toEqual({ fileKey: 'BrX9', nodeId: '5:6' })
  })

  it('accepts an encoded colon and spaces around the link', () => {
    expect(parseFigmaUrl('  https://www.figma.com/design/AbC123/N?node-id=12%3A34 \n')).toEqual({
      fileKey: 'AbC123',
      nodeId: '12:34',
    })
  })

  it('returns null for a link without a node id', () => {
    expect(parseFigmaUrl('https://www.figma.com/design/AbC123/Newsletter')).toBeNull()
  })

  it('returns null for other hosts and for text that is not a URL', () => {
    expect(parseFigmaUrl('https://example.com/design/AbC123/N?node-id=1-2')).toBeNull()
    expect(parseFigmaUrl('https://notfigma.com/design/AbC123/N?node-id=1-2')).toBeNull()
    expect(parseFigmaUrl('hello')).toBeNull()
    expect(parseFigmaUrl('')).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test and make sure it fails**

Run: `yarn test src/main/figma/parse-url.test.js`
Expected: FAIL, the module `./parse-url` does not exist.

- [ ] **Step 4: Write the implementation**

Create `src/main/figma/parse-url.js`:

```js
// Reads the file key and the node id from a Figma link, for example
// https://www.figma.com/design/<fileKey>/<name>?node-id=12-34
// The link has `12-34`, the Figma API uses `12:34`.
const PATH_RE = /^\/(?:design|file|proto)\/([A-Za-z0-9]+)(?:\/branch\/([A-Za-z0-9]+))?/
const NODE_ID_RE = /^\d+[-:]\d+$/

export function parseFigmaUrl(link) {
  let url
  try {
    url = new URL(String(link).trim())
  } catch (err) {
    return null
  }
  if (url.hostname !== 'figma.com' && !url.hostname.endsWith('.figma.com')) {
    return null
  }
  const match = url.pathname.match(PATH_RE)
  if (!match) {
    return null
  }
  const nodeId = url.searchParams.get('node-id')
  if (!nodeId || !NODE_ID_RE.test(nodeId)) {
    return null
  }
  return { fileKey: match[2] || match[1], nodeId: nodeId.replace('-', ':') }
}
```

- [ ] **Step 5: Run the test and make sure it passes**

Run: `yarn test src/main/figma/parse-url.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
yarn prettier --write vitest.config.mjs src/main/figma .github/workflows/ci.yml package.json
yarn lint && yarn prettier:check
git add vitest.config.mjs src/main/figma package.json yarn.lock .github/workflows/ci.yml
git commit -m "Add Vitest and the Figma link parser"
```

---

### Task 2: Error results and redaction

**Files:**

- Create: `src/main/errors.js`
- Test: `src/main/errors.test.js`
- Modify: `package.json` (dependency `ai`)

**Interfaces:**

- Produces:
  - `class ImportError extends Error { code: string }`, `new ImportError(code, message)`
  - `redact(text: string, secrets: string[]) -> string` (replaces each secret of 4 or more characters with `***`)
  - `toErrorResult(err, secrets = []) -> { error: { code: string, message: string } }`. Codes: the `ImportError` code, `CANCELLED` (`AbortError`), `AI_UNAUTHORIZED` (`APICallError` 401 or 403), `AI_ERROR` (other `APICallError`), `UNKNOWN`. A `RetryError` is unwrapped to its `lastError`.

- [ ] **Step 1: Install the AI SDK core**

Run: `yarn add ai@^7`

- [ ] **Step 2: Write the failing test**

Create `src/main/errors.test.js`:

```js
import { APICallError, RetryError } from 'ai'
import { describe, expect, it } from 'vitest'

import { ImportError, redact, toErrorResult } from './errors'

function apiError(statusCode, message = 'Bad request') {
  return new APICallError({
    message,
    url: 'https://api.example.com',
    requestBodyValues: {},
    statusCode,
    isRetryable: false,
  })
}

describe('toErrorResult', () => {
  it('keeps the code of an ImportError', () => {
    expect(toErrorResult(new ImportError('INVALID_LINK', 'Bad link.'))).toEqual({
      error: { code: 'INVALID_LINK', message: 'Bad link.' },
    })
  })

  it('maps an abort to CANCELLED', () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    expect(toErrorResult(err).error.code).toBe('CANCELLED')
  })

  it('maps 401 and 403 from the AI provider to AI_UNAUTHORIZED', () => {
    expect(toErrorResult(apiError(401)).error.code).toBe('AI_UNAUTHORIZED')
    expect(toErrorResult(apiError(403)).error.code).toBe('AI_UNAUTHORIZED')
  })

  it('maps other AI provider errors to AI_ERROR and keeps the message', () => {
    const { error } = toErrorResult(apiError(500, 'Overloaded'))
    expect(error.code).toBe('AI_ERROR')
    expect(error.message).toContain('Overloaded')
  })

  it('unwraps a RetryError', () => {
    const err = new RetryError({
      message: 'Failed after 2 attempts',
      reason: 'maxRetriesExceeded',
      errors: [apiError(500), apiError(401)],
    })
    expect(toErrorResult(err).error.code).toBe('AI_UNAUTHORIZED')
  })

  it('gives UNKNOWN for other errors', () => {
    expect(toErrorResult(new Error('boom'))).toEqual({
      error: { code: 'UNKNOWN', message: 'boom' },
    })
  })

  it('removes secrets from the message', () => {
    const { error } = toErrorResult(new Error('key sk-secret-123 is wrong'), ['sk-secret-123'])
    expect(error.message).toBe('key *** is wrong')
  })
})

describe('redact', () => {
  it('ignores empty and very short secrets', () => {
    expect(redact('abc', ['', null, 'ab'])).toBe('abc')
  })
})
```

- [ ] **Step 3: Run the test and make sure it fails**

Run: `yarn test src/main/errors.test.js`
Expected: FAIL, the module `./errors` does not exist.

- [ ] **Step 4: Write the implementation**

Create `src/main/errors.js`:

```js
import { APICallError, RetryError } from 'ai'

// An error with a code that the renderer can show. Errors lose their `code`
// when they cross the context bridge, so the IPC handlers return
// toErrorResult(err) instead of throwing.
export class ImportError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ImportError'
    this.code = code
  }
}

export function redact(text, secrets = []) {
  return secrets
    .filter(secret => typeof secret === 'string' && secret.length >= 4)
    .reduce((result, secret) => result.split(secret).join('***'), String(text))
}

export function toErrorResult(err, secrets = []) {
  if (RetryError.isInstance(err) && err.lastError) {
    err = err.lastError
  }

  let code = 'UNKNOWN'
  let message = (err && err.message) || 'Unknown error.'

  if (err instanceof ImportError) {
    code = err.code
  } else if (err && err.name === 'AbortError') {
    code = 'CANCELLED'
    message = 'The import was cancelled.'
  } else if (APICallError.isInstance(err)) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      code = 'AI_UNAUTHORIZED'
      message = 'The AI provider did not accept the API key. Check the key in Settings > AI & Figma.'
    } else {
      code = 'AI_ERROR'
      message = `The AI provider returned an error: ${err.message}`
    }
  }

  return { error: { code, message: redact(message, secrets) } }
}
```

- [ ] **Step 5: Run the test and make sure it passes**

Run: `yarn test src/main/errors.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
yarn prettier --write src/main/errors.js src/main/errors.test.js
yarn lint && yarn prettier:check
git add src/main/errors.js src/main/errors.test.js package.json yarn.lock
git commit -m "Add error results with codes for the Figma import"
```

---

### Task 3: Secret store

**Files:**

- Create: `src/main/secrets.js`
- Test: `src/main/secrets.test.js`

**Interfaces:**

- Consumes: `ImportError` from `src/main/errors.js`.
- Produces:
  - `SECRET_NAMES: string[]` = `['ai.anthropic', 'ai.openai', 'ai.google', 'ai.openai-compatible', 'figma.token']`
  - `createSecretStore({ filePath, safeStorage }) -> { isAvailable(): boolean, set(name, value): Promise<void>, has(name): Promise<boolean>, get(name): Promise<string|null>, getAll(): Promise<string[]> }`. `set` with an empty value removes the secret. `set` throws `ImportError('ENCRYPTION_UNAVAILABLE')` when encryption is not available. `getAll` returns all values (for redaction).

- [ ] **Step 1: Write the failing test**

Create `src/main/secrets.test.js`:

```js
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSecretStore } from './secrets'

// reverses the text, so the saved file never has the plain value
function fakeSafeStorage(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: text => Buffer.from([...text].reverse().join(''), 'utf8'),
    decryptString: buffer => [...buffer.toString('utf8')].reverse().join(''),
  }
}

describe('createSecretStore', () => {
  let dir
  let filePath

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mjml-secrets-'))
    filePath = join(dir, 'secrets.json')
  })

  afterEach(() => rm(dir, { recursive: true, force: true }))

  it('saves, reads and removes a secret', async () => {
    const store = createSecretStore({ filePath, safeStorage: fakeSafeStorage() })
    expect(await store.has('ai.openai')).toBe(false)

    await store.set('ai.openai', 'sk-123456')
    expect(await store.has('ai.openai')).toBe(true)
    expect(await store.get('ai.openai')).toBe('sk-123456')
    expect(await store.getAll()).toEqual(['sk-123456'])
    expect(await readFile(filePath, 'utf8')).not.toContain('sk-123456')

    await store.set('ai.openai', '')
    expect(await store.has('ai.openai')).toBe(false)
    expect(await store.get('ai.openai')).toBeNull()
  })

  it('refuses to save when encryption is not available', async () => {
    const store = createSecretStore({ filePath, safeStorage: fakeSafeStorage(false) })
    await expect(store.set('figma.token', 'figd_123')).rejects.toMatchObject({
      code: 'ENCRYPTION_UNAVAILABLE',
    })
  })

  it('returns null when the file is missing', async () => {
    const store = createSecretStore({ filePath, safeStorage: fakeSafeStorage() })
    expect(await store.get('figma.token')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `yarn test src/main/secrets.test.js`
Expected: FAIL, the module `./secrets` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/main/secrets.js`:

```js
import { readFile, writeFile } from 'node:fs/promises'

import { ImportError } from './errors'

export const SECRET_NAMES = [
  'ai.anthropic',
  'ai.openai',
  'ai.google',
  'ai.openai-compatible',
  'figma.token',
]

// Keeps API keys and tokens encrypted with Electron safeStorage (the OS
// keychain). The file has one base64 string for each name. The renderer can
// set a secret and ask if it exists, only the main process reads the value.
export function createSecretStore({ filePath, safeStorage }) {
  async function load() {
    try {
      return JSON.parse(await readFile(filePath, 'utf8'))
    } catch (err) {
      return {}
    }
  }

  function decrypt(value) {
    try {
      return safeStorage.decryptString(Buffer.from(value, 'base64'))
    } catch (err) {
      return null
    }
  }

  return {
    isAvailable: () => safeStorage.isEncryptionAvailable(),

    async set(name, value) {
      const data = await load()
      if (value) {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new ImportError(
            'ENCRYPTION_UNAVAILABLE',
            'The system keychain is not available, so the app cannot save the key.',
          )
        }
        data[name] = safeStorage.encryptString(value).toString('base64')
      } else {
        delete data[name]
      }
      await writeFile(filePath, JSON.stringify(data), { mode: 0o600 })
    },

    async has(name) {
      return Boolean((await load())[name])
    },

    async get(name) {
      const value = (await load())[name]
      return value ? decrypt(value) : null
    },

    async getAll() {
      return Object.values(await load())
        .map(decrypt)
        .filter(Boolean)
    },
  }
}
```

- [ ] **Step 4: Run the test and make sure it passes**

Run: `yarn test src/main/secrets.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
yarn prettier --write src/main/secrets.js src/main/secrets.test.js
yarn lint && yarn prettier:check
git add src/main/secrets.js src/main/secrets.test.js
git commit -m "Add an encrypted secret store for API keys"
```

---

### Task 4: Trim the REST node JSON

**Files:**

- Create: `src/main/figma/trim-node.js`
- Test: `src/main/figma/trim-node.test.js`

**Interfaces:**

- Produces:
  - `toHex(color: { r, g, b, a? }, opacity = 1) -> string` (`#rrggbb`, or `#rrggbbaa` when the alpha is below 1)
  - `trimNode(node) -> { tree: object, exports: Array<{ id, name }>, imageFills: Array<{ imageRef, name }> }`. `tree` nodes have `id`, `name`, `type`, `box: { x, y, w, h }`, layout keys, `fills`, `strokes`, `text`, `style`, `children`, and `exportAsImage: true` for nodes that become an image.

- [ ] **Step 1: Write the failing test**

Create `src/main/figma/trim-node.test.js`:

```js
import { describe, expect, it } from 'vitest'

import { toHex, trimNode } from './trim-node'

const white = { r: 1, g: 1, b: 1, a: 1 }
const black = { r: 0, g: 0, b: 0, a: 1 }

const email = {
  id: '1:1',
  name: 'Email',
  type: 'FRAME',
  exportSettings: [{ format: 'PNG' }],
  absoluteBoundingBox: { x: 0.4, y: 0, width: 600, height: 800.2 },
  layoutMode: 'VERTICAL',
  itemSpacing: 16,
  paddingTop: 24,
  fills: [{ type: 'SOLID', color: white }],
  children: [
    {
      id: '1:2',
      name: 'Title',
      type: 'TEXT',
      characters: 'Hello',
      style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 32, lineHeightPx: 40, foo: 1 },
      fills: [{ type: 'SOLID', color: black }],
    },
    { id: '1:3', name: 'Hidden', type: 'TEXT', visible: false, characters: 'x' },
    {
      id: '1:4',
      name: 'Icon',
      type: 'GROUP',
      children: [
        { id: '1:5', name: 'a', type: 'VECTOR' },
        { id: '1:6', name: 'b', type: 'VECTOR' },
      ],
    },
    {
      id: '1:7',
      name: 'Hero',
      type: 'RECTANGLE',
      fills: [{ type: 'IMAGE', imageRef: 'ref1', scaleMode: 'FILL' }],
    },
    {
      id: '1:8',
      name: 'Logo',
      type: 'FRAME',
      exportSettings: [{ format: 'PNG' }],
      children: [{ id: '1:9', name: 'ACME', type: 'TEXT', characters: 'ACME' }],
    },
  ],
}

describe('toHex', () => {
  it('converts a Figma color', () => {
    expect(toHex({ r: 1, g: 0.5, b: 0, a: 1 })).toBe('#ff8000')
  })

  it('adds the alpha when it is below 1', () => {
    expect(toHex({ r: 1, g: 0.5, b: 0, a: 1 }, 0.5)).toBe('#ff800080')
  })
})

describe('trimNode', () => {
  const { tree, exports, imageFills } = trimNode(email)

  it('keeps the root as a layout node even with export settings', () => {
    expect(tree.exportAsImage).toBeUndefined()
    expect(tree.layoutMode).toBe('VERTICAL')
    expect(tree.itemSpacing).toBe(16)
    expect(tree.box).toEqual({ x: 0, y: 0, w: 600, h: 800 })
    expect(tree.fills).toEqual([{ type: 'SOLID', color: '#ffffff' }])
  })

  it('keeps text and the useful style keys', () => {
    const title = tree.children.find(c => c.id === '1:2')
    expect(title.text).toBe('Hello')
    expect(title.style).toEqual({
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 32,
      lineHeightPx: 40,
    })
  })

  it('removes hidden nodes', () => {
    expect(tree.children.find(c => c.id === '1:3')).toBeUndefined()
  })

  it('exports a group of vectors as one image', () => {
    const icon = tree.children.find(c => c.id === '1:4')
    expect(icon.exportAsImage).toBe(true)
    expect(icon.children).toBeUndefined()
    expect(exports).toContainEqual({ id: '1:4', name: 'Icon' })
    expect(exports.find(e => e.id === '1:5')).toBeUndefined()
  })

  it('exports a child node with export settings', () => {
    const logo = tree.children.find(c => c.id === '1:8')
    expect(logo.exportAsImage).toBe(true)
    expect(logo.children).toBeUndefined()
    expect(exports).toContainEqual({ id: '1:8', name: 'Logo' })
  })

  it('collects image fills', () => {
    expect(imageFills).toEqual([{ imageRef: 'ref1', name: 'Hero' }])
    const hero = tree.children.find(c => c.id === '1:7')
    expect(hero.fills).toEqual([{ type: 'IMAGE', imageRef: 'ref1', scaleMode: 'FILL' }])
  })
})
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `yarn test src/main/figma/trim-node.test.js`
Expected: FAIL, the module `./trim-node` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/main/figma/trim-node.js`:

```js
// The REST API returns a large node tree. The model needs only the layout,
// the colors, the text and the fonts, so this removes everything else.
// Vectors and nodes with export settings become images.

const VECTOR_TYPES = new Set([
  'VECTOR',
  'BOOLEAN_OPERATION',
  'STAR',
  'LINE',
  'ELLIPSE',
  'REGULAR_POLYGON',
])

const LAYOUT_KEYS = [
  'layoutMode',
  'itemSpacing',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'primaryAxisAlignItems',
  'counterAxisAlignItems',
  'layoutSizingHorizontal',
  'layoutSizingVertical',
  'cornerRadius',
  'strokeWeight',
  'opacity',
]

const STYLE_KEYS = [
  'fontFamily',
  'fontWeight',
  'fontSize',
  'lineHeightPx',
  'letterSpacing',
  'textAlignHorizontal',
  'textDecoration',
  'textCase',
  'italic',
]

function channel(value) {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, '0')
}

export function toHex({ r, g, b, a = 1 }, opacity = 1) {
  const alpha = a * opacity
  return `#${channel(r)}${channel(g)}${channel(b)}${alpha < 1 ? channel(alpha) : ''}`
}

function isAllVectors(node) {
  return (
    Array.isArray(node.children) &&
    node.children.length > 0 &&
    node.children.every(child => VECTOR_TYPES.has(child.type) || isAllVectors(child))
  )
}

export function trimNode(root) {
  const exports = []
  const imageFills = []

  function paints(list, nodeName) {
    return (list || [])
      .filter(paint => paint.visible !== false)
      .map(paint => {
        if (paint.type === 'SOLID') {
          return { type: 'SOLID', color: toHex(paint.color, paint.opacity ?? 1) }
        }
        if (paint.type === 'IMAGE') {
          if (!imageFills.some(fill => fill.imageRef === paint.imageRef)) {
            imageFills.push({ imageRef: paint.imageRef, name: nodeName })
          }
          return { type: 'IMAGE', imageRef: paint.imageRef, scaleMode: paint.scaleMode }
        }
        if (paint.type.startsWith('GRADIENT')) {
          return {
            type: paint.type,
            stops: (paint.gradientStops || []).map(stop => toHex(stop.color)),
          }
        }
        return { type: paint.type }
      })
  }

  function walk(node, isRoot) {
    if (node.visible === false) {
      return null
    }

    const out = { id: node.id, name: node.name, type: node.type }
    const box = node.absoluteBoundingBox
    if (box) {
      out.box = {
        x: Math.round(box.x),
        y: Math.round(box.y),
        w: Math.round(box.width),
        h: Math.round(box.height),
      }
    }

    // the root is the email itself: designers often mark it for export,
    // but it must stay a layout node
    const hasExport = !isRoot && Array.isArray(node.exportSettings) && node.exportSettings.length
    if (!isRoot && (VECTOR_TYPES.has(node.type) || hasExport || isAllVectors(node))) {
      out.exportAsImage = true
      exports.push({ id: node.id, name: node.name })
      return out
    }

    for (const key of LAYOUT_KEYS) {
      if (node[key] !== undefined) {
        out[key] = node[key]
      }
    }

    const fills = paints(node.fills, node.name)
    if (fills.length) {
      out.fills = fills
    }
    const strokes = paints(node.strokes, node.name)
    if (strokes.length) {
      out.strokes = strokes
    }

    if (node.characters !== undefined) {
      out.text = node.characters
    }
    if (node.style) {
      out.style = {}
      for (const key of STYLE_KEYS) {
        if (node.style[key] !== undefined) {
          out.style[key] = node.style[key]
        }
      }
    }

    if (Array.isArray(node.children)) {
      const children = node.children.map(child => walk(child, false)).filter(Boolean)
      if (children.length) {
        out.children = children
      }
    }

    return out
  }

  return { tree: walk(root, true), exports, imageFills }
}
```

- [ ] **Step 4: Run the test and make sure it passes**

Run: `yarn test src/main/figma/trim-node.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
yarn prettier --write src/main/figma/trim-node.js src/main/figma/trim-node.test.js
yarn lint && yarn prettier:check
git add src/main/figma/trim-node.js src/main/figma/trim-node.test.js
git commit -m "Trim the Figma REST node tree before it goes to the model"
```

---

### Task 5: MJML extraction, validation and prompts

**Files:**

- Create: `src/main/ai/extract-mjml.js`, `src/main/ai/validate-mjml.js`, `src/main/ai/prompt.js`
- Test: `src/main/ai/extract-mjml.test.js`, `src/main/ai/validate-mjml.test.js`, `src/main/ai/prompt.test.js`

**Interfaces:**

- Produces:
  - `extractMjml(text: string) -> string | null`
  - `validateMjml(content: string, filePath?: string) -> Promise<{ html: string, errors: Array<{ line, message, tagName }> }>`
  - `SYSTEM_PROMPT: string`, `NO_MJML_PROMPT: string`, `MAX_CONTEXT_CHARS = 100000`
  - `bodyWidth(designWidth?: number) -> number`
  - `buildDesignText(design, images) -> string`
  - `buildGenerateMessages({ design, images }) -> ModelMessage[]`
  - `buildFixPrompt(errors) -> string`
  - `buildVisualCheckMessages({ design, mjml, rendered: Buffer }) -> ModelMessage[]`
  - `buildRefineMessages({ content, instruction, screenshot?: Buffer }) -> ModelMessage[]`
  - The `Design` object (used from here on): `{ source: 'mcp' | 'rest', name: string, width: number, screenshot: Buffer, context: string, variables: object, assets: Array<{ id, url, suggestedName }> }`
  - The image result object (from Task 10, used here): `{ id, url, name, path, ok: boolean, format: string }`

- [ ] **Step 1: Write the failing tests**

Create `src/main/ai/extract-mjml.test.js`:

```js
import { describe, expect, it } from 'vitest'

import { extractMjml } from './extract-mjml'

const DOC = '<mjml>\n  <mj-body></mj-body>\n</mjml>'

describe('extractMjml', () => {
  it('reads an mjml code block', () => {
    expect(extractMjml(`Here it is:\n\`\`\`mjml\n${DOC}\n\`\`\`\nDone.`)).toBe(DOC)
  })

  it('reads a code block without a language', () => {
    expect(extractMjml(`\`\`\`\n${DOC}\n\`\`\``)).toBe(DOC)
  })

  it('reads a reply without a code block', () => {
    expect(extractMjml(`Sure. ${DOC} Bye.`)).toBe(DOC)
  })

  it('skips a code block that has no MJML', () => {
    expect(extractMjml(`\`\`\`css\n.a { color: red }\n\`\`\`\n\`\`\`xml\n${DOC}\n\`\`\``)).toBe(
      DOC,
    )
  })

  it('returns null for a reply that is cut before </mjml>', () => {
    expect(extractMjml('```mjml\n<mjml><mj-body><mj-section>')).toBeNull()
  })

  it('returns null for an empty reply', () => {
    expect(extractMjml('')).toBeNull()
    expect(extractMjml(undefined)).toBeNull()
  })
})
```

Create `src/main/ai/validate-mjml.test.js`:

```js
import { describe, expect, it } from 'vitest'

import { validateMjml } from './validate-mjml'

describe('validateMjml', () => {
  it('returns HTML and no errors for valid MJML', async () => {
    const res = await validateMjml(
      '<mjml><mj-body><mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-body></mjml>',
    )
    expect(res.errors).toEqual([])
    expect(res.html).toContain('Hi')
  })

  it('returns the errors of wrong nesting', async () => {
    const res = await validateMjml(
      '<mjml><mj-body><mj-column><mj-text>Hi</mj-text></mj-column></mj-body></mjml>',
    )
    expect(res.errors.length).toBeGreaterThan(0)
    expect(res.errors[0].message).toContain('cannot be used inside')
    expect(res.errors[0]).toHaveProperty('line')
  })
})
```

Create `src/main/ai/prompt.test.js`:

```js
import { describe, expect, it } from 'vitest'

import {
  MAX_CONTEXT_CHARS,
  bodyWidth,
  buildDesignText,
  buildGenerateMessages,
  buildRefineMessages,
} from './prompt'

const design = {
  source: 'rest',
  name: 'Newsletter',
  width: 640,
  screenshot: Buffer.from('png'),
  context: '{"id":"1:1"}',
  variables: { 'color/primary': '#1a73e8' },
  assets: [],
}

const images = [
  { id: '1:4', url: 'u1', name: 'Logo', path: 'images/logo.png', ok: true, format: 'png' },
  { id: 'ref1', url: 'u2', name: 'Hero', path: 'images/hero.png', ok: false, format: 'png' },
]

describe('bodyWidth', () => {
  it('keeps a width up to 700 px and uses 600 px above it', () => {
    expect(bodyWidth(480)).toBe(480)
    expect(bodyWidth(700)).toBe(700)
    expect(bodyWidth(1200)).toBe(600)
    expect(bodyWidth(undefined)).toBe(600)
  })
})

describe('buildDesignText', () => {
  it('lists the images, the variables and the design data', () => {
    const text = buildDesignText(design, images)
    expect(text).toContain('Body width: 640px')
    expect(text).toContain('- images/logo.png (Figma: Logo, id: 1:4)')
    expect(text).toContain('- images/hero.png (Figma: Hero, id: ref1) - missing, use a placeholder')
    expect(text).toContain('"color/primary": "#1a73e8"')
    expect(text).toContain('{"id":"1:1"}')
  })

  it('cuts design data that is too long', () => {
    const text = buildDesignText({ ...design, context: 'x'.repeat(MAX_CONTEXT_CHARS + 10) }, [])
    expect(text).toContain('The design data is cut at this point')
    expect(text.length).toBeLessThan(MAX_CONTEXT_CHARS + 2000)
  })
})

describe('message builders', () => {
  it('adds the screenshot to the generate message', () => {
    const [message] = buildGenerateMessages({ design, images })
    expect(message.role).toBe('user')
    expect(message.content[1]).toEqual({
      type: 'file',
      mediaType: 'image/png',
      data: design.screenshot,
    })
  })

  it('adds the screenshot to the refine message only when there is one', () => {
    const [withShot] = buildRefineMessages({
      content: '<mjml></mjml>',
      instruction: 'make it blue',
      screenshot: Buffer.from('png'),
    })
    expect(withShot.content.some(part => part.type === 'file')).toBe(true)
    expect(withShot.content[0].text).toContain('make it blue')

    const [noShot] = buildRefineMessages({ content: '<mjml></mjml>', instruction: 'x' })
    expect(noShot.content.some(part => part.type === 'file')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `yarn test src/main/ai`
Expected: FAIL, the three modules do not exist.

- [ ] **Step 3: Write `extract-mjml.js`**

Create `src/main/ai/extract-mjml.js`:

```js
const FENCE_RE = /```[^\n]*\n([\s\S]*?)```/g

function findDocument(text) {
  const start = text.indexOf('<mjml')
  const end = text.lastIndexOf('</mjml>')
  if (start === -1 || end === -1 || end < start) {
    return null
  }
  return text.slice(start, end + '</mjml>'.length).trim()
}

// Takes the MJML document out of a model reply. Returns null when the reply
// has no complete document (for example when the output was cut).
export function extractMjml(text) {
  if (!text) {
    return null
  }
  for (const [, body] of text.matchAll(FENCE_RE)) {
    const doc = findDocument(body)
    if (doc) {
      return doc
    }
  }
  return findDocument(text)
}
```

- [ ] **Step 4: Write `validate-mjml.js`**

Create `src/main/ai/validate-mjml.js`:

```js
import mjml2html from 'mjml'

// Compiles MJML in the main process. `filePath` lets mj-include and relative
// paths resolve from the project folder.
export async function validateMjml(content, filePath) {
  try {
    const res = await mjml2html(content, {
      filePath,
      validationLevel: 'soft',
      ignoreIncludes: false,
    })
    return {
      html: res.html || '',
      errors: (res.errors || []).map(({ line, message, tagName }) => ({ line, message, tagName })),
    }
  } catch (err) {
    return { html: '', errors: [{ line: null, message: err.message, tagName: null }] }
  }
}
```

- [ ] **Step 5: Write `prompt.js`**

Create `src/main/ai/prompt.js`:

````js
export const MAX_CONTEXT_CHARS = 100000

export const SYSTEM_PROMPT = `You convert a Figma design into one MJML email template.

Rules:
- Return one complete MJML document (<mjml> ... </mjml>) in a single \`\`\`mjml code block. Do not write anything else.
- Use mj-section and mj-column for the layout. Never put an mj-section inside an mj-column. Use mj-group only when columns must stay side by side on mobile.
- Set the width attribute of mj-body to the body width that the user message gives.
- Put the colors and the fonts of the design into mj-attributes and mj-class in mj-head. Use the design variable names for the mj-class names when possible.
- Use mj-font for web fonts and give a safe fallback, for example "Inter, Arial, sans-serif".
- Use only the image paths from the image list in src attributes. Do not invent image URLs. For an image marked as missing, use https://placehold.co/<width>x<height> with the size from the design.
- Use mj-button for buttons, mj-divider for lines, mj-spacer for empty space and mj-social for social icons.
- Keep the text of the design exactly. Do not translate it.
- Use px units. Do not use CSS position, flexbox or grid.`

export const NO_MJML_PROMPT =
  'Your reply did not contain a complete MJML document. Return the full document from <mjml> to </mjml> in one ```mjml code block.'

export function bodyWidth(designWidth) {
  if (!designWidth || designWidth > 700) {
    return 600
  }
  return Math.round(designWidth)
}

function imageList(images) {
  if (!images.length) {
    return 'No images.'
  }
  return images
    .map(img => {
      const missing = img.ok ? '' : ' - missing, use a placeholder'
      return `- ${img.path} (Figma: ${img.name}, id: ${img.id})${missing}`
    })
    .join('\n')
}

export function buildDesignText(design, images) {
  let context = design.context || ''
  let note = ''
  if (context.length > MAX_CONTEXT_CHARS) {
    context = context.slice(0, MAX_CONTEXT_CHARS)
    note =
      '\n(The design data is cut at this point because it is too long. Use the screenshot for the rest.)'
  }
  const variables = design.variables || {}

  return [
    `Design name: ${design.name}`,
    `Body width: ${bodyWidth(design.width)}px (design width: ${Math.round(design.width || 0)}px)`,
    '',
    'Images (use only these paths in src):',
    imageList(images),
    '',
    'Design variables:',
    Object.keys(variables).length ? JSON.stringify(variables, null, 2) : 'None.',
    '',
    `Design data from Figma (${design.source}):`,
    context + note,
  ].join('\n')
}

function image(data) {
  return { type: 'file', mediaType: 'image/png', data }
}

export function buildGenerateMessages({ design, images }) {
  const content = [{ type: 'text', text: buildDesignText(design, images) }]
  if (design.screenshot) {
    content.push(image(design.screenshot))
  }
  return [{ role: 'user', content }]
}

export function buildFixPrompt(errors) {
  return [
    'The MJML has these validation errors. Fix them and return the full corrected document.',
    ...errors.map(err => `- line ${err.line ?? '?'}: ${err.message}`),
  ].join('\n')
}

export function buildVisualCheckMessages({ design, mjml, rendered }) {
  const text = [
    `The first image is the Figma design. The second image is the current MJML rendered at ${bodyWidth(design.width)}px.`,
    'Compare them. Fix the differences in layout, spacing, colors, font sizes and alignment.',
    'Keep the image paths. Return the full corrected MJML document.',
    '',
    'Current MJML:',
    '```mjml',
    mjml,
    '```',
  ].join('\n')
  return [
    {
      role: 'user',
      content: [{ type: 'text', text }, image(design.screenshot), image(rendered)],
    },
  ]
}

export function buildRefineMessages({ content, instruction, screenshot }) {
  const text = [
    `Change this MJML template. Instruction: ${instruction}`,
    'Keep everything else the same. Return the full MJML document.',
    '',
    '```mjml',
    content,
    '```',
  ].join('\n')
  const parts = [{ type: 'text', text }]
  if (screenshot) {
    parts.push({ type: 'text', text: 'This image is the original Figma design.' }, image(screenshot))
  }
  return [{ role: 'user', content: parts }]
}
````

- [ ] **Step 6: Run the tests and make sure they pass**

Run: `yarn test src/main/ai`
Expected: PASS, 14 tests.

- [ ] **Step 7: Commit**

```bash
yarn prettier --write src/main/ai
yarn lint && yarn prettier:check
git add src/main/ai
git commit -m "Add the MJML prompts, extraction and validation"
```

---

### Task 6: Generation loop with fixes and the visual check

**Files:**

- Create: `src/main/ai/generate-mjml.js`
- Test: `src/main/ai/generate-mjml.test.js`

**Interfaces:**

- Consumes: `extractMjml`, `validateMjml`, everything from `prompt.js` (Task 5). `ImportError` (Task 2).
- Produces:
  - `MAX_FIX_ROUNDS = 2`
  - `isImageInputError(err) -> boolean`
  - `generateMjml({ model, design, images, validate, renderScreenshot?, visualCheck = true, signal?, onProgress? }) -> Promise<{ mjml, warnings: string[], usage: { inputTokens, outputTokens, calls } }>`. `validate(content) -> Promise<{ html, errors }>`. `renderScreenshot(html, width) -> Promise<Buffer>`.
  - `refineMjml({ model, content, instruction, screenshot?, validate, signal?, onProgress? }) -> Promise<{ mjml, warnings, usage }>`
  - Throws `ImportError('AI_NO_MJML')` when no round gives an MJML document.
  - Progress events: `{ step: 'generate' }`, `{ step: 'validate', detail: 'round 1 of 2' }`, `{ step: 'visual-check' }`.

- [ ] **Step 1: Write the failing test**

Create `src/main/ai/generate-mjml.test.js`:

```js
import { APICallError } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'

import { generateMjml, refineMjml } from './generate-mjml'
import { validateMjml } from './validate-mjml'

const VALID =
  '<mjml><mj-body><mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-body></mjml>'
const VALID_2 =
  '<mjml><mj-body><mj-section><mj-column><mj-text>Hello</mj-text></mj-column></mj-section></mj-body></mjml>'
const INVALID = '<mjml><mj-body><mj-column><mj-text>Hi</mj-text></mj-column></mj-body></mjml>'

const block = mjml => `\`\`\`mjml\n${mjml}\n\`\`\``

// gives the replies in order, an Error in the list is thrown
function mockModel(replies) {
  const calls = []
  const model = new MockLanguageModelV4({
    doGenerate: async options => {
      calls.push(options)
      const reply = replies[calls.length - 1]
      if (reply instanceof Error) {
        throw reply
      }
      return {
        content: [{ type: 'text', text: reply }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 5, text: 5, reasoning: 0 },
        },
        warnings: [],
      }
    },
  })
  return { model, calls }
}

const promptText = call => JSON.stringify(call.prompt)
const hasImage = call => promptText(call).includes('"type":"file"')

const design = {
  source: 'mcp',
  name: 'Newsletter',
  width: 1200,
  screenshot: Buffer.from('png'),
  context: '<div>Hi</div>',
  variables: {},
  assets: [],
}

const base = { design, images: [], validate: c => validateMjml(c), visualCheck: false }

describe('generateMjml', () => {
  it('returns valid MJML from the first reply', async () => {
    const { model, calls } = mockModel([block(VALID)])
    const res = await generateMjml({ ...base, model })
    expect(res.mjml).toBe(VALID)
    expect(res.warnings).toEqual([])
    expect(res.usage).toEqual({ inputTokens: 10, outputTokens: 5, calls: 1 })
    expect(hasImage(calls[0])).toBe(true)
  })

  it('sends the validation errors back and uses the fixed version', async () => {
    const { model, calls } = mockModel([block(INVALID), block(VALID)])
    const onProgress = vi.fn()
    const res = await generateMjml({ ...base, model, onProgress })
    expect(res.mjml).toBe(VALID)
    expect(calls).toHaveLength(2)
    expect(promptText(calls[1])).toContain('cannot be used inside')
    expect(onProgress).toHaveBeenCalledWith({ step: 'validate', detail: 'round 1 of 2' })
  })

  it('stops after 2 fix rounds and adds a warning', async () => {
    const { model, calls } = mockModel([block(INVALID), block(INVALID), block(INVALID)])
    const res = await generateMjml({ ...base, model })
    expect(calls).toHaveLength(3)
    expect(res.mjml).toBe(INVALID)
    expect(res.warnings.join(' ')).toContain('validation errors')
    expect(res.usage.calls).toBe(3)
  })

  it('asks again when a reply has no MJML', async () => {
    const { model, calls } = mockModel(['Sorry, I cannot.', block(VALID)])
    const res = await generateMjml({ ...base, model })
    expect(res.mjml).toBe(VALID)
    expect(promptText(calls[1])).toContain('did not contain a complete MJML document')
  })

  it('fails with AI_NO_MJML when no reply has MJML', async () => {
    const { model } = mockModel(['no', 'no', 'no'])
    await expect(generateMjml({ ...base, model })).rejects.toMatchObject({ code: 'AI_NO_MJML' })
  })

  it('sends text only when the model does not accept images', async () => {
    const imageError = new APICallError({
      message: 'This model does not support image input',
      url: 'https://api.example.com',
      requestBodyValues: {},
      statusCode: 400,
      isRetryable: false,
    })
    const { model, calls } = mockModel([imageError, block(VALID)])
    const res = await generateMjml({ ...base, model })
    expect(res.mjml).toBe(VALID)
    expect(hasImage(calls[1])).toBe(false)
    expect(res.warnings.join(' ')).toContain('does not accept images')
  })

  it('uses the result of the visual check when it is valid', async () => {
    const { model, calls } = mockModel([block(VALID), block(VALID_2)])
    const renderScreenshot = vi.fn(async () => Buffer.from('render'))
    const res = await generateMjml({ ...base, model, visualCheck: true, renderScreenshot })
    expect(res.mjml).toBe(VALID_2)
    expect(renderScreenshot).toHaveBeenCalledWith(expect.stringContaining('Hi'), 600)
    expect(promptText(calls[1])).toContain('The first image is the Figma design')
  })

  it('keeps the first version when the visual check gives invalid MJML', async () => {
    const { model } = mockModel([block(VALID), block(INVALID)])
    const renderScreenshot = async () => Buffer.from('render')
    const res = await generateMjml({ ...base, model, visualCheck: true, renderScreenshot })
    expect(res.mjml).toBe(VALID)
    expect(res.warnings.join(' ')).toContain('visual check')
  })

  it('stops before a model call when the signal is aborted', async () => {
    const { model, calls } = mockModel([block(VALID)])
    const controller = new AbortController()
    controller.abort()
    await expect(generateMjml({ ...base, model, signal: controller.signal })).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })
})

describe('refineMjml', () => {
  it('sends the content and the instruction', async () => {
    const { model, calls } = mockModel([block(VALID_2)])
    const res = await refineMjml({
      model,
      content: VALID,
      instruction: 'say hello',
      validate: c => validateMjml(c),
    })
    expect(res.mjml).toBe(VALID_2)
    expect(promptText(calls[0])).toContain('say hello')
    expect(hasImage(calls[0])).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `yarn test src/main/ai/generate-mjml.test.js`
Expected: FAIL, the module `./generate-mjml` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/main/ai/generate-mjml.js`:

```js
import { APICallError, UnsupportedFunctionalityError, generateText } from 'ai'

import { ImportError } from '../errors'
import { extractMjml } from './extract-mjml'
import {
  NO_MJML_PROMPT,
  SYSTEM_PROMPT,
  bodyWidth,
  buildFixPrompt,
  buildGenerateMessages,
  buildRefineMessages,
  buildVisualCheckMessages,
} from './prompt'

export const MAX_FIX_ROUNDS = 2

const NO_IMAGES_WARNING =
  'The model does not accept images, so the app sent only the design data. The result can be less accurate.'
const VISUAL_CHECK_WARNING =
  'The visual check did not give a valid result. The app kept the first version.'

export function isImageInputError(err) {
  if (UnsupportedFunctionalityError.isInstance(err)) {
    return true
  }
  if (!APICallError.isInstance(err) || err.statusCode !== 400) {
    return false
  }
  return /image|vision|multimodal|modalit/i.test(`${err.message} ${err.responseBody || ''}`)
}

function stripImages(messages) {
  return messages.map(message =>
    Array.isArray(message.content)
      ? { ...message, content: message.content.filter(part => part.type !== 'file') }
      : message,
  )
}

// One session counts the tokens of all calls. When the model refuses
// images, the session sends text only from then on.
function createSession({ model, signal, warnings }) {
  const usage = { inputTokens: 0, outputTokens: 0, calls: 0 }
  let acceptsImages = true

  async function call(messages) {
    signal?.throwIfAborted()
    try {
      const res = await generateText({
        model,
        system: SYSTEM_PROMPT,
        messages: acceptsImages ? messages : stripImages(messages),
        abortSignal: signal,
        maxRetries: 1,
      })
      usage.inputTokens += res.usage?.inputTokens ?? 0
      usage.outputTokens += res.usage?.outputTokens ?? 0
      usage.calls += 1
      return res.text
    } catch (err) {
      if (!acceptsImages || !isImageInputError(err)) {
        throw err
      }
      acceptsImages = false
      warnings.push(NO_IMAGES_WARNING)
      return call(messages)
    }
  }

  return { call, usage, acceptsImages: () => acceptsImages }
}

async function runWithFixes({ session, messages, validate, onProgress }) {
  let text = await session.call(messages)
  let mjml = extractMjml(text)
  let missing = !mjml
  let errors = mjml ? (await validate(mjml)).errors : []

  for (let round = 1; round <= MAX_FIX_ROUNDS && (missing || errors.length > 0); round++) {
    onProgress({ step: 'validate', detail: `round ${round} of ${MAX_FIX_ROUNDS}` })
    messages = [
      ...messages,
      { role: 'assistant', content: text },
      { role: 'user', content: missing ? NO_MJML_PROMPT : buildFixPrompt(errors) },
    ]
    text = await session.call(messages)
    const next = extractMjml(text)
    missing = !next
    if (next) {
      mjml = next
      errors = (await validate(next)).errors
    }
  }

  if (!mjml) {
    throw new ImportError(
      'AI_NO_MJML',
      'The model did not return an MJML document. Try again or use a different model.',
    )
  }
  return { mjml, errors }
}

function errorsWarning(errors) {
  return `The MJML still has ${errors.length} validation errors. The editor shows them.`
}

export async function generateMjml({
  model,
  design,
  images,
  validate,
  renderScreenshot,
  visualCheck = true,
  signal,
  onProgress = () => {},
}) {
  const warnings = []
  const session = createSession({ model, signal, warnings })

  onProgress({ step: 'generate' })
  let { mjml, errors } = await runWithFixes({
    session,
    messages: buildGenerateMessages({ design, images }),
    validate,
    onProgress,
  })

  if (visualCheck && renderScreenshot && session.acceptsImages() && errors.length === 0) {
    onProgress({ step: 'visual-check' })
    try {
      const { html } = await validate(mjml)
      const rendered = await renderScreenshot(html, bodyWidth(design.width))
      const text = await session.call(buildVisualCheckMessages({ design, mjml, rendered }))
      const better = extractMjml(text)
      if (better && (await validate(better)).errors.length === 0) {
        mjml = better
      } else {
        warnings.push(VISUAL_CHECK_WARNING)
      }
    } catch (err) {
      if (signal?.aborted) {
        throw err
      }
      warnings.push(VISUAL_CHECK_WARNING)
    }
  }

  if (errors.length) {
    warnings.push(errorsWarning(errors))
  }
  return { mjml, warnings, usage: session.usage }
}

export async function refineMjml({
  model,
  content,
  instruction,
  screenshot,
  validate,
  signal,
  onProgress = () => {},
}) {
  const warnings = []
  const session = createSession({ model, signal, warnings })

  onProgress({ step: 'generate' })
  const { mjml, errors } = await runWithFixes({
    session,
    messages: buildRefineMessages({ content, instruction, screenshot }),
    validate,
    onProgress,
  })

  if (errors.length) {
    warnings.push(errorsWarning(errors))
  }
  return { mjml, warnings, usage: session.usage }
}
```

- [ ] **Step 4: Run the test and make sure it passes**

Run: `yarn test src/main/ai/generate-mjml.test.js`
Expected: PASS, 10 tests. If the `MockLanguageModelV4` result shape gives a type error at run time, open `node_modules/@ai-sdk/provider/dist/index.d.ts`, search for `LanguageModelV4GenerateResult`, and change only the mock in the test to match.

- [ ] **Step 5: Commit**

```bash
yarn prettier --write src/main/ai
yarn lint && yarn prettier:check && yarn test
git add src/main/ai
git commit -m "Generate MJML with a fix loop and a visual self-check"
```

---

### Task 7: AI providers

**Files:**

- Create: `src/data/aiProviders.js`
- Create: `src/main/ai/providers.js`
- Test: `src/main/ai/providers.test.js`
- Modify: `package.json` (dependencies)

**Interfaces:**

- Consumes: `ImportError` (Task 2).
- Produces:
  - `PROVIDERS: { [id]: { label, defaultModel, needsKey, keyURL } }`, `PROVIDER_IDS: string[]` in `src/data/aiProviders.js` (the renderer imports it as `data/aiProviders`, the main process as `../../data/aiProviders`)
  - `createModel({ provider, model, baseURL }, apiKey) -> LanguageModel`. Throws `ImportError` with `AI_PROVIDER_UNKNOWN`, `AI_KEY_MISSING`, `AI_BASE_URL_MISSING` or `AI_MODEL_MISSING`.

- [ ] **Step 1: Install the provider packages**

Run: `yarn add @ai-sdk/anthropic@^4 @ai-sdk/openai@^4 @ai-sdk/google@^4 @ai-sdk/openai-compatible@^3`

- [ ] **Step 2: Write the failing test**

Create `src/main/ai/providers.test.js`:

```js
import { describe, expect, it } from 'vitest'

import { PROVIDERS } from '../../data/aiProviders'
import { createModel } from './providers'

describe('createModel', () => {
  it('uses the default model of the provider when the model is empty', () => {
    const model = createModel({ provider: 'anthropic', model: '' }, 'sk-ant-123')
    expect(model.modelId).toBe(PROVIDERS.anthropic.defaultModel)
    expect(model.provider).toContain('anthropic')
  })

  it('uses the model that the user gives', () => {
    expect(createModel({ provider: 'openai', model: 'gpt-x' }, 'sk-1').modelId).toBe('gpt-x')
    expect(createModel({ provider: 'google', model: '' }, 'g-1').provider).toContain('google')
  })

  it('creates an OpenAI compatible model without a key', () => {
    const model = createModel(
      { provider: 'openai-compatible', model: 'llama3.2', baseURL: 'http://localhost:11434/v1' },
      null,
    )
    expect(model.modelId).toBe('llama3.2')
    expect(model.provider).toContain('openai-compatible')
  })

  it('throws codes for missing values', () => {
    expect(() => createModel({ provider: 'nope' }, 'k')).toThrow(
      expect.objectContaining({ code: 'AI_PROVIDER_UNKNOWN' }),
    )
    expect(() => createModel({ provider: 'openai', model: '' }, '')).toThrow(
      expect.objectContaining({ code: 'AI_KEY_MISSING' }),
    )
    expect(() => createModel({ provider: 'openai-compatible', model: 'x' }, null)).toThrow(
      expect.objectContaining({ code: 'AI_BASE_URL_MISSING' }),
    )
    expect(() =>
      createModel({ provider: 'openai-compatible', model: '', baseURL: 'http://x/v1' }, null),
    ).toThrow(expect.objectContaining({ code: 'AI_MODEL_MISSING' }))
  })
})
```

- [ ] **Step 3: Run the test and make sure it fails**

Run: `yarn test src/main/ai/providers.test.js`
Expected: FAIL, the modules do not exist.

- [ ] **Step 4: Write the provider list**

Create `src/data/aiProviders.js`:

```js
// AI providers for the Figma import. The main process and the settings tab
// both use this list. The default models are only a start, the user can type
// any model id of the provider.
export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic Claude',
    defaultModel: 'claude-sonnet-5-5',
    needsKey: true,
    keyURL: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-5-mini',
    needsKey: true,
    keyURL: 'https://platform.openai.com/api-keys',
  },
  google: {
    label: 'Google Gemini (has a free tier)',
    defaultModel: 'gemini-2.5-flash',
    needsKey: true,
    keyURL: 'https://aistudio.google.com/apikey',
  },
  'openai-compatible': {
    label: 'OpenAI compatible (Ollama, LM Studio, OpenRouter, Groq)',
    defaultModel: '',
    needsKey: false,
    keyURL: null,
  },
}

export const PROVIDER_IDS = Object.keys(PROVIDERS)
```

- [ ] **Step 5: Write `providers.js`**

Create `src/main/ai/providers.js`:

```js
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

import { PROVIDERS } from '../../data/aiProviders'
import { ImportError } from '../errors'

export function createModel({ provider, model, baseURL } = {}, apiKey) {
  const info = PROVIDERS[provider]
  if (!info) {
    throw new ImportError('AI_PROVIDER_UNKNOWN', 'Select an AI provider in Settings > AI & Figma.')
  }
  if (info.needsKey && !apiKey) {
    throw new ImportError(
      'AI_KEY_MISSING',
      `Add an API key for ${info.label} in Settings > AI & Figma.`,
    )
  }

  const modelId = (model || '').trim() || info.defaultModel

  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(modelId)
    case 'openai':
      return createOpenAI({ apiKey })(modelId)
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(modelId)
    default: {
      if (!baseURL) {
        throw new ImportError(
          'AI_BASE_URL_MISSING',
          'Add the base URL of the OpenAI compatible server in Settings > AI & Figma.',
        )
      }
      if (!modelId) {
        throw new ImportError('AI_MODEL_MISSING', 'Add a model name in Settings > AI & Figma.')
      }
      return createOpenAICompatible({
        name: 'openai-compatible',
        baseURL,
        apiKey: apiKey || undefined,
      })(modelId)
    }
  }
}
```

- [ ] **Step 6: Run the test and make sure it passes**

Run: `yarn test src/main/ai/providers.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
yarn prettier --write src/data/aiProviders.js src/main/ai
yarn lint && yarn prettier:check && yarn test
git add src/data/aiProviders.js src/main/ai package.json yarn.lock
git commit -m "Add the AI providers for the Figma import"
```

---

### Task 8: Figma REST source

**Files:**

- Create: `src/main/figma/rest-source.js`
- Test: `src/main/figma/rest-source.test.js`

**Interfaces:**

- Consumes: `trimNode` (Task 4), `toHex` (Task 4), `ImportError` (Task 2).
- Produces:
  - `flattenVariables(response) -> { [name]: string | number | boolean }`
  - `getDesignFromRest({ fileKey, nodeId, token, fetch = globalThis.fetch, signal?, wait? }) -> Promise<Design>` with `source: 'rest'`
  - `testRestConnection({ token, fetch = globalThis.fetch }) -> Promise<{ ok, message }>`
  - Error codes: `FIGMA_TOKEN_MISSING`, `FIGMA_FORBIDDEN`, `FIGMA_NOT_FOUND`, `FIGMA_RATE_LIMIT`, `FIGMA_ERROR`.

- [ ] **Step 1: Write the failing test**

Create `src/main/figma/rest-source.test.js`:

```js
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
    const design = await getDesignFromRest({ ...params, fetch: fakeFetch(defaultRoutes({ variables })) })
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
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `yarn test src/main/figma/rest-source.test.js`
Expected: FAIL, the module `./rest-source` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/main/figma/rest-source.js`:

```js
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
    result[variable.name] = value && typeof value === 'object' && 'r' in value ? toHex(value) : value
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
  const rendered = await get(
    `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`,
  )
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
```

- [ ] **Step 4: Run the test and make sure it passes**

Run: `yarn test src/main/figma/rest-source.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
yarn prettier --write src/main/figma
yarn lint && yarn prettier:check && yarn test
git add src/main/figma
git commit -m "Read Figma designs with the REST API"
```

---

### Task 9: Figma MCP source and source selection

**Files:**

- Create: `src/main/figma/mcp-source.js`, `src/main/figma/index.js`
- Test: `src/main/figma/mcp-source.test.js`, `src/main/figma/index.test.js`
- Modify: `package.json` (dependency `@modelcontextprotocol/sdk`)

**Interfaces:**

- Consumes: `parseFigmaUrl` (Task 1), `getDesignFromRest`, `testRestConnection` (Task 8), `ImportError` (Task 2).
- Produces:
  - `connectMcp(url) -> Promise<Client>`
  - `findAssets(code: string) -> Array<{ id, url, suggestedName }>`
  - `getDesignFromMcp({ nodeId, url, connect = connectMcp, signal? }) -> Promise<Design>` with `source: 'mcp'`
  - `testMcpConnection({ url, connect = connectMcp }) -> Promise<{ ok, message }>`
  - `getDesign({ link, source, mcpURL, token, signal?, fetch?, connect? }) -> Promise<Design>`. Throws `ImportError('INVALID_LINK')`.
  - `testFigmaConnection({ source, mcpURL, token, fetch?, connect? }) -> Promise<{ ok, message }>`
  - Error codes: `FIGMA_MCP_UNAVAILABLE`, `FIGMA_MCP_LIMIT`, `FIGMA_ERROR`.

- [ ] **Step 1: Install the MCP SDK**

Run: `yarn add @modelcontextprotocol/sdk@^1`

- [ ] **Step 2: Write the failing tests**

Create `src/main/figma/mcp-source.test.js`:

```js
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
      { id: 'http://localhost:3845/assets/abc.png', url: 'http://localhost:3845/assets/abc.png', suggestedName: 'Logo' },
      { id: 'http://localhost:3845/assets/def.png', url: 'http://localhost:3845/assets/def.png', suggestedName: 'HeroImage' },
      { id: 'http://localhost:3845/assets/ghi.svg', url: 'http://localhost:3845/assets/ghi.svg', suggestedName: 'image' },
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
      expect.objectContaining({ name: 'get_design_context', arguments: expect.objectContaining({ nodeId: '1:2' }) }),
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
      get_design_context: { isError: true, content: [{ type: 'text', text: 'Rate limit exceeded for your plan' }] },
    })
    await expect(
      getDesignFromMcp({ nodeId: '1:2', url: 'x', connect: async () => client }),
    ).rejects.toMatchObject({ code: 'FIGMA_MCP_LIMIT' })
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
```

Create `src/main/figma/index.test.js`:

```js
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
```

- [ ] **Step 3: Run the tests and make sure they fail**

Run: `yarn test src/main/figma`
Expected: FAIL, `./mcp-source` and `./index` do not exist.

- [ ] **Step 4: Write `mcp-source.js`**

Create `src/main/figma/mcp-source.js`:

```js
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import { ImportError } from '../errors'

// The Figma desktop app runs this MCP server when the user turns it on in
// Dev Mode. The tools read the file that is open in the desktop app.

const NAMED_ASSET_RE = /(?:const|let|var)\s+(\w+)\s*=\s*["'](https?:\/\/[^"']+\/assets\/[^"']+)["']/g
const ASSET_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/assets\/[^"'\s)`]+/g
const LIMIT_RE = /limit|quota|rate/i

export async function connectMcp(url) {
  const client = new Client({ name: 'mjml-app', version: '1.0.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL(url)))
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
  const result = await client.callTool({ name, arguments: args }, undefined, { signal })
  if (result.isError) {
    const message = textOf(result)
    if (LIMIT_RE.test(message)) {
      throw new ImportError(
        'FIGMA_MCP_LIMIT',
        'The Figma MCP server reached the limit of your plan. Use the REST API source instead.',
      )
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
```

- [ ] **Step 5: Write `index.js`**

Create `src/main/figma/index.js`:

```js
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
```

- [ ] **Step 6: Run the tests and make sure they pass**

Run: `yarn test src/main/figma`
Expected: PASS, all Figma tests (parse-url 6, trim-node 8, rest-source 7, mcp-source 5, index 2).

- [ ] **Step 7: Commit**

```bash
yarn prettier --write src/main/figma
yarn lint && yarn prettier:check && yarn test
git add src/main/figma package.json yarn.lock
git commit -m "Read Figma designs from the desktop MCP server"
```

---

### Task 10: Asset download

**Files:**

- Create: `src/main/download-assets.js`
- Test: `src/main/download-assets.test.js`

**Interfaces:**

- Consumes: the `assets` list of a `Design`.
- Produces:
  - `slugify(name) -> string`
  - `downloadAssets({ assets, projectPath, fetch = globalThis.fetch, signal?, onProgress? }) -> Promise<Array<{ id, url, name, path, ok, format }>>`. `path` is relative to the project (`images/logo.png`). Progress: `{ step: 'assets', detail: '1/3' }`. It never overwrites a file.

- [ ] **Step 1: Write the failing test**

Create `src/main/download-assets.test.js`:

```js
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
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `yarn test src/main/download-assets.test.js`
Expected: FAIL, the module `./download-assets` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/main/download-assets.js`:

```js
import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const FORMATS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export function slugify(name) {
  const slug = String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'image'
}

async function exists(p) {
  try {
    await access(p)
    return true
  } catch (err) {
    return false
  }
}

async function freeName(dir, base, format, used) {
  let name = `${base}.${format}`
  for (let n = 2; used.has(name) || (await exists(join(dir, name))); n++) {
    name = `${base}-${n}.${format}`
  }
  used.add(name)
  return name
}

// Downloads the images of a design into <project>/images. Figma URLs expire,
// so the template uses these local files. A failed image does not stop the
// import, the result has `ok: false` for it.
export async function downloadAssets({
  assets,
  projectPath,
  fetch = globalThis.fetch,
  signal,
  onProgress = () => {},
}) {
  const results = []
  if (!assets.length) {
    return results
  }

  const dir = join(projectPath, 'images')
  await mkdir(dir, { recursive: true })
  const used = new Set()

  for (const [index, asset] of assets.entries()) {
    onProgress({ step: 'assets', detail: `${index + 1}/${assets.length}` })
    const base = slugify(asset.suggestedName)
    let body = null
    let format = 'png'

    try {
      if (asset.url) {
        const res = await fetch(asset.url, { signal })
        if (res.ok) {
          const type = (res.headers.get('content-type') || '').split(';')[0].trim()
          format = FORMATS[type] || 'png'
          body = Buffer.from(await res.arrayBuffer())
        }
      }
    } catch (err) {
      if (signal && signal.aborted) {
        throw err
      }
    }

    const name = await freeName(dir, base, format, used)
    if (body) {
      await writeFile(join(dir, name), body, { flag: 'wx' })
    }
    results.push({
      id: asset.id,
      url: asset.url,
      name: asset.suggestedName,
      path: `images/${name}`,
      ok: Boolean(body),
      format,
    })
  }

  return results
}
```

- [ ] **Step 4: Run the test and make sure it passes**

Run: `yarn test src/main/download-assets.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
yarn prettier --write src/main/download-assets.js src/main/download-assets.test.js
yarn lint && yarn prettier:check && yarn test
git add src/main/download-assets.js src/main/download-assets.test.js
git commit -m "Download the Figma images into the project folder"
```

---

### Task 11: Importer, IPC, preload and settings state

**Files:**

- Create: `src/main/figma-import.js`, `src/main/screenshot.js`
- Test: `src/main/figma-import.test.js`
- Modify: `src/main/ipc.js` (move `takeScreenshot` out, add handlers)
- Modify: `src/preload/index.js` (new API and event channel)
- Modify: `src/actions/settings.js` (defaults), `src/reducers/settings.js` (state)

**Interfaces:**

- Consumes: `getDesign`, `testFigmaConnection` (Task 9), `downloadAssets` (Task 10), `generateMjml`, `refineMjml` (Task 6), `validateMjml` (Task 5), `createModel` (Task 7), `toErrorResult`, `ImportError` (Task 2), the secret store (Task 3).
- Produces:
  - `createFigmaImporter({ secrets, renderScreenshot, fetch = globalThis.fetch }) -> { importDesign(params, onProgress), refine(params, onProgress), cancel(), testAi(ai), testFigma(figma) }`
  - `importDesign({ link, projectPath, fileName, ai, figma }, onProgress) -> Promise<{ filePath, warnings, usage } | { error }>`
  - `refine({ filePath, content, instruction, ai }, onProgress) -> Promise<{ content, warnings, usage } | { error }>`
  - `testAi(ai)`, `testFigma(figma) -> Promise<{ ok: boolean, message: string }>`
  - Error codes added here: `BUSY`, `INVALID_FILE_NAME`, `FILE_EXISTS`, `UNKNOWN_SECRET`.
  - `renderScreenshot(html, width, workingDirectory) -> Promise<Buffer>` in `src/main/screenshot.js`
  - Preload: `window.api.figma.{ import, refine, cancel, testConnection }`, `window.api.ai.testConnection`, `window.api.secrets.{ set, has, isAvailable }`, event channel `figma-import-progress`.
  - Settings state: `settings.get('ai')` and `settings.get('figma')` are Immutable `Map`s.

- [ ] **Step 1: Write the failing test**

Create `src/main/figma-import.test.js`:

```js
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MockLanguageModelV4 } from 'ai/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./figma', () => ({ getDesign: vi.fn(), testFigmaConnection: vi.fn() }))
vi.mock('./ai/providers', () => ({ createModel: vi.fn() }))

const { getDesign } = await import('./figma')
const { createModel } = await import('./ai/providers')
const { createFigmaImporter } = await import('./figma-import')

const VALID =
  '<mjml><mj-body><mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-body></mjml>'

function replyModel(text) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 5, text: 5, reasoning: 0 },
      },
      warnings: [],
    }),
  })
}

const design = {
  source: 'mcp',
  name: 'Newsletter',
  width: 600,
  screenshot: Buffer.from('png'),
  context: 'code',
  variables: {},
  assets: [],
}

const secrets = { get: async () => 'secret-key-123', getAll: async () => ['secret-key-123'] }
const ai = { provider: 'anthropic', model: '', visualCheck: false }
const figma = { source: 'mcp', mcpURL: 'http://127.0.0.1:3845/mcp' }

describe('createFigmaImporter', () => {
  let dir

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mjml-import-'))
    getDesign.mockReset()
    createModel.mockReset()
    createModel.mockReturnValue(replyModel(`\`\`\`mjml\n${VALID}\n\`\`\``))
  })

  afterEach(() => rm(dir, { recursive: true, force: true }))

  const params = () => ({ link: 'L', projectPath: dir, fileName: 'news.mjml', ai, figma })

  it('writes the MJML file and returns the usage', async () => {
    getDesign.mockResolvedValue(design)
    const importer = createFigmaImporter({ secrets, renderScreenshot: vi.fn() })
    const onProgress = vi.fn()

    const res = await importer.importDesign(params(), onProgress)

    expect(res.error).toBeUndefined()
    expect(res.filePath).toBe(join(dir, 'news.mjml'))
    expect(await readFile(res.filePath, 'utf8')).toBe(VALID)
    expect(res.usage).toEqual({ inputTokens: 10, outputTokens: 5, calls: 1 })
    expect(onProgress).toHaveBeenCalledWith({ step: 'write' })
  })

  it('never overwrites a file', async () => {
    getDesign.mockResolvedValue(design)
    await writeFile(join(dir, 'news.mjml'), 'mine')
    const importer = createFigmaImporter({ secrets, renderScreenshot: vi.fn() })

    const res = await importer.importDesign(params(), () => {})

    expect(res.error.code).toBe('FILE_EXISTS')
    expect(await readFile(join(dir, 'news.mjml'), 'utf8')).toBe('mine')
  })

  it('rejects a file name with a path', async () => {
    const importer = createFigmaImporter({ secrets, renderScreenshot: vi.fn() })
    const res = await importer.importDesign({ ...params(), fileName: '../x.mjml' }, () => {})
    expect(res.error.code).toBe('INVALID_FILE_NAME')
    expect(getDesign).not.toHaveBeenCalled()
  })

  it('runs one import at a time and can cancel it', async () => {
    getDesign.mockImplementation(
      ({ signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )
    const importer = createFigmaImporter({ secrets, renderScreenshot: vi.fn() })

    const first = importer.importDesign(params(), () => {})
    const second = await importer.importDesign(params(), () => {})
    expect(second.error.code).toBe('BUSY')

    importer.cancel()
    expect((await first).error.code).toBe('CANCELLED')
  })

  it('removes secrets from error messages', async () => {
    getDesign.mockRejectedValue(new Error('bad key secret-key-123'))
    const importer = createFigmaImporter({ secrets, renderScreenshot: vi.fn() })
    const res = await importer.importDesign(params(), () => {})
    expect(res.error.message).toBe('bad key ***')
  })

  it('refines content and sends the Figma screenshot of an imported file', async () => {
    getDesign.mockResolvedValue(design)
    const importer = createFigmaImporter({ secrets, renderScreenshot: vi.fn() })
    const { filePath } = await importer.importDesign(params(), () => {})

    const res = await importer.refine(
      { filePath, content: VALID, instruction: 'make it blue', ai },
      () => {},
    )

    expect(res.content).toBe(VALID)
    expect(res.usage.calls).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `yarn test src/main/figma-import.test.js`
Expected: FAIL, the module `./figma-import` does not exist.

- [ ] **Step 3: Write `figma-import.js`**

Create `src/main/figma-import.js`:

```js
import { writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join } from 'node:path'
import { generateText } from 'ai'

import { generateMjml, refineMjml } from './ai/generate-mjml'
import { createModel } from './ai/providers'
import { validateMjml } from './ai/validate-mjml'
import { downloadAssets } from './download-assets'
import { ImportError, toErrorResult } from './errors'
import { getDesign, testFigmaConnection } from './figma'

const FILE_NAME_RE = /^[\w.-]+\.mjml$/

function checkFileName(projectPath, fileName) {
  if (!isAbsolute(String(projectPath)) || basename(fileName) !== fileName || !FILE_NAME_RE.test(fileName)) {
    throw new ImportError(
      'INVALID_FILE_NAME',
      'Use a file name with letters, numbers, "-", "_" or "." only.',
    )
  }
}

function imageWarnings(images) {
  const warnings = []
  for (const image of images) {
    if (!image.ok) {
      warnings.push(`The app could not download ${image.path}. The template uses a placeholder.`)
    } else if (image.format === 'svg') {
      warnings.push(
        `${image.path} is an SVG file. Many email clients do not show SVG images. Export it as PNG in Figma and replace the file.`,
      )
    }
  }
  return warnings
}

// Runs the Figma import and the refine command in the main process. Only one
// of them runs at a time. The results are plain objects, errors included,
// because errors lose their code when they cross IPC.
export function createFigmaImporter({ secrets, renderScreenshot, fetch = globalThis.fetch }) {
  let running = null
  const screenshots = new Map()

  async function run(fn) {
    if (running) {
      return { error: { code: 'BUSY', message: 'An import is already running.' } }
    }
    const controller = new AbortController()
    running = controller
    try {
      return await fn(controller.signal)
    } catch (err) {
      if (controller.signal.aborted) {
        return { error: { code: 'CANCELLED', message: 'The import was cancelled.' } }
      }
      return toErrorResult(err, await secrets.getAll())
    } finally {
      running = null
    }
  }

  async function getModel(ai) {
    return createModel(ai, await secrets.get(`ai.${ai.provider}`))
  }

  function importDesign({ link, projectPath, fileName, ai, figma }, onProgress) {
    return run(async signal => {
      onProgress({ step: 'parse' })
      checkFileName(projectPath, fileName)
      const model = await getModel(ai)

      onProgress({ step: 'figma' })
      const design = await getDesign({
        link,
        source: figma.source,
        mcpURL: figma.mcpURL,
        token: await secrets.get('figma.token'),
        signal,
        fetch,
      })

      const images = await downloadAssets({
        assets: design.assets,
        projectPath,
        fetch,
        signal,
        onProgress,
      })
      // MCP code has the asset URLs, the model gets the local paths instead
      let context = design.context
      for (const image of images) {
        if (image.ok && image.url) {
          context = context.split(image.url).join(image.path)
        }
      }

      const filePath = join(projectPath, fileName)
      const result = await generateMjml({
        model,
        design: { ...design, context },
        images,
        validate: content => validateMjml(content, filePath),
        renderScreenshot: (html, width) => renderScreenshot(html, width, projectPath),
        visualCheck: ai.visualCheck !== false,
        signal,
        onProgress,
      })

      onProgress({ step: 'write' })
      try {
        await writeFile(filePath, result.mjml, { flag: 'wx' })
      } catch (err) {
        if (err.code === 'EEXIST') {
          throw new ImportError('FILE_EXISTS', `${fileName} already exists.`)
        }
        throw err
      }
      screenshots.set(filePath, design.screenshot)

      return {
        filePath,
        warnings: [...imageWarnings(images), ...result.warnings],
        usage: result.usage,
      }
    })
  }

  function refine({ filePath, content, instruction, ai }, onProgress) {
    return run(async signal => {
      const model = await getModel(ai)
      const result = await refineMjml({
        model,
        content,
        instruction,
        screenshot: screenshots.get(filePath),
        validate: value => validateMjml(value, filePath),
        signal,
        onProgress,
      })
      return { content: result.mjml, warnings: result.warnings, usage: result.usage }
    })
  }

  function cancel() {
    if (running) {
      running.abort()
    }
  }

  async function testAi(ai) {
    try {
      const { text } = await generateText({
        model: await getModel(ai),
        prompt: 'Reply with the word OK.',
        maxOutputTokens: 16,
        maxRetries: 0,
      })
      return { ok: true, message: `The model replied: ${text.trim().slice(0, 40)}` }
    } catch (err) {
      return { ok: false, message: toErrorResult(err, await secrets.getAll()).error.message }
    }
  }

  async function testFigma(figma) {
    try {
      return await testFigmaConnection({
        source: figma.source,
        mcpURL: figma.mcpURL,
        token: await secrets.get('figma.token'),
        fetch,
      })
    } catch (err) {
      return { ok: false, message: toErrorResult(err, await secrets.getAll()).error.message }
    }
  }

  return { importDesign, refine, cancel, testAi, testFigma }
}
```

- [ ] **Step 4: Run the test and make sure it passes**

Run: `yarn test src/main/figma-import.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Move the screenshot code**

Create `src/main/screenshot.js` with the code that is now in `src/main/ipc.js` (lines with `SCREENSHOT_TMP_FILE` and `takeScreenshot`), plus `cleanUpScreenshot` and `renderScreenshot`:

```js
import { unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow } from 'electron'

const SCREENSHOT_TMP_FILE = 'tpm-mjml-preview.html'

// The temporary file is in the working directory, so relative image paths of
// the HTML resolve.
export function takeScreenshot(html, deviceWidth, workingDirectory) {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: deviceWidth,
      show: false,
    })

    const tmpFileName = join(workingDirectory, SCREENSHOT_TMP_FILE)

    win.webContents.once('did-finish-load', async () => {
      try {
        const height = await win.webContents.executeJavaScript(
          "document.querySelector('body').getBoundingClientRect().height",
        )
        win.setSize(deviceWidth, Math.ceil(height) + 50)
        // Window is not fully painted after this event, hence setTimeout()...
        setTimeout(async () => {
          try {
            const img = await win.webContents.capturePage()
            resolve(img.toPNG())
          } catch (err) {
            reject(err)
          } finally {
            win.close()
          }
        }, 500)
      } catch (err) {
        win.close()
        reject(err)
      }
    })

    writeFile(tmpFileName, html)
      .then(() => win.loadURL(pathToFileURL(tmpFileName).href))
      .catch(err => {
        win.close()
        reject(err)
      })
  })
}

export function cleanUpScreenshot(workingDirectory) {
  return unlink(join(workingDirectory, SCREENSHOT_TMP_FILE))
}

// screenshot for the visual check of the Figma import
export async function renderScreenshot(html, width, workingDirectory) {
  try {
    return await takeScreenshot(html, width, workingDirectory)
  } finally {
    await cleanUpScreenshot(workingDirectory).catch(() => {})
  }
}
```

- [ ] **Step 6: Wire the IPC handlers**

In `src/main/ipc.js`:

1. Remove `SCREENSHOT_TMP_FILE`, the `takeScreenshot` function, and the imports that only it used (`writeFile`, `unlink`, `join`, `pathToFileURL`).
2. Replace the imports at the top with:

```js
import { promisify } from 'node:util'
import { join } from 'node:path'
import { app, BrowserWindow, clipboard, dialog, ipcMain, safeStorage, shell } from 'electron'
import storage from 'electron-json-storage'

import { toErrorResult } from './errors'
import { createFigmaImporter } from './figma-import'
import { cleanUpScreenshot, renderScreenshot, takeScreenshot } from './screenshot'
import { createSecretStore, SECRET_NAMES } from './secrets'
import { compile } from './templating'
```

3. Change the two screenshot handlers to:

```js
  ipcMain.handle('screenshot:take', (e, html, deviceWidth, workingDirectory) =>
    takeScreenshot(html, deviceWidth, workingDirectory),
  )
  ipcMain.handle('screenshot:cleanUp', (e, workingDirectory) => cleanUpScreenshot(workingDirectory))
```

4. Add at the end of `registerIpcHandlers()`:

```js
  const secrets = createSecretStore({
    filePath: join(app.getPath('userData'), 'secrets.json'),
    safeStorage,
  })
  const importer = createFigmaImporter({ secrets, renderScreenshot })
  const unknownSecret = { error: { code: 'UNKNOWN_SECRET', message: 'Unknown secret.' } }

  ipcMain.handle('secrets:isAvailable', () => secrets.isAvailable())
  ipcMain.handle('secrets:has', (e, name) => SECRET_NAMES.includes(name) && secrets.has(name))
  ipcMain.handle('secrets:set', async (e, name, value) => {
    if (!SECRET_NAMES.includes(name)) {
      return unknownSecret
    }
    try {
      await secrets.set(name, value)
      return { ok: true }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  const sendProgress = e => progress => {
    if (!e.sender.isDestroyed()) {
      e.sender.send('figma-import-progress', progress)
    }
  }
  ipcMain.handle('figma:import', (e, params) => importer.importDesign(params, sendProgress(e)))
  ipcMain.handle('figma:refine', (e, params) => importer.refine(params, sendProgress(e)))
  ipcMain.handle('figma:cancel', () => importer.cancel())
  ipcMain.handle('figma:testConnection', (e, figma) => importer.testFigma(figma))
  ipcMain.handle('ai:testConnection', (e, ai) => importer.testAi(ai))
```

- [ ] **Step 7: Expose the API in the preload script**

In `src/preload/index.js`:

1. Change the channel list:

```js
const EVENT_CHANNELS = ['redux-command', 'openPath', 'browser-window-focus', 'figma-import-progress']
```

2. Add to the `api` object, after `sendEmail,`:

```js
  // Figma import: the main process keeps the keys and makes the requests
  figma: {
    import: params => ipcRenderer.invoke('figma:import', params),
    refine: params => ipcRenderer.invoke('figma:refine', params),
    cancel: () => ipcRenderer.invoke('figma:cancel'),
    testConnection: figma => ipcRenderer.invoke('figma:testConnection', figma),
  },
  ai: {
    testConnection: ai => ipcRenderer.invoke('ai:testConnection', ai),
  },
  // the renderer can set a secret and ask if it exists, it cannot read it
  secrets: {
    isAvailable: () => ipcRenderer.invoke('secrets:isAvailable'),
    has: name => ipcRenderer.invoke('secrets:has', name),
    set: (name, value) => ipcRenderer.invoke('secrets:set', name, value),
  },
```

- [ ] **Step 8: Add the settings defaults and state**

In `src/actions/settings.js`, in the `defaultsDeep` object, add after `previewSize: { ... },`:

```js
      ai: {
        provider: 'anthropic',
        model: '',
        baseURL: '',
        visualCheck: true,
      },
      figma: {
        source: 'mcp',
        mcpURL: 'http://127.0.0.1:3845/mcp',
      },
```

In `src/reducers/settings.js`, in `SETTINGS_LOAD_SUCCESS`, add after `previewSize: Map(payload.previewSize),`:

```js
        ai: Map(payload.ai),
        figma: Map(payload.figma),
```

- [ ] **Step 9: Build and check**

Run: `yarn lint && yarn prettier:check && yarn test && yarn build`
Expected: all pass. `out/main/index.js` exists. Run `yarn dev` and make sure the app starts and a project opens with no error in the terminal.

- [ ] **Step 10: Commit**

```bash
yarn prettier --write src/main src/preload src/actions/settings.js src/reducers/settings.js
yarn lint && yarn prettier:check && yarn test
git add src/main src/preload src/actions/settings.js src/reducers/settings.js
git commit -m "Run the Figma import in the main process and expose it through IPC"
```

---

### Task 12: "AI & Figma" settings tab

**Files:**

- Create: `src/components/SettingsModal/AIFigmaSettings.jsx`
- Modify: `src/components/SettingsModal/index.jsx` (new tab)

**Interfaces:**

- Consumes: `PROVIDERS`, `PROVIDER_IDS` (Task 7), `window.api.secrets`, `window.api.ai.testConnection`, `window.api.figma.testConnection` (Task 11), `updateSettings` from `actions/settings`, settings `ai` and `figma` maps (Task 11).
- Produces: the default export `AIFigmaSettings` (connected component, no props).

- [ ] **Step 1: Write the component**

Create `src/components/SettingsModal/AIFigmaSettings.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { connect } from 'react-redux'
import cx from 'classnames'

import api from 'helpers/api'
import { updateSettings } from 'actions/settings'
import { PROVIDERS, PROVIDER_IDS } from 'data/aiProviders'

import Button from 'components/Button'
import CheckBox from 'components/CheckBox'
import RadioGroup from 'components/RadioGroup'
import Radio from 'components/RadioGroup/Radio'

const LABEL_WIDTH = 150

function Row({ label, children }) {
  return (
    <div className="d-f ai-c">
      <div style={{ width: LABEL_WIDTH }} className="fs-0 t-small">
        {label}
      </div>
      <div className="fg-1 d-f ai-c">{children}</div>
    </div>
  )
}

function SecretInput({ name, label }) {
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let alive = true
    setMessage(null)
    api.secrets.has(name).then(has => alive && setSaved(Boolean(has)))
    return () => {
      alive = false
    }
  }, [name])

  const save = async next => {
    const res = await api.secrets.set(name, next)
    if (res.error) {
      setMessage(res.error.message)
      return
    }
    setSaved(Boolean(next))
    setValue('')
    setMessage(next ? 'Saved' : 'Removed')
  }

  return (
    <Row label={label}>
      <input
        className="fg-1"
        type="password"
        value={value}
        placeholder={saved ? 'Saved (type to replace)' : 'Not set'}
        onChange={e => setValue(e.target.value.trim())}
      />
      <Button className="ml-5" ghost disabled={!value} onClick={() => save(value)}>
        {'Save'}
      </Button>
      {saved && (
        <Button className="ml-5" transparent onClick={() => save('')}>
          {'Remove'}
        </Button>
      )}
      {message && <span className="ml-5 t-small">{message}</span>}
    </Row>
  )
}

function TestConnection({ run }) {
  const [result, setResult] = useState(null)

  const test = async () => {
    setResult({ ok: true, message: 'Testing...' })
    setResult(await run())
  }

  return (
    <div className="d-f ai-c">
      <Button ghost onClick={test}>
        {'Test connection'}
      </Button>
      {result && (
        <span className={cx('ml-10 t-small', { 'c-red': !result.ok })}>{result.message}</span>
      )}
    </div>
  )
}

function AIFigmaSettings({ ai, figma, updateSettings }) {
  const [encryption, setEncryption] = useState(true)

  useEffect(() => {
    api.secrets.isAvailable().then(setEncryption)
  }, [])

  const provider = ai.get('provider')
  const info = PROVIDERS[provider] || PROVIDERS.anthropic
  const setValue = (group, key) => value => updateSettings(s => s.setIn([group, key], value))
  const onInput = (group, key) => e => setValue(group, key)(e.target.value.trim())

  return (
    <div className="flow-v-10">
      {!encryption && (
        <div className="t-small c-red">
          {'The system keychain is not available. The app cannot save API keys on this system.'}
        </div>
      )}

      <div className="mt-10">{'AI provider:'}</div>
      <Row label="Provider:">
        <select className="fg-1" value={provider} onChange={onInput('ai', 'provider')}>
          {PROVIDER_IDS.map(id => (
            <option key={id} value={id}>
              {PROVIDERS[id].label}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Model:">
        <input
          className="fg-1"
          value={ai.get('model')}
          placeholder={info.defaultModel || 'for example llama3.2'}
          onChange={onInput('ai', 'model')}
        />
      </Row>
      {provider === 'openai-compatible' && (
        <>
          <Row label="Base URL:">
            <input
              className="fg-1"
              value={ai.get('baseURL')}
              placeholder="http://localhost:11434/v1"
              onChange={onInput('ai', 'baseURL')}
            />
          </Row>
          <div className="t-small" style={{ marginLeft: LABEL_WIDTH }}>
            {'Ollama: http://localhost:11434/v1 · LM Studio: http://localhost:1234/v1 · '}
            {'OpenRouter: https://openrouter.ai/api/v1'}
          </div>
        </>
      )}
      <SecretInput
        key={provider}
        name={`ai.${provider}`}
        label={info.needsKey ? 'API key:' : 'API key (optional):'}
      />
      {info.keyURL && (
        <div className="t-small" style={{ marginLeft: LABEL_WIDTH }}>
          <a
            href=""
            className="a c-blue"
            onClick={e => {
              e.preventDefault()
              api.shell.openExternal(info.keyURL)
            }}
          >
            {'Get an API key'}
          </a>
        </div>
      )}
      <CheckBox value={ai.get('visualCheck')} onChange={setValue('ai', 'visualCheck')}>
        {'Compare the result with the design and fix it (one more model call)'}
      </CheckBox>
      <TestConnection run={() => api.ai.testConnection(ai.toJS())} />

      <div className="mt-20">{'Figma source:'}</div>
      <RadioGroup value={figma.get('source')} onChange={setValue('figma', 'source')}>
        <Radio value="mcp">
          <div className="flow-v-10">
            <div>{'Figma desktop MCP server (open the file in the Figma desktop app)'}</div>
            {figma.get('source') === 'mcp' && (
              <input
                className="fg-1"
                value={figma.get('mcpURL')}
                onChange={onInput('figma', 'mcpURL')}
              />
            )}
          </div>
        </Radio>
        <Radio value="rest">{'Figma REST API (works on the free plan)'}</Radio>
      </RadioGroup>
      <SecretInput name="figma.token" label="Figma token:" />
      <div className="t-small" style={{ marginLeft: LABEL_WIDTH }}>
        <a
          href=""
          className="a c-blue"
          onClick={e => {
            e.preventDefault()
            api.shell.openExternal('https://www.figma.com/developers/api#access-tokens')
          }}
        >
          {'Create a personal access token'}
        </a>
        {' · The REST source and the "Try REST" fallback use it.'}
      </div>
      <TestConnection run={() => api.figma.testConnection(figma.toJS())} />
    </div>
  )
}

export default connect(
  state => ({
    ai: state.settings.get('ai'),
    figma: state.settings.get('figma'),
  }),
  { updateSettings },
)(AIFigmaSettings)
```

- [ ] **Step 2: Add the tab**

In `src/components/SettingsModal/index.jsx`:

1. Add the imports:

```js
import { FaFigma } from 'react-icons/fa'
import AIFigmaSettings from './AIFigmaSettings'
```

2. Add the tab before `<TabItem title="Snippets" ...>`:

```jsx
              <TabItem title="AI & Figma" className="flow-v-10" icon={FaFigma}>
                <AIFigmaSettings />
              </TabItem>
```

- [ ] **Step 3: Check it in the app**

Run: `yarn dev`
Do these checks:

1. Open the settings (cog button). Open the "AI & Figma" tab.
2. Select each provider. Make sure the model placeholder changes and the base URL row shows only for "OpenAI compatible".
3. Type a key and click "Save". Make sure "Saved" shows and the field is empty. Close and open the settings. Make sure the placeholder is "Saved (type to replace)".
4. Click "Test connection" with a wrong key. Make sure a red message shows and the message does not contain the key.
5. Restart the app. Make sure the provider and the Figma source stay as you set them.

- [ ] **Step 4: Commit**

```bash
yarn prettier --write src/components/SettingsModal
yarn lint && yarn prettier:check && yarn test
git add src/components/SettingsModal
git commit -m "Add the AI and Figma settings tab"
```

---

### Task 13: Import modal on the Project page

**Files:**

- Create: `src/pages/Project/FigmaImportModal.jsx`
- Modify: `src/pages/Project/index.jsx`

**Interfaces:**

- Consumes: `window.api.figma.import`, `window.api.figma.cancel`, `window.api.secrets.has`, `api.on('figma-import-progress')` (Task 11). `isModalOpened`, `closeModal`, `openModal` from `reducers/modals`. `fileExists` from `helpers/fs`.
- Produces: `FigmaImportModal` with props `rootPath: string`, `onImported({ filePath, warnings, usage })`. Modal name `figmaImport`.

- [ ] **Step 1: Write the modal**

Create `src/pages/Project/FigmaImportModal.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react'
import { connect } from 'react-redux'
import { MdAutorenew as IconChecking, MdError as IconError } from 'react-icons/md'

import api, { path } from 'helpers/api'
import { fileExists } from 'helpers/fs'
import { isModalOpened, closeModal, openModal } from 'reducers/modals'

import Modal from 'components/Modal'
import Button from 'components/Button'

export const STEP_LABELS = {
  parse: 'Checking the settings',
  figma: 'Reading the Figma design',
  assets: 'Downloading the images',
  generate: 'Writing MJML with AI',
  validate: 'Fixing MJML errors',
  'visual-check': 'Comparing the result with the design',
  write: 'Saving the file',
}

const SETTINGS_CODES = [
  'AI_KEY_MISSING',
  'AI_UNAUTHORIZED',
  'AI_MODEL_MISSING',
  'AI_BASE_URL_MISSING',
  'AI_PROVIDER_UNKNOWN',
  'FIGMA_TOKEN_MISSING',
  'FIGMA_FORBIDDEN',
  'ENCRYPTION_UNAVAILABLE',
]
const REST_FALLBACK_CODES = ['FIGMA_MCP_UNAVAILABLE', 'FIGMA_MCP_LIMIT']
const NAME_RE = /^[\w.-]+$/

function FigmaImportModal({ isOpened, rootPath, ai, figma, closeModal, openModal, onImported }) {
  const [link, setLink] = useState('')
  const [fileName, setFileName] = useState('figma')
  const [exists, setExists] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const isRunning = useRef(false)

  useEffect(() => {
    if (isOpened) {
      api.secrets.has('figma.token').then(setHasToken)
    }
  }, [isOpened])

  useEffect(
    () => api.on('figma-import-progress', p => isRunning.current && setProgress(p)),
    [],
  )

  useEffect(() => {
    let alive = true
    if (!NAME_RE.test(fileName)) {
      setExists(false)
      return
    }
    fileExists(path.join(rootPath, `${fileName}.mjml`)).then(v => alive && setExists(v))
    return () => {
      alive = false
    }
  }, [rootPath, fileName])

  const isNameValid = NAME_RE.test(fileName) && !exists
  const canSubmit = Boolean(link.trim()) && isNameValid && !progress

  const run = async source => {
    setError(null)
    setProgress({ step: 'parse' })
    isRunning.current = true
    const res = await api.figma.import({
      link: link.trim(),
      projectPath: rootPath,
      fileName: `${fileName}.mjml`,
      ai: ai.toJS(),
      figma: { ...figma.toJS(), source },
    })
    isRunning.current = false
    setProgress(null)

    if (res.error) {
      if (res.error.code !== 'CANCELLED') {
        setError(res.error)
      }
      return
    }
    closeModal('figmaImport')
    setLink('')
    onImported(res)
  }

  const handleSubmit = e => {
    e.preventDefault()
    if (canSubmit) {
      run(figma.get('source'))
    }
  }

  const handleClose = () => {
    if (progress) {
      api.figma.cancel()
    }
    setError(null)
    closeModal('figmaImport')
  }

  const openSettings = () => {
    closeModal('figmaImport')
    openModal('settings')
  }

  return (
    <Modal isOpened={isOpened} onClose={handleClose}>
      <div className="Modal--label">{'Import from Figma'}</div>

      <form className="flow-v-20" onSubmit={handleSubmit}>
        <div className="d-f ai-b">
          <div style={{ width: 150 }} className="fs-0">
            {'Figma link:'}
          </div>
          <input
            className="fg-1"
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder="https://www.figma.com/design/...?node-id=..."
            disabled={Boolean(progress)}
            autoFocus
          />
        </div>
        <div className="d-f ai-b">
          <div style={{ width: 150 }} className="fs-0">
            {'File name:'}
          </div>
          <div className="fg-1">
            <div className="d-f ai-c">
              <input
                className="fg-1"
                value={fileName}
                onChange={e => setFileName(e.target.value.trim())}
                disabled={Boolean(progress)}
              />
              <div className="ml-5">{'.mjml'}</div>
            </div>
            {exists && (
              <div className="t-small mt-10 c-red">
                <b className="mr-5">{`${fileName}.mjml`}</b>
                {'already exists'}
              </div>
            )}
          </div>
        </div>
        <div className="t-small">
          {`Source: ${figma.get('source') === 'rest' ? 'Figma REST API' : 'Figma desktop MCP'} · `}
          {`AI: ${ai.get('provider')}${ai.get('model') ? ` (${ai.get('model')})` : ''}`}
        </div>

        {progress && (
          <div className="t-small">
            <IconChecking className="rotating mr-5" />
            {STEP_LABELS[progress.step] || progress.step}
            {progress.detail ? ` (${progress.detail})` : ''}
          </div>
        )}

        {error && (
          <div className="t-small c-red flow-v-10">
            <div>
              <IconError className="mr-5 mb-5" />
              {error.message}
            </div>
            <div className="d-f flow-h-10">
              {SETTINGS_CODES.includes(error.code) && (
                <Button ghost onClick={openSettings}>
                  {'Open settings'}
                </Button>
              )}
              {REST_FALLBACK_CODES.includes(error.code) && hasToken && (
                <Button ghost onClick={() => run('rest')}>
                  {'Try REST'}
                </Button>
              )}
            </div>
          </div>
        )}
      </form>

      <div className="ModalFooter">
        <Button primary onClick={handleSubmit} disabled={!canSubmit}>
          {'Import'}
        </Button>
        <Button transparent onClick={progress ? () => api.figma.cancel() : handleClose}>
          {progress ? 'Stop' : 'Cancel'}
        </Button>
      </div>
    </Modal>
  )
}

export default connect(
  state => ({
    isOpened: isModalOpened(state, 'figmaImport'),
    ai: state.settings.get('ai'),
    figma: state.settings.get('figma'),
  }),
  { closeModal, openModal },
)(FigmaImportModal)
```

- [ ] **Step 2: Wire it into the Project page**

In `src/pages/Project/index.jsx`:

1. Add the imports:

```js
import { FaFigma } from 'react-icons/fa'
import FigmaImportModal from './FigmaImportModal'
```

2. Add the methods in the class, after `openAddFileModal`:

```js
    openFigmaImportModal = () => this.props.openModal('figmaImport')

    handleFigmaImported = ({ filePath, warnings, usage }) => {
      const { addAlert } = this.props
      this._filelist.refresh()
      this.setState({ activeFile: { isFolder: false, name: pathModule.basename(filePath) } })
      addAlert(
        `Done: ${usage.inputTokens} input tokens, ${usage.outputTokens} output tokens, ${usage.calls} model calls`,
        'success',
      )
      if (warnings.length) {
        addAlert(['Import warnings:', ...warnings.map(w => `■ ${w}`)], 'info', { autoHide: false })
      }
    }
```

3. Add the button after the "New file" button:

```jsx
              <Button ghost onClick={this.openFigmaImportModal}>
                <FaFigma className="mr-5" />
                {'Import from Figma'}
              </Button>
```

4. Add the modal after `<AddFileModal ... />`:

```jsx
          <FigmaImportModal rootPath={path} onImported={this.handleFigmaImported} />
```

- [ ] **Step 3: Check it in the app**

Run: `yarn dev`
Do these checks:

1. Open a project. Click "Import from Figma".
2. Type `hello` as the link and click "Import". Make sure the "not a link to a Figma node" message shows.
3. Close the Figma desktop app. Paste a real Figma link with the MCP source. Make sure the MCP message shows, and "Try REST" shows if a token is saved.
4. With a valid key and a real link, click "Import". Make sure the steps show, the file opens in the editor, the preview shows the design, and `images/` has the images.
5. Start an import and click "Stop". Make sure no `.mjml` file is written.

- [ ] **Step 4: Commit**

```bash
yarn prettier --write src/pages/Project
yarn lint && yarn prettier:check && yarn test
git add src/pages/Project
git commit -m "Add the Import from Figma modal to the project page"
```

---

### Task 14: Refine modal

**Files:**

- Create: `src/pages/Project/RefineModal.jsx`
- Modify: `src/pages/Project/index.jsx`

**Interfaces:**

- Consumes: `window.api.figma.refine`, `window.api.figma.cancel`, `api.on('figma-import-progress')` (Task 11). `STEP_LABELS` from `./FigmaImportModal` (Task 13). The editor ref methods `getContent()` and `setContent(content)` (`components/FileEditor/index.jsx`). `setContent` dispatches one CodeMirror transaction, so the normal undo command reverts it.
- Produces: `RefineModal` with props `filePath: string | null`, `getEditor: () => FileEditor`. Modal name `refine`.

- [ ] **Step 1: Write the modal**

Create `src/pages/Project/RefineModal.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react'
import { connect } from 'react-redux'
import { MdAutorenew as IconChecking, MdError as IconError } from 'react-icons/md'

import api from 'helpers/api'
import { addAlert } from 'reducers/alerts'
import { isModalOpened, closeModal, openModal } from 'reducers/modals'

import Modal from 'components/Modal'
import Button from 'components/Button'

import { STEP_LABELS } from './FigmaImportModal'

function RefineModal({ isOpened, filePath, getEditor, ai, closeModal, openModal, addAlert }) {
  const [instruction, setInstruction] = useState('')
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const isRunning = useRef(false)

  useEffect(
    () => api.on('figma-import-progress', p => isRunning.current && setProgress(p)),
    [],
  )

  const canSubmit = Boolean(instruction.trim()) && Boolean(filePath) && !progress

  const handleSubmit = async e => {
    e.preventDefault()
    if (!canSubmit) {
      return
    }
    const editor = getEditor()
    setError(null)
    setProgress({ step: 'generate' })
    isRunning.current = true
    const res = await api.figma.refine({
      filePath,
      content: editor.getContent(),
      instruction: instruction.trim(),
      ai: ai.toJS(),
    })
    isRunning.current = false
    setProgress(null)

    if (res.error) {
      if (res.error.code !== 'CANCELLED') {
        setError(res.error)
      }
      return
    }
    editor.setContent(res.content)
    closeModal('refine')
    setInstruction('')
    addAlert(
      `Done: ${res.usage.inputTokens} input tokens, ${res.usage.outputTokens} output tokens. Undo reverts the change.`,
      'success',
    )
    if (res.warnings.length) {
      addAlert(['Refine warnings:', ...res.warnings.map(w => `■ ${w}`)], 'info', {
        autoHide: false,
      })
    }
  }

  const handleClose = () => {
    if (progress) {
      api.figma.cancel()
    }
    setError(null)
    closeModal('refine')
  }

  return (
    <Modal isOpened={isOpened} onClose={handleClose}>
      <div className="Modal--label">{'Refine with AI'}</div>

      <form className="flow-v-20" onSubmit={handleSubmit}>
        <textarea
          className="fg-1"
          style={{ width: '100%', minHeight: 100 }}
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="For example: make the button full width and use a 16px font"
          disabled={Boolean(progress)}
          autoFocus
        />

        {progress && (
          <div className="t-small">
            <IconChecking className="rotating mr-5" />
            {STEP_LABELS[progress.step] || progress.step}
            {progress.detail ? ` (${progress.detail})` : ''}
          </div>
        )}

        {error && (
          <div className="t-small c-red flow-v-10">
            <div>
              <IconError className="mr-5 mb-5" />
              {error.message}
            </div>
            {error.code.startsWith('AI_') && (
              <Button
                ghost
                onClick={() => {
                  closeModal('refine')
                  openModal('settings')
                }}
              >
                {'Open settings'}
              </Button>
            )}
          </div>
        )}
      </form>

      <div className="ModalFooter">
        <Button primary onClick={handleSubmit} disabled={!canSubmit}>
          {'Refine'}
        </Button>
        <Button transparent onClick={progress ? () => api.figma.cancel() : handleClose}>
          {progress ? 'Stop' : 'Cancel'}
        </Button>
      </div>
    </Modal>
  )
}

export default connect(
  state => ({
    isOpened: isModalOpened(state, 'refine'),
    ai: state.settings.get('ai'),
  }),
  { closeModal, openModal, addAlert },
)(RefineModal)
```

- [ ] **Step 2: Wire it into the Project page**

In `src/pages/Project/index.jsx`:

1. Add the imports (`MdAutoAwesome` goes into the existing `react-icons/md` import list):

```js
  MdAutoAwesome as IconRefine,
```

```js
import RefineModal from './RefineModal'
```

2. Add the method after `openFigmaImportModal`:

```js
    openRefineModal = () => this.props.openModal('refine')
```

3. In the `isMJMLFile && [ ... ]` button list, add after the "Beautify" button:

```jsx
                <Button key="refine" transparent onClick={this.openRefineModal}>
                  <IconRefine style={{ marginRight: 5 }} />
                  {'Refine with AI'}
                </Button>,
```

4. Add the modal after `<FigmaImportModal ... />`:

```jsx
          <RefineModal
            filePath={isMJMLFile ? pathModule.join(path, activeFile.name) : null}
            getEditor={() => this._editor}
          />
```

- [ ] **Step 3: Check it in the app**

Run: `yarn dev`
Do these checks:

1. Open an `.mjml` file. Click "Refine with AI".
2. Type "make the background of the body light gray" and click "Refine". Make sure the editor and the preview change.
3. Press Cmd+Z (Ctrl+Z on Windows and Linux). Make sure the old content comes back in one step.
4. Refine a file that an import made in this session. Make sure it works with a model that accepts images and with one that does not (a warning shows).

- [ ] **Step 4: Commit**

```bash
yarn prettier --write src/pages/Project
yarn lint && yarn prettier:check && yarn test
git add src/pages/Project
git commit -m "Add the Refine with AI command"
```

---

### Task 15: Documentation and final check

**Files:**

- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: all earlier tasks.
- Produces: up-to-date project instructions.

- [ ] **Step 1: Update `CLAUDE.md`**

1. In the commands block, add after `yarn prettier:check`:

```bash
yarn test            # Vitest unit tests (src/**/*.test.js)
```

2. Replace the sentence "The repository has no unit tests. CI (`.github/workflows/ci.yml`) runs `yarn lint`, `yarn prettier:check` and `yarn dist:dir` on macOS, Linux and Windows. A commit must pass `yarn lint` and `yarn prettier:check`." with:

```markdown
Unit tests (Vitest) cover the main process code of the Figma import. Tests are next to the code (`*.test.js`) and run in Node.js, so they do not import `electron`. CI (`.github/workflows/ci.yml`) runs `yarn lint`, `yarn prettier:check`, `yarn test` and `yarn dist:dir` on macOS, Linux and Windows. A commit must pass `yarn lint`, `yarn prettier:check` and `yarn test`.
```

3. Add a section after "### Templating":

```markdown
### Figma import

The Project page has "Import from Figma" (`pages/Project/FigmaImportModal.jsx`) and "Refine with AI" (`pages/Project/RefineModal.jsx`). All the work runs in the main process (`src/main/figma-import.js`):

- `src/main/figma/`: reads a node from the Figma desktop MCP server (`mcp-source.js`, default `http://127.0.0.1:3845/mcp`) or from the REST API (`rest-source.js`, personal access token). Both return the same `Design` object.
- `src/main/download-assets.js`: downloads the images into `images/` of the project. It never overwrites a file.
- `src/main/ai/`: the Vercel AI SDK sends the design to the selected provider (`providers.js`, list in `src/data/aiProviders.js`). `generate-mjml.js` validates the result with `mjml2html`, sends the errors back for at most 2 fix rounds and runs one visual self-check (screenshot of the result next to the Figma screenshot).
- `src/main/secrets.js`: API keys and the Figma token are encrypted with `safeStorage` in `secrets.json` in the app user data folder, not in `settings`. The renderer can set a secret and ask if it exists, it cannot read it.
- Settings: `settings.ai` (`provider`, `model`, `baseURL`, `visualCheck`) and `settings.figma` (`source`, `mcpURL`), edited in the "AI & Figma" settings tab.
- IPC returns `{ error: { code, message } }` instead of throwing. Progress goes to the renderer on the `figma-import-progress` channel.
```

- [ ] **Step 2: Run all checks**

Run: `yarn lint && yarn prettier:check && yarn test && yarn dist:dir`
Expected: all pass. `release/` has the unpacked app.

- [ ] **Step 3: Run the packaged app**

Open the unpacked app in `release/` (on macOS `release/mac-arm64/MJML.app` or `release/mac/MJML.app`). Do one import with the REST source and one with the MCP source. Make sure both write a file. This proves that the new `dependencies` are in the package.

- [ ] **Step 4: Run the manual test list of the spec**

1. MCP source with a paid model.
2. REST source with a free model (Ollama with a vision model such as `llama3.2-vision`, or the Gemini free tier).
3. MCP server off: the "Try REST" button shows.
4. Wrong API key: the error message and "Open settings" show.
5. Refine on an imported file, then undo.

Write down the result of each test in the PR description.

- [ ] **Step 5: Commit**

```bash
yarn prettier --write CLAUDE.md
git add CLAUDE.md
git commit -m "Document the Figma import"
```
