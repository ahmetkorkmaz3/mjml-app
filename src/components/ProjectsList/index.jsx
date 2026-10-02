import { Component } from 'react'
import { connect } from 'react-redux'

import api from 'helpers/api'
import { showContextMenu } from 'helpers/contextMenu'
import { nextSelection, sortProjects } from 'helpers/projects'
import { openProject, removeProject, renameProject, duplicateProject } from 'actions/projects'

import {
  setSelectedProjects,
  selectAllProjects,
  unselectAllProjects,
} from 'reducers/selectedProjects'

import CheckBox from 'components/CheckBox'
import ConfirmModal from 'components/Modal/ConfirmModal'

import RenameModal from './RenameModal'
import ProjectItem from './ProjectItem'

import './style.scss'

const HOME_DIR = api.homedir
const REVEAL_LABEL = api.platform === 'darwin' ? 'Reveal in Finder' : 'Show in File Manager'

export default connect(
  state => ({
    projects: state.projects,
    selectedProjects: state.selectedProjects,
    search: state.search,
    sort: state.settings.getIn(['layout', 'projectSort'], 'recent'),
  }),
  {
    openProject,
    removeProject,
    renameProject,
    duplicateProject,
    setSelectedProjects,
    selectAllProjects,
    unselectAllProjects,
  },
)(
  class ProjectsList extends Component {
    state = {
      activePath: null,
      anchor: null,
      isDeleteModalOpened: false,
      isRenameModalOpened: false,
      shouldDeleteFolder: false,
    }

    componentWillUnmount() {
      this._isUnmounted = true
    }

    getVisibleProjects() {
      const { projects, search, sort } = this.props
      const { text, results } = search
      const list = (text ? projects.filter(p => results.has(p.get('path'))) : projects).toJS()
      return sortProjects(list, sort)
    }

    handleClick = (e, projectPath, ordered) => {
      const { selected, anchor } = nextSelection({
        selected: this.props.selectedProjects,
        clicked: projectPath,
        ordered,
        anchor: this.state.anchor,
        meta: e.metaKey || e.ctrlKey,
        shift: e.shiftKey,
      })
      this.props.setSelectedProjects(selected)
      this.safeSetState({ anchor })
    }

    handleContextMenu = async (e, projectPath) => {
      e.preventDefault()
      if (!this.props.selectedProjects.includes(projectPath)) {
        this.props.setSelectedProjects([projectPath])
        this.safeSetState({ anchor: projectPath })
      }
      const id = await showContextMenu([
        { id: 'open', label: 'Open' },
        { id: 'reveal', label: REVEAL_LABEL },
        { type: 'separator' },
        { id: 'rename', label: 'Rename…' },
        { id: 'duplicate', label: 'Duplicate' },
        { type: 'separator' },
        { id: 'remove', label: 'Remove from List…' },
      ])
      if (id === 'open') this.props.openProject(projectPath)
      if (id === 'reveal') api.shell.showItemInFolder(projectPath)
      if (id === 'rename') this.safeSetState({ activePath: projectPath, isRenameModalOpened: true })
      if (id === 'duplicate') this.props.duplicateProject(projectPath)
      if (id === 'remove') this.safeSetState({ activePath: projectPath, isDeleteModalOpened: true })
    }

    handleGridClick = e => {
      if (e.target === e.currentTarget) {
        this.props.unselectAllProjects()
      }
    }

    handleGridKeyDown = e => {
      if (e.key === 'a' && (e.metaKey || e.ctrlKey) && e.target.tagName !== 'INPUT') {
        e.preventDefault()
        this.props.selectAllProjects()
      } else if (e.key === 'Escape') {
        this.props.unselectAllProjects()
      }
    }

    handleConfirmRemove = () => {
      const { activePath, shouldDeleteFolder } = this.state
      const { removeProject } = this.props
      const isHome = activePath === HOME_DIR
      removeProject(activePath, isHome ? false : shouldDeleteFolder)
      this.props.unselectAllProjects()
      this.handleCloseDeleteModal()
    }

    handleCloseDeleteModal = () =>
      this.safeSetState({
        activePath: null,
        isDeleteModalOpened: false,
      })

    handleChangeShouldDelete = shouldDeleteFolder => this.setState({ shouldDeleteFolder })

    handleCloseRenameModal = () =>
      this.safeSetState({
        activePath: null,
        isRenameModalOpened: false,
      })

    handleRename = newPath => {
      this.props.renameProject(this.state.activePath, newPath)
      this.props.unselectAllProjects()
      this.handleCloseRenameModal()
    }

    safeSetState = (...args) => {
      if (this._isUnmounted) {
        return
      }
      this.setState(...args)
    }

    render() {
      const { openProject, selectedProjects, search } = this.props

      const { isDeleteModalOpened, isRenameModalOpened, shouldDeleteFolder, activePath } =
        this.state

      const isHome = activePath === HOME_DIR

      const visible = this.getVisibleProjects()
      const ordered = visible.map(p => p.path)

      return (
        <div
          className="ProjectsList"
          onClick={this.handleGridClick}
          onKeyDown={this.handleGridKeyDown}
        >
          {visible.map(project => (
            <ProjectItem
              key={project.path}
              project={project}
              isSelected={selectedProjects.includes(project.path)}
              onClick={e => this.handleClick(e, project.path, ordered)}
              onOpen={() => openProject(project.path)}
              onContextMenu={e => this.handleContextMenu(e, project.path)}
            />
          ))}
          {!!search.text && !visible.length && (
            <div className="ProjectsList--no-match">{`No projects match “${search.text}”`}</div>
          )}
          <ConfirmModal
            isOpened={isDeleteModalOpened}
            danger={shouldDeleteFolder}
            yepCTA={shouldDeleteFolder ? 'Remove and Move to Trash' : 'Remove from List'}
            nopCTA="Cancel"
            onCancel={this.handleCloseDeleteModal}
            onConfirm={this.handleConfirmRemove}
          >
            <h2 className="mb-10">{'Remove the project from the list?'}</h2>
            {!isHome && (
              <CheckBox value={shouldDeleteFolder} onChange={this.handleChangeShouldDelete}>
                {'Also move the folder and its files to the trash'}
              </CheckBox>
            )}
          </ConfirmModal>
          <RenameModal
            isOpened={isRenameModalOpened}
            path={activePath}
            onCancel={this.handleCloseRenameModal}
            onConfirm={this.handleRename}
          />
        </div>
      )
    }
  },
)
