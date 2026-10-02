# Desktop Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MJML App look and behave like a native desktop application: themed tokens, a native window shell, a reorganized project screen with a status bar, a new home screen and consistent dialogs.

**Architecture:** CSS custom properties on `<html data-theme>` carry all colors. The main process owns the native parts (window, `nativeTheme`, menus, context menus) and talks to the renderer through new IPC calls and the existing `redux-command` channel. A small renderer command registry connects the menu items to the handlers of the page that is open.

**Tech Stack:** Electron 44, electron-vite, React 19, Redux (Immutable.js state), Sass (`@use`), CodeMirror 6, vitest. No new packages (one declared transitive package, see Global Constraints).

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-redesign-design.md`

## Global Constraints

- Node.js 24 and Yarn 1. Do not add or upgrade packages. One exception: Task 17 adds `@lezer/highlight` (`^1.2.5`, already in `node_modules` as a dependency of `@codemirror/language`) to `devDependencies`, like `@lezer/common`.
- Renderer code does not import `fs`, `path`, `os` or `electron`. It uses `helpers/api`, `helpers/fs` and `import { path } from 'helpers/api'`.
- Renderer imports use the `src` root aliases (`import x from 'helpers/theme'`). Main and preload use relative imports.
- Files with JSX use `.jsx`. Styles use Sass `@use`, never `@import`.
- Settings are an Immutable `Map`. A new top-level settings key must be added in `loadSettings` defaults (`src/actions/settings.js`) and in `SETTINGS_LOAD_SUCCESS` (`src/reducers/settings.js`).
- The UI copy stays in English.
- Tests: vitest, files `src/**/*.test.js`, environment `node`. A tested module must not import `helpers/api` (it reads `window`).
- Each commit must pass `yarn lint`, `yarn prettier:check`, `yarn test` and `yarn build`.
- Each commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_019GMcRdgXizENhBQzPHYKAY
  ```
- Token values (copy exactly):

  | Token | Dark | Light |
  |---|---|---|
  | `--bg-window` | `#1e1f24` | `#f5f5f7` |
  | `--bg-sidebar` | `#191a1f` | `#ececef` |
  | `--bg-sidebar` (macOS, vibrancy) | `rgba(25, 26, 31, 0.72)` | `rgba(236, 236, 239, 0.7)` |
  | `--bg-panel` | `#23242a` | `#ffffff` |
  | `--bg-elevated` | `#2b2c33` | `#ffffff` |
  | `--bg-input` | `#17181c` | `#ffffff` |
  | `--bg-hover` | `rgba(255, 255, 255, 0.06)` | `rgba(0, 0, 0, 0.05)` |
  | `--bg-active` | `rgba(255, 255, 255, 0.1)` | `rgba(0, 0, 0, 0.08)` |
  | `--bg-selected` | `rgba(76, 141, 255, 0.18)` | `rgba(52, 112, 223, 0.14)` |
  | `--bg-canvas` | `#15161a` | `#e9e9ed` |
  | `--fg` | `#e6e6ea` | `#1d1d1f` |
  | `--fg-muted` | `#a1a1aa` | `#5f5f66` |
  | `--fg-subtle` | `#6b6b75` | `#8e8e95` |
  | `--fg-on-accent` | `#ffffff` | `#ffffff` |
  | `--border` | `rgba(255, 255, 255, 0.08)` | `rgba(0, 0, 0, 0.1)` |
  | `--border-strong` | `rgba(255, 255, 255, 0.14)` | `rgba(0, 0, 0, 0.18)` |
  | `--separator` | `rgba(0, 0, 0, 0.4)` | `rgba(0, 0, 0, 0.08)` |
  | `--accent` | `#4c8dff` | `#3470df` |
  | `--accent-hover` | `#6aa0ff` | `#2b62c9` |
  | `--focus-ring` | `rgba(76, 141, 255, 0.55)` | `rgba(52, 112, 223, 0.5)` |
  | `--danger` | `#ff6b6b` | `#d93a3a` |
  | `--danger-bg` | `rgba(255, 107, 107, 0.14)` | `rgba(217, 58, 58, 0.1)` |
  | `--warning` | `#f0b44c` | `#b7791f` |
  | `--warning-bg` | `rgba(240, 180, 76, 0.14)` | `rgba(183, 121, 31, 0.1)` |
  | `--success` | `#3ecf8e` | `#1f9d63` |
  | `--success-bg` | `rgba(62, 207, 142, 0.14)` | `rgba(31, 157, 99, 0.1)` |
  | `--shadow-popover` | `0 8px 30px rgba(0, 0, 0, 0.45)` | `0 8px 30px rgba(0, 0, 0, 0.14)` |
  | `--shadow-dialog` | `0 20px 60px rgba(0, 0, 0, 0.55)` | `0 20px 60px rgba(0, 0, 0, 0.2)` |
  | `--overlay` | `rgba(0, 0, 0, 0.45)` | `rgba(0, 0, 0, 0.25)` |

  Theme-independent tokens: `--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 10px`, `--space-1: 4px` … `--space-8: 32px` (steps of 4 px), `--font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`, `--font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace`, `--text-xs: 11px`, `--text-sm: 12px`, `--text-md: 13px`, `--text-lg: 15px`, `--text-xl: 20px`, `--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1)`, `--duration-fast: 120ms`, `--duration-normal: 200ms`, `--titlebar-height: 44px`, `--statusbar-height: 24px`, `--control-height: 28px`.

## Review Focus

1. Saved window bounds on a display that is not connected now: the window must open on a visible display, centered, at the default size. Test: `fitBounds` in Task 4.
2. Theme "System" and the user changes the OS appearance while the app is open: the app, the editor and the native title bar must follow without a restart. Test: `resolveTheme` in Task 1, plus the live check in Task 18.
3. A menu shortcut in a context where it does not apply (Cmd+E on the home screen, Cmd+S with auto-save on, Cmd+Shift+B on an image): the item is disabled and nothing runs. Test: `buildMenuTemplate` in Task 6.
4. Cmd+W: on the project screen it closes the project, on the home screen it closes the window like a normal app. Test: `buildMenuTemplate` in Task 6.
5. Long project names, long file names and a 960 px wide window: the title bar and the cards truncate with an ellipsis and no control overflows. Check: the 960×600 screenshots in Tasks 10, 13 and 18 (layout, no unit test).

---

## File map

New files:

| File | Responsibility |
|---|---|
| `src/helpers/theme.js` (+ test) | `resolveTheme(setting, systemIsDark)` |
| `src/main/theme.js` (+ test) | `windowColors(isDark)`, `normalizeThemeSetting(value)` |
| `src/styles/tokens.scss` | the CSS custom properties |
| `src/reducers/theme.js` | the resolved theme (`'light'` or `'dark'`) for components that need it in JS |
| `src/components/Application/useAppTheme.js` | applies the theme to `<html>` and to the main process |
| `src/components/SegmentedControl/index.jsx`, `style.scss` | a segmented control |
| `src/main/window-bounds.js` (+ test) | `fitBounds(saved, displays, defaults)` |
| `src/components/TitleBar/index.jsx`, `style.scss` | the window title bar |
| `src/main/menu.js` (rewrite, + test) | `buildMenuTemplate(options)` |
| `src/main/popup-menu.js` (+ test) | `toPopupTemplate(items, onChoose)` |
| `src/helpers/commands.js` (+ test) | the renderer command registry |
| `src/helpers/shortcut.js` (+ test) | `formatShortcut(accelerator, platform)` |
| `src/helpers/useMenuContext.js` | sends the page context to the main process |
| `src/reducers/editorStatus.js` (+ test) | cursor, dirty and render state |
| `src/components/StatusBar/index.jsx`, `style.scss` | the status bar |
| `src/helpers/files.js` (+ test) | `fileKind(name, isFolder)`, `duplicateName(name, existingNames)` |
| `src/helpers/projects.js` (+ test) | `formatRelativeTime`, `displayPath`, `sortProjects`, `nextSelection` |
| `src/pages/Home/EmptyState.jsx` | the empty home screen |
| `src/components/SettingsModal/SettingRow.jsx` | a label, help text and control row |

---

## Phase 1: Foundation

### Task 1: Theme setting, resolution and native theme

**Files:**
- Create: `src/helpers/theme.js`, `src/helpers/theme.test.js`, `src/main/theme.js`, `src/main/theme.test.js`, `src/reducers/theme.js`, `src/components/Application/useAppTheme.js`
- Modify: `src/actions/settings.js` (defaults), `src/reducers/settings.js` (`SETTINGS_LOAD_SUCCESS`), `src/reducers/index.js`, `src/main/ipc.js`, `src/main/index.js`, `src/preload/index.js`, `src/renderer/main.jsx`, `src/components/Application/index.jsx`

**Interfaces:**
- Produces: `resolveTheme(setting: 'system'|'light'|'dark', systemIsDark: boolean): 'light'|'dark'`; settings keys `appearance.theme` and `layout` (`{ sidebarWidth: 220, sidebarCollapsed: false, previewCollapsed: false, projectSort: 'recent' }`); `api.theme.set(setting)`; `api.initialTheme` (`'light'|'dark'`); redux `state.theme` (`'light'|'dark'`) and action `setResolvedTheme(theme)`; main `windowColors(isDark) → { background, symbol }`; main `normalizeThemeSetting(value) → 'system'|'light'|'dark'`.

- [ ] **Step 1: Write the failing tests**

`src/helpers/theme.test.js`:

```js
import { describe, expect, it } from 'vitest'

import { resolveTheme } from './theme'

describe('resolveTheme', () => {
  it('keeps an explicit theme', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('follows the system for "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('follows the system for an unknown value', () => {
    expect(resolveTheme(undefined, true)).toBe('dark')
    expect(resolveTheme('blue', false)).toBe('light')
  })
})
```

`src/main/theme.test.js`:

```js
import { describe, expect, it } from 'vitest'

import { normalizeThemeSetting, windowColors } from './theme'

describe('normalizeThemeSetting', () => {
  it('keeps the known values', () => {
    expect(normalizeThemeSetting('light')).toBe('light')
    expect(normalizeThemeSetting('dark')).toBe('dark')
    expect(normalizeThemeSetting('system')).toBe('system')
  })

  it('gives "system" for other values', () => {
    expect(normalizeThemeSetting(undefined)).toBe('system')
    expect(normalizeThemeSetting(42)).toBe('system')
  })
})

describe('windowColors', () => {
  it('gives the window colors of each theme', () => {
    expect(windowColors(true)).toEqual({ background: '#1e1f24', symbol: '#e6e6ea' })
    expect(windowColors(false)).toEqual({ background: '#f5f5f7', symbol: '#1d1d1f' })
  })
})
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `yarn test src/helpers/theme.test.js src/main/theme.test.js`
Expected: FAIL, the modules do not exist.

- [ ] **Step 3: Write the helpers**

`src/helpers/theme.js`:

```js
// The theme setting is 'system', 'light' or 'dark'. 'system' (and any
// unknown value) follows the appearance of the operating system.
export function resolveTheme(setting, systemIsDark) {
  if (setting === 'light' || setting === 'dark') {
    return setting
  }
  return systemIsDark ? 'dark' : 'light'
}
```

`src/main/theme.js`:

```js
const THEME_SETTINGS = ['system', 'light', 'dark']

export function normalizeThemeSetting(value) {
  return THEME_SETTINGS.includes(value) ? value : 'system'
}

// the colors of the window background and of the Windows/Linux window buttons,
// the same values as --bg-window and --fg in src/styles/tokens.scss
export function windowColors(isDark) {
  return isDark
    ? { background: '#1e1f24', symbol: '#e6e6ea' }
    : { background: '#f5f5f7', symbol: '#1d1d1f' }
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `yarn test src/helpers/theme.test.js src/main/theme.test.js`
Expected: PASS.

- [ ] **Step 5: Add the settings keys**

In `src/actions/settings.js` `loadSettings`, add to the `defaultsDeep` object:

```js
      appearance: {
        theme: 'system',
      },
      layout: {
        sidebarWidth: 220,
        sidebarCollapsed: false,
        previewCollapsed: false,
        projectSort: 'recent',
      },
```

In the `editor` defaults, remove `lightTheme: false` and add `fontSize: 13`.

In `src/reducers/settings.js` `SETTINGS_LOAD_SUCCESS`, add:

```js
        appearance: Map(payload.appearance),
        layout: Map(payload.layout),
```

- [ ] **Step 6: Add the theme reducer**

`src/reducers/theme.js`:

```js
import { createAction, handleActions } from 'redux-actions'

// the resolved theme ('light' or 'dark'), for the code that needs it in JS
// (CodeMirror). The CSS uses the data-theme attribute of <html>.
export default handleActions(
  {
    THEME_RESOLVED: (state, { payload }) => payload,
  },
  window.api.initialTheme,
)

export const setResolvedTheme = createAction('THEME_RESOLVED')
```

Register it in `src/reducers/index.js` as `theme`.

- [ ] **Step 7: Main process: native theme and the `theme:set` call**

In `src/main/ipc.js`, import `nativeTheme` from `electron` and `{ normalizeThemeSetting, windowColors }` from `./theme`. Change `registerIpcHandlers()` to `registerIpcHandlers({ onThemeChange })` and add:

```js
  ipcMain.handle('theme:set', (e, setting) => {
    nativeTheme.themeSource = normalizeThemeSetting(setting)
    onThemeChange(nativeTheme.themeSource)
  })
```

In `src/main/index.js`:

1. Import `nativeTheme` and `{ normalizeThemeSetting, windowColors }`.
2. Add a function that reads the stored setting before the window exists:

```js
async function applyStoredTheme() {
  const settings = await getStoredSettings()
  nativeTheme.themeSource = normalizeThemeSetting(settings?.appearance?.theme)
}
```

   Add `getStoredSettings()` to `window-settings.js` (it returns `storageGet('settings')` or `{}` on error) and export it.
3. In `createMainWindow`, compute `const isDark = nativeTheme.shouldUseDarkColors` and `const colors = windowColors(isDark)`. Set `backgroundColor: colors.background` and add `additionalArguments: [`--mjml-theme=${isDark ? 'dark' : 'light'}`]` to `webPreferences`.
4. Call `registerIpcHandlers({ onThemeChange: () => updateWindowTheme() })`, where `updateWindowTheme` sets `mainWindow.setBackgroundColor(...)` (not on macOS, see Task 4) and, on Windows and Linux, `mainWindow.setTitleBarOverlay({ color: colors.background, symbolColor: colors.symbol })` inside a `try` (the call throws when the window has no overlay). Task 4 adds the overlay. Task 6 also rebuilds the menu here.
5. In `app.whenReady()`, `await applyStoredTheme()` before `createMainWindow()`.
6. Listen to `nativeTheme.on('updated', updateWindowTheme)`.

- [ ] **Step 8: Preload**

In `src/preload/index.js`, add to `api`:

```js
  // the theme of the first frame, the main process gives it as an argument
  initialTheme: process.argv.includes('--mjml-theme=light') ? 'light' : 'dark',

  theme: {
    set: setting => ipcRenderer.invoke('theme:set', setting),
  },
```

- [ ] **Step 9: Renderer: apply the theme**

`src/components/Application/useAppTheme.js`:

```js
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import api from 'helpers/api'
import { resolveTheme } from 'helpers/theme'
import { setResolvedTheme } from 'reducers/theme'

const query = window.matchMedia('(prefers-color-scheme: dark)')

// Applies the theme setting: the data-theme attribute of <html> (CSS),
// the redux state (CodeMirror) and nativeTheme in the main process
// (menus, dialogs, scroll bars, window buttons).
export default function useAppTheme() {
  const dispatch = useDispatch()
  const setting = useSelector(state =>
    state.settings ? state.settings.getIn(['appearance', 'theme'], 'system') : null,
  )

  useEffect(() => {
    if (!setting) {
      return
    }
    api.theme.set(setting).catch(err => console.error(err))

    const apply = () => {
      const theme = resolveTheme(setting, query.matches)
      document.documentElement.dataset.theme = theme
      dispatch(setResolvedTheme(theme))
    }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [setting, dispatch])
}
```

Call `useAppTheme()` at the start of `Application` in `src/components/Application/index.jsx`.

In `src/renderer/main.jsx`, before `createRoot(...)`, add:

```js
// the first frame uses the theme that the main process resolved
document.documentElement.dataset.theme = api.initialTheme
document.documentElement.dataset.platform = api.platform
```

- [ ] **Step 10: Run the checks**

Run: `yarn lint && yarn prettier:check && yarn test && yarn build`
Expected: all pass. (`editor.lightTheme` is still read in `FileEditor` and `PreviewSettings` with a default, so the build works. Task 17 removes these reads.)

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Add the theme setting and apply it to the window and the renderer"
```

### Task 2: Tokens and base styles

**Files:**
- Create: `src/styles/tokens.scss`
- Modify: `src/styles/global.scss`, `src/styles/utils.scss`, `src/styles/animations.scss`, `src/components/Application/style.scss`, `src/components/Application/Placeholder.jsx`, `src/components/Application/index.jsx`

**Interfaces:**
- Consumes: `data-theme` and `data-platform` on `<html>` (Task 1).
- Produces: all tokens of the Global Constraints table; the global `[data-tooltip]` style.

- [ ] **Step 1: Write `src/styles/tokens.scss`**

Write the `:root` block with the theme-independent tokens, a `:root[data-theme='dark']` block and a `:root[data-theme='light']` block with the exact values of the token table, plus `color-scheme: dark` / `color-scheme: light` in each block (native form controls and scroll bars). Then:

```scss
:root[data-platform='darwin'][data-theme='dark'] {
  --bg-sidebar: rgba(25, 26, 31, 0.72);
}

:root[data-platform='darwin'][data-theme='light'] {
  --bg-sidebar: rgba(236, 236, 239, 0.7);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-normal: 0ms;
  }
}
```

- [ ] **Step 2: Rewrite `src/styles/global.scss`**

Keep the reset block. Change these parts:

```scss
@use 'tokens.scss';
@use 'animations.scss';
@use 'select.scss';

