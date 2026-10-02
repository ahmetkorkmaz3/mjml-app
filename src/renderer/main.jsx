import { createRoot } from 'react-dom/client'

import createStore from 'store'
import api from 'helpers/api'
import { loadSettings, updateSettings } from 'actions/settings'
import { registerCommand, runCommand } from 'helpers/commands'
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

// the commands of the menu that work on each page
registerCommand('about', () => dispatch(openModal('about')))
registerCommand('settings', () => dispatch(openModal('settings')))
registerCommand('new-project', () => dispatch(openModal('newProject')))
registerCommand('open-project', () => dispatch(addProject()))
for (const theme of ['system', 'light', 'dark']) {
  registerCommand(`theme-${theme}`, () =>
    dispatch(updateSettings(s => s.setIn(['appearance', 'theme'], theme))),
  )
}

api.on('redux-command', command => runCommand(command))

api.on('openPath', openPath => {
  dispatch(openExternalFile(openPath))
})
