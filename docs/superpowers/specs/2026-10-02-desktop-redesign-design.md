# Desktop redesign

Date: 2026-10-02
Branch: `feat/desktop-redesign`

## Goal

Make MJML App look and behave like a desktop application, not like a web page in a window. The user gave the design decisions to Claude. The user chose these three points:

- Scope: a full redesign (tokens, window, project screen, home screen, dialogs).
- Theme: light and dark. The default follows the system. The user can select System, Light or Dark.
- Platform: macOS first. Windows and Linux get the same layout with their native window buttons.

## Problems in the current app

These come from screenshots of the running app (1280×800 and 800×568).

1. The window uses the standard title bar. The content does not use the title bar area. The default size is 800×600 and there is no minimum size. At 800 px the project toolbar overflows.
2. The project toolbar has more than ten text buttons in one row. File, AI, export and settings actions are mixed. There is no status bar, so the save state, the MJML errors and the engine are not visible.
3. The home screen has a full-width search field and cards with a name only. There is no date, no sort and no useful empty state.
4. The dialogs look like web forms: an uppercase tab label, sharp corners, 40 px controls.
5. Colors are fixed Sass variables. There is no light theme. The `Lato` font is not bundled, so a random fallback font shows. Spacing and corner radius values are different in each file.
6. The Edit menu has no Undo and Redo items. There are no shortcuts for Save, Settings, Export or New file. There are no context menus.

## Design principles

- Use native conventions: system font, 13 px base size, 28 px controls, default cursor on controls, `:focus-visible` rings only, no text selection outside the editor and inputs.
- Put each command in one clear place and give it a menu item and a shortcut.
- Show state, do not hide it: the save state, the validation errors and the engine are always visible.
- Keep the email preview white. The app chrome changes with the theme, the email does not.

## 1. Foundation (tokens and theme)

**New file `src/styles/tokens.scss`.** It defines CSS custom properties on `:root[data-theme='light']` and `:root[data-theme='dark']`:

| Group | Tokens |
|---|---|
| Surfaces | `--bg-window`, `--bg-sidebar`, `--bg-panel`, `--bg-elevated` (dialogs, popovers), `--bg-input`, `--bg-hover`, `--bg-selected`, `--bg-canvas` (behind the preview) |
| Text | `--fg`, `--fg-muted`, `--fg-subtle`, `--fg-on-accent` |
| Lines | `--border`, `--border-strong`, `--separator` |
| Accent | `--accent` (MJML blue `#3470df` in light, `#4c8dff` in dark), `--accent-hover`, `--focus-ring` |
| Status | `--danger`, `--warning`, `--success`, each with a `-bg` variant |
| Shape | `--radius-sm` 4px, `--radius-md` 6px, `--radius-lg` 10px |
| Space | 4 px grid: `--space-1` 4px to `--space-8` 32px |
| Type | `--font-ui` (`-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`), `--font-mono` (`ui-monospace, 'SF Mono', Menlo, Consolas, monospace`), `--text-xs` 11px, `--text-sm` 12px, `--text-md` 13px, `--text-lg` 15px, `--text-xl` 20px |
| Motion | `--ease-out`, `--duration-fast` 120ms, `--duration-normal` 200ms. `prefers-reduced-motion` sets the durations to 0. |
| Sizes | `--titlebar-height` 44px, `--statusbar-height` 24px, `--control-height` 28px |

`vars.scss` stays for the Sass color functions that still use it. New and changed styles use the tokens only.

**Theme setting.** A new settings key `appearance.theme` with the values `system` (default), `light` and `dark`.

- The renderer resolves the effective theme (`system` uses `matchMedia('(prefers-color-scheme: dark)')`) and sets `data-theme` on `<html>`. A small pure helper `resolveTheme(setting, systemIsDark)` does the resolution.
- The renderer sends the setting to the main process with a new IPC call `theme:set`. The main process sets `nativeTheme.themeSource`. This makes the native menus, scroll bars, dialogs and the macOS window match. On Windows and Linux the main process also updates the `titleBarOverlay` colors.
- The main process reads the stored setting before it creates the window, so the first frame has the correct background color (no white or dark flash).
- The old `editor.lightTheme` setting ("high-contrast theme") is removed. The editor follows the app theme.

