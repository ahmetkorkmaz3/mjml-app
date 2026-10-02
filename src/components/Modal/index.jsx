import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import cx from 'classnames'

import useTransition from './useTransition'

import './style.scss'

export default function Modal({ isOpened, onClose, children, className, style, noUI }) {
  const { isMounted, isVisible } = useTransition(isOpened)
  const bodyRef = useRef(null)

  useEffect(() => {
    if (isOpened && isMounted && bodyRef.current) {
      bodyRef.current.focus()
    }
  }, [isOpened, isMounted])

  useEffect(() => {
    if (!isOpened || !onClose) {
      return
    }
    const handleKeyDown = e => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpened, onClose])

  if (!isMounted) {
    return null
  }

  return createPortal(
    <div className={cx('Modal', { withUI: !noUI, isVisible })}>
      <div className="Modal--overlay" onClick={onClose} />
      <div className="Modal-box">
        <div tabIndex={0} ref={bodyRef} className={cx('Modal--body', className)} style={style}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
