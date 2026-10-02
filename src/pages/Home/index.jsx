import { Component } from 'react'
import cx from 'classnames'

import { FaCog } from 'react-icons/fa'
import { MdCreateNewFolder as IconCreate, MdFileDownload as IconOpen } from 'react-icons/md'

import { connect } from 'react-redux'

import { addProject } from 'actions/projects'
import { openModal } from 'reducers/modals'

import Button from 'components/Button'
import MassActions from 'components/MassActions'
import ProjectsList from 'components/ProjectsList'
import GlobalSearch from 'components/GlobalSearch'
import TitleBar from 'components/TitleBar'

import './style.scss'

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
        <div className="fg-1 d-f fd-c">
          <TitleBar
            left={hasProjects && <GlobalSearch className="fg-1" />}
            right={
              <>
                <Button
                  ref={n => (this._newProjectBTN = n)}
                  primary
                  onClick={() => openModal('newProject')}
                >
                  <IconCreate size={20} className="mr-5" />
                  {'New project'}
                </Button>
                <Button ghost onClick={() => addProject()}>
                  <IconOpen size={20} className="mr-5" />
                  {'Open project'}
                </Button>
                <Button ghost onClick={() => openModal('settings')}>
                  <FaCog />
                </Button>
              </>
            }
          />

          {hasProjects && (
            <div className={cx('fg-1 d-f fd-c p-10 anim-enter-fade')}>
              <MassActions />
              <div className="fg-1 r mt-20">
                <ProjectsList />
              </div>
            </div>
          )}
        </div>
      )
    }
  },
)
