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

Unit tests (Vitest) cover the main process code of the Figma import and of the window and menus, and the pure renderer helpers and reducers. A tested renderer module must not import `helpers/api`, because it reads `window`. Tests are next to the code (`*.test.js`) and run in Node.js, so they do not import `electron`. CI (`.github/workflows/ci.yml`) runs `yarn lint`, `yarn prettier:check`, `yarn test` and `yarn dist:dir` on macOS, Linux and Windows. A commit must pass `yarn lint`, `yarn prettier:check` and `yarn test`.

### Release

`.github/workflows/release.yml` runs when a `v*` tag is pushed. On macOS, Windows and Linux it runs the checks, then `electron-vite build` and `electron-builder --publish always`. The files go to a draft GitHub release (`publish` in `electron-builder.yml`: `ahmetkorkmaz3/mjml-app`). The tag must match the version of `package.json`. The secrets are in `README.md`. `electron-builder.yml` sets:

- macOS: arm64 and x64 builds, `hardenedRuntime`, `build/entitlements.mac.plist` and `notarize: true`. Notarization runs only when the app is signed and the `APPLE_*` variables are set, so `yarn dist:dir` (`-c.mac.identity=null`) works without credentials.
- `electronFuses`: no `ELECTRON_RUN_AS_NODE`, no `NODE_OPTIONS`, no `--inspect`, the app loads only from the checked `app.asar`. Do not spawn `process.execPath` as Node.js. Playwright `_electron.launch` cannot attach to a packaged build (it uses `--inspect`), so start the packaged binary with `--remote-debugging-port` and use `chromium.connectOverCDP`.
- `files`: the source maps, type declarations, `.md` files and the test, docs and example folders of `node_modules` are not packaged.

## Architecture

The app has three parts. `electron.vite.config.mjs` builds each one.

- **Main process** (`src/main/`): `index.js` creates the window, builds the menu (`menu.js`), saves the window size and position on quit (`window-settings.js`) and runs `electron-updater` in packaged builds. It logs `uncaughtException` and `unhandledRejection`, and shows a Reload / Quit dialog when the renderer crashes (`render-process-gone`) or stops responding (`unresponsive`, with Wait). `ipc.js` registers the IPC handlers: settings storage, dialogs, shell, clipboard, screenshots and templating (`templating.js`, erb and Handlebars). When the app opens a `.mjml` file (argument or macOS `open-file`), it sends `openPath` to the renderer.
- **Preload** (`src/preload/`): the window uses `contextIsolation: true`, `nodeIntegration: false` and `sandbox: false`. The preload script is the only renderer code with Node.js. It exposes `window.api` with the context bridge: file system helpers (`fs.js`), MJML rendering (`mjml.js`), `path`, and wrappers for the IPC calls. Errors lose their `code` when they cross the bridge, so the helpers return booleans when the renderer needs the reason.
- **Renderer** (`src/renderer/main.jsx` + the folders of `src/`): React code with no Node.js access. The built `index.html` gets a Content-Security-Policy meta tag (`contentSecurityPolicyPlugin` in `electron.vite.config.mjs`, build only, because the dev server uses inline scripts). The email preview iframe inherits it: inline and `https:` styles, `https:`/`data:`/`file:` fonts and images are allowed, scripts only from `'self'`. Update the policy when the renderer needs a new origin. Use `helpers/api` (`window.api`), `helpers/fs` and `import { path } from 'helpers/api'`. Do not import `fs`, `path`, `os` or `electron` in the renderer.

Other points:

