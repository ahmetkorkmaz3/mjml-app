import { useState } from 'react'
import cx from 'classnames'
import { connect } from 'react-redux'
import { Outlet, useLocation } from 'react-router'

import api from 'helpers/api'
import { dropFile } from 'actions/projects'

import Alerts from 'components/Alerts'
import NewProjectModal from 'components/NewProjectModal'
import SettingsModal from 'components/SettingsModal'
import ErrorModal from 'components/ErrorModal'
import AboutModal from 'components/AboutModal'
import ExternalFileOverlay from 'components/ExternalFileOverlay'

import Placeholder from './Placeholder'
import DropFile from './DropFile'

import './style.scss'

function Application({ projects, settings, dropFile }) {
  const [isOver, setIsOver] = useState(false)
  const { pathname } = useLocation()

  const handleDragLeave = () => setIsOver(false)

  const handleDrop = e => {
    e.preventDefault()
    handleDragLeave()
    if (!e.dataTransfer.files || !e.dataTransfer.files.length) {
      return
    }
    const fileName = api.getPathForFile(e.dataTransfer.files[0])
    if (fileName) {
      dropFile(fileName)
    }
  }

  const handleDragOver = e => {
    e.preventDefault()
    if (!isOver) {
      setIsOver(true)
    }
  }

  return (
    <div
      className={cx('Application', {
        'bg-dark': pathname === '/',
        'bg-darker': pathname === '/project',
        isOver,
      })}
      onDragOver={handleDragOver}
    >
      <DropFile
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        isVisible={isOver}
      />

      <ExternalFileOverlay />

      <Placeholder show={!projects} />
      {projects && <Outlet />}

      {settings && <SettingsModal />}
      {settings && <NewProjectModal />}

      <ErrorModal />
      <AboutModal />
      <Alerts />
    </div>
  )
}

export default connect(
  state => ({
    projects: state.projects,
    settings: state.settings,
  }),
  {
    dropFile,
  },
)(Application)
