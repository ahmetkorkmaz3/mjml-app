# Figma to MJML import: design

Date: 2026-10-02
Status: draft, waiting for review

## Goal

The user gives a Figma link in MJML App. The app reads the design of that node and writes a new `.mjml` file into the open project. The result is a good, editable start. It is not a pixel-perfect copy.

The user selects the AI provider. Paid providers (Anthropic, OpenAI, Google) and free options (Ollama, LM Studio, OpenRouter free models, the Gemini free tier) must work.

## Decisions

| Topic           | Decision                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Where it runs   | Inside MJML App. All network calls and secrets stay in the main process.                                                                 |
| Figma source    | Two sources with one interface: Figma Desktop MCP server (`http://127.0.0.1:3845/mcp`) and Figma REST API with a personal access token. |
| AI layer        | Vercel AI SDK (`ai`) in the main process, with `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google` and `@ai-sdk/openai-compatible`.  |
| Entry point     | An "Import from Figma" button on the Project page. The result is a new file in the open project.                                        |
| Images          | Download to `images/` in the project folder. The MJML uses relative paths.                                                             |
| Secrets         | Electron `safeStorage`. The renderer can set a secret and ask if it exists. It cannot read the secret back.                             |
| Scope of v1     | Import, Figma variables to `mj-attributes`, connection tests, token report, visual self-check, refine command, Vitest unit tests.       |
| Not in v1       | Many frames to many files (`mj-include` partials). Upload of images to a CDN.                                                           |

Why two Figma sources: the Desktop MCP server gives the best data, but Figma limits MCP calls on the Starter plan and on View and Collab seats (about 6 calls each month). The REST API works on the free plan.

Why the Vercel AI SDK: one API for text and image input across all providers. The `openai-compatible` adapter covers Ollama, LM Studio, OpenRouter and Groq.

## Architecture

```
src/main/figma/
  parse-url.js        Figma link -> { fileKey, nodeId }
  mcp-source.js       Desktop MCP: get_design_context, get_screenshot, get_variable_defs
  rest-source.js      REST: node JSON, PNG export, image fills, variables
  trim-node.js        removes heavy fields from REST node JSON before it goes to the model
  index.js            getDesign(link, options) -> Design
src/main/ai/
  providers.js        createModel(aiSettings, apiKey) -> AI SDK model
  prompt.js           system prompt and message builders
  extract-mjml.js     takes the MJML out of a model reply
  generate-mjml.js    generate -> validate -> fix loop -> visual self-check
src/main/secrets.js   safeStorage wrapper, file in app userData
src/main/screenshot.js takeScreenshot(), moved out of ipc.js so the import flow can use it
src/main/figma-import.js  runs the import, sends progress events, keeps a cache for refine
src/main/ipc.js       registers the new handlers
src/preload/index.js  exposes window.api.figma, window.api.ai, window.api.secrets
src/pages/Project/FigmaImportModal.jsx
src/pages/Project/RefineModal.jsx
src/components/SettingsModal  new "AI & Figma" tab
```

### The Design object

Both Figma sources return the same shape:

```js
{
  name: 'Newsletter',          // node name, used for the default file name
  width: 600,                  // node width in px
  screenshot: Buffer,          // PNG of the node
  context: '...',              // MCP: generated code. REST: trimmed node JSON as text
  variables: { 'color/primary': '#1A73E8', ... },
  assets: [{ id, url, suggestedName }],
}
```

### Settings

New keys in the `settings` object (saved with `electron-json-storage`, defaults in `actions/settings.js`):

```js
ai: {
  provider: 'anthropic',      // anthropic | openai | google | openai-compatible
  model: '',                  // empty means the default model of the provider
  baseURL: '',                // only for openai-compatible, for example http://localhost:11434/v1
  visualCheck: true,          // run the visual self-check
},
figma: {
  source: 'mcp',              // mcp | rest
  mcpURL: 'http://127.0.0.1:3845/mcp',
}
```

Secrets (in `safeStorage`, not in `settings`): `ai.anthropic`, `ai.openai`, `ai.google`, `ai.openai-compatible`, `figma.token`.

If `safeStorage.isEncryptionAvailable()` is false (some Linux systems), the app shows a warning and does not save the secret.

### IPC

| Channel                  | Type   | Payload / result                                                         |
| ------------------------ | ------ | ------------------------------------------------------------------------ |
| `secrets:set`            | invoke | `(name, value)`. An empty value removes the secret.                      |
| `secrets:has`            | invoke | `(name) -> boolean`                                                      |
| `figma:testConnection`   | invoke | `(source) -> { ok, message }`                                            |
| `ai:testConnection`      | invoke | `() -> { ok, message }`. Sends a very short prompt.                       |
| `figma:import`           | invoke | `({ link, projectPath, fileName }) -> { filePath, warnings, usage }`     |
| `figma:refine`           | invoke | `({ filePath, content, instruction }) -> { content, warnings, usage }`   |
| `figma:cancel`           | invoke | stops the running import or refine                                       |
| `figma-import-progress`  | event  | `{ step, detail }` from main to renderer. Added to `EVENT_CHANNELS`.     |

Only one import or refine runs at a time. A second call while one runs gets an error.

## Data flow

### Import

