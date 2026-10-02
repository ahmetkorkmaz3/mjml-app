import { Component } from 'react'
import debounce from 'lodash/debounce'
import { path as pathModule } from 'helpers/api'

import {
  MdCheckCircle as IconCheck,
  MdAutorenew as IconChecking,
  MdError as IconError,
} from 'react-icons/md'

import { alreadyExists } from 'helpers/fs'

import ConfirmModal from 'components/Modal/ConfirmModal'

import { getProjectNameError } from './projectName'

const EXISTS_ERROR = 'A file or folder with this name already exists'

class RenameModal extends Component {
  state = {
    newName: '',
    oldName: '',
    // unset / checking / valid / invalid
    projectLocStatus: 'unset',
    nameError: null,
  }

  componentDidUpdate(prevProps) {
    if (this.props.isOpened && !prevProps.isOpened) {
      this.setState({
        newName: pathModule.basename(this.props.path),
        oldName: pathModule.basename(this.props.path),
        projectLocStatus: 'unset',
        nameError: null,
      })
      this._inputName && this._inputName.focus()
    }
  }

  handleConfirm = e => {
    e && e.preventDefault()

    const { newName, projectLocStatus } = this.state

    if (projectLocStatus !== 'valid') {
      return
    }

    const { path } = this.props

    if (!path || getProjectNameError(newName)) {
      return
    }

    this.props.onConfirm(pathModule.join(pathModule.dirname(path), newName.trim()))
  }

  handleChangeNewName = e => {
    const newName = e.target.value
    const nameError = newName ? getProjectNameError(newName) : null
    this.setState({
      newName,
      nameError,
      projectLocStatus: !newName ? 'unset' : nameError ? 'invalid' : 'checking',
    })
    if (newName && !nameError) {
      this.debounceCheckName()
    }
  }

  debounceCheckName = debounce(async () => {
    const { path } = this.props
    const { newName } = this.state
    if (!newName || !path) {
      return this.setState({
        projectLocStatus: 'unset',
      })
    }
    const nameError = getProjectNameError(newName)
    if (nameError) {
      return this.setState({ projectLocStatus: 'invalid', nameError })
    }
    const full = pathModule.join(pathModule.dirname(path), newName.trim())
    const exists = await alreadyExists(full)
    // the name can change while the check runs
    if (this.state.newName !== newName) {
      return
    }
    this.setState({
      projectLocStatus: exists ? 'invalid' : 'valid',
      nameError: exists ? EXISTS_ERROR : null,
    })
  }, 250)

  render() {
    const { isOpened, onCancel, path } = this.props

    const { newName, oldName, projectLocStatus, nameError } = this.state

    const hasChanged = newName.trim() !== oldName
    const dir = path ? pathModule.dirname(path) : null
    const fullPath =
      newName && dir && !getProjectNameError(newName) ? pathModule.join(dir, newName.trim()) : null

    return (
      <ConfirmModal
        isOpened={isOpened}
        yepCTA={'Rename project'}
        nopCTA="Cancel"
        onCancel={onCancel}
        onConfirm={this.handleConfirm}
        isConfirmDisabled={!hasChanged || !newName || projectLocStatus !== 'valid'}
      >
        <form onSubmit={this.handleConfirm}>
          <h2 className="mb-20">{'Rename project'}</h2>
          <div className="flow-v-20">
            <div className="d-f ai-b">
              <div style={{ width: 150 }} className="fs-0">
                {'New name:'}
              </div>
              <div className="fg-1">
                <input
                  style={{ width: '100%' }}
                  ref={n => (this._inputName = n)}
                  className="fg-1"
                  value={newName}
                  onChange={this.handleChangeNewName}
                  placeholder="New name"
                  type="text"
                />
                {fullPath && (
                  <div className="mt-10 t-small">
                    {'Project will be renamed to: '}
                    <b className="wb-ba">{fullPath}</b>
                  </div>
                )}
                {projectLocStatus === 'checking' && (
                  <div className="t-small mt-10">
                    <IconChecking className="rotating mr-5" />
                    {'Checking...'}
                  </div>
                )}
                {projectLocStatus === 'valid' && (
                  <div className="t-small mt-10 c-green">
                    <IconCheck className="mr-5" />
                    {'Location is OK'}
                  </div>
                )}
                {projectLocStatus === 'invalid' && (
                  <div className="t-small mt-10 c-red">
                    <IconError className="mr-5" />
                    {nameError || EXISTS_ERROR}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </ConfirmModal>
    )
  }
}

export default RenameModal
