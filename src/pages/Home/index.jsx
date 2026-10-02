import { Component } from 'react'
import { connect } from 'react-redux'
import { MdAdd as IconAdd, MdSettings as IconSettings } from 'react-icons/md'

import api from 'helpers/api'
import { formatShortcut } from 'helpers/shortcut'
import { addProject } from 'actions/projects'
import { openModal } from 'reducers/modals'

import Button from 'components/Button'
import MassActions from 'components/MassActions'
import ProjectsList from 'components/ProjectsList'
import GlobalSearch from 'components/GlobalSearch'
import TitleBar from 'components/TitleBar'
import PageCommands from 'components/PageCommands'

import EmptyState from './EmptyState'

import './style.scss'

const shortcut = accelerator => formatShortcut(accelerator, api.platform)

const HOME_CONTEXT = { page: 'home', hasMjmlFile: false, hasPreview: false, preventAutoSave: false }

const HOME_COMMANDS = {
  find: () => {
    const input = document.querySelector('.GlobalSearch--input')
    if (input) input.focus()
  },
}

export default connect(
  state => ({
    projects: state.settings.get('projects'),
  }),
  {
    addProject,
    openModal,
  },
)(
  class HomePage extends Component {
    componentDidMount() {
      if (this.props.projects.size === 0 && this._newProjectBTN) {
        this._newProjectBTN.focus()
      }
    }

    render() {
      const { addProject, openModal, projects } = this.props

      const hasProjects = !!projects.size

      return (
        <div className="HomePage">
          <PageCommands commands={HOME_COMMANDS} context={HOME_CONTEXT} />
          <TitleBar
            left={<span className="HomePage--app-name">{'MJML'}</span>}
            center={hasProjects && <GlobalSearch />}
            right={
              <>
                <Button
                  variant="ghost"
                  onClick={() => addProject()}
                  data-tooltip={`Open project (${shortcut('CmdOrCtrl+O')})`}
                >
                  {'Open…'}
                </Button>
                <Button variant="primary" onClick={() => openModal('newProject')}>
                  <IconAdd size={16} />
                  {'New Project'}
                </Button>
                <Button
                  variant="ghost"
                  icon
                  aria-label="Settings"
                  data-tooltip={`Settings (${shortcut('CmdOrCtrl+,')})`}
                  onClick={() => openModal('settings')}
                >
                  <IconSettings size={16} />
                </Button>
              </>
            }
          />

          {hasProjects ? (
            <div className="HomePage--content anim-enter-fade">
              <MassActions />
              <ProjectsList />
            </div>
          ) : (
            <EmptyState
              newButtonRef={n => (this._newProjectBTN = n)}
              onNew={() => openModal('newProject')}
              onOpen={() => addProject()}
            />
          )}
        </div>
      )
    }
  },
)
