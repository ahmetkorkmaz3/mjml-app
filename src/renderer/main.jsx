import { createRoot } from 'react-dom/client'

import createStore from 'store'
import api from 'helpers/api'
import { loadSettings } from 'actions/settings'
import { loadProjects, addProject, openExternalFile } from 'actions/projects'

import Root from 'components/Root'

import { openModal } from 'reducers/modals'

import 'styles/global.scss'
import 'styles/utils.scss'

// the first frame uses the theme that the main process resolved
document.documentElement.dataset.theme = api.initialTheme
document.documentElement.dataset.platform = api.platform

const store = createStore()
const { dispatch } = store

createRoot(document.getElementById('app')).render(<Root store={store} />)

async function boot() {
  await dispatch(loadSettings())
  await dispatch(loadProjects())
}

boot()

// handle menu actions
api.on('redux-command', message => {
  if (message === 'about') {
    dispatch(openModal('about'))
  }
  if (message === 'new-project') {
    dispatch(openModal('newProject'))
  }
  if (message === 'open-project') {
    dispatch(addProject())
  }
})

api.on('openPath', openPath => {
  dispatch(openExternalFile(openPath))
})
