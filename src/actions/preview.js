import { createAction } from 'redux-actions'

import { path } from 'helpers/api'
import mjml2html from 'helpers/mjml'
import { readFile } from 'helpers/fs'
import { updateProjectPreview } from 'actions/projects'
import { setEditorStatus } from 'reducers/editorStatus'

const setPrev = createAction('SET_PREVIEW')

// each call has a number: a slow render that ends after a newer call is dropped
let lastRequest = 0

// options: rootPath (the project folder, mj-include can read the files in it)
export function setPreview(fileName, content = '', options = {}) {
  return async (dispatch, getState) => {
    const request = ++lastRequest
    const isLatest = () => request === lastRequest

    if (!fileName) {
      dispatch(setEditorStatus({ isRendering: false }))
      return dispatch(setPrev(null))
    }

    const bName = path.basename(fileName)
    const fName = path.dirname(fileName)
    const ext = path.extname(fileName)

    const state = getState()
    const { settings } = state

    // eventually get the custom mjml path set in settings
    const mjmlManual = settings.getIn(['mjml', 'engine']) === 'manual'
    const mjmlPath = mjmlManual ? settings.getIn(['mjml', 'path']) : undefined

    // an older MJML render can still be in progress
    if (ext !== '.mjml') {
      dispatch(setEditorStatus({ isRendering: false }))
    }

    switch (ext) {
      case '.html':
        if (!content) {
          content = await readFile(fileName)
        }
        if (isLatest()) {
          dispatch(setPrev({ type: 'html', content }))
        }
        break
      case '.jpg':
      case '.png':
      case '.gif':
        dispatch(setPrev({ type: 'image', content: fileName }))
        break
      case '.mjml': {
        if (!content) {
          content = await readFile(fileName)
        }
        if (!isLatest()) {
          return
        }
        const renderOpts = {
          minify: settings.getIn(['mjml', 'minify']),
          rootPath: options.rootPath,
        }

        dispatch(setEditorStatus({ isRendering: true }))
        const startedAt = performance.now()
        let result
        try {
          result = await mjml2html(content, fileName, mjmlPath, renderOpts)
        } finally {
          // a newer render shows its own status
          if (isLatest()) {
            const renderMs = Math.round(performance.now() - startedAt)
            dispatch(setEditorStatus({ isRendering: false, renderMs }))
          }
        }
        const { html, errors } = result
        if (!isLatest()) {
          return
        }
        dispatch(setPrev({ type: 'html', content: html, errors }))
        // update the preview in project
        if (bName === 'index.mjml') {
          dispatch(updateProjectPreview(fName, html))
        }
        break
      }
      default:
        dispatch(setPrev(null))
    }
  }
}
