import { describe, expect, it } from 'vitest'

import reducer from './settings'

const load = payload =>
  reducer(null, {
    type: 'SETTINGS_LOAD_SUCCESS',
    payload: { projects: [], snippets: [], templating: [], ...payload },
  })

describe('settings reducer', () => {
  it('keeps the last opened and exported folders after a load', () => {
    const state = load({ lastOpenedFolder: '/open', lastExportedFolder: '/export' })
    expect(state.get('lastOpenedFolder')).toBe('/open')
    expect(state.get('lastExportedFolder')).toBe('/export')
  })

  it('moves the project and its templating settings on rename', () => {
    const state = load({
      projects: ['/a/old', '/a/other'],
      templating: [
        { projectPath: '/a/old', engine: 'handlebars' },
        { projectPath: '/a/old/sub', engine: 'erb' },
        { projectPath: '/a/older', engine: 'erb' },
        { projectPath: '/a/other', engine: 'html' },
      ],
    })
    const next = reducer(state, {
      type: 'PROJECT_RENAME',
      payload: { oldPath: '/a/old', newPath: '/a/new' },
    })
    expect(next.get('projects').toArray()).toEqual(['/a/new', '/a/other'])
    expect(next.get('templating')).toEqual([
      { projectPath: '/a/new', engine: 'handlebars' },
      { projectPath: '/a/new/sub', engine: 'erb' },
      { projectPath: '/a/older', engine: 'erb' },
      { projectPath: '/a/other', engine: 'html' },
    ])
  })

  it('moves Windows subfolder paths too', () => {
    const state = load({ templating: [{ projectPath: 'C:\\a\\old\\sub' }] })
    const next = reducer(state, {
      type: 'PROJECT_RENAME',
      payload: { oldPath: 'C:\\a\\old', newPath: 'C:\\a\\new' },
    })
    expect(next.get('templating')[0].projectPath).toBe('C:\\a\\new\\sub')
  })
})
