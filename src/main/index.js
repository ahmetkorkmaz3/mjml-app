import { app, BrowserWindow, dialog, Menu, nativeTheme, screen, shell } from 'electron'
import { join } from 'node:path'
import { autoUpdater } from 'electron-updater'
import fixPath from 'fix-path'

import { saveWindowSettings, getWindowSettings, getStoredSettings } from './window-settings'
import { openExternal, registerIpcHandlers } from './ipc'
import { buildMenuTemplate } from './menu'
import { normalizeThemeSetting, windowColors } from './theme'
import { fitBounds } from './window-bounds'

const isDevelopment = !app.isPackaged

// allows app to find node when launched from GUI
fixPath()

// An error in the main process must not close the app without a trace
process.on('uncaughtException', err => console.error('Uncaught exception:', err))
process.on('unhandledRejection', reason => console.error('Unhandled rejection:', reason))

let mainWindow = null
let currentMenu = null
let menuContext = { page: 'home', hasMjmlFile: false, hasPreview: false, preventAutoSave: false }
let isRendererReady = false
let isQuitting = false

// if we double clicked on mjml file (or launched app with argument)
// we send path to renderer, to directly open/create project
let openPath = process.argv.slice(1).find(arg => arg.endsWith('.mjml')) || null

function sendOpenPath() {
  if (mainWindow && isRendererReady && openPath) {
    mainWindow.webContents.send('openPath', openPath)
    openPath = null
  }
}

// the first frame must use the stored theme, so read it before the window exists
async function applyStoredTheme() {
  const settings = await getStoredSettings()
  nativeTheme.themeSource = normalizeThemeSetting(settings.appearance?.theme)
}

function updateWindowTheme() {
  if (!mainWindow) {
    return
  }
  const colors = windowColors(nativeTheme.shouldUseDarkColors)
  if (process.platform === 'darwin') {
    // the window stays transparent for the vibrancy
    return
  }
  mainWindow.setBackgroundColor(colors.background)
  try {
    mainWindow.setTitleBarOverlay({ color: colors.background, symbolColor: colors.symbol })
  } catch (err) {
    console.warn('Cannot set the title bar overlay:', err)
  }
}