// (keep the reset, but remove `outline` handling from it)

:focus {
  outline: none;
}

:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}

html,
body {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: var(--font-ui);
  font-size: var(--text-md);
  line-height: 1.4;
  color: var(--fg);
  // macOS: transparent, so the vibrancy shows through the sidebars
  background: var(--bg-window);
  -webkit-font-smoothing: antialiased;
  cursor: default;
}

:root[data-platform='darwin'] body {
  background: transparent;
}

input,
textarea,
[contenteditable],
.cm-content,
.us-t {
  user-select: text;
  -webkit-user-select: text;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border: 3px solid transparent;
  border-radius: 10px;
  background-clip: content-box;
}

::-webkit-scrollbar-corner {
  background: transparent;
}

h2 {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--fg);
}

input[type='text'],
input[type='number'],
input[type='email'],
input[type='password'],
input[type='search'],
select,
textarea {
  height: var(--control-height);
  padding: 0 var(--space-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background-color: var(--bg-input);
  color: var(--fg);
  font-size: var(--text-md);

  &:focus-visible,
  &:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--focus-ring);
  }

  &:disabled {
    opacity: 0.5;
  }
}

textarea {
  width: 100%;
  height: 150px;
  padding: var(--space-2);
  resize: none;
}

::placeholder {
  color: var(--fg-subtle);
}

// tooltips: <button data-tooltip="Export HTML (⌘E)">
[data-tooltip] {
  position: relative;
}

[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 100000;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-popover);
  color: var(--fg);
  font-size: var(--text-xs);
  font-weight: normal;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  animation: tooltipIn var(--duration-fast) var(--ease-out) 500ms forwards;
}

@keyframes tooltipIn {
  to {
    opacity: 1;
  }
}
```

Change the other existing rules to tokens: `.round-label` (`--warning-bg` background, `--warning` color, `--radius-sm`), `.a.white` (hover `--fg`), `.split-pane-divider` (hover `--bg-hover`, active `--bg-active`, a 1 px `--separator` line in the middle with a `::after`), `.focus` (dashed `--border-strong` on `:focus-visible`), `.brand` (`--bg-hover`), `.settings-group` (`--border`, `--radius-md`), `.red-star` (`--danger`).

- [ ] **Step 3: Map the utility colors to tokens**

In `src/styles/utils.scss`: `.c-blue` → `var(--accent)`, `.c-yellow` → `var(--warning)`, `.c-red` → `var(--danger)`, both `.c-white` → `var(--fg)` (keep one rule), `.c-green` → `var(--success)`, `.bg-dark` → `var(--bg-window)`, `.bg-darker` → `var(--bg-panel)`, `.small` and `.t-small` → `var(--text-sm)`, `.ff-m` → `var(--font-mono)`. Restyle `.tooltip` with `--bg-elevated`, `--border`, `--radius-md`, `--shadow-popover`, `--fg` and remove the arrow. Remove `@use 'vars.scss'` if nothing in the file uses it.

- [ ] **Step 4: Animations and the application shell**

In `animations.scss`, use `var(--duration-normal)` for `.anim-enter-fade`, and change `.anim-enter-fade-left` to a 8 px move. In `Application/style.scss`, remove the `background-color` transition, use `var(--bg-window)` for `.DropFile`, `.AppPlaceholder` and the drop border (`2px dashed var(--accent)` inset 16 px, `--radius-lg`, background `--bg-selected`). In `Application/index.jsx`, remove the `bg-dark` and `bg-darker` class names (the pages set their own backgrounds). In `Placeholder.jsx`, remove `bg-dark`.

- [ ] **Step 5: Run the checks and look at the result**

Run: `yarn lint && yarn prettier:check && yarn build`
Start the app with the screenshot script (see "Visual check" at the end of this plan) and take `home-dark.png`. Expected: the system font, no blue outline on mouse focus, dark colors from the tokens.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add the design tokens and move the base styles to them"
```

### Task 3: Buttons, form controls and the segmented control

**Files:**
- Modify: `src/components/Button/index.jsx`, `src/components/Button/style.scss`, `src/components/Button/ButtonDropdown.jsx`, `src/components/CheckBox/index.jsx`, `src/components/CheckBox/style.scss`, `src/components/RadioGroup/Radio.jsx`, `src/styles/select.scss`
- Create: `src/components/SegmentedControl/index.jsx`, `src/components/SegmentedControl/style.scss`

**Interfaces:**
- Produces: `<Button variant="primary|secondary|ghost|danger" size="sm|md|lg" icon>` (old booleans still work); `<SegmentedControl value options={[{ value, label, icon?, tooltip? }]} onChange disabled />`.

- [ ] **Step 1: Button variants**

Replace `src/components/Button/index.jsx` with:

```jsx
import { Link } from 'react-router'
import cx from 'classnames'

import './style.scss'

// the old boolean props map to the variants, so each file can move at its own speed
function getVariant({ variant, primary, warn, ghost, transparent }) {
  if (variant) return variant
  if (primary) return 'primary'
  if (warn) return 'danger'
  if (ghost || transparent) return 'ghost'
  return 'secondary'
}

// `ref` is a regular prop since React 19
export default function Button({
  link,
  variant,
  size,
  icon,
  primary,
  ghost,
  warn,
  transparent,
  unclickable,
  className,
  children,
  disabled,
  small,
  ref,
  ...props
}) {
  const cn = cx(
    'Button',
    `Button--${getVariant({ variant, primary, warn, ghost, transparent })}`,
    `Button--${size || (small ? 'sm' : 'md')}`,
    className,
    { 'Button--icon': icon, unclickable },
  )

  const p = {
    className: cn,
    disabled,
    tabIndex: unclickable ? undefined : 0,
    type: link || unclickable ? undefined : 'button',
    ...props,
    ref,
  }

  if (link) {
    return <Link {...p}>{children}</Link>
  }
  if (unclickable) {
    return <div {...p}>{children}</div>
  }
  return <button {...p}>{children}</button>
}
```

Note: `type: 'button'` stops a button in a `<form>` from submitting the form. Search for buttons that must submit: `grep -rn "type=\"submit\"\|onSubmit" src --include='*.jsx'`. A `Button` that submits a form must get `type="submit"` explicitly. Add it where a form relies on a `Button` click to submit.

- [ ] **Step 2: Button styles**

Rewrite `src/components/Button/style.scss` (keep the `.ButtonDropdown--*` rules, restyled in Step 3, and remove `.BackButton--label`):

```scss
.Button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-shrink: 0;
  white-space: nowrap;
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--fg);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);

  &:disabled {
    opacity: 0.4;
  }

  &.unclickable {
    pointer-events: none;
  }
}

.Button--sm {
  height: 24px;
  padding: 0 var(--space-2);
  font-size: var(--text-sm);
}

.Button--md {
  height: var(--control-height);
  padding: 0 var(--space-3);
}

.Button--lg {
  height: 32px;
  padding: 0 var(--space-4);
}

.Button--icon {
  padding: 0;
  &.Button--sm {
    width: 24px;
  }
  &.Button--md {
    width: var(--control-height);
  }
  &.Button--lg {
    width: 32px;
  }
}

.Button--primary {
  background: var(--accent);
  color: var(--fg-on-accent);
  &:hover:not(:disabled) {
    background: var(--accent-hover);
  }
}

.Button--secondary {
  background: var(--bg-elevated);
  border-color: var(--border-strong);
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.06);
  &:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  &:active:not(:disabled) {
    background: var(--bg-active);
  }
}

.Button--ghost {
  background: transparent;
  color: var(--fg-muted);
  &:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--fg);
  }
  &:active:not(:disabled),
  &.isActive {
    background: var(--bg-active);
    color: var(--fg);
  }
}

.Button--danger {
  background: var(--danger);
  color: var(--fg-on-accent);
  &:hover:not(:disabled) {
    filter: brightness(1.08);
  }
}
```

- [ ] **Step 3: Dropdown, check box, radio, select**

- `ButtonDropdown--dropdown`: `--bg-elevated`, `1px solid var(--border)`, `--radius-lg`, `--shadow-popover`, `padding: var(--space-1)`, `margin-top: 4px`. Items: `--radius-md`, `padding: 6px var(--space-2)`, hover `--bg-hover`, `.isActive` `--bg-selected` with `--fg`, no top border between items. Description `--fg-subtle`, `--text-xs`. In `ButtonDropdown.jsx`, replace `c-white` on the title with nothing (it inherits `--fg`).
- `CheckBox`: replace the Material icons with a 14 px box: `<span className={cx('Checkbox--box', { isChecked: value })}>{value && <MdCheck size={12} />}</span>`. Style: `1px solid var(--border-strong)`, `--radius-sm`, `--bg-input`; checked: `--accent` background and border, `--fg-on-accent` icon. Add `role="checkbox"` and `aria-checked={value}` to the root.
- `Radio`: the same idea with a round 14 px box and a 6 px dot. Add `role="radio"` and `aria-checked={isActive}`.
- `select.scss`: rename nothing (the class is `SelectDark` in the JSX, keep it). Replace every color with tokens: control `--bg-input`, `1px solid var(--border-strong)`, `--radius-md`, `min-height: var(--control-height)`, focused `--accent` border and `0 0 0 3px var(--focus-ring)`; placeholder `--fg-subtle`; multi value `--bg-hover`, `--radius-sm`; menu `--bg-elevated`, `--border`, `--radius-lg`, `--shadow-popover`, `padding: var(--space-1)`; option `--radius-md`, focused `--bg-selected`. Remove `@use './vars' as *`.

- [ ] **Step 4: Segmented control**

`src/components/SegmentedControl/index.jsx`:

```jsx
import cx from 'classnames'

import './style.scss'

export default function SegmentedControl({ value, options, onChange, disabled, className }) {
  return (
    <div className={cx('SegmentedControl', className, { isDisabled: disabled })} role="radiogroup">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={disabled}
          data-tooltip={o.tooltip}
          className={cx('SegmentedControl--item', { isActive: o.value === value })}
          onClick={() => o.value !== value && onChange(o.value)}
        >
          {o.icon}
          {o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  )
}
```

`style.scss`:

```scss
.SegmentedControl {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  border-radius: var(--radius-md);
  background: var(--bg-hover);
  -webkit-app-region: no-drag;

  &.isDisabled {
    opacity: 0.4;
  }
}

.SegmentedControl--item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--fg-muted);
  font-size: var(--text-sm);
  font-weight: 500;

  &:hover:not(:disabled):not(.isActive) {
    color: var(--fg);
  }

  &.isActive {
    background: var(--bg-elevated);
    color: var(--fg);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  }
}
```

- [ ] **Step 5: Run the checks and look at the result**

Run: `yarn lint && yarn prettier:check && yarn build`. Take `home-dark.png` and `project-dark.png`. Expected: 28 px buttons with rounded corners, the primary button in the accent color.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Restyle the buttons and the form controls and add a segmented control"
```

## Phase 2: Window shell

### Task 4: Window options and bounds

**Files:**
- Create: `src/main/window-bounds.js`, `src/main/window-bounds.test.js`
- Modify: `src/main/index.js`, `src/main/window-settings.js`, `src/preload/index.js` (event channel)

**Interfaces:**
- Produces: `fitBounds(saved, displays, defaults) → { x?, y?, width, height }` where `displays` is `[{ workArea: { x, y, width, height } }]` and `defaults` is `{ width: 1280, height: 800 }`; the `window-fullscreen` event channel (payload `boolean`).

- [ ] **Step 1: Write the failing test**

`src/main/window-bounds.test.js`:

```js
import { describe, expect, it } from 'vitest'

import { fitBounds } from './window-bounds'

const displays = [{ workArea: { x: 0, y: 25, width: 1440, height: 875 } }]
const defaults = { width: 1280, height: 800 }

describe('fitBounds', () => {
  it('keeps saved bounds that are on a display', () => {
    const saved = { x: 100, y: 100, width: 1000, height: 700 }
    expect(fitBounds(saved, displays, defaults)).toEqual(saved)
  })

  it('gives the default size without a position when nothing is saved', () => {
    expect(fitBounds(undefined, displays, defaults)).toEqual(defaults)
    expect(fitBounds({}, displays, defaults)).toEqual(defaults)
  })

  it('gives the default size when the saved window is on a missing display', () => {
    const saved = { x: 3000, y: 200, width: 1000, height: 700 }
    expect(fitBounds(saved, displays, defaults)).toEqual(defaults)
  })

  it('keeps a window that is partly on a display, when its top bar is visible', () => {
    const saved = { x: 1200, y: 100, width: 1000, height: 700 }
    expect(fitBounds(saved, displays, defaults)).toEqual(saved)
  })

  it('makes a saved window smaller than the work area fit', () => {
    const saved = { x: 0, y: 25, width: 3000, height: 2000 }
    expect(fitBounds(saved, displays, defaults)).toEqual({ x: 0, y: 25, width: 1440, height: 875 })
  })
})
```

- [ ] **Step 2: Run it and make sure it fails**

Run: `yarn test src/main/window-bounds.test.js`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Write `fitBounds`**

```js
const MIN_VISIBLE = 100

function isNumber(n) {
  return typeof n === 'number' && Number.isFinite(n)
}

// the top bar of the window (where the user can drag it) must be on a display
function topBarIsVisible(b, { workArea: a }) {
  const visibleWidth = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x)
  return visibleWidth >= MIN_VISIBLE && b.y >= a.y && b.y < a.y + a.height - MIN_VISIBLE / 2
}

// Gives the window bounds to use at start. Saved bounds outside all the
// displays (a disconnected monitor) give the default size, centered by Electron.
export function fitBounds(saved, displays, defaults) {
  if (!saved || ![saved.x, saved.y, saved.width, saved.height].every(isNumber)) {
    return { ...defaults }
  }
  const display = displays.find(d => topBarIsVisible(saved, d))
  if (!display) {
    return { ...defaults }
  }
  const { workArea: a } = display
  return {
    x: saved.x,
    y: saved.y,
    width: Math.min(saved.width, a.width),
    height: Math.min(saved.height, a.height),
  }
}
```

- [ ] **Step 4: Run it and make sure it passes**

Run: `yarn test src/main/window-bounds.test.js`
Expected: PASS.

- [ ] **Step 5: Use it in the window**

`window-settings.js`: save `{ ...window.getNormalBounds(), isMaximized: window.isMaximized() }` (use `getNormalBounds`, not `getContentBounds`, because the window now has no system title bar). `getWindowSettings` returns the raw saved object.

`src/main/index.js` `createMainWindow`:

```js
  const saved = await getWindowSettings()
  const bounds = fitBounds(saved, screen.getAllDisplays(), { width: 1280, height: 800 })
  const isMac = process.platform === 'darwin'
  const colors = windowColors(nativeTheme.shouldUseDarkColors)

  const w = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: isMac ? '#00000000' : colors.background,
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset',
          trafficLightPosition: { x: 16, y: 14 },
          vibrancy: 'sidebar',
          visualEffectState: 'followWindow',
        }
      : {
          titleBarStyle: 'hidden',
          titleBarOverlay: { height: 44, color: colors.background, symbolColor: colors.symbol },
        }),
    webPreferences: { /* keep the existing values, plus additionalArguments from Task 1 */ },
  })

  if (saved && saved.isMaximized) {
    w.maximize()
  }

  const sendFullScreen = isFullScreen => w.webContents.send('window-fullscreen', isFullScreen)
  w.on('enter-full-screen', () => sendFullScreen(true))
  w.on('leave-full-screen', () => sendFullScreen(false))
