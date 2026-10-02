import cx from 'classnames'

import './style.scss'

export default function AppPlaceholder({ show }) {
  return <div className={cx('AppPlaceholder sticky z', { isVisible: show })} />
}
