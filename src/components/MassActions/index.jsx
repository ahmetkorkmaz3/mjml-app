import { Component } from 'react'
import { connect } from 'react-redux'
import { MdKeyboardArrowDown as IconDown } from 'react-icons/md'

import {
  exportSelectedProjectsToHTML,
  exportSelectedProjectsAllFilesToHTML,
  exportSelectedProjectsToImages,
} from 'actions/projects'
import { updateSettings } from 'actions/settings'
import { unselectAllProjects } from 'reducers/selectedProjects'
import { showContextMenu } from 'helpers/contextMenu'

import Button from 'components/Button'

import './style.scss'

const SORT_LABELS = { recent: 'Last opened', name: 'Name', modified: 'Last modified' }

// The header of the projects list: the count and the sort, or the actions
// for the selected projects.
export default connect(
  state => ({
    projectsCount: state.projects ? state.projects.size : 0,
    selectedProjects: state.selectedProjects,
    sort: state.settings.getIn(['layout', 'projectSort'], 'recent'),
  }),
  {
    unselectAllProjects,
    updateSettings,
    exportSelectedProjectsToHTML,
    exportSelectedProjectsAllFilesToHTML,
    exportSelectedProjectsToImages,
  },
)(
  class MassActions extends Component {
    state = {
      isLoading: false,
    }

    handleExportToHTML = () => {
      this.props.exportSelectedProjectsToHTML()
      this.props.unselectAllProjects()
    }

    handleExportAllToHTML = () => {
      this.props.exportSelectedProjectsAllFilesToHTML()
      this.props.unselectAllProjects()
    }

    handleExportToImages = () => {
      this.setState({ isLoading: true })
      this.props.exportSelectedProjectsToImages(() => {
        this.setState({ isLoading: false })
        this.props.unselectAllProjects()
      })
    }

    handleSortMenu = async () => {
      const { sort, updateSettings } = this.props
      const id = await showContextMenu(
        Object.entries(SORT_LABELS).map(([value, label]) => ({
          id: value,
          label,
          checked: value === sort,
        })),
      )
      if (id) {
        updateSettings(s => s.setIn(['layout', 'projectSort'], id))
      }
    }

    render() {
      const { selectedProjects, unselectAllProjects, projectsCount, sort } = this.props
      const { isLoading } = this.state
      const selectedCount = selectedProjects.length

      return (
        <div className="HomeHeader">
          {selectedCount ? (
            <>
              <span className="HomeHeader--title">{`${selectedCount} selected`}</span>
              <Button size="sm" variant="secondary" onClick={this.handleExportToHTML}>
                {'Export Index to HTML'}
              </Button>
              <Button size="sm" variant="secondary" onClick={this.handleExportAllToHTML}>
                {'Export All Files'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isLoading}
                onClick={this.handleExportToImages}
              >
                {isLoading ? 'Exporting…' : 'Export Images'}
              </Button>
              <Button size="sm" variant="ghost" onClick={unselectAllProjects}>
                {'Clear'}
              </Button>
            </>
          ) : (
            <>
              <span className="HomeHeader--title">{'Recent projects'}</span>
              <span className="HomeHeader--count">{projectsCount}</span>
            </>
          )}
          <div className="fg-1" />
          <Button size="sm" variant="ghost" onClick={this.handleSortMenu}>
            {`Sort: ${SORT_LABELS[sort] || SORT_LABELS.recent}`}
            <IconDown size={14} />
          </Button>
        </div>
      )
    }
  },
)