```

Import `screen` from `electron`. In `updateWindowTheme` (Task 1), skip `setBackgroundColor` on macOS (the window stays transparent for the vibrancy).

In `src/preload/index.js`, add `'window-fullscreen'` to `EVENT_CHANNELS`.

- [ ] **Step 6: Run the checks and look at the window**

Run: `yarn lint && yarn prettier:check && yarn test && yarn build`, then `yarn start`. Expected: a 1280×800 window, the traffic lights over the content on macOS, the window does not get smaller than 960×600. The content is under the traffic lights until Task 5. That is expected.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Use a hidden title bar, a minimum size and saved bounds that fit a display"
```

### Task 5: Title bar component

**Files:**
- Create: `src/components/TitleBar/index.jsx`, `src/components/TitleBar/style.scss`
- Modify: `src/pages/Home/index.jsx`, `src/pages/Project/index.jsx` (temporary: wrap the existing top rows)

**Interfaces:**
- Consumes: `window-fullscreen` (Task 4).
- Produces: `<TitleBar left center right className />`. The children of `left`, `center` and `right` are clickable (no drag). The empty parts drag the window.

- [ ] **Step 1: Write the component**

```jsx
import { useEffect, useState } from 'react'
import cx from 'classnames'

import api from 'helpers/api'

import './style.scss'

function useFullScreen() {
  const [isFullScreen, setIsFullScreen] = useState(false)
  useEffect(() => api.on('window-fullscreen', setIsFullScreen), [])
  return isFullScreen
}

// The top bar of each page. The empty parts drag the window (and a double
// click zooms it, the system does this). macOS: room on the left for the
// traffic lights. Windows/Linux: room on the right for the window buttons.
export default function TitleBar({ left, center, right, className }) {
  const isFullScreen = useFullScreen()
  return (
    <div className={cx('TitleBar', `TitleBar--${api.platform}`, className, { isFullScreen })}>
      <div className="TitleBar--left">{left}</div>
      <div className="TitleBar--center">{center}</div>
      <div className="TitleBar--right">{right}</div>
    </div>
  )
}
```

- [ ] **Step 2: Write the styles**

```scss
.TitleBar {
  flex-shrink: 0;
  height: var(--titlebar-height);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-3);
  border-bottom: 1px solid var(--separator);
  background: var(--bg-window);
  -webkit-app-region: drag;
  position: relative;
  z-index: 10;

  button,
  a,
  input,
  select,
  [role='button'],
  .SegmentedControl,
  .GlobalSearch {
    -webkit-app-region: no-drag;
  }
}

.TitleBar--darwin:not(.isFullScreen) {
  padding-left: 84px;
}

.TitleBar--win32,
.TitleBar--linux {
  padding-right: 148px;
}

.TitleBar--left,
.TitleBar--right {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
}

.TitleBar--left {
  flex: 1 1 0;
}

.TitleBar--center {
  display: flex;
  justify-content: center;
  flex: 0 1 auto;
  min-width: 0;
}

.TitleBar--right {
  flex: 1 1 0;
  justify-content: flex-end;
}
```

- [ ] **Step 3: Use it on both pages (temporary layout)**

In `pages/Home/index.jsx`, put the existing top row inside `<TitleBar left={<GlobalSearch />} right={<buttons>} />`. In `pages/Project/index.jsx`, put the existing top row in `<TitleBar left={...} right={...} />`. Tasks 10 and 13 replace this content. Remove the `p-10` padding of the old rows.

- [ ] **Step 4: Run the checks and look at the result**

Run: `yarn lint && yarn prettier:check && yarn build`. Take `home-dark.png` and `project-dark.png` at 1280×800. On macOS run `yarn start` and drag the window by the empty part of the bar, double click it, and go to full screen. Expected: the window moves and zooms, the buttons still click, the left room goes away in full screen.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add the title bar and use it on the home and project pages"
```

### Task 6: Command registry and the application menu

**Files:**
- Create: `src/helpers/commands.js`, `src/helpers/commands.test.js`, `src/helpers/shortcut.js`, `src/helpers/shortcut.test.js`, `src/helpers/useMenuContext.js`, `src/main/menu.test.js`
- Modify: `src/main/menu.js` (rewrite), `src/main/index.js`, `src/main/ipc.js`, `src/preload/index.js`, `src/renderer/main.jsx`, `src/pages/Home/index.jsx`, `src/pages/Project/index.jsx`

**Interfaces:**
- Produces:
  - `registerCommand(name, handler) → unregister`, `runCommand(name) → boolean`, `useCommands(map)` (a hook that registers each `name → handler` of `map` while the component is mounted).
  - `formatShortcut(accelerator, platform) → string` (`'CmdOrCtrl+Shift+E'`, `'darwin'` → `'⇧⌘E'`; `'win32'` → `'Ctrl+Shift+E'`).
  - `api.menu.setContext(context)`, with `context = { page: 'home'|'project', hasMjmlFile: boolean, hasPreview: boolean, preventAutoSave: boolean }`.
  - `buildMenuTemplate({ platform, context, theme, send, actions }) → MenuItemConstructorOptions[]`. Each custom item has an `id` equal to the command name it sends. `actions` is `{ openExternal(url), reload(), toggleDevTools(), toggleFullScreen() }`.
  - The command names (renderer handlers must use these exact strings): `about`, `settings`, `new-project`, `open-project`, `new-file`, `import-figma`, `save`, `export-html`, `copy-html`, `screenshots`, `send`, `close-project`, `find`, `beautify`, `refine`, `toggle-sidebar`, `toggle-preview`, `preview-desktop`, `preview-mobile`, `templating`, `theme-system`, `theme-light`, `theme-dark`.

- [ ] **Step 1: Write the failing tests**

`src/helpers/commands.test.js`:

```js
import { describe, expect, it, vi } from 'vitest'

import { registerCommand, runCommand } from './commands'

describe('commands', () => {
  it('runs the registered handler', () => {
    const handler = vi.fn()
    const unregister = registerCommand('test-a', handler)
    expect(runCommand('test-a')).toBe(true)
    expect(handler).toHaveBeenCalledOnce()
    unregister()
  })

  it('returns false for a command without a handler', () => {
    expect(runCommand('test-missing')).toBe(false)
  })

  it('uses the last registered handler, and unregister keeps a newer one', () => {
    const first = vi.fn()
    const second = vi.fn()
    const unregisterFirst = registerCommand('test-b', first)
    const unregisterSecond = registerCommand('test-b', second)
    unregisterFirst()
    runCommand('test-b')
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
    unregisterSecond()
    expect(runCommand('test-b')).toBe(false)
  })
})
```

`src/helpers/shortcut.test.js`:

```js
import { describe, expect, it } from 'vitest'

import { formatShortcut } from './shortcut'

describe('formatShortcut', () => {
  it('uses the macOS symbols in the macOS order', () => {
    expect(formatShortcut('CmdOrCtrl+Shift+E', 'darwin')).toBe('⇧⌘E')
    expect(formatShortcut('CmdOrCtrl+Alt+P', 'darwin')).toBe('⌥⌘P')
    expect(formatShortcut('CmdOrCtrl+,', 'darwin')).toBe('⌘,')
  })

  it('uses words on Windows and Linux', () => {
    expect(formatShortcut('CmdOrCtrl+Shift+E', 'win32')).toBe('Ctrl+Shift+E')
    expect(formatShortcut('CmdOrCtrl+0', 'linux')).toBe('Ctrl+0')
  })

  it('gives an empty string without an accelerator', () => {
    expect(formatShortcut(undefined, 'darwin')).toBe('')
  })
})
```

`src/main/menu.test.js`:

```js
import { describe, expect, it, vi } from 'vitest'

import { buildMenuTemplate } from './menu'

const actions = {
  openExternal: vi.fn(),
  reload: vi.fn(),
  toggleDevTools: vi.fn(),
  toggleFullScreen: vi.fn(),
}

const home = { page: 'home', hasMjmlFile: false, hasPreview: false, preventAutoSave: false }
const project = { page: 'project', hasMjmlFile: true, hasPreview: true, preventAutoSave: false }

function findItem(template, id) {
  for (const item of template) {
    if (item.id === id) return item
    if (Array.isArray(item.submenu)) {
      const found = findItem(item.submenu, id)
      if (found) return found
    }
  }
  return null
}

function build(context, platform = 'darwin', send = vi.fn()) {
  return buildMenuTemplate({ platform, context, theme: 'system', send, actions })
}

describe('buildMenuTemplate', () => {
  it('disables the project commands on the home page', () => {
    const t = build(home)
    for (const id of ['new-file', 'export-html', 'copy-html', 'send', 'beautify', 'close-project']) {
      expect(findItem(t, id).enabled).toBe(false)
    }
    expect(findItem(t, 'new-project').enabled).not.toBe(false)
  })

  it('enables the project commands when there is an MJML file and a preview', () => {
    const t = build(project)
    for (const id of ['new-file', 'export-html', 'copy-html', 'send', 'beautify', 'close-project']) {
      expect(findItem(t, id).enabled).toBe(true)
    }
  })

  it('disables the MJML commands for a file that is not MJML', () => {
    const t = build({ ...project, hasMjmlFile: false, hasPreview: true })
    expect(findItem(t, 'beautify').enabled).toBe(false)
    expect(findItem(t, 'refine').enabled).toBe(false)
    expect(findItem(t, 'export-html').enabled).toBe(true)
  })

  it('enables Save only when auto-save is off', () => {
    expect(findItem(build(project), 'save').enabled).toBe(false)
    expect(findItem(build({ ...project, preventAutoSave: true }), 'save').enabled).toBe(true)
  })

  it('gives Cmd+W to Close Project on the project page and to the window on the home page', () => {
    expect(findItem(build(project), 'close-project').accelerator).toBe('CmdOrCtrl+W')
    expect(findItem(build(home), 'close-project').accelerator).toBeUndefined()
    expect(findItem(build(home), 'close-window').role).toBe('close')
    expect(findItem(build(home), 'close-window').accelerator).toBe('CmdOrCtrl+W')
  })

  it('sends the command of a custom item', () => {
    const send = vi.fn()
    findItem(build(project, 'darwin', send), 'export-html').click()
    expect(send).toHaveBeenCalledWith('export-html')
  })

  it('puts Undo and Redo in the Edit menu', () => {
    const edit = build(home).find(m => m.label === 'Edit')
    expect(edit.submenu.map(i => i.role)).toEqual(
      expect.arrayContaining(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']),
    )
  })

  it('checks the selected theme', () => {
    const t = buildMenuTemplate({ platform: 'darwin', context: home, theme: 'dark', send: vi.fn(), actions })
    expect(findItem(t, 'theme-dark').checked).toBe(true)
    expect(findItem(t, 'theme-light').checked).toBe(false)
  })

  it('puts Settings in the File menu on Windows and in the app menu on macOS', () => {
    const mac = build(home, 'darwin')
    expect(mac[0].submenu.some(i => i.id === 'settings')).toBe(true)
    const win = build(home, 'win32')
    expect(win.find(m => m.label === 'File').submenu.some(i => i.id === 'settings')).toBe(true)
  })
})
```

- [ ] **Step 2: Run them and make sure they fail**

Run: `yarn test src/helpers/commands.test.js src/helpers/shortcut.test.js src/main/menu.test.js`
Expected: FAIL.

- [ ] **Step 3: Write the registry and the shortcut helper**

`src/helpers/commands.js`:

```js
import { useEffect, useRef } from 'react'

// The menu items send a command name (see src/main/menu.js). The page that
// is open registers the handlers of the commands that it supports.
const handlers = new Map()

export function registerCommand(name, handler) {
  handlers.set(name, handler)
  return () => {
    if (handlers.get(name) === handler) {
      handlers.delete(name)
    }
  }
}

export function runCommand(name) {
  const handler = handlers.get(name)
  if (!handler) {
    return false
  }
  handler()
  return true
}

// registers the handlers of `map` while the component is mounted,
// the handlers can change on each render
export function useCommands(map) {
  const ref = useRef(map)
  ref.current = map
  const names = Object.keys(map).join(',')
  useEffect(() => {
    const unregister = names
      .split(',')
      .filter(Boolean)
      .map(name => registerCommand(name, () => ref.current[name]()))
    return () => unregister.forEach(fn => fn())
  }, [names])
}
```

Note: `commands.test.js` imports this file, which imports `react`. That is fine in the node environment.

`src/helpers/shortcut.js`:

```js
const MAC_SYMBOLS = { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', CmdOrCtrl: '⌘', Cmd: '⌘' }
const MAC_ORDER = ['Ctrl', 'Alt', 'Shift', 'CmdOrCtrl', 'Cmd']

// formats an Electron accelerator for a tooltip
export function formatShortcut(accelerator, platform) {
  if (!accelerator) {
    return ''
  }
  const parts = accelerator.split('+')
  const key = parts.pop() || '+'
  if (platform === 'darwin') {
    const modifiers = MAC_ORDER.filter(m => parts.includes(m)).map(m => MAC_SYMBOLS[m])
    return [...modifiers, key].join('')
  }
  return [...parts.map(m => (m === 'CmdOrCtrl' || m === 'Cmd' ? 'Ctrl' : m)), key].join('+')
}
```

- [ ] **Step 4: Write the menu template**

Rewrite `src/main/menu.js`:

```js
const DOCS_URL = 'https://documentation.mjml.io/'
const TRY_URL = 'https://mjml.io/try-it-live'
const ISSUES_URL = 'https://github.com/mjmlio/mjml-app/issues'

// Builds the application menu for the page that is open. Each custom item
// sends its `id` to the renderer (src/helpers/commands.js).
export function buildMenuTemplate({ platform, context, theme, send, actions }) {
  const isMac = platform === 'darwin'
  const isProject = context.page === 'project'
  const item = (id, label, accelerator, enabled = true) => ({
    id,
    label,
    accelerator,
    enabled,
    click: () => send(id),
  })
  const themeItem = (id, label, value) => ({
    id,
    label,
    type: 'radio',
    checked: theme === value,
    click: () => send(id),
  })
  const settings = item('settings', 'Settings…', 'CmdOrCtrl+,')
  const about = item('about', 'About MJML')

  const appMenu = {
    label: 'MJML',
    submenu: [
      about,
      { type: 'separator' },
      settings,
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  }

  const fileMenu = {
    label: 'File',
    submenu: [
      item('new-project', 'New Project…', 'CmdOrCtrl+Shift+N'),
      item('new-file', 'New File…', 'CmdOrCtrl+N', isProject),
      item('open-project', 'Open Project…', 'CmdOrCtrl+O'),
      item('import-figma', 'Import from Figma…', undefined, isProject),
      { type: 'separator' },
      item('save', 'Save', 'CmdOrCtrl+S', isProject && context.preventAutoSave),
      item('export-html', 'Export HTML…', 'CmdOrCtrl+E', isProject && context.hasPreview),
      item('copy-html', 'Copy HTML', 'CmdOrCtrl+Shift+C', isProject && context.hasPreview),
      item('screenshots', 'Save Screenshots', undefined, isProject && context.hasPreview),
      item('send', 'Send Test Email…', 'CmdOrCtrl+Shift+E', isProject && context.hasPreview),
      { type: 'separator' },
      item('close-project', 'Close Project', isProject ? 'CmdOrCtrl+W' : undefined, isProject),
      {
        id: 'close-window',
        role: 'close',
        accelerator: isProject ? undefined : 'CmdOrCtrl+W',
      },
      ...(isMac ? [] : [{ type: 'separator' }, settings, { type: 'separator' }, { role: 'quit' }]),
    ],
  }

  const editMenu = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
      { type: 'separator' },
      item('find', 'Find', 'CmdOrCtrl+F'),
      item('beautify', 'Beautify', 'CmdOrCtrl+Shift+B', isProject && context.hasMjmlFile),
      item('refine', 'Refine with AI…', undefined, isProject && context.hasMjmlFile),
    ],
  }

  const viewMenu = {
    label: 'View',
    submenu: [
      item('toggle-sidebar', 'Toggle Sidebar', 'CmdOrCtrl+0', isProject),
      item('toggle-preview', 'Toggle Preview', 'CmdOrCtrl+Alt+P', isProject),
      item('preview-desktop', 'Desktop Preview', 'CmdOrCtrl+1', isProject),
      item('preview-mobile', 'Mobile Preview', 'CmdOrCtrl+2', isProject),
      item('templating', 'Templating…', undefined, isProject),
      { type: 'separator' },
      {
        label: 'Theme',
        submenu: [
          themeItem('theme-system', 'System', 'system'),
          themeItem('theme-light', 'Light', 'light'),
          themeItem('theme-dark', 'Dark', 'dark'),
        ],
      },
      { type: 'separator' },
      { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => actions.reload() },
      {
        label: 'Toggle Developer Tools',
        accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
        click: () => actions.toggleDevTools(),
      },
      {
        label: 'Toggle Full Screen',
        accelerator: isMac ? 'Ctrl+Command+F' : 'F11',
        click: () => actions.toggleFullScreen(),
      },
    ],
  }

  const windowMenu = {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : []),
    ],
  }

  const helpMenu = {
    role: 'help',
    label: 'Help',
    submenu: [
      { label: 'Documentation', click: () => actions.openExternal(DOCS_URL) },
      { label: 'Browser Editor', click: () => actions.openExternal(TRY_URL) },
      { label: 'Report an Issue', click: () => actions.openExternal(ISSUES_URL) },
      ...(isMac ? [] : [{ type: 'separator' }, about]),
    ],
  }

  return [...(isMac ? [appMenu] : []), fileMenu, editMenu, viewMenu, windowMenu, helpMenu]
}
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `yarn test src/helpers/commands.test.js src/helpers/shortcut.test.js src/main/menu.test.js`
Expected: PASS.

