import { handleActions } from 'redux-actions'
import { Map, List } from 'immutable'
import uniq from 'lodash/uniq'

const state = null

// the new path of p when the folder oldPath moves to newPath (subfolders included)
function movePath(p, oldPath, newPath) {
  if (p === oldPath) {
    return newPath
  }
  if (typeof p === 'string' && (p.startsWith(`${oldPath}/`) || p.startsWith(`${oldPath}\\`))) {
    return newPath + p.slice(oldPath.length)
  }
  return p
}

export default handleActions(
  {
    SETTINGS_LOAD_SUCCESS: (state, { payload }) => {
      return Map({
        lastOpenedFolder: payload.lastOpenedFolder,
        lastExportedFolder: payload.lastExportedFolder,
        projects: List(payload.projects),
        editor: Map(payload.editor),
        api: Map(payload.api),
        mjml: Map(payload.mjml),
        previewSize: Map(payload.previewSize),
        ai: Map(payload.ai),
        figma: Map(payload.figma),
        appearance: Map(payload.appearance),
        layout: Map(payload.layout),
        snippets: List(payload.snippets),
        templating: payload.templating,
      })
    },

    UPDATE_SETTINGS: (state, { payload: updater }) => updater(state),

    ADD_TO_LAST_USED_EMAILS: (state, { payload: emails }) => {
      const lastEmails = uniq([...state.getIn(['api', 'LastEmails']), ...emails])
      // console.log(lastEmails)
      // return state.setIn(['api', 'LastEmails'], [])
      return state.setIn(['api', 'LastEmails'], lastEmails)
    },

    REMOVE_FROM_LAST_USED_EMAILS: (state, { payload: email }) => {
      return state.updateIn(['api', 'LastEmails'], lastEmails => {
        return lastEmails.filter(e => e !== email)
      })
    },

    PROJECT_LOAD: (state, { payload: { path } }) =>
      state.update('projects', projects => {
        if (projects.includes(path)) {
          return projects
        }
        return projects.unshift(path)
      }),

    // the project that the user opened last is at the start of the list
    PROJECT_TOUCH: (state, { payload: path }) =>
      state.update('projects', projects =>
        projects.includes(path) ? projects.filter(p => p !== path).unshift(path) : projects,
      ),

    PROJECT_REMOVE: (state, { payload: path }) =>
      state.update('projects', projects => projects.filter(p => p !== path)),

    // the templating settings of the project follow it to the new path
    PROJECT_RENAME: (state, { payload: { oldPath, newPath } }) =>
      state
        .update('projects', projects =>
          projects.map(p => {
            if (p !== oldPath) {
              return p
            }
            return newPath
          }),
        )
        .update('templating', (templating = []) =>
          templating.map(t => {
            const projectPath = movePath(t.projectPath, oldPath, newPath)
            return projectPath === t.projectPath ? t : { ...t, projectPath }
          }),
        ),

    PROJECTS_REMOVE: (state, { payload: paths }) =>
      state.update('projects', projects => projects.filter(p => paths.indexOf(p) === -1)),

    SNIPPET_ADD: (state, { payload: { snippetName, snippetTrigger, snippetContent } }) =>
      state.update('snippets', snippets =>
        snippets.unshift({
          name: snippetName,
          trigger: snippetTrigger,
          content: snippetContent,
        }),
      ),

    SNIPPET_UPDATE: (state, { payload: { oldName, newName, newTrigger, newContent } }) =>
      state.update('snippets', snippets => {
        const index = snippets.findIndex(s => s.name === oldName)
        return snippets.set(index, {
          name: newName,
          trigger: newTrigger,
          content: newContent,
        })
      }),

    SNIPPET_DELETE: (state, { payload: { snippetName } }) =>
      state.update('snippets', snippets => {
        const index = snippets.findIndex(s => s.name === snippetName)
        return snippets.delete(index)
      }),
  },
  state,
)