- **Imports**: the renderer imports from the `src` root (`import x from 'helpers/mjml'`). The aliases are in `electron.vite.config.mjs` (`rendererRoots`). Main and preload use relative imports.
- **JSX**: files with JSX use the `.jsx` extension.
- **State**: reducers in `src/reducers/` use `redux-actions` and Immutable.js (for example `settings.getIn(['mjml', 'engine'])`). Thunk actions are in `src/actions/`. `src/store/index.js` creates the store with Redux Toolkit. The serializability and immutability checks are off, because the state uses Immutable.js and `UPDATE_SETTINGS` carries a function.
- **Routing**: `src/router/index.jsx` creates a hash router. `pages/Home` is the project list. `pages/Project` (`/project?path=...`) is the editor, the files list and the preview. Thunks navigate with `router.navigate()`.
- **Persistence**: settings, projects and window state are saved with `electron-json-storage` in the main process (key `settings`), not in the project folders.
- **Animations**: modals, alerts and transitions use CSS transitions (`components/Modal/useTransition.js`).
- **Styles**: Sass with `@use` (no `@import`). All colors, sizes and shadows are CSS custom properties in `src/styles/tokens.scss`. Do not use fixed colors in components.
- **Theme**: `settings.appearance.theme` is `system`, `light` or `dark`. `components/Application/useAppTheme.js` sets `data-theme` on `<html>`, puts the resolved theme in `state.theme` (for CodeMirror) and calls `theme:set`, so the main process sets `nativeTheme.themeSource`. The main process reads the stored theme before it creates the window, and the preload gives it to the first frame as `api.initialTheme`.
- **Window**: the title bar is hidden (`hiddenInset` with vibrancy on macOS, `titleBarOverlay` on Windows and Linux). Each page puts its controls in `components/TitleBar`. `src/main/window-bounds.js` keeps the saved bounds on a connected display.
- **Menu and commands**: `src/main/menu.js` builds the menu from the context of the page (`menu:setContext`). "Toggle Developer Tools" is only in the menu when `isPackaged` is false. Each item sends a command name on `redux-command`. The pages register the handlers with `components/PageCommands.jsx` (`helpers/commands.js`). Context menus use `showContextMenu` (`helpers/contextMenu.js`, IPC `menu:popup`).
- **Status bar**: `components/StatusBar` shows `state.editorStatus` (cursor, dirty state, render time) and the MJML errors of `state.preview`.
- **Layout**: `settings.layout` keeps the sidebar width, the collapsed sidebar and preview, and the sort of the project list.

### MJML rendering pipeline

`actions/preview.js` → `helpers/mjml.js` (renderer) → `window.api.mjml.render` (`src/preload/mjml.js`):

- The engine setting `mjml.engine` is `auto` or `manual`. `auto` uses the bundled `mjml` 5 package (async `mjml2html`, `ignoreIncludes: false` so `mj-include` works). `manual` runs a local `mjml` binary at `mjml.path` (see `components/MJMLEngine.jsx`).
- Content that does not start with `<mjml` is wrapped in `<mjml><mj-body>` before it renders. This lets partial files (headers, footers) show a preview.
- Other settings that change the output: `mjml.minify`, `mjml.keepComments`, `mjml.useMjmlConfig` / `mjml.mjmlConfigPath` (`.mjmlconfig`), and `editor.preventAutoSave` (send content through stdin instead of the saved file).
- Rendering of `index.mjml` also updates the project thumbnail on the Home page.

### Editor

`components/FileEditor` uses CodeMirror 6 with `@codemirror/lang-xml` and the MJML schema in `helpers/codemirror/mjml-schema.js` for autocompletion. `helpers/codemirror/theme.js` builds the light and dark editor themes from the tokens. Settings and the app theme change the editor through compartments. Each file keeps its `EditorState` (history included) while the project is open. MJML validation errors show in the lint gutter.

### Templating

Each project can have one templating engine (`html` means none, `handlebars`, or `erb`) and a set of variables in YAML or JSON. The `settings.templating` array keeps these, with one entry for each `projectPath`. `pages/Project/PreviewSettings.jsx` edits them. `helpers/preview-content.js` (`compile`, run in the main process) applies them to the rendered HTML in `components/FilesList/FilePreview.jsx` and before a test email is sent in `pages/Project/SendModal.jsx` (Mailjet Send API v3.1, `node-mailjet`). The email is sent from the main process (`src/main/mailjet.js`, IPC `mailjet:send`), and the Mailjet keys are secrets (`mailjet.apiKey`, `mailjet.apiSecret` in `secrets.js`), not settings.

The HTML export (`helpers/export-html.js`) also copies the local files that the HTML links to (`helpers/local-assets.js`, preload `copyAssets`), and never overwrites a file. The preview iframe has `sandbox="allow-same-origin"` without `allow-scripts`: the email HTML must never run code, it could reach `window.parent.api`.

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