- [ ] **Step 6: Connect the menu in the main process**

In `src/main/index.js`:

```js
let menuContext = { page: 'home', hasMjmlFile: false, hasPreview: false, preventAutoSave: false }

function rebuildMenu() {
  if (!mainWindow) return
  const w = mainWindow
  const template = buildMenuTemplate({
    platform: process.platform,
    context: menuContext,
    theme: nativeTheme.themeSource,
    send: command => w.webContents.send('redux-command', command),
    actions: {
      openExternal: url => shell.openExternal(url),
      reload: () => w.webContents.reload(),
      toggleDevTools: () => w.webContents.toggleDevTools(),
      toggleFullScreen: () => w.setFullScreen(!w.isFullScreen()),
    },
  })
  const menu = Menu.buildFromTemplate(template)
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(menu)
  } else {
    w.setMenu(menu)
  }
}
```

Replace the old `buildMenu` use with `rebuildMenu()` after `mainWindow` is set (in `whenReady` and `activate`). Call `rebuildMenu()` in `onThemeChange` too. On Windows and Linux the hidden title bar hides the menu bar: call `w.setAutoHideMenuBar(true)` so the Alt key shows it.

In `src/main/ipc.js`, change the signature to `registerIpcHandlers({ onThemeChange, onMenuContext })` and add:

```js
  ipcMain.handle('menu:setContext', (e, context) => onMenuContext(context))
```

In `index.js`: `onMenuContext: context => { menuContext = { ...menuContext, ...context }; rebuildMenu() }`.

In `src/preload/index.js`: `menu: { setContext: context => ipcRenderer.invoke('menu:setContext', context) }`.

- [ ] **Step 7: The renderer side**

`src/helpers/useMenuContext.js`:

```js
import { useEffect } from 'react'

import api from 'helpers/api'

// tells the main process which menu items apply to the page that is open
export default function useMenuContext(context) {
  const key = JSON.stringify(context)
  useEffect(() => {
    api.menu.setContext(JSON.parse(key)).catch(err => console.error(err))
  }, [key])
}
```

In `src/renderer/main.jsx`, replace the `redux-command` listener with:

```js
registerCommand('about', () => dispatch(openModal('about')))
registerCommand('settings', () => dispatch(openModal('settings')))
registerCommand('new-project', () => dispatch(openModal('newProject')))
registerCommand('open-project', () => dispatch(addProject()))
for (const theme of ['system', 'light', 'dark']) {
  registerCommand(`theme-${theme}`, () =>
    dispatch(updateSettings(s => s.setIn(['appearance', 'theme'], theme))),
  )
}

api.on('redux-command', command => runCommand(command))
```

The pages are class components. Add a small function component in each page file that calls the hooks and renders nothing:

```jsx
function PageCommands({ commands, context }) {
  useCommands(commands)
  useMenuContext(context)
  return null
}
```

Home (`pages/Home/index.jsx`): render `<PageCommands context={{ page: 'home', hasMjmlFile: false, hasPreview: false, preventAutoSave: false }} commands={{ find: () => document.querySelector('.GlobalSearch--input')?.focus() }} />`.

Project (`pages/Project/index.jsx`): render `<PageCommands>` with `context = { page: 'project', hasMjmlFile: isMJMLFile, hasPreview: !!preview && preview.type === 'html', preventAutoSave }` and these commands (the handlers that exist today, plus small new ones):

| Command | Handler |
|---|---|
| `new-file` | `this.openAddFileModal` |
| `import-figma` | `this.openFigmaImportModal` |
| `save` | `() => this._editor && this._editor.handleSave()` |
| `export-html` | `this.handleExportToHTML` |
| `copy-html` | `this.handleCopyHTML` |
| `screenshots` | `this.handleScreenshot` |
| `send` | `this.openSendModal` |
| `close-project` | `() => router.navigate('/')` (import `router` from `router`) |
| `find` | `() => this._editor && this._editor.openSearch()` |
| `beautify` | `this.handleBeautify` |
| `refine` | `this.openRefineModal` |
| `templating` | `this.handleOpenSettings` |
| `toggle-sidebar`, `toggle-preview`, `preview-desktop`, `preview-mobile` | added in Tasks 10 and 11, register an empty function for now: `() => {}` |

Guard each handler that needs a preview or an MJML file with the same check that the menu uses (the menu disables the item, but a guard keeps a stale menu safe): for example `export-html: () => this.hasHTMLPreview() && this.handleExportToHTML()`. Add `hasHTMLPreview()` to the page: `return !!this.props.preview && this.props.preview.type === 'html'`.

In `FileEditor`, add:

```js
    openSearch = () => {
      if (this._view) {
        this._view.focus()
        openSearchPanel(this._view)
      }
    }
```

(import `openSearchPanel` from `@codemirror/search`).

- [ ] **Step 8: Run the checks and try the menu**

Run: `yarn lint && yarn prettier:check && yarn test && yarn build`, then `yarn start`. Expected: on the home page File → Export HTML is gray. In a project, Cmd+E opens the save dialog, Cmd+W goes back to the home page, Cmd+W on the home page closes the window, Edit → Undo works in the editor, View → Theme → Light makes the app light.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Rebuild the menu for each page, add the shortcuts and a command registry"
```

### Task 7: Native context menus

**Files:**
- Create: `src/main/popup-menu.js`, `src/main/popup-menu.test.js`, `src/helpers/contextMenu.js`
- Modify: `src/main/ipc.js`, `src/preload/index.js`

**Interfaces:**
- Produces: `toPopupTemplate(items, onChoose)`; `api.menu.popup(items) → Promise<string|null>`; renderer `showContextMenu(items) → Promise<string|null>`. An item is `{ id, label, enabled?, checked?, accelerator? }` or `{ type: 'separator' }`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it, vi } from 'vitest'

import { toPopupTemplate } from './popup-menu'

describe('toPopupTemplate', () => {
  it('gives each item a click that chooses its id', () => {
    const onChoose = vi.fn()
    const [open] = toPopupTemplate([{ id: 'open', label: 'Open' }], onChoose)
    open.click()
    expect(onChoose).toHaveBeenCalledWith('open')
  })

  it('keeps the separators and the enabled state', () => {
    const t = toPopupTemplate(
      [{ id: 'a', label: 'A', enabled: false }, { type: 'separator' }, { id: 'b', label: 'B' }],
      vi.fn(),
    )
    expect(t[0].enabled).toBe(false)
    expect(t[1]).toEqual({ type: 'separator' })
    expect(t[2].enabled).toBe(true)
  })

  it('makes an item with `checked` a checkbox item', () => {
    const [item] = toPopupTemplate([{ id: 'a', label: 'A', checked: true }], vi.fn())
    expect(item.type).toBe('checkbox')
    expect(item.checked).toBe(true)
  })

  it('drops the items without an id or a label', () => {
    expect(toPopupTemplate([{ label: 'No id' }, { id: 'x' }, null], vi.fn())).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and make sure it fails**

Run: `yarn test src/main/popup-menu.test.js` — Expected: FAIL.

- [ ] **Step 3: Write `popup-menu.js`**

```js
// Converts the items that the renderer sends to an Electron menu template.
// The renderer cannot send functions, so each item has an id.
export function toPopupTemplate(items, onChoose) {
  return (Array.isArray(items) ? items : [])
    .filter(i => i && (i.type === 'separator' || (typeof i.id === 'string' && i.label)))
    .map(i => {
      if (i.type === 'separator') {
        return { type: 'separator' }
      }
      return {
        label: String(i.label),
        enabled: i.enabled !== false,
        accelerator: i.accelerator,
        ...(typeof i.checked === 'boolean' ? { type: 'checkbox', checked: i.checked } : {}),
        click: () => onChoose(i.id),
      }
    })
}
```

- [ ] **Step 4: Run it and make sure it passes**

Run: `yarn test src/main/popup-menu.test.js` — Expected: PASS.

- [ ] **Step 5: The IPC call and the renderer helper**

In `src/main/ipc.js` (import `Menu`):

```js
  // shows a native context menu, resolves with the id of the chosen item or null
  ipcMain.handle(
    'menu:popup',
    (e, items) =>
      new Promise(resolve => {
        const menu = Menu.buildFromTemplate(toPopupTemplate(items, resolve))
        menu.popup({
          window: BrowserWindow.fromWebContents(e.sender),
          // the click can come after the close event, so wait a little
          callback: () => setTimeout(() => resolve(null), 100),
        })
      }),
  )
```

In the preload `menu` object: `popup: items => ipcRenderer.invoke('menu:popup', items)`.

`src/helpers/contextMenu.js`:

```js
import api from 'helpers/api'

// shows a native menu at the mouse position, resolves with the chosen id or null
export function showContextMenu(items) {
  return api.menu.popup(items).catch(err => {
    console.error(err)
    return null
  })
}
```

- [ ] **Step 6: Run the checks**

Run: `yarn lint && yarn prettier:check && yarn test && yarn build`. The menu shows in Tasks 11 and 13.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add native context menus through IPC"
```

## Phase 3: Project screen

### Task 8: Editor status state

**Files:**
- Create: `src/reducers/editorStatus.js`, `src/reducers/editorStatus.test.js`
- Modify: `src/reducers/index.js`, `src/components/FileEditor/index.jsx`, `src/actions/preview.js`

**Interfaces:**
- Produces: `state.editorStatus = { line, col, isDirty, isRendering, renderMs }`; `setEditorStatus(partial)`, `resetEditorStatus()`; `FileEditor#goToLine(line)`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest'

import reducer, { resetEditorStatus, setEditorStatus } from './editorStatus'

const initial = reducer(undefined, { type: '@@INIT' })

describe('editorStatus', () => {
  it('starts at line 1, column 1, clean and not rendering', () => {
    expect(initial).toEqual({ line: 1, col: 1, isDirty: false, isRendering: false, renderMs: null })
  })

  it('merges a partial update', () => {
    const s = reducer(initial, setEditorStatus({ line: 12, col: 8 }))
    expect(s).toEqual({ ...initial, line: 12, col: 8 })
    expect(reducer(s, setEditorStatus({ isRendering: true })).line).toBe(12)
  })

  it('resets to the initial state', () => {
    const s = reducer(initial, setEditorStatus({ line: 3, isDirty: true }))
    expect(reducer(s, resetEditorStatus())).toEqual(initial)
  })
})
```

- [ ] **Step 2: Run it and make sure it fails** — `yarn test src/reducers/editorStatus.test.js`, Expected: FAIL.

- [ ] **Step 3: Write the reducer**

```js
import { createAction, handleActions } from 'redux-actions'

// what the status bar shows about the open file
const initialState = { line: 1, col: 1, isDirty: false, isRendering: false, renderMs: null }

export default handleActions(
  {
    EDITOR_STATUS_SET: (state, { payload }) => ({ ...state, ...payload }),
    EDITOR_STATUS_RESET: () => initialState,
  },
  initialState,
)

export const setEditorStatus = createAction('EDITOR_STATUS_SET')
export const resetEditorStatus = createAction('EDITOR_STATUS_RESET')
```

Register it in `reducers/index.js` as `editorStatus`.

- [ ] **Step 4: Run it and make sure it passes** — Expected: PASS.

- [ ] **Step 5: Dispatch from the editor**

In `FileEditor` (add `setEditorStatus` and `resetEditorStatus` to the `connect` actions):

- In the `updateListener`, after the existing code:

```js
            if (update.selectionSet || update.docChanged) {
              this.scheduleCursorStatus()
            }
```

- Add:

```js
    // one dispatch for each frame at most
    scheduleCursorStatus = () => {
      if (this._cursorFrame) return
      this._cursorFrame = requestAnimationFrame(() => {
        this._cursorFrame = null
        if (!this._view) return
        const { state } = this._view
        const head = state.selection.main.head
        const line = state.doc.lineAt(head)
        this.props.setEditorStatus({ line: line.number, col: head - line.from + 1 })
      })
    }

    updateDirty = () => {
      const fileName = this._contentFileName
      if (!this._view || !fileName) return
      const isDirty = this.props.preventAutoSave && this.getContent() !== this._lastWritten[fileName]
      if (isDirty !== this._isDirty) {
        this._isDirty = isDirty
        this.props.setEditorStatus({ isDirty })
      }
    }

    goToLine = lineNumber => {
      if (!this._view) return
      const { doc } = this._view.state
      const line = doc.line(Math.min(Math.max(1, lineNumber), doc.lines))
      this._view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true })
      this._view.focus()
    }
```

- Call `this.updateDirty()` at the end of `handleChange`, after `write()` and at the end of `handleSave`, and after `loadContent` sets `_lastWritten`.
- In `componentWillUnmount`, `cancelAnimationFrame(this._cursorFrame)` and `this.props.resetEditorStatus()`.

- [ ] **Step 6: Dispatch the render time**

In `actions/preview.js`, in the `.mjml` case:

```js
        dispatch(setEditorStatus({ isRendering: true }))
        const startedAt = performance.now()
        const { html, errors } = await mjml2html(content, fileName, mjmlPath, renderOpts)
        dispatch(
          setEditorStatus({ isRendering: false, renderMs: Math.round(performance.now() - startedAt) }),
        )
```

If `mjml2html` throws, the `catch-errors` middleware shows the error. Wrap the call in `try { … } finally { … }` so `isRendering` goes back to `false`:

```js
        let result
        try {
          result = await mjml2html(content, fileName, mjmlPath, renderOpts)
        } finally {
          dispatch(
            setEditorStatus({ isRendering: false, renderMs: Math.round(performance.now() - startedAt) }),
          )
        }
        const { html, errors } = result
```

- [ ] **Step 7: Run the checks** — `yarn lint && yarn prettier:check && yarn test && yarn build`. Open the Redux DevTools in `yarn dev` and move the cursor: `EDITOR_STATUS_SET` actions show.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Keep the cursor, dirty and render state of the editor in the store"
```

### Task 9: Status bar

**Files:**
- Create: `src/components/StatusBar/index.jsx`, `src/components/StatusBar/style.scss`
- Modify: `src/pages/Project/index.jsx`

**Interfaces:**
- Consumes: `state.editorStatus` (Task 8), `state.preview.errors`, `FileEditor#goToLine` (Task 8).
- Produces: `<StatusBar projectPath onGoToLine />`.

- [ ] **Step 1: Write the component**

```jsx
import { connect } from 'react-redux'
import find from 'lodash/find'
import { MdCheckCircle as IconOk, MdError as IconError } from 'react-icons/md'

import './style.scss'

const TEMPLATING_LABELS = { handlebars: 'Handlebars', erb: 'ERB' }

function StatusBar({ status, errors, engine, templating, preventAutoSave, isMJML, onGoToLine }) {
  const firstError = errors.find(e => e.line > 0)
  return (
    <div className="StatusBar">
      <div className="StatusBar--group">
        {isMJML &&
          (errors.length ? (
            <button
              type="button"
              className="StatusBar--item StatusBar--errors"
              onClick={() => firstError && onGoToLine(firstError.line)}
              data-tooltip="Go to the first error"
            >
              <IconError size={13} />
              {errors.length === 1 ? '1 error' : `${errors.length} errors`}
            </button>
          ) : (
            <span className="StatusBar--item StatusBar--ok">
              <IconOk size={13} />
              {'No errors'}
            </span>
          ))}
        {isMJML && (
          <span className="StatusBar--item">
            {status.isRendering
              ? 'Rendering…'
              : status.renderMs !== null
                ? `Rendered in ${status.renderMs} ms`
                : ''}
          </span>
        )}
      </div>
      <div className="StatusBar--group">
        {preventAutoSave && <span className="StatusBar--item">{'Auto-save off'}</span>}
        {TEMPLATING_LABELS[templating] && (
          <span className="StatusBar--item">{TEMPLATING_LABELS[templating]}</span>
        )}
        <span className="StatusBar--item">
          {engine === 'manual' ? 'MJML (local binary)' : `MJML ${__MJML_VERSION__}`}
        </span>
        {isMJML && <span className="StatusBar--item">{`Ln ${status.line}, Col ${status.col}`}</span>}
      </div>
    </div>
  )
}

export default connect((state, { projectPath }) => ({
  status: state.editorStatus,
  errors: (state.preview && state.preview.errors) || [],
  engine: state.settings.getIn(['mjml', 'engine'], 'auto'),
  templating: (find(state.settings.get('templating'), { projectPath }) || {}).engine,
  preventAutoSave: state.settings.getIn(['editor', 'preventAutoSave'], false),
}))(StatusBar)
```