1. The user opens the modal, gives the link and the file name, and clicks "Import". The modal checks the file name like `AddFileModal` does.
2. `parse-url.js` reads `fileKey` and `node-id` from the link (`node-id=12-34` becomes `12:34`). Links of type `design`, `file` and `proto` are accepted. A link without `node-id` is an error.
3. The selected source returns a `Design`.
   - MCP: `get_design_context` (code and asset URLs), `get_screenshot`, `get_variable_defs`. The file must be open in the Figma desktop app.
   - REST: `GET /v1/files/:key/nodes?ids=` for the tree, `GET /v1/images/:key?ids=&format=png&scale=2` for the screenshot and for nodes that are vectors or have export settings, `GET /v1/files/:key/images` for image fills, `GET /v1/files/:key/variables/local` for variables (Enterprise only, an error here is not fatal).
4. The assets download into `<project>/images/`. A name that exists gets a number suffix. A failed download gives a warning and the prompt marks that image as a placeholder.
5. `generate-mjml.js` sends the system prompt, the screenshot (image input), the context, the variables and the list of local image paths. The model returns MJML only.
6. The main process compiles the MJML with `mjml2html` (`validationLevel: 'soft'`, `filePath` set to the project so relative paths work). If there are errors, the errors go back to the model. There are at most 2 fix rounds.
7. Visual self-check (if `ai.visualCheck` is true and the model accepts images): the main process renders the HTML with `takeScreenshot()` at the design width. It sends the Figma screenshot, the render screenshot and the MJML to the model and asks for one corrected version. The app keeps the corrected version only if it compiles without errors.
8. The main process writes the file and returns `{ filePath, warnings, usage }`. The renderer refreshes the files list and opens the file in the editor.
9. The main process keeps the Figma screenshot in memory for that file path, for the refine command.

### Refine

1. The user opens a `.mjml` file and clicks "Refine with AI". The user writes an instruction, for example "make the button full width".
2. The renderer sends the current editor content and the instruction. If an import made this file in this session, the main process adds the Figma screenshot.
3. The same validate and fix loop runs (step 6 above). The visual self-check does not run for refine.
4. The renderer puts the result into the editor as one CodeMirror transaction. The user can undo it with the normal undo command. The normal save flow saves the file.

### Prompt rules

The system prompt tells the model to:

- return one MJML document only, in a single code block
- use `mj-section` and `mj-column` for layout, never put an `mj-section` inside an `mj-column`
- keep the body width equal to the design width (600 px if the design is wider than 700 px)
- put colors and fonts from the variables into `mj-attributes` and `mj-class`
- use `mj-font` for web fonts and give a safe fallback font
- use only the image paths in the given list
- use `mj-button` for buttons and `mj-divider`, `mj-spacer` for spacing where possible

### Progress steps

`parse`, `figma`, `assets` (with `n/total`), `generate`, `validate` (with the round number), `visual-check`, `write`. The modal shows the current step and a "Cancel" button. Cancel uses an `AbortController` that stops the Figma and AI requests.

## Error handling

| Case                                     | Behavior                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Link not valid or has no `node-id`       | Error in the modal before any request.                                                                     |
| MCP server not running (`ECONNREFUSED`)  | Message: open the Figma desktop app and turn on the MCP server. If a Figma token exists, show "Try REST". |
| MCP limit reached                        | Same message as above with "Try REST".                                                                     |
| Figma 403 or 404                         | Message: the token has no access, or the node does not exist.                                             |
| Figma 429                                | Wait for `Retry-After` (max 60 s), then try one more time.                                                |
| AI key missing or 401                    | Message and an "Open settings" button.                                                                    |
| Model does not accept images             | Continue with text only. Skip the visual self-check. Add a warning.                                       |
| MJML still has errors after 2 rounds     | Save the file. The lint gutter shows the errors. Add a warning.                                           |
| An image download fails                  | Continue. Use a placeholder. Add a warning.                                                                |
| Model reply has no MJML                  | Count it as a failed round. After the last round, show the error.                                          |
| User cancels                             | Stop all requests. Do not write a file. Keep the images that downloaded.                                  |

Messages and logs never contain keys or tokens. Errors that cross IPC carry a `code` field in the result object, because errors lose their `code` on the bridge (see CLAUDE.md).

## Token report

The AI SDK gives `usage` (input and output tokens) for each call. The import adds the numbers of all rounds. The success alert shows them, for example "Done: 12 400 input tokens, 3 100 output tokens, 3 model calls". The app does not show a price, because prices change and free providers have no price.

## Dependencies

All are used by the main process at run time, so they go into `dependencies`:

- `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`
- `@modelcontextprotocol/sdk` (Streamable HTTP client transport)

`vitest` goes into `devDependencies`.

The REST source uses the built-in `fetch`. No new package is needed for it.

## Testing

1. Vitest unit tests (new `yarn test` script, new CI step):
   - `parse-url.js`: link types, `node-id` forms, links that are not valid
   - `trim-node.js`: removes vector geometry, keeps layout, fills, text and styles
   - `extract-mjml.js`: code blocks with and without a language tag, text around the block, no block
   - `generate-mjml.js`: the fix loop with the mock model from `ai/test` (valid on the first round, valid after one fix, still not valid after 2 rounds)
2. Manual tests with one real Figma file:
   - MCP source with a paid model
   - REST source with a free model (Ollama or the Gemini free tier)
   - MCP server off: the "Try REST" message shows
   - wrong API key: the error message and "Open settings" show
   - refine on an imported file, then undo
3. `yarn lint`, `yarn prettier:check` and `yarn dist:dir` pass. The packaged app runs an import.
