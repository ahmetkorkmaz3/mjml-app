import { promisify } from 'node:util'
import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  safeStorage,
  shell,
} from 'electron'
import storage from 'electron-json-storage'

import { toErrorResult } from './errors'
import { createFigmaImporter } from './figma-import'
import { migrateMailjetKeys, sendTestEmail } from './mailjet'
import { cleanUpScreenshot, renderScreenshot, takeScreenshot } from './screenshot'
import { createSecretStore, SECRET_NAMES } from './secrets'
import { compile } from './templating'
import { toPopupTemplate } from './popup-menu'
import { normalizeThemeSetting } from './theme'

const storageGet = promisify(storage.get)
const storageSet = promisify(storage.set)

const EXTERNAL_PROTOCOLS = ['http:', 'https:', 'mailto:']

export function openExternal(url) {
  let protocol
  try {
    ;({ protocol } = new URL(url))
  } catch (err) {
    return
  }
  if (EXTERNAL_PROTOCOLS.includes(protocol)) {
    return shell.openExternal(url)
  }
}

export function registerIpcHandlers({ onThemeChange, onMenuContext, onAppMenu }) {
  const secrets = createSecretStore({
    filePath: join(app.getPath('userData'), 'secrets.json'),
    safeStorage,
  })

  // The settings never keep the Mailjet keys in plain text: the keys of the
  // old versions go to the secret store the first time the settings are read.
  async function withoutMailjetKeys(settings) {
    try {
      return await migrateMailjetKeys(settings, secrets)
    } catch (err) {
      return settings
    }
  }

  ipcMain.handle('storage:get', async (e, key) => {
    const value = await storageGet(key)
    if (key !== 'settings') {
      return value
    }
    const migrated = await withoutMailjetKeys(value)
    if (migrated !== value) {
      await storageSet(key, migrated)
    }
    return migrated
  })
  ipcMain.handle('storage:set', async (e, key, value) =>
    storageSet(key, key === 'settings' ? await withoutMailjetKeys(value) : value),
  )

  ipcMain.handle('dialog:open', async (e, options) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win, options)
    if (canceled || !filePaths || !filePaths.length) {
      return null
    }
    return filePaths[0]
  })

  ipcMain.handle('dialog:save', async (e, options) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(win, options)
    return canceled || !filePath ? null : filePath
  })

  ipcMain.handle('shell:openExternal', (e, url) => openExternal(url))
  ipcMain.handle('shell:showItemInFolder', (e, p) => shell.showItemInFolder(p))
  ipcMain.handle('shell:openPath', (e, p) => shell.openPath(p))
  ipcMain.handle('shell:trashItem', (e, p) => shell.trashItem(p))

  ipcMain.handle('theme:set', (e, setting) => {
    nativeTheme.themeSource = normalizeThemeSetting(setting)
    onThemeChange(nativeTheme.themeSource)
  })

  ipcMain.handle('menu:setContext', (e, context) => onMenuContext(context))
  ipcMain.handle('menu:popupApp', e => onAppMenu(BrowserWindow.fromWebContents(e.sender)))

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

  ipcMain.handle('templating:compile', (e, params) => compile(params))

  ipcMain.handle('clipboard:writeText', (e, text) => clipboard.writeText(text))

  ipcMain.handle('screenshot:take', (e, html, deviceWidth, workingDirectory) =>
    takeScreenshot(html, deviceWidth, workingDirectory),
  )
  ipcMain.handle('screenshot:cleanUp', (e, workingDirectory) => cleanUpScreenshot(workingDirectory))

  const importer = createFigmaImporter({ secrets, renderScreenshot })
  const unknownSecret = { error: { code: 'UNKNOWN_SECRET', message: 'Unknown secret.' } }

  // the renderer uses these two as booleans, so an unreadable keys file gives false
  ipcMain.handle('secrets:isAvailable', async () => {
    try {
      return await secrets.isAvailable()
    } catch (err) {
      return false
    }
  })
  ipcMain.handle('secrets:has', async (e, name) => {
    try {
      return SECRET_NAMES.includes(name) && (await secrets.has(name))
    } catch (err) {
      return false
    }
  })
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

  // the main process reads the Mailjet keys, the renderer cannot
  ipcMain.handle('mailjet:send', async (e, params) => {
    try {
      const settings = await storageGet('settings')
      return await sendTestEmail(params, { secrets, settings })
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
}