Note: a templating entry is `{ projectPath, engine, variables, ... }` (see `defaultTemplatingSettings` in `pages/Project/PreviewSettings.jsx`), and `engine` is `'html'` when there is no templating.

- [ ] **Step 2: Write the styles**

```scss
.StatusBar {
  flex-shrink: 0;
  height: var(--statusbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-2);
  border-top: 1px solid var(--separator);
  background: var(--bg-window);
  color: var(--fg-muted);
  font-size: var(--text-xs);
}

.StatusBar--group {
  display: flex;
  align-items: center;
  min-width: 0;
}

.StatusBar--item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

button.StatusBar--item:hover {
  background: var(--bg-hover);
  color: var(--fg);
}

.StatusBar--ok svg {
  color: var(--success);
}

.StatusBar--errors {
  color: var(--danger);
}
```

- [ ] **Step 3: Put it in the project page**

In `pages/Project/index.jsx`, render `<StatusBar projectPath={path} isMJML={!!isMJMLFile} onGoToLine={line => this._editor && this._editor.goToLine(line)} />` after the files list container.

- [ ] **Step 4: Run the checks and look at the result**

Run: `yarn lint && yarn prettier:check && yarn build`. Take `project-dark.png`. Add `<mj-text foo="1">` to a file in the running app: the status bar shows "1 error" and a click puts the cursor on that line.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add the status bar to the project page"
```

### Task 10: Project title bar and actions

**Files:**
- Modify: `src/pages/Project/index.jsx`, `src/components/FilesList/FilePreview.jsx`, `src/components/FilesList/styles.scss`
- Delete: `src/pages/Project/BackButton.jsx`
- Create: `src/pages/Project/style.scss`

**Interfaces:**
- Consumes: `TitleBar` (Task 5), `SegmentedControl` (Task 3), `showContextMenu` (Task 7), `formatShortcut` (Task 6), `useCommands` names (Task 6).
- Produces: the `preview-desktop` and `preview-mobile` command handlers.

- [ ] **Step 1: Build the title bar content**

Replace the old toolbar in `render()` with:

```jsx
<TitleBar
  left={
    <>
      <Button
        variant="ghost"
        icon
        link
        to="/"
        aria-label="Back to projects"
        data-tooltip={`Back to projects (${shortcut('CmdOrCtrl+W')})`}
      >
        <IconBack size={18} />
      </Button>
      <Breadcrumb
        projectName={projectName}
        folders={pathModule.relative(rootPath, path).split(pathModule.sep).filter(Boolean)}
        fileName={activeFile && !activeFile.isFolder ? activeFile.name : null}
        isDirty={isDirty}
        onNavigate={depth => this.handlePathChange(pathModule.join(rootPath, ...folders.slice(0, depth)))}
      />
    </>
  }
  right={
    <>
      {preventAutoSave && (
        <Button variant={isDirty ? 'primary' : 'secondary'} onClick={() => this._editor.handleSave()}>
          {'Save'}
        </Button>
      )}
      <SegmentedControl
        disabled={!hasPreview}
        value={currentPreviewSize === desktopSize ? 'desktop' : currentPreviewSize === mobileSize ? 'mobile' : null}
        onChange={v => this.setPreviewSize(v)}
        options={[
          { value: 'desktop', icon: <IconDesktop size={14} />, tooltip: `Desktop (${shortcut('CmdOrCtrl+1')})` },
          { value: 'mobile', icon: <IconMobile size={14} />, tooltip: `Mobile (${shortcut('CmdOrCtrl+2')})` },
        ]}
      />
      <Button variant="ghost" disabled={!hasPreview} onClick={this.openSendModal}
        data-tooltip={`Send test email (${shortcut('CmdOrCtrl+Shift+E')})`}>
        <IconEmail size={16} />
        {'Send'}
      </Button>
      <Button variant="ghost" disabled={!hasPreview} onClick={this.handleExportMenu}>
        <IconExport size={16} />
        {'Export'}
        <IconDown size={14} />
      </Button>
      <Button variant="ghost" icon aria-label="More actions" data-tooltip="More actions" onClick={this.handleMoreMenu}>
        <IconMore size={18} />
      </Button>
      <Button variant="ghost" icon aria-label="Settings" data-tooltip={`Settings (${shortcut('CmdOrCtrl+,')})`}
        onClick={this.openSettingsModal}>
        <IconSettings size={16} />
      </Button>
    </>
  }
/>
```

Where:
- `shortcut = accelerator => formatShortcut(accelerator, api.platform)`.
- Icons (`react-icons/md`): `MdChevronLeft as IconBack`, `MdDesktopWindows as IconDesktop`, `MdPhoneIphone as IconMobile`, `MdSend as IconEmail`, `MdIosShare as IconExport`, `MdKeyboardArrowDown as IconDown`, `MdMoreHoriz as IconMore`, `MdSettings as IconSettings`. Check that each name exists: `node -e "const m=require('react-icons/md');console.log(['MdIosShare','MdPhoneIphone','MdMoreHoriz'].map(n=>n+':'+!!m[n]))"`. Use `MdFileUpload` if `MdIosShare` is missing.
- `hasPreview = this.hasHTMLPreview()`, `isDirty` from `state.editorStatus.isDirty` (add it to `connect`), `desktopSize`, `mobileSize`, `currentPreviewSize` from `previewSize`.
- `folders` is the same array that the `Breadcrumb` gets. Compute it once before the JSX.

`Breadcrumb` is a small function component in the same file:

```jsx
function Breadcrumb({ projectName, folders, fileName, isDirty, onNavigate }) {
  return (
    <div className="Breadcrumb">
      <button type="button" className="Breadcrumb--item Breadcrumb--project" onClick={() => onNavigate(0)}>
        {projectName}
      </button>
      {folders.map((folder, i) => (
        <Fragment key={i}>
          <span className="Breadcrumb--sep">{'/'}</span>
          <button type="button" className="Breadcrumb--item" onClick={() => onNavigate(i + 1)}>
            {folder}
          </button>
        </Fragment>
      ))}
      {fileName && (
        <>
          <span className="Breadcrumb--sep">{'/'}</span>
          <span className="Breadcrumb--file">{fileName}</span>
          {isDirty && <span className="Breadcrumb--dirty" aria-label="Unsaved changes" />}
        </>
      )}
    </div>
  )
}
```

`src/pages/Project/style.scss` (import it in `index.jsx`):

```scss
.ProjectPage {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-window);
}

.Breadcrumb {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  font-size: var(--text-md);
}

.Breadcrumb--item {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  color: var(--fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  -webkit-app-region: no-drag;

  &:hover {
    background: var(--bg-hover);
    color: var(--fg);
  }
}

.Breadcrumb--project {
  font-weight: 600;
  color: var(--fg);
}

.Breadcrumb--sep {
  color: var(--fg-subtle);
}

.Breadcrumb--file {
  padding: 2px 6px;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 40px;
}

.Breadcrumb--dirty {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--fg-muted);
}
```

Give the page root `className="ProjectPage"` (replace `fg-1 d-f fd-c o-n`, keep `tabIndex` and `ref`).

- [ ] **Step 2: The menus**

```js
    handleExportMenu = async () => {
      const id = await showContextMenu([
        { id: 'copy-html', label: 'Copy HTML', accelerator: 'CmdOrCtrl+Shift+C' },
        { id: 'export-html', label: 'Export HTML File…', accelerator: 'CmdOrCtrl+E' },
        { type: 'separator' },
        { id: 'screenshots', label: 'Save Screenshots (Mobile and Desktop)' },
      ])
      if (id) runCommand(id)
    }

    handleMoreMenu = async () => {
      const isMJML = !!this.state.activeFile && this.state.activeFile.name.endsWith('.mjml')
      const id = await showContextMenu([
        { id: 'beautify', label: 'Beautify', enabled: isMJML, accelerator: 'CmdOrCtrl+Shift+B' },
        { id: 'refine', label: 'Refine with AI…', enabled: isMJML },
        { type: 'separator' },
        { id: 'import-figma', label: 'Import from Figma…' },
        { id: 'templating', label: 'Templating…' },
        { type: 'separator' },
        { id: 'reveal', label: api.platform === 'darwin' ? 'Reveal in Finder' : 'Show in File Manager' },
      ])
      if (id === 'reveal') this.handleOpenInBrowser()
      else if (id) runCommand(id)
    }
```

Import `runCommand` from `helpers/commands`. The accelerators in a popup are only labels (Electron shows them, the main menu owns the real shortcuts).

- [ ] **Step 3: The preview size handlers**

```js
    setPreviewSize = which => {
      const size = this.props.previewSize.get(which)
      this.props.updateSettings(s => s.setIn(['previewSize', 'current'], size))
    }
```

Add `updateSettings` to `connect`. Register `preview-desktop: () => this.setPreviewSize('desktop')` and `preview-mobile: () => this.setPreviewSize('mobile')` in `PageCommands`.

In `FilePreview.jsx`, remove the floating Desktop/Mobile buttons (`FileList--preview-actions-wrapper` and its CSS in `FilesList/styles.scss`) and the now unused props and imports.

- [ ] **Step 4: Remove the old button component**

Delete `src/pages/Project/BackButton.jsx` and its import.

- [ ] **Step 5: Run the checks and look at the result**

Run: `yarn lint && yarn prettier:check && yarn build`. Take `project-dark.png` at 1280×800 **and at 960×600**. Expected: one row with the back button, the breadcrumb, Desktop/Mobile, Send, Export, More and Settings. At 960 px the breadcrumb truncates and nothing overflows. Open a project with a long name (`mkdir "/tmp/a very long project name for the title bar check"` with an `index.mjml`, then open it) and check the ellipsis.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Replace the project toolbar with a title bar, an export menu and a more menu"
```

### Task 11: Sidebar and preview pane

**Files:**
- Create: `src/helpers/files.js`, `src/helpers/files.test.js`
- Modify: `src/components/FilesList/index.jsx`, `src/components/FilesList/styles.scss`, `src/components/FilesList/FilePreview.jsx`, `src/components/FilesList/OldSyntaxDetected.jsx`, `src/pages/Project/index.jsx`, `src/preload/fs.js`, `src/helpers/fs.js`

**Interfaces:**
- Consumes: `showContextMenu` (Task 7), `useCommands` (Task 6), `settings.layout` (Task 1).
- Produces: `fileKind(name, isFolder) → 'folder'|'mjml'|'html'|'image'|'other'`; `duplicateName(name, existingNames) → string`; `copyFile(src, dest)` in `helpers/fs`; `FilesList` props `onNewFile`, `onImportFigma`, `sidebarCollapsed`, `previewCollapsed`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest'

import { duplicateName, fileKind } from './files'

describe('fileKind', () => {
  it('finds the kind from the extension', () => {
    expect(fileKind('index.mjml', false)).toBe('mjml')
    expect(fileKind('out.HTML', false)).toBe('html')
    expect(fileKind('logo.png', false)).toBe('image')
    expect(fileKind('photo.jpeg', false)).toBe('image')
    expect(fileKind('notes.txt', false)).toBe('other')
    expect(fileKind('Makefile', false)).toBe('other')
  })

  it('gives folder for a folder, whatever its name', () => {
    expect(fileKind('images.mjml', true)).toBe('folder')
  })
})

describe('duplicateName', () => {
  it('adds " copy" before the extension', () => {
    expect(duplicateName('index.mjml', ['index.mjml'])).toBe('index copy.mjml')
  })

  it('adds a number when the copy exists', () => {
    expect(duplicateName('index.mjml', ['index.mjml', 'index copy.mjml'])).toBe('index copy 2.mjml')
    expect(
      duplicateName('index.mjml', ['index.mjml', 'index copy.mjml', 'index copy 2.mjml']),
    ).toBe('index copy 3.mjml')
  })

  it('works for a name without an extension and for a dot file', () => {
    expect(duplicateName('README', ['README'])).toBe('README copy')
    expect(duplicateName('.mjmlconfig', ['.mjmlconfig'])).toBe('.mjmlconfig copy')
  })
})
```

- [ ] **Step 2: Run it and make sure it fails** — `yarn test src/helpers/files.test.js`, Expected: FAIL.

- [ ] **Step 3: Write the helpers**

```js
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']

function splitName(name) {
  const dot = name.lastIndexOf('.')
  // a dot at the start is a hidden file, not an extension
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
}

export function fileKind(name, isFolder) {
  if (isFolder) return 'folder'
  const ext = splitName(name)[1].slice(1).toLowerCase()
  if (ext === 'mjml') return 'mjml'
  if (ext === 'html' || ext === 'htm') return 'html'
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
  return 'other'
}

// "index.mjml" → "index copy.mjml", then "index copy 2.mjml"...
export function duplicateName(name, existingNames) {
  const [base, ext] = splitName(name)
  const taken = new Set(existingNames)
  let candidate = `${base} copy${ext}`
  for (let n = 2; taken.has(candidate); n++) {
    candidate = `${base} copy ${n}${ext}`
  }
  return candidate
}
```

- [ ] **Step 4: Run it and make sure it passes** — Expected: PASS.

- [ ] **Step 5: `copyFile`**

In `src/preload/fs.js`: `export function copyFile(src, dest) { return fs.copyFile(src, dest, fsConstants.COPYFILE_EXCL) }` (import `constants as fsConstants` from `node:fs`, check how `fs` is imported at the top of the file and follow it). In `src/helpers/fs.js`, export `copyFile` the same way as the other helpers.

- [ ] **Step 6: Rewrite the file list rows**

In `FilesList/index.jsx`:

1. Each row: `<button className={cx('FilesList--file', { active })} onClick onDoubleClick={startRename} onContextMenu={this.handleContextMenuFactory(f)} data-name={f.name}>` with an icon from `fileKind` (`folder` → `MdFolder`, `mjml` → `MdCode`, `html` → `MdHtml` (or `MdLanguage` if missing), `image` → `MdImage`, `other` → `MdInsertDriveFile`) and the name. Remove the hover rename and remove icons (`FilesList--item-actions`).
2. Rename starts with `startRename(f)`: `this.setState({ renamedFile: f, newName: f.name })`. In the rename input, select the name without the extension on focus: `input.setSelectionRange(0, f.isFolder ? f.name.length : splitAt)` where `splitAt` is `f.name.lastIndexOf('.')` when it is `> 0`, else the full length. Replace `this._renameInput.select()` in `componentDidUpdate`. Use `e.key` (`'Escape'`, `'Enter'`) in `handleRenameInputKeyDown` instead of `e.which`. On a rename error (the name exists), call `this.props.addAlert('A file with this name already exists', 'error')` (add `addAlert` to `connect`) and keep the input open.
3. Keyboard on the list container (`onKeyDown`):

```js
    handleListKeyDown = e => {
      if (this.state.renamedFile) return
      const rows = [...e.currentTarget.querySelectorAll('.FilesList--file[data-name]')]
      const index = rows.indexOf(document.activeElement)
      const file = index > -1 ? this.state.files.find(f => f.name === rows[index].dataset.name) : null
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const next = rows[Math.min(rows.length - 1, Math.max(0, index + (e.key === 'ArrowDown' ? 1 : -1)))]
        if (next) {
          next.focus()
          next.click()
        }
      } else if (file && (e.key === 'F2' || (e.key === 'Enter' && api.platform === 'darwin'))) {
        e.preventDefault()
        this.startRename(file)
      } else if (file && e.key === 'Backspace' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        this.props.openModal('removeFile', file)
      }
    }
```

   Note: `ArrowDown` on a folder row clicks it and opens the folder. To avoid this, only call `next.click()` when the next row is not a folder.
4. Context menu:

```js
    handleContextMenuFactory = f => async e => {
      e.preventDefault()
      const reveal = api.platform === 'darwin' ? 'Reveal in Finder' : 'Show in File Manager'
      const id = await showContextMenu([
        { id: 'rename', label: 'Rename' },
        { id: 'duplicate', label: 'Duplicate', enabled: !f.isFolder },
        { id: 'reveal', label: reveal },
        { type: 'separator' },
        { id: 'trash', label: 'Move to Trash' },
      ])
      const fullPath = pathModule.join(this.props.path, f.name)
      if (id === 'rename') this.startRename(f)
      if (id === 'reveal') api.shell.showItemInFolder(fullPath)
      if (id === 'trash') this.props.openModal('removeFile', f)
      if (id === 'duplicate') {
        const name = duplicateName(f.name, this.state.files.map(file => file.name))
        try {
          await copyFile(fullPath, pathModule.join(this.props.path, name))
          this.refresh()
        } catch (err) {
          this.props.addAlert('Could not duplicate the file', 'error')
        }
      }
    }
