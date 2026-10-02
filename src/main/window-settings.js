import { promisify } from 'node:util'
import storage from 'electron-json-storage'
import set from 'lodash/set'

const storageGet = promisify(storage.get)
const storageSet = promisify(storage.set)

export const saveWindowSettings = async window => {
  if (!window) return
  const bounds = { ...window.getNormalBounds(), isMaximized: window.isMaximized() }
  const settings = await storageGet('settings')

  if (!settings) return

  set(settings, 'windowParams', bounds)

  return storageSet('settings', settings)
}

// the stored settings, or an empty object when they cannot be read
export const getStoredSettings = async () => {
  try {
    return (await storageGet('settings')) || {}
  } catch (e) {
    return {}
  }
}

export const getWindowSettings = async () => {
  try {
    const settings = await storageGet('settings')
    return settings.windowParams || {}
  } catch (e) {
    console.warn('Cannot read the window settings:', e)
    return {}
  }
}
