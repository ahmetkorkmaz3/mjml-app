import { describe, expect, it, vi } from 'vitest'

import { buildMenuTemplate } from './menu'

const actions = {
  openExternal: vi.fn(),
  reload: vi.fn(),
  toggleDevTools: vi.fn(),
  toggleFullScreen: vi.fn(),
}

const home = { page: 'home', hasMjmlFile: false, hasPreview: false, preventAutoSave: false }
const project = { page: 'project', hasMjmlFile: true, hasPreview: true, preventAutoSave: false }
const PROJECT_IDS = ['new-file', 'export-html', 'copy-html', 'send', 'beautify', 'close-project']

function findItem(template, id) {
  for (const item of template) {
    if (item.id === id) return item
    if (Array.isArray(item.submenu)) {
      const found = findItem(item.submenu, id)
      if (found) return found
    }
  }
  return null
}

function build(context, platform = 'darwin', send = vi.fn(), theme = 'system', isPackaged) {
  return buildMenuTemplate({ platform, context, theme, send, actions, isPackaged })
}

describe('buildMenuTemplate', () => {
  it('shows the developer tools only in a development build', () => {
    expect(findItem(build(home, 'darwin', vi.fn(), 'system', false), 'toggle-devtools')).not.toBe(
      null,
    )
    expect(findItem(build(home, 'darwin', vi.fn(), 'system', true), 'toggle-devtools')).toBe(null)
    expect(findItem(build(home, 'win32', vi.fn(), 'system', true), 'toggle-devtools')).toBe(null)
  })

  it('opens the issues of the repository from the Help menu', () => {
    const help = build(home).find(m => m.label === 'Help')
    help.submenu.find(i => i.label === 'Report an Issue').click()
    expect(actions.openExternal).toHaveBeenCalledWith(
      'https://github.com/ahmetkorkmaz3/mjml-app/issues',
    )
  })

  it('disables the project commands on the home page', () => {
    const t = build(home)
    for (const id of PROJECT_IDS) {
      expect(findItem(t, id).enabled).toBe(false)
    }
    expect(findItem(t, 'new-project').enabled).not.toBe(false)
  })

  it('enables the project commands when there is an MJML file and a preview', () => {
    const t = build(project)
    for (const id of PROJECT_IDS) {
      expect(findItem(t, id).enabled).toBe(true)
    }
  })

  it('disables the MJML commands for a file that is not MJML', () => {
    const t = build({ ...project, hasMjmlFile: false, hasPreview: true })
    expect(findItem(t, 'beautify').enabled).toBe(false)
    expect(findItem(t, 'refine').enabled).toBe(false)
    expect(findItem(t, 'export-html').enabled).toBe(true)
  })

  it('enables Save only when auto-save is off', () => {
    expect(findItem(build(project), 'save').enabled).toBe(false)
    expect(findItem(build({ ...project, preventAutoSave: true }), 'save').enabled).toBe(true)
  })

  it('gives Cmd+W to Close Project on the project page and to the window on the home page', () => {
    expect(findItem(build(project), 'close-project').accelerator).toBe('CmdOrCtrl+W')
    expect(findItem(build(home), 'close-project').accelerator).toBeUndefined()
    expect(findItem(build(home), 'close-window').role).toBe('close')
    expect(findItem(build(home), 'close-window').accelerator).toBe('CmdOrCtrl+W')
    // a role item without an accelerator gets Cmd/Ctrl+W from Electron, so it must have another one
    expect(findItem(build(project), 'close-window').accelerator).toBe('CmdOrCtrl+Shift+W')
  })

  it('sends the command of a custom item', () => {
    const send = vi.fn()
    findItem(build(project, 'darwin', send), 'export-html').click()
    expect(send).toHaveBeenCalledWith('export-html')
  })

  it('puts Undo and Redo in the Edit menu', () => {
    const edit = build(home).find(m => m.label === 'Edit')
    expect(edit.submenu.map(i => i.role)).toEqual(
      expect.arrayContaining(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']),
    )
  })

  it('checks the selected theme', () => {
    const t = build(home, 'darwin', vi.fn(), 'dark')
    expect(findItem(t, 'theme-dark').checked).toBe(true)
    expect(findItem(t, 'theme-light').checked).toBe(false)
  })

  it('puts Settings in the File menu on Windows and in the app menu on macOS', () => {
    const mac = build(home, 'darwin')
    expect(mac[0].submenu.some(i => i.id === 'settings')).toBe(true)
    const win = build(home, 'win32')
    expect(win.find(m => m.label === 'File').submenu.some(i => i.id === 'settings')).toBe(true)
  })
})