```

5. Sidebar header above the list:

```jsx
<div className="FilesList--header">
  <span className="FilesList--title">{'Files'}</span>
  <Button variant="ghost" size="sm" icon aria-label="New file" data-tooltip={`New file (${shortcut('CmdOrCtrl+N')})`} onClick={onNewFile}>
    <MdNoteAdd size={15} />
  </Button>
  <Button variant="ghost" size="sm" icon aria-label="Import from Figma" data-tooltip="Import from Figma" onClick={onImportFigma}>
    <FaFigma size={13} />
  </Button>
</div>
```

   The project page passes `onNewFile={this.openAddFileModal}` and `onImportFigma={this.openFigmaImportModal}`. Remove the "New file" and "Import from Figma" buttons from the page (they are in the sidebar, the More menu and the File menu).

6. The ".." row keeps working: it uses `handleNavigateUp`, give it the `folder` icon and the label `..`.

- [ ] **Step 7: Collapse and save the sizes**

In the project page, read `settings.layout` (`sidebarCollapsed`, `previewCollapsed`, `sidebarWidth`) in `connect` and register:

```js
'toggle-sidebar': () => this.props.updateSettings(s => s.updateIn(['layout', 'sidebarCollapsed'], v => !v)),
'toggle-preview': () => this.props.updateSettings(s => s.updateIn(['layout', 'previewCollapsed'], v => !v)),
```

Pass `sidebarCollapsed`, `previewCollapsed` and `sidebarWidth` to `FilesList`. In `FilesList.render()`:

- When `sidebarCollapsed`, do not render the first `Pane` (render only the inner content).
- When `previewCollapsed`, do not render the inner `SplitPane`, render only the editor pane content.
- The sidebar `Pane` gets `defaultSize={sidebarWidth}`, `minSize={180}`, `maxSize={360}`.
- On the outer `onResizeEnd`, save the sidebar width: `sizes => { this.props.updateSettings(s => s.setIn(['layout', 'sidebarWidth'], Math.round(sizes[0]))); this.stopDrag() }`.

Check the `react-split-pane` API first: `grep -n "onResizeEnd\|defaultSize\|minSize" node_modules/react-split-pane/dist/index.d.ts`. If `onResizeEnd` does not give the sizes, use the same approach as `handlePreviewPanelStopDrag` (it already reads `sizes[1]`).

- [ ] **Step 8: Sidebar, preview and banner styles**

Rewrite `FilesList/styles.scss` with tokens:

- `.FilesList--sidebar` (the sticky container of the list, replace `bg-dark`): `background: var(--bg-sidebar)`, `border-right: 1px solid var(--separator)`.
- `.FilesList--header`: `height: 32px`, `display: flex`, `align-items: center`, `gap: 2px`, `padding: 0 var(--space-2) 0 var(--space-3)`. `.FilesList--title`: `flex: 1`, `font-size: var(--text-xs)`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.04em`, `color: var(--fg-subtle)`.
- `.FilesList--list`: `padding: 0 var(--space-2) var(--space-2)`.
- `.FilesList--file`: `height: 26px`, `gap: 6px`, `padding: 0 var(--space-2)`, `border-radius: var(--radius-md)`, `color: var(--fg)`, icon `color: var(--fg-muted)`; hover `--bg-hover`; `.active` `--bg-selected` and the icon in `--accent`; `:focus-visible` uses an inset ring `box-shadow: inset 0 0 0 2px var(--focus-ring)` with `outline: none`. Remove the blue left border.
- `.renaming input`: full width, `height: 22px`, `border: 1px solid var(--accent)`, `border-radius: var(--radius-sm)`, `background: var(--bg-input)`, `padding: 0 4px`.
- `.FilesList--preview-container`: `background: var(--bg-canvas)`, `padding: var(--space-3)`, `margin-left: 0` (remove `ml-5` in the JSX).
- `.FilesList--preview iframe`: keep `background: white`, add `border-radius: var(--radius-md)`, `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.12)`, and set `top/left/right/bottom: var(--space-3)` with `width/height: auto` in place of `100%`.
- `.FilesList--preview-empty`: centered, `color: var(--fg-subtle)`, `font-size: var(--text-sm)`.
- `.OldSyntaxDetected`: `background: var(--warning-bg)`, `color: var(--warning)`, `border-bottom: 1px solid var(--separator)`, `padding: var(--space-2) var(--space-3)`, `display: flex`, `align-items: center`, `gap: var(--space-3)`, `font-size: var(--text-sm)`. In `OldSyntaxDetected.jsx`, put the text and a `size="sm"` button in one row.
- The editor pane gets `background: var(--bg-panel)`.

In `FilePreview.jsx`: when `!preview`, render `<div className="FilesList--preview-empty">{'Select an MJML file to preview it'}</div>`. Under the iframe, render `<div className="FilesList--preview-width">{`${previewSize.get('current')} px`}</div>` (position absolute, bottom 2px, centered, `--text-xs`, `--fg-subtle`).

- [ ] **Step 9: Run the checks and try it**

Run: `yarn lint && yarn prettier:check && yarn test && yarn build`, then `yarn start`:
1. Cmd+0 hides and shows the sidebar. Restart the app: the state stays.
2. Cmd+Alt+P hides and shows the preview.
3. Right click a file → Duplicate makes "index copy.mjml".
4. Up and Down keys move between files, F2 renames.

Take `project-dark.png` at 1280×800 and 960×600.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Restyle the files sidebar and the preview and add the keyboard and context menu"
```

## Phase 4: Home screen

### Task 12: Project list helpers and data

**Files:**
- Create: `src/helpers/projects.js`, `src/helpers/projects.test.js`
- Modify: `src/preload/fs.js`, `src/helpers/fs.js`, `src/actions/projects.js`, `src/reducers/projects.js`, `src/reducers/settings.js`

**Interfaces:**
- Produces: `formatRelativeTime(timeMs, nowMs) → string`; `displayPath(p, homedir, sep) → string`; `sortProjects(projects, sort) → projects` (array of `{ path, mtime }`, `sort` is `'recent'|'name'|'modified'`); `nextSelection({ selected, clicked, ordered, anchor, meta, shift }) → { selected, anchor }`; `getMtime(p) → Promise<number|null>`; project field `mtime`; action `PROJECT_TOUCH` (payload: path).

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest'

import { displayPath, formatRelativeTime, nextSelection, sortProjects } from './projects'

const NOW = Date.UTC(2026, 9, 2, 12, 0, 0)
const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('gives an empty string without a time', () => {
    expect(formatRelativeTime(null, NOW)).toBe('')
  })

  it('gives "just now" under a minute and for a time in the future', () => {
    expect(formatRelativeTime(NOW - 30 * 1000, NOW)).toBe('just now')
    expect(formatRelativeTime(NOW + HOUR, NOW)).toBe('just now')
  })

  it('gives minutes, hours, days', () => {
    expect(formatRelativeTime(NOW - MIN, NOW)).toBe('1 minute ago')
    expect(formatRelativeTime(NOW - 5 * MIN, NOW)).toBe('5 minutes ago')
    expect(formatRelativeTime(NOW - 2 * HOUR, NOW)).toBe('2 hours ago')
    expect(formatRelativeTime(NOW - DAY, NOW)).toBe('yesterday')
    expect(formatRelativeTime(NOW - 3 * DAY, NOW)).toBe('3 days ago')
  })

  it('gives a date after 30 days', () => {
    expect(formatRelativeTime(Date.UTC(2026, 0, 15), NOW)).toMatch(/2026/)
  })
})

describe('displayPath', () => {
  it('replaces the home folder with ~ and shows the parent folder', () => {
    expect(displayPath('/Users/a/projects/news', '/Users/a', '/')).toBe('~/projects')
    expect(displayPath('/Users/a/news', '/Users/a', '/')).toBe('~')
  })

  it('keeps a path outside the home folder', () => {
    expect(displayPath('/tmp/mail/news', '/Users/a', '/')).toBe('/tmp/mail')
  })

  it('does not change a folder that only starts with the same letters', () => {
    expect(displayPath('/Users/ab/x/news', '/Users/a', '/')).toBe('/Users/ab/x')
  })

  it('works with Windows paths', () => {
    expect(displayPath('C:\\Users\\a\\mail\\news', 'C:\\Users\\a', '\\')).toBe('~\\mail')
  })
})

describe('sortProjects', () => {
  const list = [
    { path: '/p/beta', mtime: 2 },
    { path: '/p/Alpha', mtime: 1 },
    { path: '/p/gamma', mtime: null },
  ]

  it('keeps the order for "recent"', () => {
    expect(sortProjects(list, 'recent').map(p => p.path)).toEqual(['/p/beta', '/p/Alpha', '/p/gamma'])
  })

  it('sorts by name without case', () => {
    expect(sortProjects(list, 'name').map(p => p.path)).toEqual(['/p/Alpha', '/p/beta', '/p/gamma'])
  })

  it('sorts by modified time, newest first, unknown times at the end', () => {
    expect(sortProjects(list, 'modified').map(p => p.path)).toEqual(['/p/beta', '/p/Alpha', '/p/gamma'])
  })

  it('does not change the input array', () => {
    sortProjects(list, 'name')
    expect(list[0].path).toBe('/p/beta')
  })
})

describe('nextSelection', () => {
  const ordered = ['a', 'b', 'c', 'd']

  it('selects only the clicked project on a plain click', () => {
    expect(nextSelection({ selected: ['a', 'b'], clicked: 'c', ordered, anchor: 'a' })).toEqual({
      selected: ['c'],
      anchor: 'c',
    })
  })

  it('adds or removes the clicked project with Cmd/Ctrl', () => {
    expect(nextSelection({ selected: ['a'], clicked: 'c', ordered, anchor: 'a', meta: true })).toEqual({
      selected: ['a', 'c'],
      anchor: 'c',
    })
    expect(
      nextSelection({ selected: ['a', 'c'], clicked: 'c', ordered, anchor: 'c', meta: true }),
    ).toEqual({ selected: ['a'], anchor: 'c' })
  })

  it('selects the range from the anchor with Shift', () => {
    expect(nextSelection({ selected: ['b'], clicked: 'd', ordered, anchor: 'b', shift: true })).toEqual({
      selected: ['b', 'c', 'd'],
      anchor: 'b',
    })
    expect(nextSelection({ selected: ['c'], clicked: 'a', ordered, anchor: 'c', shift: true })).toEqual({
      selected: ['a', 'b', 'c'],
      anchor: 'c',
    })
  })

  it('uses the clicked project as the anchor when the anchor is gone', () => {
    expect(nextSelection({ selected: [], clicked: 'b', ordered, anchor: 'x', shift: true })).toEqual({
      selected: ['b'],
      anchor: 'b',
    })
  })
})
```

- [ ] **Step 2: Run it and make sure it fails** — `yarn test src/helpers/projects.test.js`, Expected: FAIL.

- [ ] **Step 3: Write the helpers**

```js
const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'} ago`

export function formatRelativeTime(time, now) {
  if (time === null || time === undefined) return ''
  const diff = now - time
  if (diff < MIN) return 'just now'
  if (diff < HOUR) return plural(Math.floor(diff / MIN), 'minute')
  if (diff < DAY) return plural(Math.floor(diff / HOUR), 'hour')
  if (diff < 2 * DAY) return 'yesterday'
  if (diff < 30 * DAY) return plural(Math.floor(diff / DAY), 'day')
  return new Date(time).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// the parent folder of a project, with ~ for the home folder
export function displayPath(p, homedir, sep) {
  const parent = p.slice(0, p.lastIndexOf(sep)) || sep
  if (parent === homedir) return '~'
  if (parent.startsWith(homedir + sep)) return `~${parent.slice(homedir.length)}`
  return parent
}

function baseName(p) {
  return p.split(/[\\/]/).pop()
}

export function sortProjects(projects, sort) {
  const list = [...projects]
  if (sort === 'name') {
    return list.sort((a, b) =>
      baseName(a.path).localeCompare(baseName(b.path), undefined, { sensitivity: 'base' }),
    )
  }
  if (sort === 'modified') {
    return list.sort((a, b) => (b.mtime ?? -Infinity) - (a.mtime ?? -Infinity))
  }
  return list
}

// the selection after a click, with the Finder rules (Cmd/Ctrl toggles, Shift selects a range)
export function nextSelection({ selected, clicked, ordered, anchor, meta, shift }) {
  if (shift && ordered.includes(anchor)) {
    const [from, to] = [ordered.indexOf(anchor), ordered.indexOf(clicked)].sort((a, b) => a - b)
    return { selected: ordered.slice(from, to + 1), anchor }
  }
  if (meta) {
    const next = selected.includes(clicked)
      ? selected.filter(p => p !== clicked)
      : [...selected, clicked]
    return { selected: next, anchor: clicked }
  }
  return { selected: [clicked], anchor: clicked }
}
```

- [ ] **Step 4: Run it and make sure it passes** — Expected: PASS.

- [ ] **Step 5: `getMtime` and the project data**

`src/preload/fs.js`:

```js
// the last modification time in ms, or null when the file cannot be read
export async function getMtime(p) {
  try {
    return (await fs.stat(p)).mtimeMs
  } catch (err) {
    return null
  }
}
```

Export it from `src/helpers/fs.js`. In `actions/projects.js` `loadProject`, after the index file is found: `res.mtime = await getMtime(indexFilePath)`. If there is no MJML file, `res.mtime = await getMtime(p)`. In `PROJECT_UPDATE_PREVIEW` (reducers/projects.js), also set `mtime` to `Date.now()` (the file changed now).

- [ ] **Step 6: "Last opened" order**

Add `PROJECT_TOUCH` to both reducers:

- `reducers/settings.js`: `PROJECT_TOUCH: (state, { payload: path }) => state.update('projects', projects => projects.includes(path) ? projects.filter(p => p !== path).unshift(path) : projects)`.
- `reducers/projects.js`: `PROJECT_TOUCH: (state, { payload: path }) => { if (!state) return state; const i = state.findIndex(p => p.get('path') === path); return i < 1 ? state : state.delete(i).unshift(state.get(i)) }`.

In `openProject`, after `loadIfNeeded`: `dispatch({ type: 'PROJECT_TOUCH', payload: projectPath })` and `dispatch(saveSettings())`.

The order of `state.projects` is now newest first. `ProjectsList` uses `projects.reverse()` today. Task 13 removes the reverse.

- [ ] **Step 7: Run the checks** — `yarn lint && yarn prettier:check && yarn test && yarn build`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add the project times, the sort and selection helpers and the last opened order"
```

### Task 13: Home page

**Files:**
- Create: `src/pages/Home/EmptyState.jsx`
- Modify: `src/pages/Home/index.jsx`, `src/pages/Home/style.scss`, `src/components/ProjectsList/index.jsx`, `src/components/ProjectsList/ProjectItem.jsx`, `src/components/ProjectsList/style.scss`, `src/components/GlobalSearch/index.jsx`, `src/components/GlobalSearch/style.scss`, `src/components/Preview/style.scss`, `src/components/MassActions/index.jsx`, `src/components/MassActions/style.scss`

**Interfaces:**
- Consumes: Task 12 helpers, `showContextMenu`, `TitleBar`, `useCommands`, `setSelectedProjects` (`reducers/selectedProjects`).

- [ ] **Step 1: Title bar and header**

`pages/Home/index.jsx` render (keep the class component, keep `PageCommands`):

```jsx
<div className="HomePage">
  <TitleBar
    left={<span className="HomePage--app-name">{'MJML'}</span>}
    center={hasProjects && <GlobalSearch />}
    right={
      <>
        <Button variant="ghost" onClick={() => addProject()} data-tooltip={`Open project (${shortcut('CmdOrCtrl+O')})`}>
          {'Open…'}
        </Button>
        <Button ref={n => (this._newProjectBTN = n)} variant="primary" onClick={() => openModal('newProject')}>
          <IconAdd size={16} />
          {'New Project'}
        </Button>
        <Button variant="ghost" icon aria-label="Settings" data-tooltip={`Settings (${shortcut('CmdOrCtrl+,')})`} onClick={() => openModal('settings')}>
          <IconSettings size={16} />
        </Button>
      </>
    }
  />
  {hasProjects ? (
    <div className="HomePage--content">
      <MassActions />
      <ProjectsList />
    </div>
  ) : (
    <EmptyState onNew={() => openModal('newProject')} onOpen={() => addProject()} />
  )}
</div>
```

`MassActions` becomes the header row. Rewrite it without `react-collapse` (keep the three export actions):

```jsx
<div className="HomeHeader">
  {selected.length ? (
    <>
      <span className="HomeHeader--title">{`${selected.length} selected`}</span>
      <Button size="sm" variant="secondary" onClick={this.handleExportToHTML}>{'Export Index to HTML'}</Button>
      <Button size="sm" variant="secondary" onClick={this.handleExportAllToHTML}>{'Export All Files'}</Button>
      <Button size="sm" variant="secondary" disabled={isLoading} onClick={this.handleExportToImages}>
        {isLoading ? 'Exporting…' : 'Export Images'}
      </Button>
      <Button size="sm" variant="ghost" onClick={unselectAllProjects}>{'Clear'}</Button>
    </>
  ) : (
    <>
      <span className="HomeHeader--title">{'Recent projects'}</span>
      <span className="HomeHeader--count">{projectsCount}</span>
    </>
  )}
  <div className="fg-1" />
  <Button size="sm" variant="ghost" onClick={this.handleSortMenu}>
    {`Sort: ${SORT_LABELS[sort]}`}
    <IconDown size={14} />
  </Button>
</div>
```

With `const SORT_LABELS = { recent: 'Last opened', name: 'Name', modified: 'Last modified' }` and:

```js
    handleSortMenu = async () => {
      const { sort, updateSettings } = this.props
      const id = await showContextMenu(
        Object.entries(SORT_LABELS).map(([value, label]) => ({ id: value, label, checked: value === sort })),
      )
      if (id) updateSettings(s => s.setIn(['layout', 'projectSort'], id))
    }
```

Read `sort` from `state.settings.getIn(['layout', 'projectSort'], 'recent')`. Remove `react-collapse` from this file only (other files can still use it, check with `grep -rn react-collapse src`).

- [ ] **Step 2: The cards**

`ProjectsList/index.jsx`:

1. Remove `.reverse()`. Build the visible list: filter by search (as today), convert to `[{ path, mtime, html }]` with `p.toJS()`, then `sortProjects(list, sort)`.
2. Keep an `anchor` in the component state. On a card click: `const { selected, anchor } = nextSelection({ selected: this.props.selectedProjects, clicked: path, ordered: visiblePaths, anchor: this.state.anchor, meta: e.metaKey || e.ctrlKey, shift: e.shiftKey })`, then `this.props.setSelectedProjects(selected)` and `this.setState({ anchor })`.
3. A click on the empty grid area (`e.target === e.currentTarget`) calls `unselectAllProjects()`.
4. Double click and Enter open the project.
5. Context menu on a card (select the card first if it is not selected):

```js
      const id = await showContextMenu([
        { id: 'open', label: 'Open' },
        { id: 'reveal', label: api.platform === 'darwin' ? 'Reveal in Finder' : 'Show in File Manager' },
        { type: 'separator' },
        { id: 'rename', label: 'Rename…' },
        { id: 'duplicate', label: 'Duplicate' },
        { type: 'separator' },
        { id: 'remove', label: 'Remove from List…' },
      ])
```

   `open` → `openProject(path)`, `reveal` → `api.shell.showItemInFolder(path)`, `rename` → open the rename modal (the existing `handleEditProjectName` logic without the event), `duplicate` → `duplicateProject(path)`, `remove` → open the delete modal (the existing logic).
6. "No projects matched" message: `<div className="ProjectsList--no-match">{`No projects match “${text}”`}</div>`.

`ProjectItem.jsx` (function component):

```jsx
export default function ProjectItem({ project, isSelected, onClick, onOpen, onContextMenu }) {
  const name = path.basename(project.path)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      className={cx('ProjectCard', { isSelected })}
      onClick={onClick}
      onDoubleClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      onContextMenu={onContextMenu}
    >
      <div className="ProjectCard--thumb">
        <Preview scaled html={project.html || null} iframeBase={project.path} />
      </div>
      <div className="ProjectCard--name" title={name}>{name}</div>
      <div className="ProjectCard--meta">
        <span className="ellipsis">{displayPath(project.path, api.homedir, path.sep)}</span>
        {project.mtime && <span className="fs-0">{` · ${formatRelativeTime(project.mtime, Date.now())}`}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Styles**

`pages/Home/style.scss` (replace the content):

```scss
.HomePage {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-window);
}

