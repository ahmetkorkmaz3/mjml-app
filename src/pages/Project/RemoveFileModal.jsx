import { Component } from 'react'
import { path } from 'helpers/api'
import { connect } from 'react-redux'

import { isModalOpened, getModalProps, closeModal } from 'reducers/modals'

import ConfirmModal from 'components/Modal/ConfirmModal'

export default connect(
  state => {
    return {
      isOpened: isModalOpened(state, 'removeFile'),
      modalProps: getModalProps(state, 'removeFile'),
    }
  },
  {
    closeModal,
  },
)(
  class RemoveFileModal extends Component {
    handleClose = () => this.props.closeModal('removeFile')

    render() {
      const { isOpened, onRemove, rootPath, modalProps: file } = this.props

      const full = file ? path.join(rootPath, file.name) : ''

      return (
        <ConfirmModal
          isOpened={isOpened}
          danger
          yepCTA="Move to Trash"
          nopCTA="Cancel"
          onCancel={this.handleClose}
          onConfirm={() => {
            onRemove(full)
            window.requestIdleCallback(this.handleClose)
          }}
        >
          <h2 className="mb-10">{`Move “${file ? file.name : ''}” to the trash?`}</h2>
          <p className="t-small">{'You can get the file back from the trash.'}</p>
        </ConfirmModal>
      )
    }
  },
)
