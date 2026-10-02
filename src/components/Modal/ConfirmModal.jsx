import { Component } from 'react'
import cx from 'classnames'

import Button from 'components/Button'
import Modal from './index'

class ConfirmModal extends Component {
  static defaultProps = {
    yepCTA: 'Yes',
    nopCTA: 'No',
    size: 'sm',
  }

  render() {
    const {
      yepCTA,
      nopCTA,
      onConfirm,
      onCancel,
      isConfirmDisabled,
      danger,
      className,
      children,
      ...props
    } = this.props

    return (
      <Modal {...props} className={cx('Modal-confirm', className)} onClose={onCancel}>
        {children}
        <div className="ModalFooter">
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={isConfirmDisabled}
          >
            {yepCTA}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            {nopCTA}
          </Button>
        </div>
      </Modal>
    )
  }
}

export default ConfirmModal
