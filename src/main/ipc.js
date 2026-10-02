import { promisify } from 'node:util'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import storage from 'electron-json-storage'

import { compile } from './templating'

const storageGet = promisify(storage.get)
const storageSet = promisify(storage.set)

const SCREENSHOT_TMP_FILE = 'tpm-mjml-preview.html'

const EXTERNAL_PROTOCOLS = ['http:', 'https:', 'mailto:']

function openExternal(url) {
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

function takeScreenshot(html, deviceWidth, workingDirectory) {
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

export function registerIpcHandlers() {
  ipcMain.handle('storage:get', (e, key) => storageGet(key))
  ipcMain.handle('storage:set', (e, key, value) => storageSet(key, value))

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

  ipcMain.handle('templating:compile', (e, params) => compile(params))

  ipcMain.handle('clipboard:writeText', (e, text) => clipboard.writeText(text))

  ipcMain.handle('screenshot:take', (e, html, deviceWidth, workingDirectory) =>
    takeScreenshot(html, deviceWidth, workingDirectory),
  )
  ipcMain.handle('screenshot:cleanUp', (e, workingDirectory) =>
    unlink(join(workingDirectory, SCREENSHOT_TMP_FILE)),
  )
}
