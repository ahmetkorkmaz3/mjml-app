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

const EVENT_CHANNELS = ['redux-command', 'openPath', 'browser-window-focus']

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
