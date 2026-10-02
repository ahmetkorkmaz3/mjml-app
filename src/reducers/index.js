import { combineReducers } from 'redux'

import settings from './settings'
import preview from './preview'
import modals from './modals'
import projects from './projects'
import alerts from './alerts'
import notifs from './notifs'
import error from './error'
import selectedProjects from './selectedProjects'
import externalFileOverlay from './externalFileOverlay'
import search from './search'
import snippets from './snippets'
import theme from './theme'
import editorStatus from './editorStatus'

const rootReducer = combineReducers({
  settings,
  preview,
  modals,
  alerts,
  notifs,
  projects,
  error,
  selectedProjects,
  externalFileOverlay,
  search,
  snippets,
  theme,
  editorStatus,
})

export default rootReducer