.HomePage--app-name {
  font-weight: 600;
  color: var(--fg);
}

.HomePage--content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.HomeEmpty {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  text-align: center;
  color: var(--fg-muted);

  h1 {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--fg);
  }
}

.HomeEmpty--actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.HomeEmpty--hint {
  font-size: var(--text-sm);
  color: var(--fg-subtle);
}
```

`MassActions/style.scss` (replace):

```scss
.HomeHeader {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 44px;
  padding: 0 var(--space-6);
}

.HomeHeader--title {
  font-weight: 600;
  color: var(--fg);
}

.HomeHeader--count {
  padding: 0 6px;
  border-radius: 10px;
  background: var(--bg-hover);
  color: var(--fg-muted);
  font-size: var(--text-xs);
}
```

`ProjectsList/style.scss` (replace):

```scss
.ProjectsList {
  flex-grow: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, 220px);
  justify-content: start;
  align-content: start;
  gap: var(--space-6) var(--space-5);
  padding: var(--space-1) var(--space-6) var(--space-8);
}

.ProjectCard {
  min-width: 0;
  padding: var(--space-2);
  border-radius: var(--radius-lg);

  &:hover .ProjectCard--thumb {
    border-color: var(--border-strong);
  }

  &.isSelected {
    background: var(--bg-selected);
    .ProjectCard--thumb {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
  }
}

.ProjectCard--thumb {
  position: relative;
  height: 250px;
  overflow: hidden;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-canvas);
}

.ProjectCard--name {
  margin-top: var(--space-2);
  font-weight: 500;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ProjectCard--meta {
  display: flex;
  min-width: 0;
  font-size: var(--text-xs);
  color: var(--fg-subtle);
}

.ProjectsList--no-match {
  grid-column: 1 / -1;
  color: var(--fg-muted);
}
```

The card thumbnail is 204 px wide (220 − 2 × 8 px padding), so `Preview/style.scss` `.scaled > iframe` uses `width: 650px; height: 800px; transform: scale(0.3138)` (204 / 650). Keep `transform-origin: top left`. The empty preview icon uses `--fg-subtle`.

`GlobalSearch`: a 240 px wide search field: `height: 28px`, `border-radius: var(--radius-md)`, `background: var(--bg-hover)`, `border: 1px solid transparent`, focus `--bg-input` with the accent border and ring, `padding-left: 28px`, placeholder `'Search projects'`, the icon 14 px in `--fg-subtle`, 9 px from the left. Add `type="search"`. Esc in the field clears it: `onKeyDown={e => e.key === 'Escape' && this.handleChange({ target: { value: '' } })}`.

- [ ] **Step 4: Empty state**

`pages/Home/EmptyState.jsx`:

```jsx
import Button from 'components/Button'

export default function EmptyState({ onNew, onOpen }) {
  return (
    <div className="HomeEmpty">
      <h1>{'Create your first email'}</h1>
      <p>{'Start from a template or open a folder with MJML files.'}</p>
      <div className="HomeEmpty--actions">
        <Button variant="primary" size="lg" onClick={onNew}>
          {'New Project'}
        </Button>
        <Button variant="secondary" size="lg" onClick={onOpen}>
          {'Open Project…'}
        </Button>
      </div>
      <p className="HomeEmpty--hint">{'Or drop an .mjml file or a folder here'}</p>
    </div>
  )
}
```

Keep the focus behavior of `componentDidMount` (the New Project button gets the focus when there are no projects): give the ref to the empty state button through a prop `newButtonRef`.

- [ ] **Step 5: Run the checks and look at the result**

Run: `yarn lint && yarn prettier:check && yarn test && yarn build`. Take `home-dark.png` at 1280×800 and 960×600. For the empty state, start the app with an empty settings folder: `ELECTRON_USER_DATA` is not used by the app, so use a temporary copy: back up `~/Library/Application Support/MJML/storage/settings.json` to the scratchpad, remove the `projects` entries with a script, take the screenshot, then restore the backup. Expected: the empty state shows, and after the restore the old projects show again.

In the running app: a click selects a card, Cmd+click selects two, the header shows "2 selected" and the export buttons, Esc in the search clears it, right click shows the native menu, a double click opens the project.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Redesign the home page with project cards, sort, selection and an empty state"
```

## Phase 5: Dialogs, settings and notifications

### Task 14: Dialog look and behavior

**Files:**
- Modify: `src/components/Modal/index.jsx`, `src/components/Modal/style.scss`, `src/components/Modal/ConfirmModal.jsx`, and each dialog that needs a fix after the restyle: `src/components/NewProjectModal/index.jsx`, `src/components/NewProjectModal/style.scss`, `src/components/NewProjectModal/TemplateChooser.jsx`, `src/components/ErrorModal/index.jsx`, `src/components/ErrorModal/style.scss`, `src/components/AboutModal.jsx`, `src/pages/Project/*Modal.jsx`, `src/pages/Project/PreviewSettings.jsx`, `src/components/ProjectsList/RenameModal.jsx`

**Interfaces:**
- Produces: `<Modal size="sm|md|lg" title>`. When `title` is set, the Modal renders the header. The `.Modal--label` class (used in the existing dialogs) becomes the header style, so the dialogs that use it work without a change.

- [ ] **Step 1: Modal behavior**

In `Modal/index.jsx`:

```jsx
export default function Modal({ isOpened, onClose, children, className, style, noUI, size = 'md', title }) {
  const { isMounted, isVisible } = useTransition(isOpened, 200)
  const bodyRef = useRef(null)
  const openerRef = useRef(null)

  // keep the element that had the focus, and give it back on close
  useEffect(() => {
    if (!isOpened) return
    openerRef.current = document.activeElement
    return () => {
      const opener = openerRef.current
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [isOpened])

  useEffect(() => {
    if (isOpened && isMounted && bodyRef.current) {
      const first = bodyRef.current.querySelector('[autofocus], input, textarea, select')
      ;(first || bodyRef.current).focus()
    }
  }, [isOpened, isMounted])

  useEffect(() => {
    if (!isOpened) return
    const handleKeyDown = e => {
      const body = bodyRef.current
      if (e.key === 'Escape' && onClose) {
        onClose()
        return
      }
      if (!body) return
      if (e.key === 'Tab') {
        const focusable = [
          ...body.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])'),
        ].filter(n => n.offsetParent !== null)
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
      // Enter does the primary action, except in a text area, on a button or in a form
      if (e.key === 'Enter' && !e.defaultPrevented) {
        const t = e.target
        if (t.closest('textarea, button, form, .cm-editor, .Select__control')) return
        const primary = body.querySelector('.ModalFooter .Button--primary:not(:disabled)')
        if (primary) {
          e.preventDefault()
          primary.click()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpened, onClose])

  if (!isMounted) return null

  return createPortal(
    <div className={cx('Modal', `Modal--${size}`, { withUI: !noUI, isVisible })}>
      <div className="Modal--overlay" onClick={onClose} />
      <div className="Modal-box">
        <div
          tabIndex={-1}
          ref={bodyRef}
          role="dialog"
          aria-modal="true"
          className={cx('Modal--body', className)}
          style={style}
        >
          {title && <div className="Modal--label">{title}</div>}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

Note: `useTransition(isOpened, 200)` changes the exit time from 300 to 200 ms to match `--duration-normal`.

- [ ] **Step 2: Modal styles**

Rewrite `Modal/style.scss`:

```scss
.Modal {
  z-index: 1000;
  position: fixed;
  inset: 0;
  overflow-y: auto;
  pointer-events: none;
  display: flex;
  align-items: flex-start;
  justify-content: center;

  &.isVisible {
    pointer-events: auto;
  }
}

.Modal--sm {
  --dialog-width: 420px;
}
.Modal--md {
  --dialog-width: 560px;
}
.Modal--lg {
  --dialog-width: 760px;
}

.Modal.withUI > .Modal-box > .Modal--body {
  margin: max(10vh, 60px) 0 var(--space-8);
  width: var(--dialog-width);
  max-width: calc(100vw - 48px);
  padding: 0 var(--space-5) var(--space-5);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-dialog);
}

.Modal--overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);

  .Modal.isVisible & {
    opacity: 1;
  }
}

.Modal-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.Modal--body {
  position: relative;
  z-index: 1;
  outline: none;
  opacity: 0;
  transform: scale(0.98);
  transition:
    opacity var(--duration-normal) var(--ease-out),
    transform var(--duration-normal) var(--ease-out);

  .Modal.isVisible & {
    opacity: 1;
    transform: none;
  }
}

// the header of a dialog
.Modal--label {
  margin: 0 calc(-1 * var(--space-5)) var(--space-4);
  padding: var(--space-4) var(--space-5) 0;
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--fg);
}

// the buttons of a dialog: the primary button is the first in the DOM and shows on the right
.ModalFooter {
  display: flex;
  flex-direction: row-reverse;
  justify-content: flex-start;
  gap: var(--space-2);
  margin: var(--space-5) calc(-1 * var(--space-5)) calc(-1 * var(--space-5));
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--separator);
}
```

Remove `@use '../../styles/utils.scss'` and the `@extend` rules.

- [ ] **Step 3: ConfirmModal**

Use `size="sm"` by default, `variant="primary"` for the confirm button and `variant="secondary"` for the cancel button. Add a `danger` prop: when set, the confirm button uses `variant="danger"`. Use `danger` in `ProjectsList` when `shouldDeleteFolder` is true and in `RemoveFileModal`.

- [ ] **Step 4: Go through each dialog**

For each file in the list above, open the dialog in the running app and fix what breaks. The rules:

- Cancel buttons use `variant="secondary"`, the main action `variant="primary"`, a destructive action `variant="danger"`.
- Remove local colors (`c-white`, `rgba(white, …)`, `vars.*`) and use tokens.
- `NewProjectModal`: the `Modal--label` header shows "New Project". `TemplateChooserTabs` becomes a `SegmentedControl` or keeps its tabs with tokens (`border-bottom: 2px solid var(--accent)` for the active tab, `--fg-muted` for the others, no negative margin). The gallery items: `--radius-md`, `1px solid var(--border)`, selected `2px solid var(--accent)`, no opacity change.
- `ErrorModal`: `size="md"`, the header "Something went wrong", the error text in a `<pre>` with `--font-mono`, `--text-sm`, `--bg-input`, `--radius-md`, `user-select: text`.
- `AboutModal`: `size="sm"`, centered content.
- `SettingsModal` is Task 15. `PreviewSettings` (templating) uses `size="lg"`.
- Dialogs with a long progress (`FigmaImportModal`, `RefineModal`) keep their `onClose` guard.

Command to find the left-over colors: `grep -rn -E "c-white|rgba\(white|vars\.\\$" src/components/NewProjectModal src/components/ErrorModal src/components/AboutModal.jsx src/pages/Project src/components/ProjectsList`.
Expected at the end: no output.

- [ ] **Step 5: Run the checks and look at each dialog**

Run: `yarn lint && yarn prettier:check && yarn build`. Take a screenshot of the New Project, Add File, Remove File, Send and Templating dialogs (open them with `window.api` and the page buttons in the screenshot script, see "Visual check"). Expected: rounded dialogs with a header, the buttons on the right, Enter in the "Create MJML file" name field creates the file, Tab stays in the dialog, Esc closes it and the focus goes back to the opener.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Give all dialogs one look, a focus trap and Enter for the primary action"
```

### Task 15: Settings dialog and the Appearance section

**Files:**
- Create: `src/components/SettingsModal/SettingRow.jsx`
- Modify: `src/components/SettingsModal/index.jsx`, `src/components/SettingsModal/style.scss`, `src/components/TabsVertical/index.jsx`, `src/components/TabsVertical/style.scss`, `src/components/SettingsModal/AIFigmaSettings.jsx`, `src/components/MJMLEngine.jsx`, `src/components/MjmlConfigPath.jsx`, `src/components/MailjetInfos.jsx`, `src/components/SnippetForm/index.jsx`, `src/components/SnippetsList/*`, `src/components/SnippetImports/index.jsx`

**Interfaces:**
- Consumes: `SegmentedControl`, `settings.appearance.theme`, `settings.editor.fontSize`.
- Produces: `<SettingRow label help>{control}</SettingRow>`.

- [ ] **Step 1: `SettingRow`**

```jsx
export default function SettingRow({ label, help, children }) {
  return (
    <div className="SettingRow">
      <div className="SettingRow--text">
        <div className="SettingRow--label">{label}</div>
        {help && <div className="SettingRow--help">{help}</div>}
      </div>
      <div className="SettingRow--control">{children}</div>
    </div>
  )
}
```

Styles (`SettingsModal/style.scss`, replace the content):

