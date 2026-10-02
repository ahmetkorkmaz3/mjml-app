import { useEffect, useState } from 'react'
import cx from 'classnames'
import { MdMenu as IconMenu } from 'react-icons/md'

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
      <div className="TitleBar--left">
        {api.platform !== 'darwin' && (
          <button
            type="button"
            className="TitleBar--menu"
            aria-label="Menu"
            data-tooltip="Menu"
            onClick={() => api.menu.popupApp().catch(err => console.error(err))}
          >
            <IconMenu size={18} />
          </button>
        )}
        {left}
      </div>
      <div className="TitleBar--center">{center}</div>
      <div className="TitleBar--right">{right}</div>
    </div>
  )
}
