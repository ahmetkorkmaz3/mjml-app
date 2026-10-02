import defaultsDeep from 'lodash/defaultsDeep'
import omit from 'lodash/omit'

import api from 'helpers/api'
import { addAlert } from 'reducers/alerts'

const storageGet = key => api.storage.get(key)
const storageSet = (key, value) => api.storage.set(key, value)

// electron-json-storage puts the content that it cannot parse in the error message
function getBadData(err) {
  const message = String((err && err.message) || err)
  const index = message.indexOf('Invalid data: ')
  return index === -1 ? message : message.slice(index + 'Invalid data: '.length)
}

// keeps a copy of the settings that could not load, so the defaults do not delete them
async function backUpBadSettings(err) {
  const key = `settings-backup-${Date.now()}`
  try {
    await storageSet(key, { error: String((err && err.message) || err), data: getBadData(err) })
    return key
  } catch (e) {
    return null
  }
}

export function loadSettings() {
  return async dispatch => {
    let shouldResetDefaults = false
    let res
    try {
      res = await storageGet('settings')
      if (!res || typeof res !== 'object' || Array.isArray(res)) {
        throw new Error(`Invalid data: ${JSON.stringify(res)}`)
      }

      // check for old format and reformat
      if (typeof res.projects === 'object' && !Array.isArray(res.projects)) {
        res = res.projects
        await storageSet('settings', res)
      }
    } catch (e) {
      res = undefined
      console.error(e)
      const backupKey = await backUpBadSettings(e)
      // without a backup, the app does not write the defaults over the bad file at once
      shouldResetDefaults = !!backupKey
      dispatch(
        addAlert(
          backupKey
            ? `Could not load the settings, so the app uses the defaults. A copy of the old settings is in ${backupKey}.json in the storage folder of the app.`
            : 'Could not load the settings, so the app uses the defaults.',
          'error',
        ),
      )
    }

    const settings = defaultsDeep(res, {
      lastOpenedFolder: null,
      lastExportedFolder: null,
      editor: {
        wrapLines: true,
        autoFold: false,
        foldLevel: 1,
        highlightTag: false,
        useTab: false,
        tabSize: 2,
        indentSize: 2,
        preventAutoSave: false,
        fontSize: 13,
      },
      mjml: {
        minify: false,
        beautify: false,
        keepComments: true,
        checkForRelativePaths: false,
      },
      projects: [],
      api: {
        Subject: 'MJML App test email',
        APIKey: '',
        APISecret: '',
        SenderName: 'MJML App',
        SenderEmail: '',
        TargetEmails: [],
        LastEmails: [],
      },
      previewSize: {
        current: 500,
        mobile: 320,
        desktop: 650,
      },
      ai: {
        provider: 'anthropic',
        model: '',
        baseURL: '',
        visualCheck: true,
      },
      figma: {
        source: 'mcp',
        mcpURL: 'http://127.0.0.1:3845/mcp',
      },
      appearance: {
        theme: 'system',
      },
      layout: {
        sidebarWidth: 220,
        sidebarCollapsed: false,
        previewCollapsed: false,
        projectSort: 'recent',
      },
      snippets: [],
      templating: [],
    })

    // clean old format for TargetEmails
    if (settings.api.TargetEmail) {
      const updatedApiSettings = omit(settings.api, 'TargetEmail')
      settings.api = updatedApiSettings
    }

    dispatch({ type: 'SETTINGS_LOAD_SUCCESS', payload: settings })

    if (shouldResetDefaults) {
      dispatch(saveSettings())
    }
  }
}

export function saveSettings() {
  return (dispatch, getState) => {
    // prevent blocking the main thread
    // for no reason
    window.requestIdleCallback(() => {
      const state = getState()
      const settings = state.settings.toJS()
      dispatch({
        type: 'SAVE_SETTINGS',
        payload: settings,
      })
      storageSet('settings', settings)
    })
  }
}

export function cleanBadProjects(pathsToClean) {
  return {
    type: 'PROJECTS_REMOVE',
    payload: pathsToClean,
  }
}

export function updateSettings(updater) {
  return dispatch => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: updater,
    })
    dispatch(saveSettings())
  }
}

export function saveLastExportedFolder(path) {
  return dispatch => {
    dispatch(
      updateSettings(settings => {
        return settings.set('lastExportedFolder', path)
      }),
    )
  }
}

export function saveLastOpenedFolder(path) {
  return dispatch => {
    dispatch(
      updateSettings(settings => {
        return settings.set('lastOpenedFolder', path)
      }),
    )
  }
}

export function addToLastUsedEmails(emails) {
  return {
    type: 'ADD_TO_LAST_USED_EMAILS',
    payload: emails,
  }
}

export function removeFromLastUsedEmails(email) {
  return dispatch => {
    dispatch({
      type: 'REMOVE_FROM_LAST_USED_EMAILS',
      payload: email,
    })
    dispatch(saveSettings())
  }
}