**Base styles (`global.scss`).** Use the tokens and the system font. Remove `Lato`. Use `outline` only on `:focus-visible`. Keep `user-select: none` on the chrome and allow selection in the editor, inputs and text areas. Thin overlay scroll bars that use the theme colors.

## 2. Window shell

**`BrowserWindow` options (`src/main/index.js`).**

- Default size 1280×800, `minWidth` 960, `minHeight` 600.
- macOS: `titleBarStyle: 'hiddenInset'`, `trafficLightPosition: { x: 16, y: 14 }`, `vibrancy: 'sidebar'`, `visualEffectState: 'followWindow'`. The panels paint their own opaque background. Only the sidebars show the vibrancy.
- Windows and Linux: `titleBarStyle: 'hidden'` with `titleBarOverlay: { height: 44, color, symbolColor }`. The colors come from the theme.
- `backgroundColor` comes from the resolved theme.

**Window state (`window-settings.js`).** Save the bounds and `isMaximized`. On start, use the saved bounds only when they are inside a connected display (`screen.getDisplayMatching`). Otherwise center the default size. A pure helper `fitBounds(saved, displays, defaults)` does this check and gets unit tests.

**`TitleBar` component (`components/TitleBar`).** A 44 px bar at the top of each page. It is a drag region (`-webkit-app-region: drag`). Each control in it is `no-drag`. On macOS it reserves 78 px on the left for the traffic lights (no reserve in full screen, the main process sends `window:fullscreen` events). On Windows and Linux it reserves the overlay width on the right. A double click on an empty part does the platform zoom action (the native drag region does this already). Each page gives its own content to the bar.

**Menu (`menu.js`).** The renderer sends its context to the main process with a new IPC call `menu:setContext` (`{ page, hasMjmlFile, hasPreview, preventAutoSave }`). The main process rebuilds the menu and enables or disables the items. Each item sends a `redux-command` like today.

| Menu | Items (shortcut) |
|---|---|
| MJML (macOS app menu) | About, Settings… (Cmd+,), Services, Hide, Hide Others, Quit |
| File | New Project… (Cmd+Shift+N), New File… (Cmd+N), Open Project… (Cmd+O), Import from Figma…, Save (Cmd+S, only with prevent auto-save), Export HTML… (Cmd+E), Copy HTML (Cmd+Shift+C), Save Screenshots, Send Test Email… (Cmd+Shift+E), Close Project (Cmd+W), Settings… (Ctrl+, on Windows and Linux) |
| Edit | Undo, Redo, Cut, Copy, Paste, Select All, Find (Cmd+F), Beautify (Cmd+Shift+B), Refine with AI… |
| View | Toggle Sidebar (Cmd+0), Toggle Preview (Cmd+Alt+P), Desktop Preview (Cmd+1), Mobile Preview (Cmd+2), Templating…, Theme (System, Light, Dark radio items), Reload, Developer Tools, Full Screen |
| Window | Minimize, Zoom, Front |
| Help | Documentation, Browser Editor, Report an Issue |

The toolbar buttons and the menu call the same handlers. Find and Undo inside the editor keep the CodeMirror key bindings.

**Native context menus.** A new IPC call `menu:popup(items)` shows a native context menu and resolves with the selected item id (or `null`). The renderer uses it for the file list and the project cards.

