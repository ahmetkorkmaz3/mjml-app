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
        // Electron gives the close role Cmd/Ctrl+W when the accelerator is empty
        accelerator: isProject ? 'CmdOrCtrl+Shift+W' : 'CmdOrCtrl+W',
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
