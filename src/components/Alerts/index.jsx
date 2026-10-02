import { createPortal } from 'react-dom'
import cx from 'classnames'
import { connect } from 'react-redux'
import { MdError as IconError } from 'react-icons/md'

import { removeAlert } from 'reducers/alerts'

import './style.scss'

function Alerts({ alerts, removeAlert }) {
  return createPortal(
    <div className="Alerts">
      {alerts.map(a => (
        <div
          key={a.id}
          onClick={() => removeAlert(a.id)}
          className={cx('Alerts--item d-f ai-c', a.type)}
        >
          {a.type === 'error' && <IconError className="mr-10 fs-0" size={30} />}
          <div>
            {Array.isArray(a.message)
              ? a.message.map((line, i) => <div key={i}>{line}</div>)
              : a.message}
          </div>
        </div>
      ))}
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