```scss
.SettingsModal {
  height: 560px;
  max-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
}

.SettingRow {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--separator);

  &:last-child {
    border-bottom: none;
  }
}

.SettingRow--text {
  flex: 1;
  min-width: 0;
}

.SettingRow--label {
  color: var(--fg);
}

.SettingRow--help {
  margin-top: 2px;
  font-size: var(--text-xs);
  color: var(--fg-subtle);
}

.SettingRow--control {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.SettingsSection--title {
  margin-bottom: var(--space-2);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--fg);
}

.Snippets {
  overflow: hidden;
}
```

- [ ] **Step 2: The sections list**

`TabsVertical/style.scss`: the list is 180 px wide, `padding: var(--space-2)`, `border-right: 1px solid var(--separator)`, `background: var(--bg-sidebar)`, full height. A tab: `height: 28px`, `gap: var(--space-2)`, `padding: 0 var(--space-2)`, `border-radius: var(--radius-md)`, hover `--bg-hover`, `.isActive` `--bg-selected` and `--fg`, the icon in `--fg-muted` (in `--accent` when active). The view: `flex: 1`, `overflow-y: auto`, `padding: var(--space-4) var(--space-5)`. The root: `display: flex`, `height: 100%`, `min-height: 0`.

`TabsVertical/index.jsx`: tabs become `<button type="button" role="tab" aria-selected>` elements. Up and Down keys move between them.

- [ ] **Step 3: Rebuild the settings dialog**

In `SettingsModal/index.jsx`:

1. `<Modal size="lg" title="Settings" isOpened onClose className="SettingsModal">` (remove `noUI` and the close button row). The dialog body has no side padding for the sections: wrap `TabsVertical` in `<div className="fg-1 r" style={{ margin: '0 calc(-1 * var(--space-5)) calc(-1 * var(--space-5))', borderTop: '1px solid var(--separator)' }}>`. Put this style in `style.scss` as `.SettingsModal--sections`, not inline.
2. Add the first section:

```jsx
<TabItem title="Appearance" icon={IconAppearance}>
  <div className="SettingsSection--title">{'Appearance'}</div>
  <SettingRow label="Theme" help="System follows the appearance of your computer.">
    <SegmentedControl
      value={theme}
      onChange={v => this.props.updateSettings(s => s.setIn(['appearance', 'theme'], v))}
      options={[
        { value: 'system', label: 'System' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]}
    />
  </SettingRow>
  <SettingRow label="Editor font size">
    <select value={fontSize} onChange={e => this.changeEditorSetting('fontSize')(Number(e.target.value))}>
      {[12, 13, 14, 15, 16, 18].map(size => (
        <option key={size} value={size}>{`${size} px`}</option>
      ))}
    </select>
  </SettingRow>
</TabItem>
```

   `IconAppearance` is `MdPalette` from `react-icons/md`. `theme = settings.getIn(['appearance', 'theme'], 'system')`, `fontSize = settings.getIn(['editor', 'fontSize'], 13)`.
3. Remove the "Use high-contrast theme" check box and the font size dropdown from the Editor section.
4. Move each section to rows. Each check box becomes a `SettingRow` with the label on the left and a `CheckBox` without text on the right (or keep the check box with the text when the row has no help text). The number inputs (fold level, tab size, indent size, preview sizes) go to the `SettingRow` control with `style={{ width: 72 }}`. Add help text where the spec gives a reason: "Warn for relative paths on HTML export" → help "Email clients do not load relative paths like /image.jpg." (remove the hover tooltip).
5. `AIFigmaSettings`, `MJMLEngine`, `MjmlConfigPath`, `MailjetInfos`, `SnippetForm`, `SnippetsList`, `SnippetImports`: remove local colors and move to tokens. Use `SettingRow` where a component has a label and one control.

Left-over colors: `grep -rn -E "c-white|rgba\(white|vars\.\\$|#[0-9a-fA-F]{3,6}" src/components/SettingsModal src/components/MJMLEngine.jsx src/components/MjmlConfigPath.jsx src/components/MailjetInfos.jsx src/components/Snippet*`. Expected: no output (except the Mailjet logo in `components/icons`).

- [ ] **Step 4: Run the checks and look at each section**

Run: `yarn lint && yarn prettier:check && yarn build`. Take a screenshot of each section in dark and light. Expected: a 760 px dialog with the sections list on the left, Theme → Light changes the app at once, the font size changes the editor.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Rebuild the settings dialog with sections, rows and an Appearance section"
```

### Task 16: Toasts

**Files:**
- Modify: `src/components/Alerts/index.jsx`, `src/components/Alerts/style.scss`, `src/reducers/alerts.js`

**Interfaces:**
- Consumes: `addAlert(message, type, { autoHide })` (existing API, no change for the callers).

- [ ] **Step 1: Reducer**

In `reducers/alerts.js`: keep at most three alerts (`.slice(0, 3)`) and hide after 4 s (`4e3`).

- [ ] **Step 2: Component**

```jsx
const ICONS = { success: IconSuccess, error: IconError, info: IconInfo }

function Alerts({ alerts, removeAlert }) {
  return createPortal(
    <div className="Alerts" role="status" aria-live="polite">
      {alerts.map(a => {
        const Icon = ICONS[a.type] || IconInfo
        return (
          <div key={a.id} className={cx('Alerts--item', a.type)}>
            <Icon className="Alerts--icon" size={16} />
            <div className="Alerts--message us-t">
              {Array.isArray(a.message) ? a.message.map((line, i) => <div key={i}>{line}</div>) : a.message}
            </div>
            <button type="button" className="Alerts--close" aria-label="Close" onClick={() => removeAlert(a.id)}>
              <IconClose size={14} />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
```

Icons: `MdCheckCircle as IconSuccess`, `MdError as IconError`, `MdInfo as IconInfo`, `MdClose as IconClose`.

- [ ] **Step 3: Styles**

```scss
.Alerts {
  position: fixed;
  right: var(--space-3);
  bottom: calc(var(--statusbar-height) + var(--space-3));
  z-index: 99999;
  width: 360px;
  max-width: calc(100vw - 24px);
  display: flex;
  flex-direction: column-reverse;
  gap: var(--space-2);
  pointer-events: none;
}

.Alerts--item {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-popover);
  color: var(--fg);
  font-size: var(--text-md);
  animation: alertEnter var(--duration-normal) var(--ease-out);

  &.success .Alerts--icon {
    color: var(--success);
  }

  &.error {
    border-color: var(--danger);
    .Alerts--icon {
      color: var(--danger);
    }
  }

  &.info .Alerts--icon {
    color: var(--accent);
  }
}

.Alerts--icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.Alerts--message {
  flex: 1;
  min-width: 0;
  max-height: 240px;
  overflow-y: auto;
  word-break: break-word;
}

.Alerts--close {
  flex-shrink: 0;
  display: flex;
  padding: 2px;
  border-radius: var(--radius-sm);
  color: var(--fg-subtle);

  &:hover {
    background: var(--bg-hover);
    color: var(--fg);
  }
}

@keyframes alertEnter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
```

- [ ] **Step 4: Run the checks and look at the result**

Run: `yarn lint && yarn prettier:check && yarn build`. In the project page, use Copy HTML: a toast "Copied!" shows at the bottom right, above the status bar, and goes away after 4 s. Export with "Warn for relative paths" on and a relative `src`: the error toast stays until the close button.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Show the alerts as toasts"
```

## Phase 6: Editor theme and polish

### Task 17: CodeMirror themes

**Files:**
- Modify: `src/helpers/codemirror/theme.js`, `src/components/FileEditor/index.jsx`, `src/components/FileEditor/styles.scss`, `src/pages/Project/PreviewSettings.jsx`

**Interfaces:**
- Consumes: `state.theme` (Task 1), `settings.editor.fontSize`.
- Produces: `editorTheme(isDark: boolean, fontSize: number) → Extension[]`.

- [ ] **Step 1: The themes**

Rewrite `helpers/codemirror/theme.js`:

```js
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

// The editor colors use the app tokens (src/styles/tokens.scss), so the
// editor changes with the app theme.
const baseTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--bg-panel)', color: 'var(--fg)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.55' },
  '.cm-content': { caretColor: 'var(--accent)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--bg-selected) !important',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-panel)',
    color: 'var(--fg-subtle)',
    border: 'none',
  },
  '.cm-activeLine': { backgroundColor: 'var(--bg-hover)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--fg)' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    color: 'var(--fg-muted)',
  },
  '.cm-matchingTag': { borderBottom: '1px solid var(--accent)' },
  '.cm-searchMatch': { backgroundColor: 'var(--warning-bg)', outline: '1px solid var(--warning)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--bg-selected)' },
  '.cm-panels': {
    backgroundColor: 'var(--bg-window)',
    color: 'var(--fg)',
    borderColor: 'var(--separator)',
  },
  '.cm-panel input, .cm-panel button': { fontSize: 'var(--text-sm)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-popover)',
    color: 'var(--fg)',
  },
  '.cm-tooltip-autocomplete > ul > li': { padding: '2px 8px' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--bg-selected)',
    color: 'var(--fg)',
  },
  '.cm-tooltip.cm-tooltip-lint': { padding: '6px' },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--danger)' },
  '.cm-lint-marker-error': { content: 'none' },
})

const darkHighlight = HighlightStyle.define([
  { tag: [t.tagName, t.angleBracket], color: '#e06c75' },
  { tag: t.attributeName, color: '#d19a66' },
  { tag: [t.attributeValue, t.string], color: '#98c379' },
  { tag: t.comment, color: '#7f848e', fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.documentMeta], color: '#c678dd' },
  { tag: t.content, color: '#e6e6ea' },
])

const lightHighlight = HighlightStyle.define([
  { tag: [t.tagName, t.angleBracket], color: '#22863a' },
  { tag: t.attributeName, color: '#6f42c1' },
  { tag: [t.attributeValue, t.string], color: '#032f62' },
  { tag: t.comment, color: '#6a737d', fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.documentMeta], color: '#d73a49' },
  { tag: t.content, color: '#1d1d1f' },
])

export function editorTheme(isDark, fontSize = 13) {
  return [
    baseTheme,
    EditorView.theme({ '.cm-content, .cm-gutters': { fontSize: `${fontSize}px` } }),
    EditorView.theme({}, { dark: isDark }),
    syntaxHighlighting(isDark ? darkHighlight : lightHighlight),
  ]
}
```

Add the package that gives `tags`: `yarn add -D @lezer/highlight@^1.2.5`. It is already in `node_modules`, so the lock file only gets the direct entry. Check with `git diff package.json yarn.lock` that no other package changes.

Remove the `.cm-lint-marker-error` line if the lint gutter icon disappears (it is a check, not a requirement: the gutter must show a red marker on an error line).

- [ ] **Step 2: Use the theme in the editors**

`FileEditor`: in `connect`, replace `lightTheme` with `isDark: state.theme === 'dark'` and make `fontSize` default to `13`. In `getConfigurableExtensions`, `theme: editorTheme(isDark, fontSize)`. In `componentDidUpdate`, reconfigure when `isDark` or `fontSize` changes (replace `lightTheme`). Remove the `fontSize-*` class from `render()` and the `@each` block and the color rules from `FileEditor/styles.scss` (keep the layout rules, use `--bg-panel` for the loader).

`PreviewSettings.jsx`: replace `editorTheme(lightTheme)` with `editorTheme(isDark)` and read `isDark` the same way.

Check: `grep -rn "lightTheme" src` gives no output.

- [ ] **Step 3: Run the checks and look at the result**

Run: `yarn lint && yarn prettier:check && yarn build`. Take `project-dark.png` and `project-light.png`. Expected: the editor background is the panel color, the tags, attributes and values have different colors, and a lint error line has a red marker. Change the theme while the project is open: the editor changes at once and the undo history stays.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Build the editor themes from the app tokens"
```

### Task 18: Last token sweep, review and documentation

**Files:**
- Modify: every `.scss` file that still uses `vars.*`, `rgba(white …)` or a fixed color; `src/styles/vars.scss` (delete if no file uses it); `CLAUDE.md`

- [ ] **Step 1: Find the left-over colors**

Run:

```bash
grep -rn -E "vars\.|\\\$(bg|blue|red|green|grey|yellow|almostWhite|lighterGrey|evenLighterGrey)|rgba\((white|black)|c-white" src --include='*.scss' --include='*.jsx'
```

Move each match to a token. Files that the earlier tasks did not touch (`ExternalFileOverlay`, `SnippetsList`, `components/icons` excluded) get the same treatment. When the command gives no output, delete `src/styles/vars.scss` and remove its `@use` lines.

- [ ] **Step 2: Full visual check**

Use the screenshot script ("Visual check" below). Take these screenshots in dark and light, at 960×600 and 1440×900 (16 images):

1. Home with projects.
2. Project with `index.mjml` open.
3. Settings, Appearance section.
4. New Project dialog.

Read each image. Check:
- No text or control overflows its box. Long names have an ellipsis.
- No dark color on the light theme and no light color on the dark theme (search for left-over fixed colors).
- The title bar has room for the traffic lights.

Fix each problem and take the screenshot again.

- [ ] **Step 3: The live theme check (Review Focus 2)**

With the theme setting on System, run in the terminal:

```bash
osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to not dark mode'
```

Expected: the app, the editor, the menus and the traffic light area change without a restart. Run the command again to go back to the old appearance.

- [ ] **Step 4: Update `CLAUDE.md`**

Add to the Architecture section, in the same style as the other points:

- **Theme**: `settings.appearance.theme` (`system`, `light`, `dark`). `components/Application/useAppTheme.js` sets `data-theme` on `<html>` and calls `theme:set`, so the main process sets `nativeTheme.themeSource`. All colors are CSS custom properties in `src/styles/tokens.scss`. Do not use fixed colors in components.
- **Window**: hidden title bar (`hiddenInset` with vibrancy on macOS, `titleBarOverlay` on Windows and Linux). Each page puts its controls in `components/TitleBar`.
- **Menu and commands**: `src/main/menu.js` builds the menu from the page context (`menu:setContext`). Each item sends a command name on `redux-command`. The pages register the handlers with `useCommands` (`helpers/commands.js`). Context menus use `showContextMenu` (`helpers/contextMenu.js`, IPC `menu:popup`).
- **Status bar**: `state.editorStatus` (cursor, dirty, render time).

Change "The repository has no unit tests." to say that `yarn test` (vitest) runs the tests in `src/**/*.test.js`. Add `yarn test` to the commands list and to the CI sentence (`.github/workflows/ci.yml` runs `yarn test`).

- [ ] **Step 5: Run all the checks**

Run: `yarn lint && yarn prettier:check && yarn test && yarn build && yarn dist:dir`
Expected: all pass. `yarn dist:dir` makes the unpacked app in `release/`. Start it once and check that the window opens with the new title bar.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Move the last styles to tokens and document the theme, window and commands"
```

---

## Visual check

The script `scratchpad/shot.mjs` (copy it into the scratchpad of the session if it is missing) connects to the app with the Chrome DevTools Protocol and saves a screenshot.

1. Build and start the app with a debugging port:

```bash
yarn build && (npx electron . --remote-debugging-port=9333 > "$SCRATCH/app.log" 2>&1 &)
```

2. Take a screenshot (the script sets the viewport, edit the `width` and `height` in it for 960×600 or 1440×900):

```bash
node "$SCRATCH/shot.mjs" "$SCRATCH/home-dark.png" "1"
```

3. Run JavaScript before the screenshot with the second argument, for example to open a project or a dialog:

```bash
node "$SCRATCH/shot.mjs" "$SCRATCH/project-dark.png" "(async()=>{document.querySelector('.ProjectCard').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));await new Promise(r=>setTimeout(r,2500));return location.hash})()"
```

4. Change the theme for a light screenshot: `document.documentElement.dataset.theme='light'` (this changes only the CSS, use View → Theme in the app for the full check).

5. Stop the app: `pkill -f "remote-debugging-port=9333"`.

The development build opens the DevTools in the window. The script overrides the viewport size, so the screenshot shows the page without the DevTools.

The script source:

```js
// usage: node shot.mjs out.png [jsToEvalBefore]  ("-" as out.png: no screenshot)
import { writeFileSync } from 'node:fs'

const [, , out, js] = process.argv
let targets
for (let i = 0; i < 30; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9333/json')).json()
    if (targets.some(t => t.type === 'page' && !t.url.startsWith('devtools'))) break
  } catch {}
  await new Promise(r => setTimeout(r, 1000))
}
const page = targets.find(t => t.type === 'page' && !t.url.startsWith('devtools'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise(r => (ws.onopen = r))
let id = 0
const pending = new Map()
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (pending.has(m.id)) pending.get(m.id)(m)
}
const send = (method, params = {}) =>
  new Promise(r => {
    const i = ++id
    pending.set(i, r)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
if (js) {
  const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true })
  console.log(JSON.stringify(r.result?.result?.value ?? r.result))
  await new Promise(r => setTimeout(r, 1500))
}
if (out !== '-') {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(out, Buffer.from(r.result.data, 'base64'))
  console.log('saved', out)
}
ws.close()
```
