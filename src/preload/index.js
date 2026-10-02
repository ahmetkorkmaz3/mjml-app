// The preload script is the only part of the renderer process with access to
// Node.js. It gives the renderer a small API (`window.api`) through the
// context bridge: file system, MJML rendering, templating and mail sending.
// Operations that need the main process (dialogs, shell, screenshots...) go
// through IPC.

import { contextBridge, ipcRenderer, webUtils } from 'electron'
import os from 'node:os'
import path from 'node:path'

import * as fs from './fs'
import * as mjml from './mjml'
import sendEmail from './send-email'

const EVENT_CHANNELS = [
  'redux-command',
  'openPath',
  'browser-window-focus',
  'figma-import-progress',
]

const api = {
  platform: process.platform,
  homedir: os.homedir(),

  path: {
    sep: path.sep,
    join: (...args) => path.join(...args),
    resolve: (...args) => path.resolve(...args),
    basename: (p, ext) => path.basename(p, ext),
    dirname: p => path.dirname(p),
    extname: p => path.extname(p),
  },

  fs: { ...fs },
  mjml: { ...mjml },
  templating: {
    // erb runs in the main process: its `vm` sandbox crashes the renderer
    compile: params => ipcRenderer.invoke('templating:compile', params),
  },
  sendEmail,

  // Figma import: the main process keeps the keys and makes the requests
  figma: {
    import: params => ipcRenderer.invoke('figma:import', params),
    refine: params => ipcRenderer.invoke('figma:refine', params),
    cancel: () => ipcRenderer.invoke('figma:cancel'),
    testConnection: figma => ipcRenderer.invoke('figma:testConnection', figma),
  },
  ai: {
    testConnection: ai => ipcRenderer.invoke('ai:testConnection', ai),
  },
  // the renderer can set a secret and ask if it exists, it cannot read it
  secrets: {
    isAvailable: () => ipcRenderer.invoke('secrets:isAvailable'),
    has: name => ipcRenderer.invoke('secrets:has', name),
    set: (name, value) => ipcRenderer.invoke('secrets:set', name, value),
  },

  storage: {
    get: key => ipcRenderer.invoke('storage:get', key),
    set: (key, value) => ipcRenderer.invoke('storage:set', key, value),
  },

  dialog: {
    open: options => ipcRenderer.invoke('dialog:open', options),
    save: options => ipcRenderer.invoke('dialog:save', options),
  },

  shell: {
    openExternal: url => ipcRenderer.invoke('shell:openExternal', url),
    showItemInFolder: p => ipcRenderer.invoke('shell:showItemInFolder', p),
    openPath: p => ipcRenderer.invoke('shell:openPath', p),
    trashItem: p => ipcRenderer.invoke('shell:trashItem', p),
  },

  clipboard: {
    writeText: text => ipcRenderer.invoke('clipboard:writeText', text),
  },

  screenshot: {
    take: (html, deviceWidth, workingDirectory) =>
      ipcRenderer.invoke('screenshot:take', html, deviceWidth, workingDirectory),
    cleanUp: workingDirectory => ipcRenderer.invoke('screenshot:cleanUp', workingDirectory),
  },

  getPathForFile: file => webUtils.getPathForFile(file),

  // subscribe to a message from the main process, returns an unsubscribe function
  on(channel, callback) {
    if (!EVENT_CHANNELS.includes(channel)) {
      throw new Error(`Unknown channel: ${channel}`)
    }
    const listener = (event, ...args) => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
}

contextBridge.exposeInMainWorld('api', api)
