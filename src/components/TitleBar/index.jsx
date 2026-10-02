import { useEffect, useState } from 'react'
import cx from 'classnames'

import api from 'helpers/api'

import './style.scss'

function useFullScreen() {
  const [isFullScreen, setIsFullScreen] = useState(false)
  useEffect(() => api.on('window-fullscreen', setIsFullScreen), [])
  return isFullScreen
}

// The top bar of each page. The empty parts drag the window (and a double
// click zooms it, the system does this). macOS: room on the left for the
// traffic lights. Windows/Linux: room on the right for the window buttons.
export default function TitleBar({ left, center, right, className }) {
  const isFullScreen = useFullScreen()
  return (
    <div className={cx('TitleBar', `TitleBar--${api.platform}`, className, { isFullScreen })}>
      <div className="TitleBar--left">{left}</div>
      <div className="TitleBar--center">{center}</div>
      <div className="TitleBar--right">{right}</div>
    </div>
  )
}
