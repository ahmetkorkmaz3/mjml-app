import { unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow } from 'electron'

const SCREENSHOT_TMP_FILE = 'tpm-mjml-preview.html'

// The temporary file is in the working directory, so relative image paths of
// the HTML resolve.
export function takeScreenshot(html, deviceWidth, workingDirectory) {
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

export function cleanUpScreenshot(workingDirectory) {
  return unlink(join(workingDirectory, SCREENSHOT_TMP_FILE))
}

// screenshot for the visual check of the Figma import
export async function renderScreenshot(html, width, workingDirectory) {
  try {
    return await takeScreenshot(html, width, workingDirectory)
  } finally {
    await cleanUpScreenshot(workingDirectory).catch(() => {})
  }
}
