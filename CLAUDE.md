# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MJML App is the Electron desktop app for MJML (email markup). It is built with electron-vite (Vite 7), Electron 44, React 19, Redux (Redux Toolkit store), react-router 8 and CodeMirror 6.

## Commands

Use Node.js 24 (`.nvmrc`) and Yarn 1 (`yarn.lock` is the lockfile).

```bash
yarn                 # install dependencies
yarn dev             # start Vite and the Electron app with hot reload
yarn build           # compile main, preload and renderer to out/
yarn start           # run the compiled app from out/
yarn lint            # ESLint (flat config in eslint.config.mjs)
yarn prettier        # format the repository in place
yarn prettier:check  # check the formatting
yarn test            # Vitest unit tests (src/**/*.test.js)
yarn dist            # compile, then package with electron-builder (output in release/)
yarn dist:dir        # unpacked, unsigned build (CI uses this)
yarn site            # dev server for the marketing site in site/
./deploy             # build the site and force-push it to the gh-pages branch
```

Unit tests (Vitest) cover the main process code of the Figma import. Tests are next to the code (`*.test.js`) and run in Node.js, so they do not import `electron`. CI (`.github/workflows/ci.yml`) runs `yarn lint`, `yarn prettier:check`, `yarn test` and `yarn dist:dir` on macOS, Linux and Windows. A commit must pass `yarn lint`, `yarn prettier:check` and `yarn test`.

## Architecture

The app has three parts. `electron.vite.config.mjs` builds each one.

- **Main process** (`src/main/`): `index.js` creates the window, builds the menu (`menu.js`), saves the window size and position on quit (`window-settings.js`) and runs `electron-updater` in packaged builds. `ipc.js` registers the IPC handlers: settings storage, dialogs, shell, clipboard, screenshots and templating (`templating.js`, erb and Handlebars). When the app opens a `.mjml` file (argument or macOS `open-file`), it sends `openPath` to the renderer.
- **Preload** (`src/preload/`): the window uses `contextIsolation: true`, `nodeIntegration: false` and `sandbox: false`. The preload script is the only renderer code with Node.js. It exposes `window.api` with the context bridge: file system helpers (`fs.js`), MJML rendering (`mjml.js`), Mailjet sending (`send-email.js`), `path`, and wrappers for the IPC calls. Errors lose their `code` when they cross the bridge, so the helpers return booleans when the renderer needs the reason.
- **Renderer** (`src/renderer/main.jsx` + the folders of `src/`): React code with no Node.js access. Use `helpers/api` (`window.api`), `helpers/fs` and `import { path } from 'helpers/api'`. Do not import `fs`, `path`, `os` or `electron` in the renderer.

Other points:

- **Imports**: the renderer imports from the `src` root (`import x from 'helpers/mjml'`). The aliases are in `electron.vite.config.mjs` (`rendererRoots`). Main and preload use relative imports.
- **JSX**: files with JSX use the `.jsx` extension.
- **State**: reducers in `src/reducers/` use `redux-actions` and Immutable.js (for example `settings.getIn(['mjml', 'engine'])`). Thunk actions are in `src/actions/`. `src/store/index.js` creates the store with Redux Toolkit. The serializability and immutability checks are off, because the state uses Immutable.js and `UPDATE_SETTINGS` carries a function.
- **Routing**: `src/router/index.jsx` creates a hash router. `pages/Home` is the project list. `pages/Project` (`/project?path=...`) is the editor, the files list and the preview. Thunks navigate with `router.navigate()`.
- **Persistence**: settings, projects and window state are saved with `electron-json-storage` in the main process (key `settings`), not in the project folders.
- **Animations**: modals, alerts and transitions use CSS transitions (`components/Modal/useTransition.js`).
- **Styles**: Sass with `@use` (no `@import`).

### MJML rendering pipeline

`actions/preview.js` → `helpers/mjml.js` (renderer) → `window.api.mjml.render` (`src/preload/mjml.js`):

- The engine setting `mjml.engine` is `auto` or `manual`. `auto` uses the bundled `mjml` 5 package (async `mjml2html`, `ignoreIncludes: false` so `mj-include` works). `manual` runs a local `mjml` binary at `mjml.path` (see `components/MJMLEngine.jsx`).
- Content that does not start with `<mjml` is wrapped in `<mjml><mj-body>` before it renders. This lets partial files (headers, footers) show a preview.
- Other settings that change the output: `mjml.minify`, `mjml.keepComments`, `mjml.useMjmlConfig` / `mjml.mjmlConfigPath` (`.mjmlconfig`), and `editor.preventAutoSave` (send content through stdin instead of the saved file).
- Rendering of `index.mjml` also updates the project thumbnail on the Home page.

### Editor

`components/FileEditor` uses CodeMirror 6 with `@codemirror/lang-xml` and the MJML schema in `helpers/codemirror/mjml-schema.js` for autocompletion. Settings change the editor through compartments. Each file keeps its `EditorState` (history included) while the project is open. MJML validation errors show in the lint gutter.

### Templating

Each project can have one templating engine (`html` means none, `handlebars`, or `erb`) and a set of variables in YAML or JSON. The `settings.templating` array keeps these, with one entry for each `projectPath`. `pages/Project/PreviewSettings.jsx` edits them. `helpers/preview-content.js` (`compile`, run in the main process) applies them to the rendered HTML in `components/FilesList/FilePreview.jsx` and before a test email is sent in `pages/Project/SendModal.jsx` (Mailjet Send API v3.1, `node-mailjet`).

### Figma import

The Project page has "Import from Figma" (`pages/Project/FigmaImportModal.jsx`) and "Refine with AI" (`pages/Project/RefineModal.jsx`). All the work runs in the main process (`src/main/figma-import.js`):

- `src/main/figma/`: reads a node from the Figma desktop MCP server (`mcp-source.js`, default `http://127.0.0.1:3845/mcp`) or from the REST API (`rest-source.js`, personal access token). Both return the same `Design` object.
- `src/main/download-assets.js`: downloads the images into `images/` of the project. It never overwrites a file.
- `src/main/ai/`: the Vercel AI SDK sends the design to the selected provider (`providers.js`, list in `src/data/aiProviders.js`). `generate-mjml.js` validates the result with `mjml2html`, sends the errors back for at most 2 fix rounds and runs one visual self-check (screenshot of the result next to the Figma screenshot).
- `src/main/secrets.js`: API keys and the Figma token are encrypted with `safeStorage` in `secrets.json` in the app user data folder, not in `settings`. The renderer can set a secret and ask if it exists, it cannot read it.
- Settings: `settings.ai` (`provider`, `model`, `baseURL`, `visualCheck`) and `settings.figma` (`source`, `mcpURL`), edited in the "AI & Figma" settings tab.
- IPC returns `{ error: { code, message } }` instead of throwing. Progress goes to the renderer on the `figma-import-progress` channel.

### Build-time globals

`electron.vite.config.mjs` defines `__MJML_APP_VERSION__` (from `package.json`) and `__MJML_VERSION__` (from the installed `mjml` package). `mjml-migrate` (MJML 3 → 4 syntax, see `helpers/detectOldMJMLSyntax.js`) has no version 5 and stays on 4.x.

### Dependencies

Packages in `dependencies` are used by the main process or the preload script at run time, and electron-builder ships them. Everything that Vite bundles (renderer code, ESM-only packages like `fix-path`) is in `devDependencies`.
