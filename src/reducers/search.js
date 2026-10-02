import { handleActions, createAction } from 'redux-actions'
import { Set } from 'immutable'
import Fuse from 'fuse.js'

const FUSE_OPTS = {
  keys: ['name'],
  threshold: 0.5,
}

const state = {
  text: '',
  raw: [],
  results: Set(),
  fuse: null,
}

function compileResults(fuse, text) {
  const fuseResults = fuse.search(text) || []
  return Set(fuseResults.map(({ item }) => item.path))
}

// the index is built again each time the list of projects changes
function resetSearch(state) {
  const { raw, text } = state
  const fuse = new Fuse(raw, FUSE_OPTS)
  return {
    ...state,
    fuse,
    results: compileResults(fuse, text),
  }
}

// no helpers/api here, so the reducer runs in the tests
function baseName(p) {
  return p.split(/[\\/]/).pop()
}

function serializeRaw(raw) {
  return {
    path: raw.path,
    name: baseName(raw.path),
  }
}

export default handleActions(
  {
    PROJECTS_LOAD: (state, { payload: projects }) =>
      resetSearch({
        ...state,
        raw: projects.map(serializeRaw),
      }),
    PROJECT_LOAD: (state, { payload: project }) =>
      resetSearch({
        ...state,
        raw: [serializeRaw(project), ...state.raw],
      }),
    PROJECT_RENAME: (state, { payload: { oldPath, newPath } }) =>
      resetSearch({
        ...state,
        raw: state.raw.map(r => (r.path === oldPath ? serializeRaw({ path: newPath }) : r)),
      }),
    PROJECT_REMOVE: (state, { payload: p }) =>
      resetSearch({
        ...state,
        raw: state.raw.filter(r => r.path !== p),
      }),
    PROJECTS_REMOVE: (state, { payload: paths }) =>
      resetSearch({
        ...state,
        raw: state.raw.filter(r => !paths.includes(r.path)),
      }),
    SEARCH: (state, { payload: text }) => {
      return {
        ...state,
        text,
        results: compileResults(state.fuse, text),
      }
    },
  },
  state,
)

export const searchText = createAction('SEARCH', text => text)
