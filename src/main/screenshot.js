import { randomUUID } from 'node:crypto'
import { unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow } from 'electron'

// the name of the temporary file of the old versions
const LEGACY_TMP_FILE = 'tpm-mjml-preview.html'
const TMP_PREFIX = '.mjml-app-screenshot-'

// the longest wait for the images, in ms
const IMAGES_TIMEOUT = 5000

// resolves when all the images are loaded (or failed), or after the timeout
const WAIT_FOR_IMAGES = `new Promise(resolve => {
  const pending = [...document.images].filter(img => !img.complete)
  let left = pending.length
  if (!left) return resolve()
  const done = () => {
    left -= 1
    if (!left) resolve()
  }
  pending.forEach(img => {
    img.addEventListener('load', done, { once: true })
    img.addEventListener('error', done, { once: true })
  })
  setTimeout(resolve, ${IMAGES_TIMEOUT})
})`

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

// Each call has its own temporary file, so two calls can run at the same
// time. The file is in the working directory, so relative image paths of the
// HTML resolve. The file is always deleted.
export async function takeScreenshot(html, deviceWidth, workingDirectory) {
  const tmpFileName = join(workingDirectory, `${TMP_PREFIX}${randomUUID()}.html`)
  const win = new BrowserWindow({
    width: deviceWidth,
    useContentSize: true,
    show: false,
  })

  try {
    await writeFile(tmpFileName, html)
    await win.loadURL(pathToFileURL(tmpFileName).href)
    await win.webContents.executeJavaScript(WAIT_FOR_IMAGES)
    const height = await win.webContents.executeJavaScript(
      'Math.ceil(document.documentElement.getBoundingClientRect().height)',
    )
    win.setContentSize(deviceWidth, Math.max(1, height))
    // the window is not painted again at once after the resize
    await delay(300)
    const img = await win.webContents.capturePage()
    return img.toPNG()
  } finally {
    win.destroy()
    await unlink(tmpFileName).catch(() => {})
  }
}

// Removes the temporary file of the old versions, if it is there. It never
// fails: the screenshots are saved even when the cleanup cannot run.
export async function cleanUpScreenshot(workingDirectory) {
  try {
    await unlink(join(workingDirectory, LEGACY_TMP_FILE))
  } catch (err) {
    // no file, or no access
  }
}

// screenshot for the visual check of the Figma import
export function renderScreenshot(html, width, workingDirectory) {
  return takeScreenshot(html, width, workingDirectory)
}
