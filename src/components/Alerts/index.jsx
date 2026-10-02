import { createPortal } from 'react-dom'
import cx from 'classnames'
import { connect } from 'react-redux'
import {
  MdCheckCircle as IconSuccess,
  MdError as IconError,
  MdInfo as IconInfo,
  MdClose as IconClose,
} from 'react-icons/md'

import { removeAlert } from 'reducers/alerts'

import './style.scss'

const ICONS = { success: IconSuccess, error: IconError, info: IconInfo }

function Alerts({ alerts, removeAlert }) {
  return createPortal(
    <div className="Alerts" role="status" aria-live="polite">
      {alerts.map(a => {
        const Icon = ICONS[a.type] || IconInfo
        return (
          <div key={a.id} className={cx('Alerts--item', a.type)}>
            <Icon className="Alerts--icon" size={16} />
            <div className="Alerts--message us-t">
              {Array.isArray(a.message)
                ? a.message.map((line, i) => <div key={i}>{line}</div>)
                : a.message}
            </div>
            <button
              type="button"
              className="Alerts--close"
              aria-label="Close"
              onClick={() => removeAlert(a.id)}
            >
              <IconClose size={14} />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}

export default connect(
  state => ({
    alerts: state.alerts,
  }),
  {
    removeAlert,
  },
)(Alerts)