function rebuildMenu() {
  if (!mainWindow) {
    return
  }
  const w = mainWindow
  const template = buildMenuTemplate({
    platform: process.platform,
    isPackaged: app.isPackaged,
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
  currentMenu = menu
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(menu)
  } else {
    w.setMenu(menu)
  }
}

async function installExtensions() {
  try {
    const { installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } =
      await import('electron-devtools-installer')
    await installExtension([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS], {
      forceDownload: !!process.env.UPGRADE_EXTENSIONS,
    })
  } catch (err) {
    console.warn('Cannot install the developer extensions:', err)
  }
}

// The renderer crashed or stopped responding: the user can reload it or quit.
// A renderer killed by the app or the system shutdown gets no dialog.
let isCrashDialogOpen = false
// With `canWait`, the first button (and Escape) closes the dialog and waits.
async function askReloadOrQuit(w, { message, detail, signal, canWait = false }) {
  if (isCrashDialogOpen || w.isDestroyed()) {
    return
  }
  isCrashDialogOpen = true
  try {
    const buttons = [...(canWait ? ['Wait'] : []), 'Reload', 'Quit']
    const { response } = await dialog.showMessageBox(w, {
      type: 'error',
      buttons,
      defaultId: 0,
      // Escape never quits
      cancelId: 0,
      message,
      detail,
      signal,
    })
    if (w.isDestroyed() || signal?.aborted) {
      return
    }
    const choice = buttons[response]
    if (choice === 'Reload') {
      w.webContents.reload()
    } else if (choice === 'Quit') {
      app.quit()
    }
  } finally {
    isCrashDialogOpen = false
  }
}

function watchRenderer(w) {
  w.webContents.on('render-process-gone', (event, details) => {
    console.error('The renderer process is gone:', details)
    if (details.reason === 'clean-exit' || details.reason === 'killed' || isQuitting) {
      return
    }
    askReloadOrQuit(w, {
      message: 'The MJML window stopped working.',
      detail: `Reason: ${details.reason}. Reload the window to continue. Unsaved changes can be lost.`,
    })
  })
  // the dialog closes when the window responds again
  let unresponsiveDialog = null
  w.on('unresponsive', () => {
    console.warn('The window is not responding')
    if (isQuitting) {
      return
    }
    unresponsiveDialog = new AbortController()
    askReloadOrQuit(w, {
      message: 'The MJML window is not responding.',
      detail:
        'Wait, reload the window, or quit. Unsaved changes can be lost when you reload or quit.',
      signal: unresponsiveDialog.signal,
      canWait: true,
    })
  })
  w.on('responsive', () => {
    unresponsiveDialog?.abort()
    unresponsiveDialog = null
  })
}

async function createMainWindow() {
  const saved = await getWindowSettings()
  const bounds = fitBounds(saved, screen.getAllDisplays(), { width: 1280, height: 800 })
  const isMac = process.platform === 'darwin'
  const isDark = nativeTheme.shouldUseDarkColors
  const colors = windowColors(isDark)

  const w = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 600,
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
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // the preload script uses Node.js modules (fs, child_process, mjml...)
      sandbox: false,
      // the preview loads local images (file://) from the project folder
      webSecurity: false,
      additionalArguments: [`--mjml-theme=${isDark ? 'dark' : 'light'}`],
    },
    backgroundColor: isMac ? '#00000000' : colors.background,
    show: false,
  })

  if (saved && saved.isMaximized) {
    w.maximize()
  }

  const sendFullScreen = isFullScreen => w.webContents.send('window-fullscreen', isFullScreen)
  w.on('enter-full-screen', () => sendFullScreen(true))
  w.on('leave-full-screen', () => sendFullScreen(false))

  w.once('ready-to-show', () => {
    isRendererReady = true
    sendOpenPath()
    w.show()
  })

  watchRenderer(w)

  // the files list refreshes when the window gets the focus again
  w.on('focus', () => w.webContents.send('browser-window-focus'))

  if (isDevelopment) {
    w.webContents.openDevTools()

    w.webContents.on('context-menu', (e, { x, y }) => {
      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click() {
            w.webContents.inspectElement(x, y)
          },
        },
      ]).popup({ window: w })
    })
  }

  if (!isMac) {
    // the hidden title bar hides the menu bar, the menu button of the title
    // bar shows the menu (menu:popupApp)
    w.setAutoHideMenuBar(true)
  }

  // save the size and the position before the window closes (Cmd+W on the home page)
  let isClosing = false
  w.on('close', event => {
    if (isClosing) {
      return
    }
    event.preventDefault()
    isClosing = true
    saveWindowSettings(w)
      .catch(err => console.error('Cannot save the window settings:', err))
      .finally(() => w.close())
  })

  if (isDevelopment && process.env.ELECTRON_RENDERER_URL) {
    w.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    w.loadFile(join(__dirname, '../renderer/index.html'))
  }

  w.on('closed', () => {
    mainWindow = null
    isRendererReady = false
  })

  return w
}

let beforeQuitDone = false

app.on('before-quit', async event => {
  isQuitting = true
  if (!beforeQuitDone) {
    event.preventDefault()
    await saveWindowSettings(mainWindow)

    beforeQuitDone = true
    app.quit()
  }
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', async () => {
  if (mainWindow === null) {
    mainWindow = await createMainWindow()
    rebuildMenu()
  }
})

// The app never navigates: the links of the emails and of the pages open in
// the browser. Programmatic loads (loadURL, reload) do not emit these events.
app.on('web-contents-created', (e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    event.preventDefault()
    openExternal(url)
  })
})

// Windows and Linux start a second process when the user opens a .mjml file,
// that process gives the file to this one and quits
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (event, argv) => {
    const file = argv.slice(1).find(arg => arg.endsWith('.mjml'))
    if (file) {
      openPath = file
      sendOpenPath()
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// macOS sends this event when the user opens a .mjml file with the app
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  openPath = filePath
  sendOpenPath()
})

app.whenReady().then(async () => {
  registerIpcHandlers({
    onThemeChange: () => {
      updateWindowTheme()
      rebuildMenu()
    },
    onAppMenu: win => {
      if (currentMenu) {
        currentMenu.popup({ window: win, x: 8, y: 40 })
      }
    },
    onMenuContext: context => {
      menuContext = { ...menuContext, ...context }
      rebuildMenu()
    },
  })
  nativeTheme.on('updated', updateWindowTheme)
  await applyStoredTheme()
  if (isDevelopment) {
    await installExtensions()
  }
  mainWindow = await createMainWindow()
  rebuildMenu()
  // Squirrel.Mac installs only signed updates, the macOS build is not signed
  if (!isDevelopment && process.platform !== 'darwin') {
    // no network or no release feed must not stop the app
    autoUpdater.on('error', err => console.error('Update check failed:', err.message))
    autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  }
})