## 3. Project screen

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●  ‹  test-mjml-app / index.mjml •      [Desktop|Mobile]  Send  Export ▾  ⋯  ⚙ │  title bar 44px
├────────────┬─────────────────────────────────────┬───────────────────────────┤
│ FILES  + ⤓ │                                     │        ┌──────────────┐   │
│ ▸ images   │   CodeMirror editor                 │        │  email       │   │
│ ● index    │                                     │        │  preview     │   │
│   footer   │                                     │        │  (white)     │   │
│   header   │                                     │        └──────────────┘   │
│            │                                     │  canvas  650 px           │
├────────────┴─────────────────────────────────────┴───────────────────────────┤
│ ✓ No errors · Rendered in 84 ms           Handlebars · MJML 5.4.1 · Ln 12, Col 8 │  status bar 24px
└──────────────────────────────────────────────────────────────────────────────┘
```

**Title bar.** Left: a back button (to the project list, Cmd+W) and a breadcrumb: project name, the sub folders, the active file. A dot after the file name shows unsaved changes when `preventAutoSave` is on. Right: a segmented control Desktop / Mobile, a Send button, an Export menu button (Copy HTML, Export HTML file, Save Screenshots), a "More" button (`⋯`) and a Settings button. "More" opens a native menu: Beautify, Refine with AI…, Import from Figma…, Templating…, Reveal in Finder (Show in Explorer on Windows). Icon buttons show a tooltip with the shortcut. The buttons that need an MJML file are disabled, not hidden, so the layout does not jump.

**Sidebar (file list).** It uses `--bg-sidebar` (vibrancy on macOS). It can collapse (Cmd+0) and resize from 180 to 360 px. The width and the collapsed state are saved in `settings.layout`. The header shows "Files" and two icon buttons: New File and Import from Figma. Each row has a file type icon (MJML, HTML, image, folder, other), the name and a selected state. Keyboard: Up and Down move the selection, Enter opens, F2 (Enter on macOS when a row has focus and the editor does not) renames, Cmd+Backspace moves to the trash with the confirm dialog. Right click opens a native context menu: Rename, Duplicate, Reveal in Finder, Move to Trash. The hover pencil and cross icons go away. A ".." row stays for the sub folders.

**Editor.** No change in behavior. It gets the themed CodeMirror look (section 6). The old syntax banner (MJML 3) gets the new inline banner style.

**Preview.** The pane shows the email on a `--bg-canvas` background with a light shadow, centered, at the selected width. A small label under the email shows the width in px. Desktop and Mobile move to the title bar. The pane can collapse (Cmd+Alt+P). When there is no preview, the pane shows a short empty state ("Select an MJML file to preview it").

**Status bar (new `components/StatusBar`).**

- Left: the validation state. "No errors" with a check icon, or "3 errors" in `--danger`. A click on the error count moves the editor cursor to the first error. Then the render time ("Rendered in 84 ms"), or "Rendering…".
- Right: the templating engine (only when it is not `html`), the engine ("MJML 5.4.1" or "MJML (local binary)"), "Auto-save off" when `preventAutoSave` is on, and the cursor position "Ln 12, Col 8".
- The data comes from a new reducer `editorStatus` (`{ line, col, errors, renderMs, isRendering, isDirty }`). `FileEditor` dispatches the cursor, the errors and the dirty state. `actions/preview.js` dispatches the render time.

## 4. Home screen

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●  MJML               [ 🔍 Search projects      ]   Open…  [+ New Project]  ⚙ │
├──────────────────────────────────────────────────────────────────────────────┤
│  Recent projects  (4)                                   Sort: Last opened ▾  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                                  │
│  │ thumb  │ │ thumb  │ │ thumb  │ │ thumb  │                                  │
│  └────────┘ └────────┘ └────────┘ └────────┘                                  │
│  name        name       name       name                                       │
│  ~/projects  ~/work     …          …        · 2 hours ago                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Title bar:** the app name, a compact search field (240 px, Cmd+F focuses it), "Open…", the primary "New Project" button and Settings.
- **Header row:** "Recent projects" with the count and a sort menu: Last opened, Name, Last modified. "Last opened" puts the project that the user opened last at the start: `openProject` moves the path to the start of the list (today the list only keeps the order in which the projects were added). The sort is saved in `settings.layout.projectSort`.
- **Cards:** a responsive grid (`repeat(auto-fill, minmax(200px, 1fr))`). Each card has the thumbnail (rounded, with a border, a 4:5 crop of the top of the email), the name, the parent folder (with `~` for the home folder) and the last modified time ("2 hours ago"). The modified time comes from a new preload helper `fs.getMtime(path)`. A pure helper `formatRelativeTime(date, now)` gets unit tests.
- **Interaction:** a click selects, a double click or Enter opens (desktop convention). Cmd+click and Shift+click select more cards. Right click opens a native menu: Open, Reveal in Finder, Rename…, Duplicate, Remove from List. The floating round buttons go away. When there is a selection, the header row shows "2 selected · Export Index to HTML · Export All Files · Export Images · Clear" in place of the separate mass actions bar (the same three export actions as today).
- **Empty state:** a centered block with the MJML logo, "Create your first email", the two buttons New Project and Open Project, and "or drop an .mjml file or a folder here".
- **Drop zone:** the existing file drop keeps its behavior and gets the new overlay style (dashed `--accent` border, `--bg-selected` fill).

## 5. Dialogs, settings and notifications

**`Dialog` component (replaces the look of `Modal`).** The `Modal` API stays (`isOpened`, `onClose`). New props: `title`, `size` (`sm` 420, `md` 560, `lg` 760) and `footer`. The dialog has `--radius-lg`, `--bg-elevated`, a soft shadow and a 1 px border. The header shows the title in `--text-lg`. The footer puts the buttons on the right: Cancel, then the primary button. Enter does the primary action when the focus is not in a text area. Esc cancels. The focus stays inside the dialog (focus trap) and goes back to the opener on close. The open animation is a fade with a 0.98 → 1 scale. The `Modal--label` tab goes away. All dialogs use it: New Project, Template Chooser, Add File, Remove File, Rename, Send, Figma Import, Refine, Templating, Error, About, Confirm.

**Settings.** A `lg` dialog with a fixed height (560 px) and a left list of sections like macOS System Settings: Appearance (new), Editor, MJML, Preview, AI & Figma, Snippets. Appearance has the theme (System / Light / Dark as a segmented control) and the editor font size (the existing `editor.fontSize` setting, values 12, 13, 14, 15, 16, 18, default 13). The controls in each section use rows: the label on the left, the control on the right, a short help text under the label.

**Controls.** One `Button` with `variant`: `primary`, `secondary` (default), `ghost` (toolbar), `danger`, and `size`: `sm` 24, `md` 28, `lg` 32. The old boolean props (`primary`, `ghost`, `transparent`, `warn`, `small`) keep working and map to the new variants, so each file can move at its own speed. New `SegmentedControl` and `Tooltip` (CSS with `data-tooltip`, 500 ms delay) components. `TextInput`, `Select` (react-select styles from the tokens), `CheckBox` and `RadioGroup` get 28 px height, `--radius-md` and the focus ring.

**Notifications.** `Alerts` become toasts at the bottom right, above the status bar: an icon, the text, an optional close button, auto hide after 4 s (the existing `autoHide: false` stays). At most three show at one time. Errors that block the user stay in the Error dialog.

## 6. Editor theme

`helpers/codemirror/theme.js` gets two themes built from the token values: `mjmlDark` (based on One Dark colors, with the background `--bg-panel`) and `mjmlLight` (a GitHub-like light palette). Both set the gutter, the active line, the selection, the matching tag, the lint markers, the autocomplete and the search panel. The font is `--font-mono` at `editor.fontSize`. The editor changes the theme through the existing compartment when the app theme changes.

## 7. Error handling

- If `theme:set` fails, the app keeps the renderer theme. The native parts can then differ. The app logs the error and does not show it to the user.
- If `menu:popup` fails, the action does nothing. Each command in a context menu is also in the main menu.
- `loadProjects` already removes the projects whose folder is gone. If `getMtime` fails for another reason, it returns `null` and the card shows no time.
- Saved window bounds outside the displays fall back to the centered default size.

## 8. Testing and checks

- Unit tests (vitest, same as the main process tests): `resolveTheme`, `fitBounds`, `formatRelativeTime`, the menu template builder (items enabled for each context).
- Each phase must pass `yarn lint`, `yarn prettier:check`, `yarn test` and `yarn build`.
- Visual check after each phase: start the built app with a debugging port and take screenshots of the home screen, the project screen, the settings dialog and the new project dialog. Do this in light and dark, at 960×600 and 1440×900.
- Manual check on macOS: the traffic lights, the drag region, full screen, the menus, the shortcuts and the context menus.

## 9. Phases

Each phase is one or more commits and leaves the app in a working state.

1. **Foundation:** tokens, theme setting and IPC, base styles, `Button` and form controls.
2. **Window shell:** window options and bounds, `TitleBar`, the menu with context and shortcuts, native context menus.
3. **Project screen:** the title bar content, the sidebar, the preview pane, the status bar and the `editorStatus` reducer.
4. **Home screen:** the title bar content, the cards, the sort, the selection, the empty state.
5. **Dialogs and settings:** the `Dialog` look in all dialogs, the Appearance section, the toasts.
6. **Editor theme and polish:** the CodeMirror themes, the font size, the empty states, the reduced motion check, the screenshot review.

## Out of scope

- The marketing site in `site/`.
- New features that are not about the experience: editor tabs, more than one window, a file tree with expandable folders, translations (the UI stays in English).
- Changes to the rendering pipeline, templating, Mailjet sending and the Figma import logic.
