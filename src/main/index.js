import { app, BrowserWindow, Menu, nativeTheme } from 'electron'
import { join } from 'node:path'
import { autoUpdater } from 'electron-updater'
import fixPath from 'fix-path'

import { saveWindowSettings, getWindowSettings, getStoredSettings } from './window-settings'
import { registerIpcHandlers } from './ipc'
import buildMenu from './menu'
import { normalizeThemeSetting, windowColors } from './theme'

const isDevelopment = !app.isPackaged

// allows app to find node when launched from GUI
fixPath()

let mainWindow = null
let isRendererReady = false

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
  mainWindow.setBackgroundColor(colors.background)
}

async function installExtensions() {
  try {
    const { installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } =
      await import('electron-devtools-installer')
    await installExtension([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS], {
      forceDownload: !!process.env.UPGRADE_EXTENSIONS,
    })
  } catch (err) {
    console.log(err)
  }
}

async function createMainWindow() {
  const windowParams = await getWindowSettings()
  const isDark = nativeTheme.shouldUseDarkColors
  const colors = windowColors(isDark)

  const w = new BrowserWindow({
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
    backgroundColor: colors.background,
    show: false,
    ...windowParams,
  })

  w.once('ready-to-show', () => {
    isRendererReady = true
    sendOpenPath()
    w.show()
  })

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

  const menu = Menu.buildFromTemplate(buildMenu(w))

  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(menu)
  } else {
    w.setMenu(menu)
  }

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
  }
})

// macOS sends this event when the user opens a .mjml file with the app
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  openPath = filePath
  sendOpenPath()
})

app.whenReady().then(async () => {
  registerIpcHandlers({ onThemeChange: updateWindowTheme })
  nativeTheme.on('updated', updateWindowTheme)
  await applyStoredTheme()
  if (isDevelopment) {
    await installExtensions()
  }
  mainWindow = await createMainWindow()
  if (!isDevelopment) {
    autoUpdater.checkForUpdatesAndNotify()
  }
})
